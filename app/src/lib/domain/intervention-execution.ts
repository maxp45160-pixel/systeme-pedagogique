import type { ExerciseAttempt, LearningSession } from "./types";
import {
  lireInterventionsSeance,
  type InterventionHistoriqueReserve,
} from "./legacy-session-intervention-adapter";
import type { InterventionSeance } from "./intervention-seance";
import {
  renduPourIntervention,
  type InterventionRenderDefinition,
} from "./intervention-rendus";

export type StatutExecutionIntervention =
  | "a-faire"
  | "en-cours"
  | "terminee"
  | "abandonnee";

export interface ExecutionIntervention {
  intervention: InterventionSeance;
  rendu: InterventionRenderDefinition;
  statut: StatutExecutionIntervention;
  /** Référence d'exercice résolue sans fabriquer d'exercice. */
  exerciceId?: string;
}

export interface LectureExecutionInterventions {
  executions: ExecutionIntervention[];
  reserves: InterventionHistoriqueReserve[];
  origine: "canonical" | "legacy";
}

function statutDepuisTentatives(
  intervention: InterventionSeance,
  seance: LearningSession,
  tentatives: readonly ExerciseAttempt[],
): StatutExecutionIntervention {
  if (intervention.statut === "completed") return "terminee";
  if (intervention.statut === "abandoned") return "abandonnee";
  if (intervention.source.kind !== "exercise") return "a-faire";

  const siennes = tentatives.filter(
    (tentative) =>
      tentative.exerciseId === intervention.source.ref &&
      tentative.debut >= seance.date,
  );
  if (siennes.some((tentative) => tentative.statut === "terminee")) return "terminee";
  if (siennes.some((tentative) => tentative.statut === "en-cours")) return "en-cours";
  if (siennes.some((tentative) => tentative.statut === "abandonnee")) return "abandonnee";
  return "a-faire";
}

/**
 * Projection pure de l'exécution d'une séance.
 *
 * Les interventions canoniques peuvent porter un statut de geste ; pour les
 * exercices, la tentative reste la source de vérité. Rien ici n'écrit une
 * Observation et l'absence de preuve reste une absence.
 */
export function lireExecutionInterventions(
  seance: LearningSession,
  tentatives: readonly ExerciseAttempt[],
): LectureExecutionInterventions {
  const lecture = lireInterventionsSeance(seance);
  return {
    executions: lecture.interventions.map((intervention) => ({
      intervention,
      rendu: renduPourIntervention(intervention),
      statut: statutDepuisTentatives(intervention, seance, tentatives),
      ...(intervention.source.kind === "exercise"
        ? { exerciceId: intervention.source.ref }
        : {}),
    })),
    reserves: lecture.reserves,
    origine: lecture.origine,
  };
}

export function interventionCourante(
  executions: readonly ExecutionIntervention[],
  demandee?: string,
): ExecutionIntervention | undefined {
  const candidate = demandee
    ? executions.find(
        (execution) =>
          execution.intervention.id === demandee &&
          execution.statut !== "terminee" &&
          execution.statut !== "abandonnee",
      )
    : undefined;
  return candidate ?? executions.find(
    (execution) => execution.statut === "en-cours" || execution.statut === "a-faire",
  );
}

export function interventionsTerminees(
  executions: readonly ExecutionIntervention[],
): boolean {
  return executions.length > 0 && executions.every(
    (execution) => execution.statut === "terminee" || execution.statut === "abandonnee",
  );
}

export function interventionsAReprendre(
  executions: readonly ExecutionIntervention[],
): boolean {
  return executions.some(
    (execution) => execution.statut === "a-faire" || execution.statut === "en-cours",
  );
}

export function nombreInterventionsTraitees(
  executions: readonly ExecutionIntervention[],
): number {
  return executions.filter(
    (execution) => execution.statut === "terminee" || execution.statut === "abandonnee",
  ).length;
}

export function resumeInterventions(
  executions: readonly ExecutionIntervention[],
  abandonnee = false,
): string {
  const traitees = nombreInterventionsTraitees(executions);
  const abandonnees = executions.filter((execution) => execution.statut === "abandonnee").length;
  const prefixe = abandonnee ? "Séance abandonnée" : "Séance";
  return abandonnees > 0
    ? `${prefixe} — ${traitees} intervention(s) traitée(s) sur ${executions.length}, ${abandonnees} abandonnée(s)`
    : `${prefixe} — ${traitees} intervention(s) traitée(s) sur ${executions.length}`;
}

export function prochainExerciceIntervention(
  executions: readonly ExecutionIntervention[],
  currentId: string | undefined,
): string | undefined {
  const index = currentId
    ? executions.findIndex((execution) => execution.intervention.id === currentId)
    : -1;
  return executions.slice(index + 1).find(
    (execution) =>
      execution.rendu.kind === "exercise" &&
      execution.exerciceId !== undefined &&
      (execution.statut === "a-faire" || execution.statut === "en-cours"),
  )?.exerciceId;
}
