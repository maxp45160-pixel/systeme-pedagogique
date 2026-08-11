"use server";

/**
 * Écritures des thèmes du compte (chantier « thèmes », 10/08/2026, ADR-053).
 *
 * Même charte que `referentiel-actions.ts` : `dorsaleCompte()` redirige sans
 * session, RLS reste la barrière d'autorisation, `revalidatePath("/", "layout")`
 * suit chaque écriture (ADR-024). Le tuteur n'a aucun accès direct — sa
 * proposition (lot 2) passe par la même validation et la même écriture, après
 * relecture par l'utilisateur (P5).
 */

import { revalidatePath } from "next/cache";

import { dorsaleCompte, type DorsaleCompte } from "./db";
import { entiteVersLigne, verifier } from "./supabase-backend";
import {
  idTheme,
  motifRefusTheme,
  type NouveauTheme,
  type Theme,
} from "@/lib/domain/theme";
import { modeRetrait } from "@/lib/domain/referentiel-compte";

async function idsPris(dorsale: DorsaleCompte): Promise<Set<string>> {
  const { data, error } = await dorsale.supabase
    .from("themes")
    .select("id")
    .eq("user_id", dorsale.userId);
  verifier("lecture des identifiants de thème", error);
  return new Set(((data ?? []) as { id: string }[]).map((l) => l.id));
}

export async function creerTheme(soumission: NouveauTheme): Promise<Theme> {
  const refus = motifRefusTheme(soumission);
  if (refus) throw new Error(refus);

  const dorsale = await dorsaleCompte();
  const id = idTheme(soumission.libelle, await idsPris(dorsale));
  const maintenant = new Date().toISOString();

  const theme: Theme = {
    id,
    libelle: soumission.libelle.trim(),
    intention: soumission.intention?.trim() || undefined,
    codes: [...new Set(soumission.codes)],
    origine: soumission.origine,
    creeLe: maintenant,
    archive: false,
  };

  const { error } = await dorsale.supabase
    .from("themes")
    .insert(entiteVersLigne(theme, dorsale.userId));
  verifier("création du thème", error);

  revalidatePath("/", "layout");
  return theme;
}

export interface ModificationTheme {
  libelle: string;
  intention?: string;
  codes: string[];
}

export async function modifierTheme(id: string, modification: ModificationTheme): Promise<void> {
  const refus = motifRefusTheme({ ...modification, origine: "utilisateur" });
  if (refus) throw new Error(refus);

  const dorsale = await dorsaleCompte();
  const { error } = await dorsale.supabase
    .from("themes")
    .update({
      libelle: modification.libelle.trim(),
      intention: modification.intention?.trim() || null,
      codes: [...new Set(modification.codes)],
      modifie_le: new Date().toISOString(),
    })
    .eq("user_id", dorsale.userId)
    .eq("id", id);
  verifier("modification du thème", error);

  revalidatePath("/", "layout");
}

/**
 * Combien de séances citent ce thème (`besoin_declare.themeId`).
 *
 * `besoin_declare` est du JSONB de premier niveau côté colonne, donc pas
 * filtrable en une clause SQL simple sans opérateur `->>` : on relit la seule
 * colonne nécessaire et on compte côté code — même choix que `compterPreuves`
 * dans `referentiel-actions.ts`, pour ne pas tirer les colonnes lourdes
 * (`blueprint`, `activites`) d'une table qui peut grossir.
 */
async function nombreDeSeancesCitant(dorsale: DorsaleCompte, themeId: string): Promise<number> {
  const { data, error } = await dorsale.supabase
    .from("sessions")
    .select("besoin_declare")
    .eq("user_id", dorsale.userId);
  verifier("comptage des séances citant un thème", error);

  return ((data ?? []) as { besoin_declare: { themeId?: string } | null }[]).filter(
    (l) => l.besoin_declare?.themeId === themeId,
  ).length;
}

export interface EtatRetraitTheme {
  seances: number;
  mode: "suppression" | "archivage";
}

/**
 * Le geste de retrait qu'un thème subirait, à annoncer avant le clic
 * (ADR-027, même charte que le référentiel).
 */
export async function etatRetraitTheme(id: string): Promise<EtatRetraitTheme> {
  const dorsale = await dorsaleCompte();
  const seances = await nombreDeSeancesCitant(dorsale, id);
  return { seances, mode: modeRetrait(seances) };
}

/**
 * Retire un thème — supprimé si aucune séance ne le cite, archivé sinon.
 *
 * Dérivé, jamais offert au choix : même règle que `retirerCompetences`
 * (ADR-027/044), portée ici par `modeRetrait`, la même fonction pure.
 */
export async function retirerTheme(id: string): Promise<EtatRetraitTheme> {
  const dorsale = await dorsaleCompte();
  const seances = await nombreDeSeancesCitant(dorsale, id);
  const mode = modeRetrait(seances);

  if (mode === "suppression") {
    const { error } = await dorsale.supabase
      .from("themes")
      .delete()
      .eq("user_id", dorsale.userId)
      .eq("id", id);
    verifier("suppression du thème", error);
  } else {
    const { error } = await dorsale.supabase
      .from("themes")
      .update({ archive: true, modifie_le: new Date().toISOString() })
      .eq("user_id", dorsale.userId)
      .eq("id", id);
    verifier("archivage du thème", error);
  }

  revalidatePath("/", "layout");
  return { seances, mode };
}
