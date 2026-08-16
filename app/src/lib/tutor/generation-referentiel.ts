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
import type { MoteurTuteur } from "./moteurs";
import { lireErreurMoteur, lireOutilsActifs, messageSansOutils } from "./moteurs";
import { outilReferentielComplet, outilsTuteur } from "./outils";
import type { PropositionReferentiel } from "./proposition";

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
 * Le prompt système de la suggestion de branche.
 *
 * Volontairement court : identité, protocole de rédaction d'une compétence,
 * domaines actifs. Le reste du protocole (évaluation, anti-hallucination) ne
 * sert pas ici : la suggestion ne produit aucune mesure, elle produit du
 * contenu. P5 reformulé — « le tuteur écrit le contenu, jamais la mesure ».
 */
export function construirePromptSuggestion(
  referentiel: Referentiel,
  sujet: string,
): string {
  const domaines = referentiel.domaines
    .filter((d) => referentiel.actifs.some((s) => s.domaine === d.id))
    .map((d) => d.id);

  return [
    "Tu es le tuteur du système pédagogique. Tu proposes une branche de compétences pour un sujet demandé.",
    "",
    "PROTOCOLE DE RÉDACTION D'UNE COMPÉTENCE",
    "- Chaque intitulé doit être un savoir-faire observable, pas un sujet.",
    "- Chaque compétence doit être notable sur au moins une dimension du référentiel.",
    "- Chaque compétence doit être testable dans deux contextes.",
    "- Chaque compétence doit être exerçable par un des types d'exercice.",
    "- Chaque compétence doit être prouvable en 20 à 60 minutes.",
    "- Du plus fondamental au plus avancé.",
    "",
    `Sujet demandé : ${sujet}`,
    "",
    `Domaines disponibles : ${domaines.length > 0 ? domaines.join(", ") : "aucun — commence par proposer une branche."}`,
    "",
    "Appelle l'outil proposer_referentiel UNE fois. Ne recopie pas le contenu de l'appel dans ta réponse.",
  ].join("\n");
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
export function construirePromptReferentiel(referentiel: Referentiel, sujet: string): string {
  const existants = referentiel.domaines.filter((d) => !d.archive).map((d) => d.nom);

  return [
    "Tu es le tuteur du système pédagogique. Tu proposes un référentiel complet pour un sujet, découpé en branches.",
    "",
    "TU N'ENREGISTRES RIEN.",
    "La personne relit branche par branche, compétence par compétence, et coche ce qu'elle garde.",
    "",
    "PROTOCOLE DE RÉDACTION D'UNE COMPÉTENCE",
    "- Chaque intitulé est un savoir-faire observable, pas un sujet.",
    "- Chaque compétence est notable sur au moins une dimension du référentiel.",
    "- Chaque compétence est testable dans deux contextes.",
    "- Chaque compétence est exerçable par un des types d'exercice.",
    "- Chaque compétence est prouvable en 20 à 60 minutes.",
    "- Du plus fondamental au plus avancé, à l'intérieur de chaque branche.",
    "",
    "COMMENT DÉCOUPER",
    "- Une branche par grand thème du sujet. Trois à six branches pour un sujet large ; une seule si le sujet est étroit.",
    "- Quatre à huit compétences par branche. Vingt compétences dans un domaine unique ne se relisent pas.",
    "- Ne propose pas une branche pour un thème que tu ne sais pas remplir de compétences mesurables.",
    "",
    "L'application attribue tous les codes, à l'enregistrement. Tu n'en écris aucun.",
    "",
    `Sujet demandé : ${sujet}`,
    "",
    `Domaines déjà présents — ne les redouble pas : ${
      existants.length > 0 ? existants.join(" · ") : "aucun, le référentiel est vide"
    }`,
    "",
    "Appelle l'outil proposer_referentiel_complet UNE fois. Ne recopie pas le contenu de l'appel dans ta réponse.",
  ].join("\n");
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

  const envoyer = (evenement: string, donnees: unknown) => {
    if (evenement !== "texte") diffuser?.(evenement, donnees);

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

  await moteur.repondre({
    systemeStable: construirePromptReferentiel(referentiel, sujet),
    systemeProfil: "",
    outils: [outilReferentielComplet()],
    messages: [{ role: "user" as const, content: `Propose un référentiel pour : ${sujet}` }],
    signal,
    envoyer,
  });

  const erreur =
    branches.length > 0
      ? null
      : (panne ??
        (outilsActifs
          ? "Aucun référentiel exploitable n'a été produit."
          : messageSansOutils("la proposition de référentiel")));

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

  const systemeStable = construirePromptSuggestion(referentiel, sujet);
  const systemeProfil = profilDeclare;

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
