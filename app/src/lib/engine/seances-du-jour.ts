/**
 * Projection des séances acceptées qui concernent le jour demandé.
 *
 * Cette lecture appartient à Décide : elle ne lit ni Supabase, ni l'horloge,
 * et ne persiste rien. Une séance en cours reste visible quel que soit le
 * jour où elle a été commencée ; une séance planifiée est retenue seulement
 * si son jour civil correspond à la demande.
 */

import type { LearningSession } from "@/lib/domain/types";
import {
  construireVueSeancesAVenir,
  type SeanceAVenir,
} from "@/lib/engine/seances-a-venir";

export interface VueSeancesDuJour {
  enCours: SeanceAVenir[];
  planifiees: SeanceAVenir[];
}

function jourCivilValide(jourCivil: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(jourCivil)) return false;
  const date = new Date(`${jourCivil}T00:00:00.000Z`);
  return (
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === jourCivil
  );
}

function comparer(a: SeanceAVenir, b: SeanceAVenir): number {
  if (a.statut !== b.statut) return a.statut === "en-cours" ? -1 : 1;
  if (a.plannedFor === null && b.plannedFor !== null) return 1;
  if (a.plannedFor !== null && b.plannedFor === null) return -1;
  if (a.plannedFor !== null && b.plannedFor !== null) {
    const date = a.plannedFor.localeCompare(b.plannedFor);
    if (date !== 0) return date;
  }
  return a.sessionId.localeCompare(b.sessionId);
}

/** Construit la file du jour sans fabriquer ni modifier de donnée. */
export function construireSeancesDuJour(
  sessions: readonly LearningSession[],
  jourCivil: string,
): VueSeancesDuJour {
  const seances = construireVueSeancesAVenir(sessions).seances;
  const enCours = seances
    .filter((seance) => seance.statut === "en-cours")
    .sort(comparer);
  const planifiees = jourCivilValide(jourCivil)
    ? seances
        .filter(
          (seance) => seance.statut === "planifiee" && seance.jour === jourCivil,
        )
        .sort(comparer)
    : [];

  return { enCours, planifiees };
}
