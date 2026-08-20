/**
 * Lecture des thèmes du compte connecté (chantier « thèmes », ADR-053).
 *
 * Même partition que le référentiel (`lib/store/referentiel.ts`) : ce module
 * ne fait que l'entrée/sortie, tout ce qui est pur vit dans
 * `lib/domain/theme.ts`.
 */

import "server-only";

import { dorsaleCompte, type DorsaleCompte } from "./db";
import { ligneVersEntite, verifier } from "./supabase-backend";
import { mesurer } from "@/lib/profiling/server";
import type { Theme } from "@/lib/domain/theme";
import { validerLignesSupabase, validerTheme } from "./validation-supabase";

export async function lireThemes(dorsaleFournie?: DorsaleCompte): Promise<Theme[]> {
  const { supabase, userId } = dorsaleFournie ?? (await dorsaleCompte());

  const { data, error } = await mesurer("supabase:themes", () =>
    supabase.from("themes").select("*").eq("user_id", userId),
  );
  verifier("lecture des thèmes", error);

  return validerLignesSupabase(data, "themes").map((l, index) =>
    validerTheme(ligneVersEntite<Theme>(l), `themes[${index}]`));
}
