import type { RefusRecommandation } from "@/lib/domain/types";
import {
  INTERVENTION_EFFECTS,
  INTERVENTION_TYPES,
  type InterventionEffect,
  type InterventionType,
} from "@/lib/domain/intervention-seance";
import type {
  ActivityFamily,
  RecommendedLearningAction,
} from "@/lib/domain/adaptive-learning";
import type { Recommandation } from "./recommend";
import type { DimensionSeance } from "@/lib/domain/protocole-cours";

export const ACTION_CANDIDATE_SOURCES = [
  "existing-activity",
  "resume",
  "generation",
  "legacy-exercise",
  "course-protocol",
  "resource",
  "declared-need",
] as const;

export type ActionCandidateSource = typeof ACTION_CANDIDATE_SOURCES[number];

export type ActionCandidateProofMode =
  | "none"
  | "support-only"
  | "validated-submission";

export interface ActionCandidateTarget {
  skillCodes: string[];
  engagementIds?: string[];
  intentionRefs?: string[];
  label?: string;
}

export interface OrigineCandidateProtocole {
  courseDocumentId: string;
  sourceAttachmentId: string;
  domainId: string;
  dimension: DimensionSeance;
  instruction: string;
}

/**
 * Adaptateur de sortie : une candidate n'est pas encore une décision et ne
 * devient pas une séance tant qu'elle n'est pas acceptée.
 */
export interface ActionCandidate {
  candidateId: string;
  source: ActionCandidateSource;
  target: ActionCandidateTarget;
  intervention: InterventionType;
  expectedEffect: InterventionEffect;
  title: string;
  durationMinutes: number;
  minimumSegmentMinutes?: number;
  proofMode?: ActionCandidateProofMode;
  reasons: string[];
  constraints: string[];
  reservations: string[];
  sourceVersion?: number;
  /** Commande documentaire transitoire, uniquement pour une candidate de cours. */
  courseProtocolOrigin?: OrigineCandidateProtocole;
}

export interface ActionCandidateAdapterOptions {
  expectedEffect: InterventionEffect;
  proofMode?: ActionCandidateProofMode;
  engagementIds?: string[];
}

function sourceDepuisAction(action: RecommendedLearningAction): ActionCandidateSource {
  if (action.source === "activite") return "existing-activity";
  if (action.source === "reprise") return "resume";
  return "generation";
}

function interventionDepuisFamille(family: ActivityFamily): InterventionType {
  if (family === "explorer") return "read";
  if (family === "produire") return "produce";
  return "resolve";
}

/** Adapte une recommandation historique concrète sans relancer son moteur. */
export function actionCandidateDepuisRecommandation(
  recommandation: Recommandation,
  options: { engagementIds?: string[] } = {},
): ActionCandidate | null {
  const exercice = recommandation.exercice;
  if (!exercice) return null;
  const raisons = [
    recommandation.raison,
    ...recommandation.facteurs.map((facteur) => facteur.phrase),
  ].filter((raison, index, toutes) => toutes.indexOf(raison) === index);
  return {
    candidateId: `legacy-exercise:${exercice.id}`,
    source: "legacy-exercise",
    target: {
      skillCodes: [...exercice.competences],
      engagementIds: options.engagementIds ? [...options.engagementIds] : [],
      label: exercice.titre,
    },
    intervention: exercice.diagnostic ? "diagnose" : "resolve",
    expectedEffect: "measurement",
    title: exercice.titre,
    durationMinutes: exercice.dureeEstimeeMin,
    proofMode: "validated-submission",
    reasons: raisons,
    constraints: [],
    reservations: [],
  };
}

/**
 * Adapte `recommendLearningAction`. L'effet est obligatoire dans l'appelant :
 * cette sortie historique ne le porte pas et le moteur ne doit pas l'inventer.
 */
export function actionCandidateDepuisActionRecommandee(
  action: RecommendedLearningAction,
  options: ActionCandidateAdapterOptions,
): ActionCandidate {
  return {
    candidateId: action.candidateId,
    source: sourceDepuisAction(action),
    target: {
      skillCodes: [...action.target.skillCodes],
      intentionRefs: [...action.target.goalIds],
      engagementIds: options.engagementIds ? [...options.engagementIds] : [],
      label: action.target.label,
    },
    intervention: interventionDepuisFamille(action.family),
    expectedEffect: options.expectedEffect,
    title: action.title,
    durationMinutes: action.durationMinutes,
    proofMode: options.proofMode,
    reasons: action.factors.map((facteur) => facteur.label),
    constraints: [...action.constraints],
    reservations: [...action.reservations],
    sourceVersion: action.activityVersion,
  };
}

function texteNonVide(valeur: unknown): valeur is string {
  return typeof valeur === "string" && valeur.trim().length > 0;
}

/** Retourne une réserve plutôt que de laisser une candidate invalide entrer dans le plan. */
export function motifRefusActionCandidate(candidate: ActionCandidate): string | null {
  if (!texteNonVide(candidate.candidateId)) return "identité de candidate absente";
  if (!ACTION_CANDIDATE_SOURCES.includes(candidate.source)) return "source de candidate inconnue";
  if (!texteNonVide(candidate.title)) return "libellé de candidate absent";
  if (!INTERVENTION_TYPES.includes(candidate.intervention)) return "type d'intervention inconnu";
  if (!INTERVENTION_EFFECTS.includes(candidate.expectedEffect)) return "effet attendu inconnu";
  if (!Number.isInteger(candidate.durationMinutes) || candidate.durationMinutes <= 0) {
    return "durée de candidate invalide";
  }
  if (!candidate.target || !Array.isArray(candidate.target.skillCodes)
    || candidate.target.skillCodes.some((code) => !texteNonVide(code))) {
    return "cibles de compétence invalides";
  }
  if (candidate.target.engagementIds?.some((id) => !texteNonVide(id))) {
    return "identifiant d'engagement invalide";
  }
  if (candidate.target.intentionRefs?.some((ref) => !texteNonVide(ref))) {
    return "référence d'intention invalide";
  }
  if (candidate.source === "course-protocol") {
    const origin = candidate.courseProtocolOrigin;
    if (!origin) return "origine du protocole de cours absente";
    if (!texteNonVide(origin.courseDocumentId)
      || !texteNonVide(origin.sourceAttachmentId)
      || !texteNonVide(origin.domainId)
      || !texteNonVide(origin.instruction)) {
      return "origine du protocole de cours invalide";
    }
  } else if (candidate.courseProtocolOrigin) {
    return "origine de protocole portée par une autre source";
  }
  return null;
}

export interface RefusObserve {
  candidateId?: string;
  skillCode?: string;
  /** Refus d'une proposition de plan entière, valable jusqu'à changement d'entrée. */
  propositionRef?: string;
  observedAt: string;
  expiresAt?: string;
  sourceRef: string;
}

/** Convertit le fait historique stocké en entrée pure du planificateur. */
export function refusObserveDepuisRefusRecommandation(
  refus: RefusRecommandation,
): RefusObserve {
  const date = Date.parse(refus.date);
  const expiresAt = Number.isFinite(date)
    ? new Date(date + 7 * 24 * 60 * 60 * 1000).toISOString()
    : undefined;
  return {
    candidateId: refus.exerciceId ? `legacy-exercise:${refus.exerciceId}` : undefined,
    skillCode: refus.code,
    propositionRef: refus.propositionRef,
    observedAt: refus.date,
    expiresAt: refus.propositionRef ? undefined : expiresAt,
    sourceRef: `refus:${refus.id}`,
  };
}
