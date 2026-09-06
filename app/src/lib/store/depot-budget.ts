import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase/config";
import { dorsaleCompte } from "./db";
import { BUDGET_DEPOT_MICRO_EUROS } from "@/lib/documents/depot";

export async function estPiloteDepot(): Promise<boolean> {
  const {supabase,userId} = await dorsaleCompte();
  const {data,error} = await supabase.from("comptes_acces")
    .select("role,suspendu_le,depot_pilote").eq("user_id",userId).maybeSingle();
  return !error && data?.role === "admin" && data.suspendu_le === null && data.depot_pilote === true;
}
export async function comptePiloteDepot() {
  const compte = await dorsaleCompte();
  if (!await estPiloteDepot()) throw new Error("Le dépôt documentaire est réservé au compte pilote activé.");
  return compte;
}
/** Privilège confiné aux écritures d'infrastructure, après autorisation par JWT/RLS. */
export function clientInfrastructureDepot() {
  const cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!cle || !SUPABASE_URL) throw new Error("L'analyse documentaire n'est pas configurée. Vos fichiers restent conservés.");
  return createClient(SUPABASE_URL, cle, { auth: { persistSession: false, autoRefreshToken: false } });
}
export function configurationDepotDisponible(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.MISTRAL_API_KEY && SUPABASE_URL)
    && Date.now() < Date.parse("2026-10-06T00:00:00Z");
}
export async function budgetRestantDepot(): Promise<number> {
  const { supabase, userId } = await comptePiloteDepot();
  const { data, error } = await supabase.from("document_depot_usage")
    .select("reserve_micro_euros,facture_micro_euros").eq("user_id", userId)
    .eq("periode", `${new Date().toISOString().slice(0,7)}-01`);
  if (error) throw new Error("Le budget documentaire ne peut pas être lu.");
  const utilise = (data ?? []).reduce((s, r) => {
    const valeur = Number(r.facture_micro_euros ?? r.reserve_micro_euros);
    if (!Number.isSafeInteger(valeur) || valeur < 0) throw new Error("Budget documentaire invalide.");
    return s + valeur;
  }, 0);
  return Math.max(0, BUDGET_DEPOT_MICRO_EUROS-utilise);
}
export async function reserverCoutDepot(operation: string, pages: number, entreeOctets: number, sortieMax: number): Promise<void> {
  const { userId } = await comptePiloteDepot();
  const { data, error } = await clientInfrastructureDepot().rpc("depot_reserver", {
    p_user_id: userId, p_operation: operation, p_pages: pages, p_entree_octets: entreeOctets, p_sortie_max: sortieMax,
  });
  if (error) throw new Error(error.message.includes("Budget") ? "Le budget documentaire de 5 € est épuisé." : "La réservation du coût a été refusée.");
  if (data?.nouvelle !== true) throw new Error("Cet appel a déjà été réservé. Une reprise explicite est nécessaire.");
}
export async function finaliserCoutDepot(operation: string, cout: number): Promise<void> {
  const { userId } = await comptePiloteDepot();
  const { error } = await clientInfrastructureDepot().rpc("depot_finaliser_cout", { p_user_id: userId, p_operation: operation, p_cout: cout });
  if (error) throw new Error("Le coût réel n'a pas pu être rapproché ; la réservation reste comptée.");
}
