import "server-only";
import { comptePiloteDepot } from "./depot-budget";
import { QWEN_BUDGET, coutQwen } from "@/lib/tutor/qwen-config";

export async function budgetQwen() {
  const { supabase, userId } = await comptePiloteDepot();
  const { data, error } = await supabase.from("qwen_usage").select("reserve_micro_dollars").eq("user_id", userId);
  if (error) throw new Error("Le budget Qwen ne peut pas être vérifié.");
  let engage = 0;
  for (const ligne of data ?? []) {
    const n = Number(ligne.reserve_micro_dollars);
    if (!Number.isSafeInteger(n) || n < 0) throw new Error("Compteur Qwen invalide.");
    engage += n;
  }
  return { engage, restant: Math.max(0, QWEN_BUDGET - engage), plafond: QWEN_BUDGET };
}
export async function reserverQwen(operation: string, entree: number, sortie: number) {
  coutQwen(entree, sortie);
  const { supabase } = await comptePiloteDepot();
  const { error } = await supabase.rpc("qwen_reserver_compte", { p_operation: operation, p_entree: entree, p_sortie: sortie });
  if (error) throw new Error(error.message.includes("Budget") ? "L’enveloppe d’essai Qwen de 5 $ est épuisée." : "La réservation Qwen est refusée. Vérifiez le budget et la validité des tarifs.");
}
