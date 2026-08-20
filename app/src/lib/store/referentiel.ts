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

import { dorsaleCompte, type DorsaleCompte } from "./db";
import { ligneVersEntite, verifier } from "./supabase-backend";
import { mesurer } from "@/lib/profiling/server";
import { assemblerReferentiel } from "@/lib/domain/referentiel-compte";
import type { Domaine, Referentiel, Skill } from "@/lib/domain/types";
import type { ChangementReferentiel } from "@/lib/domain/gouvernance-referentiel";

export async function lireReferentiel(
  dorsaleFournie?: DorsaleCompte,
): Promise<Referentiel> {
  const { supabase, userId } = dorsaleFournie ?? (await dorsaleCompte());

  const [domaines, competences, rattachements] = await Promise.all([
    mesurer("supabase:domaines", () => supabase.from("domaines").select("*").eq("user_id", userId)),
    mesurer("supabase:competences", () => supabase.from("competences").select("*").eq("user_id", userId)),
    mesurer("supabase:competence_domaines", () =>
      supabase.from("competence_domaines").select("code,domaine").eq("user_id", userId)),
  ]);

  verifier("lecture des domaines", domaines.error);
  verifier("lecture des compétences", competences.error);
  verifier("lecture des rattachements de compétences", rattachements.error);

  return assemblerReferentiel(
    ((domaines.data ?? []) as Record<string, unknown>[]).map((l) => ligneVersEntite<Domaine>(l)),
    ((competences.data ?? []) as Record<string, unknown>[]).map((l) => ligneVersEntite<Skill>(l)),
    (rattachements.data ?? []) as Array<{ code: string; domaine: string }>,
  );
}

/**
 * Lecture mémoïsée par requête.
 *
 * ⚠️ **C'est celle-ci qu'il faut appeler**, pas `lireReferentiel` directement.
 * Deux appelants faisaient chacun leur propre `lireReferentiel` dans la même
 * requête — `chargerContexte` et l'ancien `chargerRetraits` — et domaines,
 * compétences et observations étaient lus deux fois par rendu. `chargerReferentiel`
 * existait déjà, mémoïsé, et n'était utilisé nulle part.
 *
 * `lireReferentiel` reste exportée pour les Server Functions d'écriture, qui
 * ont déjà leur dorsale en main et ne doivent surtout pas lire un référentiel
 * mis en cache avant leur propre écriture.
 */
export const chargerReferentiel = cache(
  async (): Promise<Referentiel> => lireReferentiel(await dorsaleCompte()),
);

export async function lireChangementsReferentiel(
  dorsaleFournie?: DorsaleCompte,
): Promise<ChangementReferentiel[]> {
  const { supabase, userId } = dorsaleFournie ?? (await dorsaleCompte());
  const { data, error } = await supabase
    .from("referentiel_changes")
    .select("id, request_id, domaine_id, type, version_avant, version_apres, origine, motif, diff, cree_le")
    .eq("user_id", userId)
    .order("cree_le", { ascending: false })
    .limit(200);
  // Compatibilité du déploiement en deux temps : le code peut être préparé
  // localement avant que la migration additive soit explicitement autorisée.
  if (error?.code === "42P01" || error?.code === "PGRST205") return [];
  verifier("lecture du journal du référentiel", error);
  return ((data ?? []) as Record<string, unknown>[]).map((ligne) => ligneVersEntite<ChangementReferentiel>(ligne));
}
