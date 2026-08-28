import {
  INTERVENTION_TYPES,
  type InterventionEffect,
  type InterventionSeance,
  type InterventionSource,
  type InterventionType,
} from "./intervention-seance";
import { exerciceExplicationPour, exerciceRappelPour } from "./protocole-cours";

/**
 * Registre unique des chemins d'exécution. La table est exhaustive par
 * construction : ajouter un type canonique oblige à choisir explicitement un
 * rendu avant de pouvoir compiler.
 */
export type InterventionRenderKind =
  | "exercise"
  | "feynman"
  | "recall"
  | "document"
  | "writing"
  | "tutor";

export interface InterventionRenderDefinition {
  type: InterventionType;
  kind: InterventionRenderKind;
  label: string;
  /** Une clôture de ce rendu ne crée pas d'Observation par elle-même. */
  observationPath: "validated-proof" | "none";
}

export const REGISTRE_RENDUS_INTERVENTIONS = {
  resolve: {
    type: "resolve",
    kind: "exercise",
    label: "Résoudre",
    observationPath: "validated-proof",
  },
  diagnose: {
    type: "diagnose",
    kind: "exercise",
    label: "Diagnostiquer",
    observationPath: "validated-proof",
  },
  explain: {
    type: "explain",
    kind: "feynman",
    label: "Expliquer",
    observationPath: "validated-proof",
  },
  recall: {
    type: "recall",
    kind: "recall",
    label: "Rappeler",
    observationPath: "validated-proof",
  },
  read: {
    type: "read",
    kind: "document",
    label: "Lire",
    observationPath: "none",
  },
  synthesize: {
    type: "synthesize",
    kind: "writing",
    label: "Synthétiser",
    observationPath: "none",
  },
  produce: {
    type: "produce",
    kind: "writing",
    label: "Produire",
    observationPath: "none",
  },
  "ask-for-help": {
    type: "ask-for-help",
    kind: "tutor",
    label: "Demander de l'aide",
    observationPath: "none",
  },
} satisfies Record<InterventionType, InterventionRenderDefinition>;

export function renduPourIntervention(
  intervention: Pick<InterventionSeance, "type">,
): InterventionRenderDefinition {
  return REGISTRE_RENDUS_INTERVENTIONS[intervention.type];
}

const LIBELLES_EFFET: Record<InterventionEffect, string> = {
  measurement: "Mesure",
  preparation: "Préparation",
  support: "Soutien",
};

export function libelleEffetIntervention(effect: InterventionEffect): string {
  return LIBELLES_EFFET[effect];
}

export function libelleSourceIntervention(source: InterventionSource): string {
  const kind = {
    exercise: "Exercice",
    course: "Cours",
    document: "Document",
    engagement: "Échéance",
    "declared-need": "Besoin déclaré",
    session: "Séance",
  }[source.kind];
  return `${kind} · ${source.ref}`;
}

export function messageFinIntervention(intervention: InterventionSeance): string {
  if (intervention.expectedEffect === "preparation" || intervention.expectedEffect === "support") {
    return "Intervention terminée : aucune nouvelle mesure n'a été produite.";
  }
  if (!intervention.proofContract) {
    return "Aucune mesure produite : le contrat de preuve n'est pas rempli.";
  }
  return "Le résultat ne pourra alimenter une observation qu'après validation du contrat de preuve.";
}

/**
 * Consigne locale déterministe pour les deux rendus issus du protocole de
 * cours. Elle ne crée pas d'exercice et ne persiste rien ; sans durée ou cible
 * déclarée, elle renvoie `undefined` plutôt que d'inventer un paramètre.
 */
export function consigneDeterministeIntervention(
  intervention: InterventionSeance,
): string | undefined {
  const code = intervention.targetSkillCodes?.[0];
  const duree = intervention.estimatedDurationMinutes;
  if (!code || duree === undefined) return undefined;
  if (intervention.type === "explain") {
    return exerciceExplicationPour({
      code,
      intitule: intervention.label,
      consigne: intervention.label,
      dureeEstimeeMin: duree,
    }).enonce;
  }
  if (intervention.type === "recall") {
    return exerciceRappelPour({
      code,
      intitule: intervention.label,
      consigne: intervention.label,
      titreCours: intervention.source.ref,
      dureeEstimeeMin: duree,
    }).enonce;
  }
  return undefined;
}

/** Une fonction simple pour les tests d'exhaustivité, sans accès extérieur. */
export function typesCouvertsParLeRegistre(): readonly InterventionType[] {
  return INTERVENTION_TYPES.filter((type) => Boolean(REGISTRE_RENDUS_INTERVENTIONS[type]));
}
