import "server-only";
import { dorsaleCompte, type DorsaleCompte } from "./db";
import { verifier } from "./supabase-backend";

/** Le filtre est dans l'UPDATE : une sauvegarde tardive ne réécrit pas une réponse close. */
export async function ecrireReponseEnCours(attemptId: string, reponse: string, dorsaleFournie?: DorsaleCompte): Promise<void> {
  const { supabase, userId } = dorsaleFournie ?? await dorsaleCompte();
  const { data, error } = await supabase.from("attempts")
    .update({ reponse })
    .eq("user_id", userId)
    .eq("id", attemptId)
    .eq("statut", "en-cours")
    .select("id")
    .maybeSingle();
  verifier("enregistrement de la réponse", error);
  if (!data) throw new Error("Cette tentative est close ou inaccessible. Sa réponse d'origine reste conservée.");
}
