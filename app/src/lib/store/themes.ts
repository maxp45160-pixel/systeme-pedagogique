/**
 * Lecture des thèmes du compte connecté (chantier « thèmes », ADR-053).
 *
 * Même partition que le référentiel (`lib/store/referentiel.ts`) : ce module
 * ne fait que l'entrée/sortie, tout ce qui est pur vit dans
 * `lib/domain/theme.ts`.
 */

import "server-only";

import { cache } from "react";

import { dorsaleCompte, type DorsaleCompte } from "./db";
import { ligneVersEntite, verifier } from "./supabase-backend";
import { mesurer } from "@/lib/profiling/server";
import type { Theme } from "@/lib/domain/theme";

import { chargerContexte } from "./context";

export async function lireThemes(dorsaleFournie?: DorsaleCompte): Promise<Theme[]> {
  const { supabase, userId } = dorsaleFournie ?? (await dorsaleCompte());

  const { data, error } = await mesurer("supabase:themes", () =>
    supabase.from("themes").select("*").eq("user_id", userId),
  );
  verifier("lecture des thèmes", error);

  return ((data ?? []) as Record<string, unknown>[]).map((l) => ligneVersEntite<Theme>(l));
}

/**
 * Lecture mémoïsée par requête — connectée au contexte complet.
 *
 * S'appuie sur `chargerContexte()` pour bénéficier de la RPC groupée
 * `charger_tout` et de la déduplication de requête.
 */
export const chargerThemes = cache(
  async (): Promise<Theme[]> => (await chargerContexte()).themes,
);
