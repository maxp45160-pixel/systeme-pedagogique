/**
 * Génération d'exercices sans conversation — le chemin d'appel du lot 1.
 *
 * Le chat reste le chemin conversationnel : `construireContexte` y assemble
 * ~12 K jetons de protocole, dimensionnés pour une conversation. Ici, la
 * demande est unique et synthétique : un exercice sur une compétence précise,
 * calibré par ce que `calibrer()` a déjà dérivé. Le prompt est donc **court** —
 * identité, protocole de rédaction, calibrage des compétences visées, domaines
 * actifs — et n'emporte ni le protocole d'évaluation complet, ni le travail
 * récent, ni les priorités calculées.
 *
 * La génération passe par `moteur.repondre` avec l'outil `proposer_exercice` :
 * c'est le même moteur, la même validation, la même honnêteté. La différence
 * est dans `envoyer` : au lieu de diffuser vers le navigateur, il **collecte**
 * les événements `proposition` dans un tableau. Un `envoyer` qui collecte au
 * lieu de diffuser suffit — c'est exactement ce que le plan appelle « un chemin
 * d'appel non conversationnel ».
 *
 * ⚠️ Dépendance à l'outillage. La génération directe exige un fournisseur qui
 * sait appeler un outil. Sans support, le bouton se désactive et le dit — même
 * honnêteté que le 503 « copier le contexte ». On ne devine pas un exercice
 * dans de la prose.
 */

import type { Referentiel, Skill } from "@/lib/domain/types";
import { LIBELLES_DIMENSIONS } from "@/lib/domain/types";
import type { Calibration } from "@/lib/engine/calibration";
import type { MoteurTuteur } from "./moteurs";
import { outilsTuteur } from "./outils";
import type { PropositionExercice, PropositionReferentiel } from "./proposition";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface DemandeGeneration {
  /** Compétence cible — la première du tableau d'exercice. */
  competence: Skill;
  /** Calibration dérivée des tentatives, ou `null` si aucune exploitable. */
  calibration: Calibration | null;
  /** Indice de rédaction facultatif — un thème, pas un sélecteur d'objet. */
  theme?: string;
}

export interface ResultatGeneration {
  /** Propositions validées, prêtes à être relues et enregistrées. */
  exercices: PropositionExercice[];
  /** Événements reçus pendant la génération — pour la progression SSE. */
  evenements: { evenement: string; donnees: unknown }[];
  /** Message d'erreur, ou `null` si la génération a abouti. */
  erreur: string | null;
}

/* ------------------------------------------------------------------ */
/* Prompt court                                                        */
/* ------------------------------------------------------------------ */

/**
 * Le prompt système de la génération directe.
 *
 * Volontairement court : pas de `construireContexte` en entier (~12 K jetons,
 * dimensionné pour le chat). Ce qui est nécessaire ici :
 *
 * 1. l'identité — qui écrit, et dans quel cadre ;
 * 2. le protocole de rédaction — ce qu'un exercice doit contenir pour être
 *    mesurable (énoncé, indices, correction, critères) ;
 * 3. le CALIBRAGE des compétences visées — la difficulté dérivée des
 *    tentatives, jamais laissée à l'appréciation du modèle (ADR-028) ;
 * 4. les domaines actifs — pour que le schéma de l'outil puisse contraindre
 *    le domaine en `enum`.
 *
 * Le reste du protocole (évaluation, anti-hallucination, référentiel) ne sert
 * pas ici : la génération ne produit aucune mesure, elle produit du contenu.
 * P5 reformulé — « le tuteur écrit le contenu, jamais la mesure » — c'est
 * exactement ce que ce prompt assume.
 */
export function construirePromptGeneration(
  referentiel: Referentiel,
  demandes: { competence: Skill; calibration: Calibration | null; theme?: string }[],
): string {
  const domaines = referentiel.domaines
    .filter((d) => referentiel.actifs.some((s) => s.domaine === d.id))
    .map((d) => d.id);

  const lignes: string[] = [
    "Tu es le tuteur du système pédagogique. Tu rédiges des exercices à partir de ce qui a été mesuré.",
    "",
    "PROTOCOLE DE RÉDACTION D'UN EXERCICE",
    "- L'énoncé doit être précis, autonome et tenir en un écran.",
    "- Les indices vont du plus léger au plus explicite : ils mesurent l'autonomie.",
    "- La correction est complète : elle permet à l'utilisateur de s'auto-évaluer.",
    "- Chaque critère porte sur une dimension du référentiel (compréhension, application, transfert, intégration, justification) et doit être cochable par l'utilisateur.",
    "- La durée estimée doit être réaliste : c'est elle qui permet de juger si la tentative a eu lieu.",
    "",
    "CALIBRAGE — LA DIFFICULTÉ N'EST PAS À TON APPRÉCIATION",
    "Elle est dérivée des tentatives réelles. Emploie la difficulté conseillée ; si tu t'en écartes, c'est une erreur.",
    "",
  ];

  for (const d of demandes) {
    const cal = d.calibration;
    const difficulte =
      cal?.difficulteConseillee ?? "déduite du niveau (aucune tentative exploitable)";
    const dimension = cal?.dimensionFaible
      ? `, en faisant travailler surtout la dimension « ${LIBELLES_DIMENSIONS[cal.dimensionFaible.dimension]} »`
      : "";
    lignes.push(`- ${d.competence.code} — ${d.competence.intitule} : difficulté ${difficulte}${dimension}`);
  }

  lignes.push(
    "",
    `Domaines disponibles : ${domaines.length > 0 ? domaines.join(", ") : "aucun — commence par proposer une branche."}`,
    "",
    "Appelle l'outil proposer_exercice UNE fois par exercice demandé. Ne recopie pas le contenu de l'appel dans ta réponse.",
  );

  return lignes.join("\n");
}

/* ------------------------------------------------------------------ */
/* Génération                                                          */
/* ------------------------------------------------------------------ */

/**
 * Génère un ou plusieurs exercices via le moteur, sans conversation.
 *
 * `envoyer` collecte les événements au lieu de les diffuser : les propositions
 * validées sont retournées dans `exercices`, et tous les événements (texte,
 * proposition-en-cours, erreur…) sont conservés pour la progression SSE de la
 * modale.
 *
 * La validation est la même que dans le chat : `validerAppelOutil` applique le
 * schéma, `exerciceComplet` refuse une proposition tronquée. Une proposition
 * incomplète est rejetée et annoncée — jamais acceptée à moitié.
 */
export async function genererExercices(
  moteur: MoteurTuteur,
  referentiel: Referentiel,
  demandes: { competence: Skill; calibration: Calibration | null; theme?: string }[],
  signal?: AbortSignal,
  /**
   * Relais **immédiat** des événements du moteur, pour la progression SSE.
   *
   * Sans lui, les événements n'étaient que collectés et rendus à la fin :
   * l'appelant les rejouait après l'`await`, donc le navigateur ne recevait
   * rien pendant toute la génération — jusqu'à 300 s — puis tout d'un coup.
   * Le flux existait, la progression non.
   */
  diffuser?: (evenement: string, donnees: unknown) => void,
): Promise<ResultatGeneration> {
  const evenements: { evenement: string; donnees: unknown }[] = [];
  const exercices: PropositionExercice[] = [];

  const envoyer = (evenement: string, donnees: unknown) => {
    evenements.push({ evenement, donnees });
    diffuser?.(evenement, donnees);
    if (evenement === "proposition") {
      const proposition = donnees as { genre: string; exercice?: PropositionExercice };
      if (proposition.genre === "exercice" && proposition.exercice) {
        exercices.push(proposition.exercice);
      }
    }
  };

  const systemeStable = construirePromptGeneration(referentiel, demandes);
  const systemeProfil = "";

  const messages = [
    {
      role: "user" as const,
      content: demandes
        .map((d, i) => {
          const theme = d.theme?.trim() ? ` Thème : ${d.theme.trim()}.` : "";
          return `${i + 1}. Un exercice sur ${d.competence.code}${theme}`;
        })
        .join("\n"),
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

  // Une proposition incomplète est rejetée par `validerAppelOutil` — elle
  // n'entre jamais dans `exercices`. On le redit ici pour l'interface : la
  // génération a pu aboutir sans produire d'exercice exploitable.
  const erreur = exercices.length === 0 ? "Aucun exercice exploitable n'a été produit." : null;

  return { exercices, evenements, erreur };
}

/* ------------------------------------------------------------------ */
/* Génération de branche référentiel (lot 2)                           */
/* ------------------------------------------------------------------ */

export interface ResultatGenerationBranche {
  /** Branches validées, prêtes à être relues et enregistrées. */
  branches: PropositionReferentiel[];
  /** Événements reçus pendant la génération — pour la progression SSE. */
  evenements: { evenement: string; donnees: unknown }[];
  /** Message d'erreur, ou `null` si la génération a abouti. */
  erreur: string | null;
}

/**
 * Le prompt système de la génération de branche.
 *
 * Encore plus court que celui de l'exercice : la branche ne dépend d'aucune
 * calibration, et le protocole de référentiel est porté par la description de
 * l'outil `proposer_referentiel` elle-même (les cinq conditions de
 * mesurabilité y vivent). Ce qui reste : l'identité, le sujet demandé, et les
 * domaines existants — pour que le tuteur propose d'étendre un domaine plutôt
 * qu'en créer un doublon.
 */
function construirePromptBranche(
  referentiel: Referentiel,
  theme: string,
): string {
  const domainesExistants = referentiel.domaines
    .filter((d) => !d.archive)
    .map((d) => `${d.nom} (${d.prefixe})`);

  return [
    "Tu es le tuteur du système pédagogique. Tu proposes une branche de compétences.",
    "",
    "PROTOCOLE DE RÉDIGATION D'UNE COMPÉTENCE",
    "- Chaque intitulé doit décrire un savoir-faire observable, pas un sujet.",
    "- Une compétence est mesurable : notable sur au moins une dimension, testable dans deux contextes, exerçable par un des types d'exercice, prouvable en 20 à 60 minutes.",
    "- Les paliers vont de « fondamentaux » à « avancé » ; l'importance est entre 0 et 1.",
    "- N'écris AUCUN code de compétence : l'application les attribue à l'enregistrement.",
    "",
    `Domaines existants : ${domainesExistants.length > 0 ? domainesExistants.join(", ") : "aucun — c'est une première branche."}`,
    "",
    `Sujet demandé : ${theme}`,
    "",
    "Appelle l'outil proposer_referentiel UNE fois. Ne recopie pas le contenu de l'appel dans ta réponse.",
  ].join("\n");
}

/**
 * Génère une branche de compétences via le moteur, sans conversation.
 *
 * Même mécanique que `genererExercices` : `envoyer` collecte, le moteur valide
 * contre le schéma, et la proposition est retournée pour prévisualisation avant
 * écriture. L'utilisateur valide — le tuteur propose (P5).
 */
export async function genererBranche(
  moteur: MoteurTuteur,
  referentiel: Referentiel,
  theme: string,
  signal?: AbortSignal,
  diffuser?: (evenement: string, donnees: unknown) => void,
): Promise<ResultatGenerationBranche> {
  const evenements: { evenement: string; donnees: unknown }[] = [];
  const branches: PropositionReferentiel[] = [];

  const envoyer = (evenement: string, donnees: unknown) => {
    evenements.push({ evenement, donnees });
    diffuser?.(evenement, donnees);
    if (evenement === "proposition") {
      const proposition = donnees as { genre: string; branche?: PropositionReferentiel };
      if (proposition.genre === "referentiel" && proposition.branche) {
        branches.push(proposition.branche);
      }
    }
  };

  const systemeStable = construirePromptBranche(referentiel, theme);
  const systemeProfil = "";

  const messages = [
    {
      role: "user" as const,
      content: `Propose-moi une branche de compétences sur : ${theme}`,
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

  const erreur = branches.length === 0 ? "Aucune branche exploitable n'a été produite." : null;

  return { branches, evenements, erreur };
}
