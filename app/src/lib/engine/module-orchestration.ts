import {
  echeancesDuModule,
  joursRestants,
  type Engagement,
} from "@/lib/domain/engagement";
import { lireInterventionsSeance } from "@/lib/domain/legacy-session-intervention-adapter";
import { statutSeance } from "@/lib/domain/seance";
import type {
  InterventionEffect,
  InterventionType,
  LearningSession,
  SkillState,
} from "@/lib/domain/types";
import {
  evaluerPreparationEcheances,
  type PreparationState,
} from "./planification-temporelle";

export interface SeanceModuleCetteSemaine {
  sessionId: string;
  plannedFor: string;
  durationMinutes?: number;
  interventionLabel?: string;
  interventionType?: InterventionType;
  expectedEffect?: InterventionEffect;
  status: "planifiee" | "en-cours";
  reservations: string[];
}

export interface EcheanceModulePreparee {
  id: string;
  type: string;
  label: string;
  dueAt: string;
  daysRemaining: number;
  preparation: PreparationState;
  evidenceRefs: string[];
  reasons: string[];
  reservations: string[];
}

export interface LectureOrchestrationModule {
  thisWeek: SeanceModuleCetteSemaine[];
  deadlines: EcheanceModulePreparee[];
}

export interface EntreeOrchestrationModule {
  domainId: string;
  sessions: readonly LearningSession[];
  engagements: readonly Engagement[];
  skillStates: readonly SkillState[];
  now: Date;
}

function bornesSemaine(now: Date): { start: number; end: number } {
  const start = new Date(now);
  const offset = (start.getDay() + 6) % 7;
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - offset);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return { start: start.getTime(), end: end.getTime() };
}

function seanceCetteSemaine(
  session: LearningSession,
  domainId: string,
  start: number,
  end: number,
): SeanceModuleCetteSemaine | null {
  const status = statutSeance(session);
  if (status !== "planifiee" && status !== "en-cours") return null;
  if (!session.domaines.includes(domainId)) return null;
  const plannedFor = session.planifieePour ?? session.date;
  const instant = Date.parse(plannedFor);
  if (!Number.isFinite(instant) || instant < start || instant >= end) return null;

  const reading = lireInterventionsSeance(session);
  const intervention = reading.interventions[0];
  return {
    sessionId: session.id,
    plannedFor,
    durationMinutes:
      session.dureePlanifieeMin
      ?? intervention?.estimatedDurationMinutes
      ?? session.blueprint?.dureeCibleMin,
    interventionLabel: intervention?.label,
    interventionType: intervention?.type,
    expectedEffect: intervention?.expectedEffect,
    status,
    reservations: [
      ...reading.reserves.map((reservation) => reservation.reason),
      ...(!intervention && reading.reserves.length === 0
        ? ["L'intervention historique ne peut pas être relue sans fabriquer sa nature."]
        : []),
    ],
  };
}

/** Projection pure de la fiche module ; aucun plan ni état de préparation n'est écrit. */
export function construireLectureOrchestrationModule(
  input: EntreeOrchestrationModule,
): LectureOrchestrationModule {
  const week = bornesSemaine(input.now);
  const thisWeek = input.sessions
    .map((session) => seanceCetteSemaine(
      session,
      input.domainId,
      week.start,
      week.end,
    ))
    .filter((session): session is SeanceModuleCetteSemaine => session !== null)
    .sort((left, right) =>
      left.plannedFor.localeCompare(right.plannedFor)
      || left.sessionId.localeCompare(right.sessionId));

  const engagements = echeancesDuModule(input.domainId, [...input.engagements]);
  const preparationById = new Map(
    evaluerPreparationEcheances(engagements, input.skillStates)
      .map((preparation) => [preparation.engagementId, preparation]),
  );
  const deadlines = engagements.map((engagement) => {
    const preparation = preparationById.get(engagement.id);
    return {
      id: engagement.id,
      type: engagement.type,
      label: engagement.libelle,
      dueAt: engagement.echeanceLe,
      daysRemaining: joursRestants(engagement.echeanceLe, input.now),
      preparation: preparation?.state ?? "non-estimable",
      evidenceRefs: [...(preparation?.evidenceRefs ?? [])],
      reasons: [...(preparation?.reasons ?? [])],
      reservations: preparation
        ? [...preparation.reservations]
        : ["La préparation ne peut pas être estimée à partir des preuves disponibles."],
    } satisfies EcheanceModulePreparee;
  });

  return { thisWeek, deadlines };
}
