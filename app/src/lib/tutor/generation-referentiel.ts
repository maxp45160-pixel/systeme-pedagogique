/**
 * Suggestion d'une branche de compétences sans conversation — le chemin
 * d'appel du lot 2.
 *
 * Même mécanique que `generation.ts` pour les exercices : un prompt court,
 * l'outil `proposer_referentiel`, et un `envoyer` qui collecte au lieu de
 * diffuser. La différence est dans l'outil : la branche ne porte AUCUN code —
 * l'application les attribue à l'enregistrement (ADR-026).
 *
 * ⚠️ Dépendance à l'outillage. Comme pour l'exercice, la suggestion directe
 * exige un fournisseur qui sait appeler un outil. Sans support, le bouton se
 * désactive et le dit — même honnêteté que le 503 « copier le contexte ».
 */

import type { Referentiel } from "@/lib/domain/types";
import { CONDITIONS_MESURABILITE } from "@/lib/domain/atomicite";
import { analyserDemandeReferentiel } from "@/lib/domain/intention";
import type { MoteurTuteur } from "./moteurs";
import { lireErreurMoteur, lireOutilsActifs, messageSansOutils } from "./moteurs";
import {
  BRANCHES_MAX_COMPTE_ETABLI,
  outilReferentielComplet,
  outilsTuteur,
} from "./outils";
import type { PropositionReferentiel } from "./proposition";
import type { PromptTuteur } from "./prompt";

const [observable, notable, deuxContextes, exercable, prouvable] = CONDITIONS_MESURABILITE;

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface ResultatSuggestion {
  /** Proposition validée, prête à être relue et enregistrée. */
  branche: PropositionReferentiel | null;
  /**
   * Le fournisseur a-t-il servi les outils ?
   *
   * `true` par défaut — voir `ResultatGeneration.outilsActifs` : une absence
   * d'information n'accuse personne.
   */
  outilsActifs: boolean;
  /** Message d'erreur, ou `null` si la suggestion a abouti. */
  erreur: string | null;
}

/* ------------------------------------------------------------------ */
/* Prompt court                                                        */
/* ------------------------------------------------------------------ */

/**
 * Résumé structuré du référentiel existant, pour **ancrer la proposition dans
 * ce qui est déjà là**.
 *
 * Le prompt de suggestion ne montrait que des identifiants de domaine — le
 * tuteur proposait donc des compétences qui existaient déjà, faute de savoir
 * ce que le compte porte. Chaque domaine actif est listé avec son préfixe, son
 * volume et un échantillon d'intitulés ; le plafond garde le prompt court sur
 * les référentiels denses.
 *
 * Fonction pure et testable.
 */
export function resumerReferentielExistant(
  referentiel: Referentiel,
  intitulesParDomaine = 6,
): string {
  const lignes: string[] = [];
  for (const domaine of referentiel.domaines.filter((d) => !d.archive)) {
    const actives = referentiel.actifs.filter((s) => s.domaine === domaine.id);
    // Un domaine sans compétence active n'est pas listé : le proposer comme
    // rattachement enverrait la branche dans un domaine que rien n'alimente.
    if (actives.length === 0) continue;
    const echantillon = actives
      .slice(0, intitulesParDomaine)
      .map((s) => `« ${s.intitule} »`)
      .join(", ");
    const suite =
      actives.length > intitulesParDomaine
        ? `… (+${actives.length - intitulesParDomaine} autres)`
        : "";
    lignes.push(
      `- ${domaine.nom} (${domaine.prefixe}) — ${actives.length} compétence${actives.length > 1 ? "s" : ""} active${actives.length > 1 ? "s" : ""} : ${echantillon}${suite}`,
    );
  }
  return lignes.length > 0 ? lignes.join("\n") : "- Aucun — le référentiel est vide.";
}

/**
 * Le prompt système de la suggestion de branche.
 *
 * Volontairement court : identité, protocole de rédaction d'une compétence,
 * référentiel existant résumé. Le reste du protocole (évaluation,
 * anti-hallucination) ne sert pas ici : la suggestion ne produit aucune
 * mesure, elle produit du contenu. P5 reformulé — « le tuteur écrit le
 * contenu, jamais la mesure ».
 */
export function construirePromptSuggestion(
  referentiel: Referentiel,
  sujet: string,
): PromptTuteur {
  const stable = [
    "Tu es le tuteur du système pédagogique. Tu proposes une branche de compétences pour un sujet demandé.",
    "",
    "PROTOCOLE DE RÉDACTION D'UNE COMPÉTENCE",
    `- Chaque intitulé doit être ${observable}.`,
    `- Chaque compétence doit être ${notable} du référentiel.`,
    `- Chaque compétence doit être ${deuxContextes}.`,
    `- Chaque compétence doit être ${exercable}.`,
    `- Chaque compétence doit être ${prouvable}.`,
    "- Du plus fondamental au plus avancé.",
    "",
    "RÉFÉRENTIEL EXISTANT DU COMPTE — ne redouble ni ces domaines ni leurs compétences ; si le sujet est déjà couvert par une compétence listée, dis-le plutôt que de proposer un doublon :",
    resumerReferentielExistant(referentiel),
  ].join("\n");

  // Le sujet est la seule chose qui change d'une suggestion à l'autre : il
  // sort du préfixe pour que celui-ci puisse être mis en cache (voir
  // `PromptTuteur`).
  const variable = [
    `Sujet demandé : ${sujet}`,
    "",
    "Appelle l'outil proposer_referentiel UNE fois. Ne recopie pas le contenu de l'appel dans ta réponse.",
  ].join("\n");

  return { stable, variable };
}

/* ------------------------------------------------------------------ */
/* Référentiel complet — plusieurs branches d'un seul geste             */
/* ------------------------------------------------------------------ */

export interface ResultatReferentiel {
  resume: string;
  branches: PropositionReferentiel[];
  /** Branches reçues mais non exploitables. Annoncé, jamais tu (ADR-036). */
  ecartees: number;
  outilsActifs: boolean;
  erreur: string | null;
}

/**
 * Le prompt d'un référentiel complet.
 *
 * Il diffère de celui d'une branche sur un seul point, mais qui change tout :
 * il demande un **découpage**. Un sujet un peu large ne tient pas dans une
 * branche — « le stoïcisme » se découpe en thèmes — et forcer une branche
 * unique produit vingt compétences que personne ne relit.
 *
 * Il porte aussi les domaines existants, pour ne pas reproposer ce qui est
 * déjà là : c'est le même souci que les intitulés voisins d'`evolution.ts`.
 */
export function construirePromptReferentiel(
  referentiel: Referentiel,
  sujet: string,
): PromptTuteur {
  const existants = referentiel.domaines.filter((d) => !d.archive).map((d) => d.nom);
  const cadrage = analyserDemandeReferentiel(sujet);
  const contraintesExplicites = [
    cadrage.nombreDomaines
      ? `- La personne demande exactement ${cadrage.nombreDomaines} domaine${cadrage.nombreDomaines > 1 ? "s" : ""} : respecte ce nombre, sauf si une branche est réellement inexploitable.`
      : null,
    cadrage.nombreCompetences
      ? `- La personne demande environ ${cadrage.nombreCompetences} compétence${cadrage.nombreCompetences > 1 ? "s" : ""} : vise ce volume, sans remplir artificiellement les branches.`
      : null,
    cadrage.granularite
      ? `- Granularité demandée : ${cadrage.granularite}. ${
          cadrage.granularite === "fine"
            ? "Découpe les savoir-faire en unités observables étroites."
            : cadrage.granularite === "large"
              ? "Garde des capacités plus englobantes, sans les transformer en sujet vague."
              : "Garde un niveau de découpage équilibré et directement exploitable."
        }`
      : null,
    cadrage.portee === "large"
      ? `- La demande porte sur une vue d'ensemble${cadrage.niveau === "debutant" ? " pour débutant" : ""} : propose plusieurs domaines cohérents et au moins trois compétences observables dans chaque branche. Ne réduis jamais cette demande à une seule compétence isolée.`
      : null,
  ].filter((contrainte): contrainte is string => contrainte !== null);

  const stable = [
    "Tu es le tuteur du système pédagogique. Tu proposes un référentiel complet pour un sujet, découpé en branches.",
    "",
    "TU N'ENREGISTRES RIEN.",
    "La personne relit branche par branche, compétence par compétence, et coche ce qu'elle garde.",
    "",
    "PROTOCOLE DE RÉDACTION D'UNE COMPÉTENCE",
    `- Chaque intitulé est ${observable}.`,
    `- Chaque compétence est ${notable} du référentiel.`,
    `- Chaque compétence est ${deuxContextes}.`,
    `- Chaque compétence est ${exercable}.`,
    `- Chaque compétence est ${prouvable}.`,
    "- Du plus fondamental au plus avancé, à l'intérieur de chaque branche.",
    "",
    "COMMENT DÉCOUPER",
    // ADR-088 — un domaine n'est pas un thème.
    //
    // Mesuré le 18/08/2026 : « les LLM » avaient produit CINQ domaines et
    // 40 compétences, aucune mesurée, soit 43 % du référentiel actif — pendant
    // que deux autres domaines restaient vides. L'ancienne consigne disait
    // « trois à six branches pour un sujet large », et une branche a été lue
    // comme un domaine.
    existants.length > 0
      ? `- UNE branche par domaine, et ${BRANCHES_MAX_COMPTE_ETABLI} domaines nouveaux au maximum : ce compte en a déjà ${existants.length}.`
      : "- Une branche par grand domaine du sujet. Deux à quatre pour un sujet large ; une seule si le sujet est étroit.",
    "- Un DOMAINE n'est pas un THÈME. Un domaine porte un préfixe de code et se gouverne ; un thème regroupe librement des compétences en traversant les domaines. Pour découper un sujet large, ne multiplie pas les domaines : propose des compétences que la personne regroupera ensuite en thèmes.",
    "- Quatre à huit compétences par branche. Vingt compétences dans un domaine unique ne se relisent pas.",
    "- Ne propose pas une branche pour un thème que tu ne sais pas remplir de compétences mesurables.",
    "",
    "L'application attribue tous les codes, à l'enregistrement. Tu n'en écris aucun.",
    "",
    "RÉFÉRENTIEL EXISTANT DU COMPTE — ne redouble ni ces domaines ni leurs compétences :",
    resumerReferentielExistant(referentiel),
  ].join("\n");

  /*
   * Tout ce qui dépend du SUJET vit ici : les contraintes explicites lues dans
   * la demande, la consigne de vue d'ensemble, le sujet lui-même. Laissé dans
   * le bloc stable, chacun de ces éléments changeait le préfixe à chaque
   * requête et interdisait tout cache (`PromptTuteur`).
   */
  const variable = [
    ...(contraintesExplicites.length > 0
      ? ["CONTRAINTES EXPLICITES DE LA PERSONNE", ...contraintesExplicites, ""]
      : []),
    ...(cadrage.portee === "large"
      ? [
          "- Pour cette vue d'ensemble, couvre le socle puis une progression courte : plusieurs compétences fondamentales, intermédiaires et une ouverture vers la suite dans chaque branche.",
          "",
        ]
      : []),
    `Sujet demandé : ${sujet}`,
    "",
    "Appelle l'outil proposer_referentiel_complet UNE fois. Ne recopie pas le contenu de l'appel dans ta réponse.",
  ].join("\n");

  return { stable, variable };
}

/** Propose un référentiel entier, sans conversation. */
export async function proposerReferentiel(
  moteur: MoteurTuteur,
  referentiel: Referentiel,
  sujet: string,
  signal?: AbortSignal,
  diffuser?: (evenement: string, donnees: unknown) => void,
): Promise<ResultatReferentiel> {
  let resume = "";
  let branches: PropositionReferentiel[] = [];
  let ecartees = 0;
  let outilsActifs = true;
  /** La panne annoncée par le moteur — clé refusée, quota, modèle absent. */
  let panne: string | null = null;
  /**
   * Le refus motivé du validateur, quand il y en a un.
   *
   * Sans lui, « Aucun référentiel exploitable n'a été produit » recouvrait deux
   * situations opposées : un tuteur qui n'a rien proposé, et un tuteur qui a
   * proposé seize compétences refusées pour une raison précise et réparable.
   * Même distinction que dans `intention.ts`, même façon de la capturer.
   */
  let rejet: string | null = null;

  const envoyer = (evenement: string, donnees: unknown) => {
    if (evenement !== "texte") diffuser?.(evenement, donnees);
    if (evenement === "proposition-rejetee") {
      const message = (donnees as { message?: unknown } | null)?.message;
      if (typeof message === "string" && message.trim()) rejet = message.trim();
    }

    const actifs = lireOutilsActifs(evenement, donnees);
    if (actifs !== null) outilsActifs = actifs;
    panne = panne ?? lireErreurMoteur(evenement, donnees);

    if (evenement === "proposition") {
      const p = donnees as {
        genre: string;
        resume?: string;
        branches?: PropositionReferentiel[];
        ecartees?: number;
      };
      if (p.genre === "referentiel-complet" && p.branches) {
        resume = p.resume ?? "";
        branches = p.branches;
        ecartees = p.ecartees ?? 0;
      }
    }
  };

  const prompt = construirePromptReferentiel(referentiel, sujet);

  await moteur.repondre({
    systemeStable: prompt.stable,
    systemeProfil: prompt.variable,
    outils: [outilReferentielComplet(referentiel, sujet)],
    messages: [{ role: "user" as const, content: `Propose un référentiel pour : ${sujet}` }],
    signal,
    envoyer,
  });

  const erreur =
    branches.length > 0
      ? null
      : (panne ??
        (!outilsActifs
          ? messageSansOutils("la proposition de référentiel")
          : (rejet ??
            "Aucun référentiel exploitable n'a été produit.")));

  return { resume, branches, ecartees, outilsActifs, erreur };
}

/* ------------------------------------------------------------------ */
/* Suggestion                                                          */
/* ------------------------------------------------------------------ */

/**
 * Suggère une branche de compétences via le moteur, sans conversation.
 *
 * `envoyer` collecte les événements au lieu de les diffuser : la proposition
 * validée est retournée dans `branche`. Une proposition incomplète est rejetée
 * et annoncée — jamais acceptée à moitié.
 */
export async function suggererBranche(
  moteur: MoteurTuteur,
  referentiel: Referentiel,
  sujet: string,
  signal?: AbortSignal,
  /**
   * Relais **immédiat** des événements du moteur, pour la progression SSE.
   *
   * Même motif que `genererExercices` : sans lui, la modale écoute un
   * `proposition-en-cours` que personne n'émet, et reste sur son message
   * d'attente initial pendant toute la rédaction — un appel d'outil ne produit
   * aucun `content`, donc rien de visible.
  */
  diffuser?: (evenement: string, donnees: unknown) => void,
  profilDeclare = "",
): Promise<ResultatSuggestion> {
  let branche: PropositionReferentiel | null = null;
  let outilsActifs = true;
  /** La panne annoncée par le moteur — clé refusée, quota, modèle absent. */
  let panne: string | null = null;

  const envoyer = (evenement: string, donnees: unknown) => {
    diffuser?.(evenement, donnees);
    const actifs = lireOutilsActifs(evenement, donnees);
    if (actifs !== null) outilsActifs = actifs;
    panne = panne ?? lireErreurMoteur(evenement, donnees);
    if (evenement === "proposition") {
      const proposition = donnees as { genre: string; branche?: PropositionReferentiel };
      if (proposition.genre === "referentiel" && proposition.branche) {
        branche = proposition.branche;
      }
    }
  };

  const prompt = construirePromptSuggestion(referentiel, sujet);
  const systemeStable = prompt.stable;
  // Le profil déclaré et la demande du moment partagent le bloc variable : ni
  // l'un ni l'autre n'est stable d'un appel à l'autre.
  const systemeProfil = [profilDeclare, prompt.variable]
    .filter((bloc) => bloc.trim() !== "")
    .join("\n\n");

  const messages = [
    {
      role: "user" as const,
      content: `Propose une branche de compétences pour : ${sujet}`,
    },
  ];

  await moteur.repondre({
    systemeStable,
    systemeProfil,
    messages,
    outils: outilsTuteur(referentiel),
    signal,
    envoyer,
  });

  // Deux pannes distinctes derrière une même absence de branche : un tuteur
  // muet, qu'on relance en reformulant ; un fournisseur sans outils, qui ne se
  // relance pas du tout. Voir `genererExercices`.
  const erreur =
    branche !== null
      ? null
      : (panne ??
        (outilsActifs
          ? "Aucune branche exploitable n'a été produite."
          : messageSansOutils("la suggestion de compétences")));

  return { branche, outilsActifs, erreur };
}
