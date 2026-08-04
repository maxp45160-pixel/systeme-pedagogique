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
import { outilsTuteur } from "./outils";
import type { PropositionReferentiel } from "./proposition";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface DemandeSuggestion {
  /** Le sujet sur lequel on veut une branche — un thème, pas un objet. */
  sujet: string;
}

export interface ResultatSuggestion {
  /** Proposition validée, prête à être relue et enregistrée. */
  branche: PropositionReferentiel | null;
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
): Promise<ResultatSuggestion> {
  let branche: PropositionReferentiel | null = null;

  const envoyer = (evenement: string, donnees: unknown) => {
    if (evenement === "proposition") {
      const proposition = donnees as { genre: string; branche?: PropositionReferentiel };
      if (proposition.genre === "referentiel" && proposition.branche) {
        branche = proposition.branche;
      }
    }
  };

  const systemeStable = construirePromptSuggestion(referentiel, sujet);
  const systemeProfil = "";

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

  const erreur = branche === null ? "Aucune branche exploitable n'a été produite." : null;
  return { branche, erreur };
}