import "server-only";

/**
 * Les faits déclarés qui autorisent une famille de relecture.
 *
 * Une version de domaine dit seulement que le référentiel a bougé. Elle ne
 * distingue pas une matière nouvelle apportée par la personne de
 * l'acceptation d'une proposition précédente. Ce journal étroit conserve le
 * second fait dont la relecture a réellement besoin : « N ajout(s) viennent
 * d'être déclarés ».
 *
 * Il est append-only par les droits SQL. Une relecture consomme le signal par
 * comparaison de dates, sans modifier ni supprimer la déclaration.
 */

import { dorsaleCompte } from "./db";
import { verifier } from "./supabase-backend";

export type FamilleRelecture = "structure" | "progression" | "maintenance";
export type CauseDeclencheurRelecture =
  | "croissance_referentiel"
  | "intention_moyen"
  | "intention_long";

export interface DernierDeclencheurDeclare {
  famille: Exclude<FamilleRelecture, "maintenance">;
  cause: CauseDeclencheurRelecture;
  nombre: number;
  creeLe: string;
}

/** Enregistre seulement un fait qui a effectivement été écrit ou déclaré. */
export async function inscrireDeclencheurDeclare(
  famille: Exclude<FamilleRelecture, "maintenance">,
  cause: CauseDeclencheurRelecture,
  nombre = 1,
): Promise<void> {
  if (!Number.isInteger(nombre) || nombre < 1) return;

  const dorsale = await dorsaleCompte();
  const { error } = await dorsale.supabase
    .from("declencheurs_relecture_referentiel")
    .insert({ user_id: dorsale.userId, famille, cause, nombre });
  verifier("inscription d'un déclencheur déclaré de relecture", error);
}

/** Le dernier signal déclaré de cette famille. */
export async function dernierDeclencheurDeclare(
  famille: Exclude<FamilleRelecture, "maintenance">,
): Promise<DernierDeclencheurDeclare | null> {
  const dorsale = await dorsaleCompte();
  const { data, error } = await dorsale.supabase
    .from("declencheurs_relecture_referentiel")
    .select("famille, cause, nombre, created_at")
    .eq("user_id", dorsale.userId)
    .eq("famille", famille)
    .order("created_at", { ascending: false })
    .limit(1);
  verifier("lecture du dernier déclencheur déclaré de relecture", error);

  const ligne = (data ?? [])[0] as
    | { famille: DernierDeclencheurDeclare["famille"]; cause: CauseDeclencheurRelecture; nombre: number; created_at: string }
    | undefined;
  return ligne
    ? { famille: ligne.famille, cause: ligne.cause, nombre: ligne.nombre, creeLe: ligne.created_at }
    : null;
}

/** Les signaux postérieurs à la dernière analyse de la famille. */
export async function declencheursDeclaresDepuis(
  famille: Exclude<FamilleRelecture, "maintenance">,
  depuis: string | null,
): Promise<DernierDeclencheurDeclare[]> {
  const dorsale = await dorsaleCompte();
  let requete = dorsale.supabase
    .from("declencheurs_relecture_referentiel")
    .select("famille, cause, nombre, created_at")
    .eq("user_id", dorsale.userId)
    .eq("famille", famille)
    .order("created_at", { ascending: true });
  if (depuis) requete = requete.gt("created_at", depuis);
  const { data, error } = await requete;
  verifier("lecture des déclencheurs déclarés de relecture", error);
  return ((data ?? []) as Array<{
    famille: DernierDeclencheurDeclare["famille"];
    cause: CauseDeclencheurRelecture;
    nombre: number;
    created_at: string;
  }>).map((ligne) => ({
    famille: ligne.famille,
    cause: ligne.cause,
    nombre: ligne.nombre,
    creeLe: ligne.created_at,
  }));
}
