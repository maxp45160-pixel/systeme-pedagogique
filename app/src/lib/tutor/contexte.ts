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
import { serialiserProfilDeclare } from "@/lib/domain/profil";
import { usageExercice } from "@/lib/domain/exercice";
import { formatDateCourte } from "@/lib/engine/dates";
import {
  OUTIL_EXERCICE,
  OUTIL_REFERENTIEL,
  outilsTuteur,
  type OutilTuteur,
} from "./outils";

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
 * évaluation, restent dans le fichier toujours chargé ci-dessus.
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

/**
 * ⚠️ Ces mots-clés déclenchent 6,8 Ko de protocole. Ils désignent l'intention de
 * TOUCHER AU RÉFÉRENTIEL, pas la conversation ordinaire.
 *
 * La première liste contenait `ajouter`, `apprendre`, `commencer`,
 * `travailler sur`, `me lancer` : « par où commencer cet exo ? » chargeait la
 * charte de construction du référentiel, en pleine résolution d'exercice, à
 * chaque message. Ce sont des verbes du langage courant, pas des marqueurs
 * d'intention.
 *
 * Le filet contre une formulation non prévue reste `referentielVide`, qui passe
 * avant tout : le seul cas où rater le déclenchement coûterait cher.
 */
const MOTS_CLES_REFERENTIEL = [
  "referentiel",
  "competence",
  "domaine",
  "branche",
  "nouveau sujet",
  "nouvelle matiere",
  "ajouter une",
  "ajouter un domaine",
  "ajouter au suivi",
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
  /**
   * Outils par lesquels le tuteur propose (lot 3.2).
   *
   * Ils font partie du contexte transmis au même titre que les protocoles : le
   * manifeste les compte, sans quoi l'interface annoncerait une taille
   * inférieure à ce qui part réellement — exactement le genre de chiffre sans
   * source que le protocole interdit.
   */
  outils: OutilTuteur[];
  manifeste: SectionContexte[];
  /** Estimation grossière, annoncée comme telle dans l'interface. */
  caracteresTotal: number;
}

/**
 * Contenu déjà lu, par chemin relatif.
 *
 * Les protocoles étaient relus du disque à chaque message : 3 fichiers sur un
 * tour ordinaire, jusqu'à 5 quand la synthèse ou le protocole de référentiel
 * s'ajoutent. Ce sont des fichiers livrés avec le build, immuables pour la
 * durée du processus — les relire ne pouvait rien apporter de neuf.
 *
 * Portée module, donc partagée par toutes les requêtes servies par la même
 * instance, contrairement au `cache()` de React qui s'arrête à la requête.
 * C'est ce qui rend le gain réel sur le chemin chaud (`POST /api/tutor`).
 *
 * ⚠️ Corollaire assumé : modifier un `.txt` en développement demande de
 * redémarrer le serveur. C'est le prix d'un cache de processus, et ces
 * fichiers ne changent qu'à l'occasion d'un chantier déclaré (CLAUDE.md §8).
 *
 * Un échec de lecture n'est PAS mémorisé : un fichier absent le restera
 * probablement, mais garder l'absence en cache transformerait une erreur de
 * déploiement transitoire en panne durable, silencieuse, et invisible au
 * manifeste.
 */
const contenusLus = new Map<string, string>();

async function lireFichier(relatif: string): Promise<string | null> {
  const memorise = contenusLus.get(relatif);
  if (memorise !== undefined) return memorise;

  try {
    const contenu = await fs.readFile(path.join(RACINE_DATA, relatif), "utf8");
    contenusLus.set(relatif, contenu);
    return contenu;
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
    lignes.push(serialiserProfilDeclare(ctx.donnees.user));
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

  // Le profil déclaré est transmis ICI, et nulle part ailleurs.
  //
  // Jusqu'au 31/07/2026 il n'était transmis nulle part : le tuteur tenait le
  // sien du § 2 des instructions principales, qui décrivait en dur le parcours
  // d'un seul utilisateur et partait vers TOUS les comptes. Un compte tiers se
  // voyait donc attribuer un diplôme et des objectifs qui n'étaient pas les
  // siens (ADR-029). Retirer ce paragraphe suppose de transmettre le vrai.
  lignes.push(serialiserProfilDeclare(ctx.donnees.user));
  lignes.push("");

  // Les étiquettes de colonne sont données UNE fois plutôt que répétées sur
  // chaque ligne : même information, plusieurs milliers de caractères de moins
  // dans le contexte envoyé au modèle.
  lignes.push(
    "Colonnes : code | niveau/5 | score/5 | confiance | robustesse | preuves/contextes | jours depuis la dernière preuve | intitulé",
  );
  lignes.push(
    "« — » = aucune preuve, donc aucune valeur dérivable (ce n'est pas un zéro). Le suffixe « ?D » marque une hypothèse issue de la formation déclarée, non vérifiée, de niveau de preuve D — elle n'autorise aucun niveau affiché.",
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

/**
 * Ce que le corpus contient déjà.
 *
 * Jusqu'au 02/08/2026, `contexte.ts` n'ouvrait ni `ctx.donnees.exercises` ni
 * `ctx.donnees.attempts` : le tuteur ne savait pas quels exercices existaient.
 * Il en a produit deux quasi identiques sur LOG-10 — « Analyser un schéma de
 * flux logistique pour identifier un goulot » et « Identification des goulots
 * d'étranglement dans un flux logistique de production de vélos » — sans qu'il
 * puisse le soupçonner.
 *
 * ⚠️ TITRES ET MÉTADONNÉES SEULEMENT, JAMAIS LES ÉNONCÉS. Le critère de choix
 * du moteur est la taille du contexte : une trentaine de titres coûte quelques
 * centaines de jetons, une trentaine d'énoncés complets en coûterait des
 * dizaines de milliers, à chaque message. Le seul énoncé transmis est celui de
 * l'exercice ouvert (bloc suivant), et il se justifie : c'est l'objet même de
 * la conversation.
 */
function serialiserCorpus(ctx: Contexte): string {
  const exercices = ctx.exercicesActifs;
  if (exercices.length === 0) {
    return "# EXERCICES EXISTANTS\n\nAucun exercice dans la bibliothèque. Tout ce que tu proposes sera un premier.";
  }

  const lignes = [
    `# EXERCICES EXISTANTS (${exercices.length})`,
    "",
    "NE PROPOSE PAS un exercice qui refait ce qu'un de ceux-ci fait déjà. Si le besoin est proche d'un existant, dis-le et propose plutôt de le reprendre, ou change franchement d'angle.",
    "",
    "Colonnes : compétence(s) | difficulté | durée | état | titre",
    "",
  ];

  const trie = [...exercices].sort(
    (a, b) =>
      (a.competences[0] ?? "").localeCompare(b.competences[0] ?? "") ||
      a.difficulte - b.difficulte,
  );

  const montres = trie.slice(0, MAX_LIGNES_CORPUS);
  for (const ex of montres) {
    const etat = LIBELLES_USAGE_TUTEUR[usageExercice(ex.id, ctx.donnees.attempts)];
    lignes.push(
      `- ${ex.competences.join(", ")} | ${ex.difficulte}/5 | ${ex.dureeEstimeeMin} min | ${etat} | « ${ex.titre} »`,
    );
  }

  // Une troncature muette se lirait comme un corpus complet (P3).
  if (trie.length > montres.length) {
    lignes.push("");
    lignes.push(
      `(${trie.length - montres.length} exercice(s) de plus ne sont pas listés ici, faute de place. La liste ci-dessus n'est donc pas exhaustive.)`,
    );
  }

  return lignes.join("\n");
}

/** Vocabulaire court, destiné au modèle — pas les libellés de l'interface. */
const LIBELLES_USAGE_TUTEUR: Record<string, string> = {
  "a-faire": "jamais tenté",
  "en-cours": "EN COURS",
  acquis: "réussi",
  travaille: "tenté, pas réussi",
};

/** Au-delà, le bloc coûterait plus qu'il ne rapporte. Voir `serialiserCorpus`. */
const MAX_LIGNES_CORPUS = 60;

/**
 * L'exercice sur lequel la personne travaille en ce moment.
 *
 * C'est l'autre moitié du « il ne sait pas ce sur quoi on bosse ». Le lien vers
 * le tuteur depuis une fiche d'exercice ne portait aucun paramètre, et aucune
 * tentative en cours n'était transmise : demander de l'aide obligeait à recoller
 * l'énoncé à la main.
 *
 * Ici l'énoncé complet est transmis, et le brouillon de réponse avec — c'est
 * précisément ce sur quoi porte la demande d'aide. Les indices déjà consultés
 * sont indiqués pour que le tuteur n'en redonne pas un plus explicite que ceux
 * que la personne a choisi de ne pas ouvrir.
 */
function serialiserExerciceEnCours(ctx: Contexte, exerciceId?: string): string {
  const parId = new Map(ctx.donnees.exercises.map((e) => [e.id, e]));

  /*
   * PostgreSQL ne garantit aucun ordre de retour : trier les tentatives en
   * cours sur leur date plutôt que traiter la position dans le tableau comme
   * une date (audit §2.5). La plus récente ouverte vient en premier.
   */
  const enCours = ctx.donnees.attempts
    .filter((t) => t.statut === "en-cours")
    .sort((a, b) => b.debut.localeCompare(a.debut));
  const cible =
    (exerciceId ? parId.get(exerciceId) : undefined) ??
    parId.get(enCours[0]?.exerciseId ?? "");

  if (!cible) {
    return "# EXERCICE EN COURS\n\nAucun exercice ouvert. Si la personne parle d'un exercice, demande-lui lequel — tu n'as pas son énoncé.";
  }

  const tentative = enCours.find((t) => t.exerciseId === cible.id);

  const lignes = [
    "# EXERCICE EN COURS",
    "",
    "C'est l'exercice ouvert dans l'interface au moment de ce message. Réponds à propos de CELUI-CI, sauf indication contraire.",
    "",
    // La gradation est au § 8 des instructions principales, mais deux forces
    // tirent en sens inverse sur ce chemin précis : le mode LÉGER (§5) et la
    // consigne de concision du cadre d'intervention. Résultat observé — la
    // solution arrivait d'un bloc, et la tentative ne mesurait plus rien.
    // Ici, et seulement ici, la gradation reprend le dessus : ce bloc n'existe
    // que si un exercice est ouvert.
    "AIDE PAS À PAS, PAS DE SOLUTION D'EMBLÉE. Une étape à la fois, dans cet ordre : questionner ce qui bloque, faire expliciter l'hypothèse ou la méthode, donner un indice, corriger partiellement. Termine par une question qui rend la main. Ne livre la résolution complète que sur demande explicite, ou après plusieurs tentatives infructueuses — l'autonomie observée est ce qui fonde la preuve, et une solution donnée trop tôt la détruit.",
    "",
    `Titre : ${cible.titre}`,
    `Compétence(s) : ${cible.competences.join(", ")}`,
    `Difficulté : ${cible.difficulte}/5 · durée estimée ${cible.dureeEstimeeMin} min`,
  ];

  if (tentative) {
    const total = cible.indices.length;
    lignes.push(
      `Indices consultés : ${tentative.indicesUtilises} sur ${total}. NE DONNE PAS un indice plus explicite que ceux qui restent fermés — la personne a choisi de ne pas les ouvrir, et l'autonomie observée est ce qui fonde sa preuve.`,
    );
  }

  lignes.push("", "## Énoncé", "", cible.enonce);

  if (tentative?.reponse.trim()) {
    lignes.push(
      "",
      "## Brouillon de réponse déjà écrit par la personne",
      "",
      tentative.reponse.trim(),
    );
  }

  // La correction n'est JAMAIS transmise : le tuteur la recopierait sur
  // demande, et la preuve produite ne vaudrait plus rien.
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
 *
 * Lot 3.2 : les trois gabarits markdown ont disparu d'ici. Ils décrivaient en
 * prose une forme que le modèle devait reproduire exactement, et qu'un parseur
 * devait relire ; ils sont remplacés par les trois outils de `outils.ts`, dont
 * le schéma part dans la même requête. Ce qui reste ici est ce qu'un schéma ne
 * sait pas dire : quand proposer, sur quoi s'appuyer, et ce qu'un intitulé de
 * compétence doit être pour être mesurable.
 */
function consignesInterface(referentiel: Referentiel): string {
  const domaines = referentiel.domaines.filter((d) =>
    referentiel.actifs.some((s) => s.domaine === d.id),
  );

  return `# CADRE D'INTERVENTION DANS CETTE INTERFACE

Tu interviens depuis l'application de suivi. Tu n'as AUCUN accès en écriture :
ni au profil, ni au corpus d'exercices, ni au référentiel. Tu disposes de deux
outils pour *proposer*, et l'utilisateur valide un formulaire pré-rempli. Ne dis
jamais qu'une chose « a été ajoutée » ou « mise à jour » : tu proposes, il décide.

1. ${OUTIL_EXERCICE} — quand l'utilisateur demande un exercice.
   LA DIFFICULTÉ N'EST PAS À TON APPRÉCIATION. Le bloc « CALIBRAGE DU PROCHAIN
   EXERCICE » ci-dessous la donne, dérivée de ce qui s'est réellement passé lors
   des dernières tentatives. Emploie-la ; si tu t'en écartes, dis pourquoi.
   Quand une dimension faible y est indiquée, l'exercice doit la faire
   travailler, et au moins un critère doit porter sur elle. Un échec localisé
   dans « application » n'appelle pas le même exercice en plus facile : il
   appelle un exercice qui fait appliquer.
   ${
     domaines.length === 0
       ? "Aucun domaine n'existe encore : commence par proposer une branche."
       : `Domaines disponibles : ${domaines.map((d) => d.id).join(", ")}.`
   }

2. ${OUTIL_REFERENTIEL} — quand le sujet demandé ne figure pas au référentiel,
   ou quand ce que fait l'utilisateur révèle un savoir-faire qu'aucune
   compétence ne couvre. Le référentiel appartient au compte : il n'y a pas de
   liste universelle. Les cinq conditions qu'un intitulé doit remplir pour être
   mesurable sont au protocole de construction du référentiel §2, chargé dès
   que la conversation porte sur le sujet.

3. TU NE DISPOSES QUE DU CONTEXTE FOURNI CI-DESSOUS.
   Tu n'as aucune mémoire des échanges précédents en dehors de la conversation
   en cours et de l'état du profil transmis. Ne prétends pas te souvenir d'une
   séance qui n'apparaît pas dans le travail récent.

4. RESTE CONCIS SAUF DEMANDE CONTRAIRE.
   L'utilisateur vient travailler, pas lire des synthèses. Pas d'introduction,
   pas de récapitulatif du profil non demandé, pas de félicitations
   automatiques. Réponds à la demande, questionne, corrige, propose la suite.
   NE RECOPIE PAS LE CONTENU D'UN APPEL D'OUTIL DANS TA RÉPONSE. L'application
   affiche la proposition dans une carte, à côté de ton message : un énoncé
   écrit deux fois est lu deux fois et payé deux fois. Une ou deux phrases —
   pourquoi cet exercice, sur quoi il porte — puis l'appel d'outil.`;
}

export async function construireContexte(
  ctx: Contexte,
  messages: { role: "user" | "assistant"; content: string }[] = [],
  /** Exercice explicitement ciblé par l'interface (`/tuteur?exercice=…`). */
  exerciceId?: string,
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

  /*
   * Un exercice ouvert change ce qui sert.
   *
   * `exerciceId` n'arrive que d'un endroit : l'interface où la personne est en
   * train de résoudre quelque chose (`/tuteur?exercice=…`, tiroir d'une fiche
   * d'exercice). Là, elle demande de l'aide sur CET énoncé — elle ne demande
   * pas quoi faire ensuite. Le catalogue des exercices existants (jusqu'à
   * 60 lignes, il n'existe que pour empêcher le tuteur d'en proposer un
   * doublon) et les priorités du moteur de recommandation ne sont mobilisés par
   * aucune réponse possible sur ce chemin, et ils y sont renvoyés à chaque
   * message.
   *
   * Ce qui RESTE, et pourquoi : le profil (le niveau conditionne le grain de
   * l'aide), le travail récent (les erreurs passées), le calibrage (la dimension
   * faible dit sur quoi insister).
   *
   * Le manifeste ne liste que ce qui part réellement — un bloc omis n'y figure
   * pas, sans quoi l'interface annoncerait un contexte que le modèle n'a pas
   * reçu (P2, P3).
   */
  const aideSurExercice = Boolean(exerciceId);

  const profil = serialiserProfil(ctx);
  const recent = serialiserRecent(ctx);
  const calibrage = serialiserCalibration(ctx);
  const corpus = aideSurExercice ? null : serialiserCorpus(ctx);
  const enCours = serialiserExerciceEnCours(ctx, exerciceId);
  const priorites = aideSurExercice ? null : serialiserRecommandations(ctx);

  manifeste.push(
    { nom: "État courant des compétences", caracteres: profil.length, origine: "calcule" },
    { nom: "Travail récent", caracteres: recent.length, origine: "calcule" },
    { nom: "Calibrage du prochain exercice", caracteres: calibrage.length, origine: "calcule" },
  );
  if (corpus !== null) {
    manifeste.push({ nom: "Exercices existants", caracteres: corpus.length, origine: "calcule" });
  }
  manifeste.push({ nom: "Exercice en cours", caracteres: enCours.length, origine: "calcule" });
  if (priorites !== null) {
    manifeste.push({ nom: "Priorités calculées", caracteres: priorites.length, origine: "calcule" });
  }

  const outils = outilsTuteur(ctx.referentiel);
  // Ce que les schémas pèsent réellement dans la requête. Mesuré sur la
  // sérialisation JSON, qui est la forme envoyée — pas estimé.
  const caracteresOutils = JSON.stringify(outils).length;
  manifeste.push({
    nom: "Outils de proposition (schémas)",
    caracteres: caracteresOutils,
    origine: "calcule",
  });

  const systemeStable = blocsStables.join("\n\n---\n\n");
  const systemeProfil = [profil, recent, calibrage, corpus, enCours, priorites]
    .filter((bloc): bloc is string => bloc !== null)
    .join("\n\n---\n\n");

  return {
    systemeStable,
    systemeProfil,
    outils,
    manifeste,
    caracteresTotal: systemeStable.length + systemeProfil.length + caracteresOutils,
  };
}

/**
 * Version texte intégrale, pour le mode « copier le contexte » sans clé API.
 *
 * Ce chemin n'a pas d'appel d'outil : le prompt est collé dans une fenêtre de
 * chat ordinaire. Les schémas y sont donc rendus en texte, à la place des
 * gabarits markdown qu'ils remplacent. Même source, une seule définition — un
 * gabarit recopié à la main ici se serait désynchronisé au premier changement,
 * en silence.
 */
export function contexteEnTexte(c: ContextePedagogique, question: string): string {
  const schemas = c.outils
    .map((o) => `## ${o.nom}\n${o.description}\n\n${JSON.stringify(o.schema, null, 2)}`)
    .join("\n\n");

  return [
    c.systemeStable,
    "\n\n---\n\n# FORME DES PROPOSITIONS (mode copié-collé)\n\n",
    "Cette conversation n'a pas d'appel d'outil. Quand tu proposes, écris un bloc ```json contenant { \"outil\": <nom>, \"donnees\": { … } } conforme au schéma correspondant.\n\n",
    schemas,
    "\n\n---\n\n",
    c.systemeProfil,
    "\n\n---\n\n# DEMANDE\n\n",
    question,
  ].join("");
}
