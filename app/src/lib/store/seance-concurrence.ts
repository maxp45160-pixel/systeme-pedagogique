import "server-only";

import type { LearningSession } from "@/lib/domain/types";
import type { DorsaleCompte } from "./db";
import { verifier } from "./supabase-backend";
import { DonneeSupabaseInvalide } from "./validation-supabase";

type ChangementSeance = Partial<Pick<LearningSession, "statut" | "date" | "interventions">>;

/**
 * Compare dans l'UPDATE l'état qui a servi à préparer le geste. Un conflit
 * retourne false : aucun tableau d'interventions ni début de séance périmé
 * ne remplace alors une écriture concurrente. Aucun réessai implicite.
 */
export async function modifierSeanceSiInchangee(
  seance: LearningSession,
  changements: ChangementSeance,
  { supabase, userId }: DorsaleCompte,
): Promise<boolean> {
  let requete = supabase.from("sessions")
    .update(changements)
    .eq("user_id", userId)
    .eq("id", seance.id)
    .eq("date", seance.date);
  requete = seance.statut === undefined
    ? requete.is("statut", null)
    : requete.eq("statut", seance.statut);
  requete = seance.interventions === undefined
    ? requete.is("interventions", null)
    : requete.eq("interventions", JSON.stringify(seance.interventions));
  const { data, error } = await requete.select("id").maybeSingle();
  verifier("mise à jour de la séance", error);
  if (data === null) return false;
  if (!data || typeof data !== "object" || Array.isArray(data) || data.id !== seance.id) {
    throw new DonneeSupabaseInvalide("sessions", "identifiant de la séance modifiée attendu");
  }
  return true;
}
