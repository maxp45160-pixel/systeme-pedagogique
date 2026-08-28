import type { LearningSession } from "./types";
import {
  parseInterventionsSeance,
  type InterventionSeance,
} from "./intervention-seance";

export interface InterventionHistoriqueReserve {
  index: number;
  type: string;
  ref: string;
  label: string;
  reason: string;
}

export interface LectureInterventionsSeance {
  interventions: InterventionSeance[];
  reserves: InterventionHistoriqueReserve[];
  origine: "canonical" | "legacy";
}

function reserve(
  activite: { type: string; ref: string; libelle: string },
  index: number,
  reason: string,
): InterventionHistoriqueReserve {
  return {
    index,
    type: activite.type,
    ref: activite.ref,
    label: activite.libelle,
    reason,
  };
}

/**
 * Lit une séance ancienne sans écrire ni déduire de nouvelles données.
 * Seul le type historique `exercice` a une correspondance certaine avec
 * `resolve`; les autres formes restent visibles dans des réserves.
 */
export function lireInterventionsSeance(
  seance: Pick<LearningSession, "id" | "activites" | "interventions">,
): LectureInterventionsSeance {
  if (seance.interventions !== undefined) {
    try {
      return {
        interventions: parseInterventionsSeance(seance.interventions),
        reserves: [],
        origine: "canonical",
      };
    } catch (error) {
      return {
        interventions: [],
        reserves: [reserve(
          { type: "interventions", ref: seance.id, libelle: "", },
          -1,
          error instanceof Error ? error.message : "interventions invalides",
        )],
        origine: "canonical",
      };
    }
  }

  const interventions: InterventionSeance[] = [];
  const reserves: InterventionHistoriqueReserve[] = [];
  for (const [index, activite] of seance.activites.entries()) {
    if (activite.type !== "exercice") {
      reserves.push(reserve(activite, index, "type historique sans correspondance canonique"));
      continue;
    }
    if (activite.ref.trim().length === 0 || activite.libelle.trim().length === 0) {
      reserves.push(reserve(activite, index, "référence ou libellé historique vide"));
      continue;
    }
    interventions.push({
      id: `legacy-activity:${seance.id}:${index}`,
      type: "resolve",
      label: activite.libelle,
      source: { kind: "exercise", ref: activite.ref },
      expectedEffect: "measurement",
    });
  }
  return { interventions, reserves, origine: "legacy" };
}
