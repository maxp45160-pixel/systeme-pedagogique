import "server-only";

import type {
  ExerciseAttempt,
  LearningSession,
  SkillObservation,
  VerdictTuteur,
} from "@/lib/domain/types";
import { dorsaleCompte, type DorsaleCompte } from "./db";
import { verifier } from "./supabase-backend";
import { DonneeSupabaseInvalide } from "./validation-supabase";

type TentativeTerminee = {
  id: string;
  exerciseId: string;
  fin: string;
  dureeMin: number;
  statut: "terminee";
  evaluation: ExerciseAttempt["evaluation"];
  resultat: ExerciseAttempt["resultat"];
  notes?: string;
  verdictTuteur?: VerdictTuteur;
};

type TentativeAbandonnee = {
  id: string;
  exerciseId: string;
  fin: string;
  dureeMin: number;
  statut: "abandonnee";
  notes?: string;
};

export interface ClotureExercice {
  tentative: TentativeTerminee | TentativeAbandonnee;
  observations: SkillObservation[];
  seance: LearningSession;
  seanceIdContexte?: string;
  /** Vrai uniquement quand l'appel fait déjà partie de la clôture de cette séance. */
  seanceHoteRequise?: boolean;
}

export interface ResultatClotureExercice {
  appliquee: boolean;
  tentativeId: string;
  observations: number;
  seanceId: string | null;
  seanceCreee: boolean;
}

function resultatCloture(valeur: unknown): ResultatClotureExercice {
  if (!valeur || typeof valeur !== "object" || Array.isArray(valeur)) {
    throw new DonneeSupabaseInvalide("clore_exercice", "résultat objet attendu");
  }
  const resultat = valeur as Record<string, unknown>;
  if (
    typeof resultat.appliquee !== "boolean" ||
    typeof resultat.tentativeId !== "string" ||
    resultat.tentativeId.length === 0 ||
    typeof resultat.observations !== "number" ||
    !Number.isInteger(resultat.observations) ||
    resultat.observations < 0 ||
    (resultat.seanceId !== null && typeof resultat.seanceId !== "string") ||
    typeof resultat.seanceCreee !== "boolean"
  ) {
    throw new DonneeSupabaseInvalide("clore_exercice", "résultat de clôture valide attendu");
  }
  return resultat as unknown as ResultatClotureExercice;
}

/**
 * Une seule transaction PostgreSQL pour le fait clos, ses observations et son
 * entrée de journal. La fonction SQL reste SECURITY INVOKER : le JWT et RLS
 * sont la frontière d'autorisation, aucun rôle privilégié n'est employé ici.
 */
export async function cloreExerciceAtomiquement(
  cloture: ClotureExercice,
  dorsaleFournie?: DorsaleCompte,
): Promise<ResultatClotureExercice> {
  const { supabase } = dorsaleFournie ?? (await dorsaleCompte());
  const { data, error } = await supabase.rpc("clore_exercice", {
    p_tentative: {
      ...cloture.tentative,
      ...(cloture.seanceHoteRequise ? { seanceHoteRequise: true } : {}),
    },
    p_observations: cloture.observations,
    p_seance: cloture.seance,
    p_seance_id_contexte: cloture.seanceIdContexte ?? null,
  });
  verifier("clôture atomique de l'exercice", error);
  return resultatCloture(data);
}
