/**
 * Construction du contexte pédagogique envoyé au tuteur.
 *
 * Point important : la fonction renvoie aussi le MANIFESTE de ce qui a été
 * réellement inclus. L'interface affiche ce manifeste tel quel, pour ne jamais
 * laisser croire que l'IA « se souvient » de plus qu'elle n'a reçu
 * (cahier des charges : ne pas afficher de fausses informations sur la mémoire
 * de l'IA).
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import type { Contexte } from "@/lib/store/context";
import type { Referentiel } from "@/lib/domain/types";
import { formatDateCourte } from "@/lib/engine/dates";
import { MARQUEUR_EXERCICE, MARQUEUR_PREUVE, MARQUEUR_REFERENTIEL } from "./proposition";

const RACINE_DATA = path.join(process.cwd(), "data");

/**
 * Fichiers de protocole toujours chargés, dans l'ordre où ils sont empilés.
 * Placés avant `CONSIGNES_INTERFACE` pour que ce préfixe reste identique
 * d'un tour à l'autre (préfixe stable pour le cache `ephemeral` d'Anthropic,
 * `moteurs/anthropic.ts`), que le protocole d'évaluation complet soit ajouté
 * ensuite ou non (ADR-021).
 */
const PROTOCOLES = [
  { fichier: "00_instructions/00_SYSTEME_INSTRUCTIONS_PRINCIPALES.txt", nom: "Instructions principales" },
  {
    fichier: "00_instructions/00_SYSTEME_PROTOCOLE_EVALUATION_CORE.txt",
    nom: "Protocole d'évaluation (essentiel)",
  },
  {
    fichier: "00_instructions/00_SYSTEME_PROTOCOLE_ANTI_HALLUCINATION.txt",
    nom: "Protocole anti-hallucination",
  },
];

/**
 * Reste du protocole d'évaluation (§12-17 : score macro, robustesse,
 * synthèse périodique, priorisation, format de bilan) — chargé seulement
 * quand un bilan est probable (ADR-021). §1-11, nécessaires à chaque
 * proposition de preuve, restent dans le fichier toujours chargé ci-dessus.
 */
const PROTOCOLE_EVALUATION_SYNTHESE = {
  fichier: "00_instructions/00_SYSTEME_PROTOCOLE_EVALUATION_SYNTHESE.txt",
  nom: "Protocole d'évaluation (complet)",
};

/**
 * Charte de rédaction d'une compétence (ADR-026) — chargée seulement quand la
 * conversation porte sur le référentiel.
 *
 * Même arbitrage qu'ADR-021 : le contexte tourne autour de 28 Ko dominés par
 * 20 Ko de protocole, et les moteurs gratuits ont de petites fenêtres. Ces
 * 6 Ko ne servent à rien quand l'utilisateur travaille un exercice.
 *
 * Exception : un compte SANS référentiel le reçoit toujours. C'est sa seule
 * conversation possible, et la faire dépendre d'un mot-clé reviendrait à
 * laisser le tuteur improviser l'amorçage — le moment où il improviserait le
 * plus coûteusement, puisque tout le reste en découle.
 */
const PROTOCOLE_REFERENTIEL = {
  fichier: "00_instructions/00_SYSTEME_PROTOCOLE_REFERENTIEL.txt",
  nom: "Protocole de construction du référentiel",
};

const MOTS_CLES_REFERENTIEL = [
  "referentiel",
  "competence",
  "domaine",
  "branche",
  "ajouter",
  "nouveau sujet",
  "travailler sur",
  "apprendre",
  "me lancer",
  "commencer",
];

const MOTS_CLES_SYNTHESE = [
  "bilan",
  "synthese",
  "resume",
  "point d'etape",
  "ou j'en suis",
  "priorite",
  "prochaine etape",
];

/** Au-delà de cette cadence, le protocole complet revient même sans mot-clé
 * reconnu — filet de sécurité contre une formulation non prévue par la liste
 * ci-dessus qui priverait durablement le tuteur du protocole complet. */
const CADENCE_SYNTHESE = 5;

function normaliser(texte: string): string {
  return texte
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Décide si le protocole d'évaluation complet (§12-17) doit être chargé ce
 * tour-ci, à partir du dernier message utilisateur et du nombre de tours.
 * Fonction pure et testable — pas d'appel LLM supplémentaire (le coût et la
 * latence annuleraient le gain de tokens visé).
 */
export function fautChargerSyntheseEvaluation(dernierMessage: string, nombreDeTours: number): boolean {
  if (nombreDeTours > 0 && nombreDeTours % CADENCE_SYNTHESE === 0) return true;
  const normalise = normaliser(dernierMessage);
  return MOTS_CLES_SYNTHESE.some((mot) => normalise.includes(mot));
}

/**
 * Décide si la charte du référentiel doit être chargée ce tour-ci.
 *
 * Pure et testable, comme `fautChargerSyntheseEvaluation`. `referentielVide`
 * l'emporte sur tout : sans compétence, il n'y a pas d'autre conversation à
 * avoir.
 */
export function fautChargerProtocoleReferentiel(
  dernierMessage: string,
  referentielVide: boolean,
): boolean {
  if (referentielVide) return true;
  const normalise = normaliser(dernierMessage);
  return MOTS_CLES_REFERENTIEL.some((mot) => normalise.includes(mot));
}

export interface SectionContexte {
  nom: string;
  caracteres: number;
  origine: "fichier" | "calcule";
}

export interface ContextePedagogique {
  /** Bloc stable : protocoles. Mis en cache par l'API. */
  systemeStable: string;
  /** Bloc variable : profil courant dérivé des preuves. */
  systemeProfil: string;
  manifeste: SectionContexte[];
  /** Estimation grossière, annoncée comme telle dans l'interface. */
  caracteresTotal: number;
}

async function lireFichier(relatif: string): Promise<string | null> {
  try {
    return await fs.readFile(path.join(RACINE_DATA, relatif), "utf8");
  } catch {
    return null;
  }
}

/**
 * Sérialise l'état des compétences pour le tuteur.
 *
 * Chaque ligne porte le niveau, la confiance, la robustesse et le nombre de
 * preuves — de sorte que le tuteur puisse raisonner sur la fiabilité de
 * l'évaluation et non seulement sur le niveau affiché.
 */
function serialiserProfil(ctx: Contexte): string {
  const lignes: string[] = [];

  lignes.push("# ÉTAT COURANT DU PROFIL (calculé à partir du journal de preuves)");
  lignes.push("");
  lignes.push(`Date : ${formatDateCourte(ctx.now.toISOString())}`);

  // Compte neuf : il n'y a pas de profil à sérialiser, et un tableau vide se
  // lirait comme « mesuré et trouvé nul ». On dit ce qui est, et on donne au
  // tuteur sa tâche du moment — construire le référentiel avec l'utilisateur.
  if (ctx.referentiel.skills.length === 0) {
    lignes.push("");
    lignes.push("## AUCUN RÉFÉRENTIEL");
    lignes.push("");
    lignes.push(
      "Ce compte n'a encore aucun domaine ni aucune compétence : il n'y a rien à mesurer, et aucun niveau ne peut être discuté.",
    );
    lignes.push(
      "Ta tâche est de construire ce référentiel AVEC l'utilisateur, pas de le deviner. Interroge-le d'abord sur ce qu'il veut savoir faire et dans quel but ; propose ensuite une première branche par un bloc PROPOSITION DE RÉFÉRENTIEL.",
    );
    lignes.push(
      "Ne propose ni preuve ni exercice tant qu'aucune compétence n'existe : ils n'auraient rien à quoi se rattacher.",
    );
    lignes.push("");
    lignes.push(`Formation déclarée : ${ctx.donnees.user.formation}`);
    lignes.push(`Objectif à moyen terme : ${ctx.donnees.user.objectifMoyenTerme}`);
    lignes.push(`Objectif à long terme : ${ctx.donnees.user.objectifLongTerme}`);
    return lignes.join("\n");
  }

  lignes.push(
    `Progression globale : ${
      ctx.global.scoreGlobal === null ? "non calculable (aucune preuve)" : `${ctx.global.scoreGlobal}/100`
    } · confiance ${ctx.global.confiance}`,
  );
  lignes.push(
    `Couverture : ${ctx.global.competencesEvaluees}/${ctx.global.competencesTotal} compétences évaluées · ${ctx.global.nombrePreuves} preuve(s) directe(s)`,
  );
  lignes.push(
    "Périmètre de travail : seules les compétences listées ci-dessous sont suivies. N'emploie aucun autre code dans une proposition de preuve ou d'exercice — il serait rejeté. Pour en ajouter une, passe par un bloc PROPOSITION DE RÉFÉRENTIEL, que l'utilisateur validera.",
  );
  lignes.push("");

  const prefs = ctx.donnees.user.preferencesPedagogiques ?? [];
  if (prefs.length > 0) {
    lignes.push("## PRÉFÉRENCES PÉDAGOGIQUES DÉCLARÉES (à respecter)");
    for (const p of prefs) lignes.push(`- ${p}`);
    lignes.push("");
  }

  // Les étiquettes de colonne sont données UNE fois plutôt que répétées sur
  // chaque ligne : même information, plusieurs milliers de caractères de moins
  // dans le contexte envoyé au modèle.
  lignes.push(
    "Colonnes : code | niveau/5 | score/5 | confiance | robustesse | preuves/contextes | jours depuis la dernière preuve | intitulé",
  );
  lignes.push(
    "« — » = aucune preuve, donc aucune valeur dérivable (ce n'est pas un zéro). Le suffixe « ?D » marque une hypothèse BUT QLIO non vérifiée, de niveau de preuve D.",
  );
  lignes.push("« ⚠n » = n preuve(s) contradictoire(s) conservée(s) : confiance réduite, niveau maintenu.");
  lignes.push("");

  // Seuls les domaines du périmètre actif : un en-tête suivi de rien laisserait
  // croire que le domaine a été mesuré et trouvé vide.
  const domainesActifs = ctx.referentiel.domaines.filter((d) =>
    ctx.etats.some((e) => e.skill.domaine === d.id),
  );
  for (const domaine of domainesActifs) {
    const etats = ctx.etats.filter((e) => e.skill.domaine === domaine.id);
    lignes.push(`## ${domaine.nom.toUpperCase()}`);
    for (const e of etats) {
      if (e.preuves.length === 0) {
        const hyp = e.skill.hypotheseInitiale ? " ?D" : "";
        lignes.push(`${e.skill.code} | —${hyp} | ${e.skill.intitule}`);
        continue;
      }
      const contra = e.contradictions.length > 0 ? ` ⚠${e.contradictions.length}` : "";
      lignes.push(
        `${e.skill.code} | ${e.niveau} | ${e.score?.toFixed(1)} | ${e.confiance} | ${e.robustesse?.toFixed(
          2,
        )} | ${e.preuves.length}/${e.contextesTestes.length} | ${e.joursDepuisDernierePreuve}j${contra} | ${
          e.skill.intitule
        }`,
      );
    }
    lignes.push("");
  }

  return lignes.join("\n");
}

function serialiserRecent(ctx: Contexte): string {
  const recentes = [...ctx.donnees.evidence]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 12);
  if (recentes.length === 0) {
    return "# TRAVAIL RÉCENT\n\nAucune séance enregistrée.";
  }
  // Le libellé de l'autonomie (« A3 — Résolution autonome ») n'est pas répété
  // ici : le protocole d'évaluation §5, déjà dans le contexte, les définit.
  const lignes = [
    "# TRAVAIL RÉCENT (12 dernières preuves)",
    "",
    "Colonnes : date | compétence | type | résultat | autonomie (§5) | qualité | contexte | commentaire de l'utilisateur",
    "",
  ];
  for (const p of recentes) {
    lignes.push(
      `- ${formatDateCourte(p.date)} | ${p.skillCode} | ${p.type} | ${p.resultat} | ${p.autonomie} | ${
        p.qualite
      } | « ${p.contexte} »${p.commentaire ? ` | ${p.commentaire}` : ""}`,
    );
  }
  return lignes.join("\n");
}

/**
 * Ce que les tentatives passées disent du calibrage à venir (ADR-028).
 *
 * C'est le 3ᵉ maillon de la boucle : sans ce bloc, le tuteur reçoit les niveaux
 * mais ignore *comment* le dernier exercice s'est passé. Il proposait donc la
 * même chose à qui vient d'échouer indices épuisés et à qui vient de réussir
 * sans effort en moitié moins de temps que prévu.
 *
 * Seules les compétences réellement calibrées sont listées : une compétence
 * jamais travaillée en exercice n'a rien à dire ici, et une ligne vide se
 * lirait comme une mesure.
 */
function serialiserCalibration(ctx: Contexte): string {
  const lignes: string[] = [];
  const calibrees = ctx.etats
    .map((e) => ctx.calibrations.get(e.skill.code))
    .filter(
      (c): c is NonNullable<typeof c> =>
        Boolean(c) && (c!.difficulteConseillee !== null || c!.dimensionFaible !== null),
    );

  if (calibrees.length === 0) {
    return "# CALIBRAGE DU PROCHAIN EXERCICE\n\nAucune tentative terminée : rien à calibrer pour l'instant. Pour un premier exercice, vise la difficulté 2 et reste sur un seul angle.";
  }

  lignes.push("# CALIBRAGE DU PROCHAIN EXERCICE (dérivé des tentatives réelles)");
  lignes.push("");
  lignes.push(
    "Ces valeurs viennent de ce qui s'est passé : résultat, indices consultés, temps réel contre temps estimé, auto-évaluation par dimension. Elles ne sont ni déclarées ni devinées.",
  );
  lignes.push(
    "QUAND TU PROPOSES UN EXERCICE, emploie la difficulté conseillée. Si la dimension faible est indiquée, c'est ELLE qu'il faut faire travailler — proposer le même exercice « en plus facile » raterait ce que la mesure dit.",
  );
  lignes.push("");
  lignes.push("Colonnes : code | difficulté conseillée | ce qu'a donné la dernière tentative | dimension à travailler");
  lignes.push("");

  for (const c of calibrees) {
    const dernier = c.verdicts[0];
    const dim = c.dimensionFaible
      ? `${c.dimensionFaible.dimension} (${c.dimensionFaible.moyenne} sur ${c.dimensionFaible.observations})`
      : "—";
    lignes.push(
      `${c.skillCode} | ${c.difficulteConseillee ?? "—"} | ${dernier ? dernier.raison : "—"} | ${dim}`,
    );
  }

  const nonTentees = calibrees.filter((c) => c.difficulteConseillee === null);
  if (nonTentees.length > 0) {
    lignes.push("");
    lignes.push(
      `« — » en difficulté : les tentatives ont été abandonnées trop tôt pour conclure. Ne suppose pas que l'exercice était trop dur — demande plutôt ce qui a bloqué.`,
    );
  }

  return lignes.join("\n");
}

function serialiserRecommandations(ctx: Contexte): string {
  const lignes = ["# PRIORITÉS CALCULÉES PAR LE SYSTÈME", ""];
  lignes.push(
    "Ces priorités proviennent du moteur de recommandation (protocole d'évaluation §16). Tu peux les discuter, pas les inventer.",
  );
  lignes.push("");
  for (const r of ctx.recommandations.slice(0, 5)) {
    lignes.push(
      `${r.etat.skill.code} (valeur ${Math.round(r.valeur)}) — ${r.etat.skill.intitule}\n    ${r.raison}`,
    );
  }
  return lignes.join("\n");
}

/**
 * Consignes propres à l'usage dans cette application.
 *
 * Devenue une fonction du référentiel avec ADR-026 : le gabarit d'exercice
 * nommait le domaine pilote global, qui n'existe plus. Elle reste **stable pour
 * un compte donné** tant que son référentiel ne change pas — c'est ce qui
 * permet de la garder dans le bloc système mis en cache.
 */
function consignesInterface(referentiel: Referentiel): string {
  const domaines = referentiel.domaines.filter((d) =>
    referentiel.actifs.some((s) => s.domaine === d.id),
  );
  const listeDomaines =
    domaines.length === 0
      ? "<aucun domaine — commence par une PROPOSITION DE RÉFÉRENTIEL>"
      : domaines.map((d) => d.id).join(" | ");

  return `# CADRE D'INTERVENTION DANS CETTE INTERFACE

Tu interviens depuis l'application de suivi. Quatre règles s'ajoutent aux protocoles ci-dessus :

1. TU NE PEUX PAS ÉCRIRE DANS LE PROFIL.
   Tu ne disposes d'aucun accès en écriture. Si une interaction constitue une
   preuve de compétence, ne dis jamais « j'ai mis à jour ton profil ». Propose
   la mise à jour dans un bloc structuré, que l'utilisateur validera lui-même :

   ${MARQUEUR_PREUVE}
   Compétence : <code>
   Niveau actuel : <valeur lue dans le profil ci-dessous>
   Niveau proposé : <valeur>
   Preuve : <ce qui a été observé dans cet échange, précisément>
   Autonomie observée : <A0-A4>
   Qualité de la preuve : <faible|moyenne|forte>
   Réserve : <ce qui reste à confirmer>

2. TU NE PEUX PAS AJOUTER D'EXERCICE NON PLUS — MAIS TU PEUX EN PROPOSER UN.
   Quand l'utilisateur demande un exercice, rédige-le dans ce bloc exact.
   L'application le transformera en formulaire pré-rempli qu'il validera.
   N'annonce jamais qu'un exercice « a été ajouté » : tu proposes, il décide.

   ${MARQUEUR_EXERCICE}
   Titre : <titre court et explicite>
   Domaine : <${listeDomaines}>
   Type : <rappel|application|calcul|probleme|etude-de-cas|programmation|simulation|projet>
   Difficulté : <1 à 5>
   Compétences : <codes séparés par des virgules ; la première est la cible>
   Durée estimée : <minutes>
   Énoncé :
   <l'énoncé complet, plusieurs lignes autorisées>
   Indice : <un indice par ligne, du plus léger au plus explicite>
   Correction :
   <la correction complète, plusieurs lignes autorisées>
   Critère : <dimension> — <ce que l'utilisateur doit pouvoir cocher>

   Les dimensions valides sont : comprehension, application, transfert,
   integration, justification. Répète « Indice : » et « Critère : » autant de
   fois que nécessaire. N'emploie que des codes de compétence figurant dans le
   profil ci-dessous — un code inventé sera rejeté.

   LA DIFFICULTÉ N'EST PAS À TON APPRÉCIATION. Le bloc « CALIBRAGE DU PROCHAIN
   EXERCICE » ci-dessous la donne, dérivée de ce qui s'est réellement passé lors
   des dernières tentatives. Emploie-la. Si tu t'en écartes, dis pourquoi dans
   la phrase qui précède le bloc.

   Quand une dimension faible y est indiquée, l'exercice doit la faire
   travailler, et au moins un « Critère : » doit porter sur elle. Un échec
   localisé dans « application » n'appelle pas le même exercice en plus facile :
   il appelle un exercice qui fait appliquer.

   L'énoncé et la correction se terminent à l'étiquette suivante. Si tu veux
   commenter après le bloc, sépare-le par une ligne « --- ».

3. TU NE PEUX PAS MODIFIER LE RÉFÉRENTIEL — MAIS TU PEUX EN PROPOSER L'EXTENSION.
   Le référentiel appartient au compte : il n'y a pas de liste universelle de
   compétences. Quand l'utilisateur veut travailler un sujet qui n'y figure pas,
   ou quand ce qu'il fait révèle un savoir-faire qu'aucune compétence ne couvre,
   propose une branche ou des compétences dans ce bloc exact.

   ${MARQUEUR_REFERENTIEL}
   Domaine : <nom d'un domaine existant, ou d'une nouvelle branche>
   Préfixe : <2 à 5 lettres majuscules — ignoré si le domaine existe déjà>
   Description : <une phrase : ce que cette branche couvre>
   Compétence : <palier> | <importance de 0 à 1> | <intitulé>
   Justification : <sur quoi tu t'appuies — ce que l'utilisateur a dit ou fait>

   Les paliers valides sont : fondamentaux, intermediaire, avance. Répète
   « Compétence : » autant de fois que nécessaire, du plus fondamental au plus
   avancé. Termine le bloc par une ligne « --- ».

   N'ÉCRIS AUCUN CODE DE COMPÉTENCE dans ce bloc : c'est l'application qui les
   attribue à partir du préfixe. Un code que tu inventerais entrerait en
   collision avec un code existant, et les preuves suivraient le mauvais.

   Chaque compétence proposée doit être MESURABLE PAR L'APPAREIL QUI EXISTE.
   Un intitulé qui ne l'est pas produit une ligne que rien ne pourra jamais
   remplir — c'est le défaut que ce système est fait pour éviter :
     a. un savoir-faire OBSERVABLE, pas un sujet : « sait reconstruire un
        argument sous forme canonique », jamais « l'histoire de la philosophie » ;
     b. notable sur au moins une des cinq dimensions du protocole d'évaluation
        §3 (comprehension, application, transfert, integration, justification) ;
     c. testable dans au moins deux contextes distincts, sans quoi la
        robustesse ne pourra jamais monter (§11) ;
     d. exerçable par au moins un des types disponibles (rappel, application,
        calcul, probleme, etude-de-cas, programmation, simulation, projet) ;
     e. prouvable par un exercice de 20 à 60 minutes — plus large, découpe ;
        plus étroit, fusionne.

   L'importance se déclare par rapport à l'objectif du compte, pas dans
   l'absolu. Si aucun objectif n'est renseigné, demande-le avant de proposer
   des importances plutôt que de les supposer.

4. TU NE DISPOSES QUE DU CONTEXTE FOURNI CI-DESSOUS.
   Tu n'as aucune mémoire des échanges précédents en dehors de la conversation
   en cours et de l'état du profil transmis. Ne prétends pas te souvenir d'une
   séance qui n'apparaît pas dans le travail récent.

5. RESTE CONCIS SAUF DEMANDE CONTRAIRE.
   L'utilisateur vient travailler, pas lire des synthèses. Pas d'introduction,
   pas de récapitulatif du profil non demandé, pas de félicitations
   automatiques. Réponds à la demande, questionne, corrige, propose la suite.`;
}

export async function construireContexte(
  ctx: Contexte,
  messages: { role: "user" | "assistant"; content: string }[] = [],
): Promise<ContextePedagogique> {
  const manifeste: SectionContexte[] = [];
  const blocsStables: string[] = [];

  for (const p of PROTOCOLES) {
    const contenu = await lireFichier(p.fichier);
    if (contenu) {
      blocsStables.push(contenu);
      manifeste.push({ nom: p.nom, caracteres: contenu.length, origine: "fichier" });
    }
  }

  const consignes = consignesInterface(ctx.referentiel);
  blocsStables.push(consignes);
  manifeste.push({
    nom: "Cadre d'intervention dans l'interface",
    caracteres: consignes.length,
    origine: "calcule",
  });

  // Sans historique transmis (indicateur de taille, mode « copier le
  // contexte »), on ne peut pas appliquer l'heuristique : on charge le
  // protocole complet par prudence (ADR-021) plutôt que de deviner.
  const dernierMessageUtilisateur = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const chargerSynthese =
    messages.length === 0 || fautChargerSyntheseEvaluation(dernierMessageUtilisateur, messages.length);

  if (chargerSynthese) {
    const contenu = await lireFichier(PROTOCOLE_EVALUATION_SYNTHESE.fichier);
    if (contenu) {
      blocsStables.push(contenu);
      manifeste.push({ nom: PROTOCOLE_EVALUATION_SYNTHESE.nom, caracteres: contenu.length, origine: "fichier" });
    }
  }

  // Même arbitrage, autre déclencheur : la charte du référentiel n'a d'utilité
  // que quand la conversation porte dessus. Un compte sans référentiel la
  // reçoit toujours — c'est sa seule conversation possible (ADR-026).
  if (fautChargerProtocoleReferentiel(dernierMessageUtilisateur, ctx.referentiel.skills.length === 0)) {
    const contenu = await lireFichier(PROTOCOLE_REFERENTIEL.fichier);
    if (contenu) {
      blocsStables.push(contenu);
      manifeste.push({ nom: PROTOCOLE_REFERENTIEL.nom, caracteres: contenu.length, origine: "fichier" });
    }
  }

  const profil = serialiserProfil(ctx);
  const recent = serialiserRecent(ctx);
  const calibrage = serialiserCalibration(ctx);
  const priorites = serialiserRecommandations(ctx);

  manifeste.push(
    { nom: "État courant des compétences", caracteres: profil.length, origine: "calcule" },
    { nom: "Travail récent", caracteres: recent.length, origine: "calcule" },
    { nom: "Calibrage du prochain exercice", caracteres: calibrage.length, origine: "calcule" },
    { nom: "Priorités calculées", caracteres: priorites.length, origine: "calcule" },
  );

  const systemeStable = blocsStables.join("\n\n---\n\n");
  const systemeProfil = [profil, recent, calibrage, priorites].join("\n\n---\n\n");

  return {
    systemeStable,
    systemeProfil,
    manifeste,
    caracteresTotal: systemeStable.length + systemeProfil.length,
  };
}

/** Version texte intégrale, pour le mode « copier le contexte » sans clé API. */
export function contexteEnTexte(c: ContextePedagogique, question: string): string {
  return [
    c.systemeStable,
    "\n\n---\n\n",
    c.systemeProfil,
    "\n\n---\n\n# DEMANDE\n\n",
    question,
  ].join("");
}
