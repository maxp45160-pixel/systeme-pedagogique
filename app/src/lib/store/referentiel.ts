/**
 * Lecture du référentiel de compétences du compte connecté (ADR-026).
 *
 * Jusqu'au 31/07/2026 le référentiel était `lib/domain/referentiel.ts` : un
 * module TypeScript compilé, identique pour tous les comptes, dont
 * `DOMAINE_PILOTE` fixait le périmètre actif. Il est désormais une donnée par
 * compte, dans les tables `domaines` et `competences`.
 *
 * Ce module ne fait que l'entrée/sortie. Tout ce qui est pur — assemblage des
 * vues dérivées, ordre, validation, attribution des codes — vit dans
 * `lib/domain/referentiel-compte.ts`, et reste donc testable sans base.
 */

import "server-only";

import { cache } from "react";

import { dorsaleCompte, lire, type DorsaleCompte } from "./db";
import { ligneVersEntite, verifier } from "./supabase-backend";
import { mesurer } from "@/lib/profiling/server";
import { assemblerReferentiel, modeRetrait, type ModeRetrait } from "@/lib/domain/referentiel-compte";
import type { Domaine, Referentiel, Skill } from "@/lib/domain/types";

export async function lireReferentiel(
  dorsaleFournie?: DorsaleCompte,
): Promise<Referentiel> {
  const { supabase, userId } = dorsaleFournie ?? (await dorsaleCompte());

  const [domaines, competences] = await Promise.all([
    mesurer("supabase:domaines", () => supabase.from("domaines").select("*").eq("user_id", userId)),
    mesurer("supabase:competences", () => supabase.from("competences").select("*").eq("user_id", userId)),
  ]);

  verifier("lecture des domaines", domaines.error);
  verifier("lecture des compétences", competences.error);

  return assemblerReferentiel(
    ((domaines.data ?? []) as Record<string, unknown>[]).map((l) => ligneVersEntite<Domaine>(l)),
    ((competences.data ?? []) as Record<string, unknown>[]).map((l) => ligneVersEntite<Skill>(l)),
  );
}

export const chargerReferentiel = cache(
  async (): Promise<Referentiel> => lireReferentiel(await dorsaleCompte()),
);

export interface EtatRetrait {
  preuves: number;
  mode: ModeRetrait;
}

/**
 * Pour chaque compétence, le geste de retrait qui s'appliquerait et le nombre
 * de preuves en jeu.
 *
 * C'est une **lecture**, pas une action : l'écran de gestion doit annoncer ce
 * qui va se produire avant le clic (ADR-027). Un bouton « supprimer » qui
 * archive en réalité, ou qui détruit des preuves sans le dire, serait trompeur
 * dans un sens comme dans l'autre.
 */
export const chargerRetraits = cache(async (): Promise<Map<string, EtatRetrait>> => {
  const dorsale = await dorsaleCompte();
  const [referentiel, preuves] = await Promise.all([
    lireReferentiel(dorsale),
    lire("evidence", dorsale),
  ]);

  const parCode = new Map<string, number>();
  for (const p of preuves) parCode.set(p.skillCode, (parCode.get(p.skillCode) ?? 0) + 1);

  return new Map(
    referentiel.skills.map((s) => {
      const n = parCode.get(s.code) ?? 0;
      return [s.code, { preuves: n, mode: modeRetrait(n) }];
    }),
  );
});
