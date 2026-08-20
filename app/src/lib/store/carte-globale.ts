import "server-only";

import { cache } from "react";

import type { CarteGlobale, SelectionCarteGlobale } from "@/lib/domain/carte-globale";
import { dorsaleCompte, type DorsaleCompte } from "./db";
import { ligneVersEntite, verifier } from "./supabase-backend";
import {
  validerElementGlobal,
  validerRelationGlobale,
  validerSelectionCarteGlobale,
} from "./validation-carte-globale";
import { validerLignesSupabase } from "./validation-supabase";

const COLONNES_ELEMENT = "id,type,nom,description,statut,provenance,version,valide_le";
const COLONNES_RELATION = "id,source_id,cible_id,type,statut,provenance,version,valide_le";

export async function lireCarteGlobale(
  dorsaleFournie?: DorsaleCompte,
): Promise<CarteGlobale> {
  const { supabase } = dorsaleFournie ?? (await dorsaleCompte());
  const [elements, relations] = await Promise.all([
    supabase
      .from("carte_globale_elements")
      .select(COLONNES_ELEMENT)
      .eq("statut", "publie")
      .order("nom", { ascending: true }),
    supabase
      .from("carte_globale_relations")
      .select(COLONNES_RELATION)
      .eq("statut", "publie")
      .order("valide_le", { ascending: true }),
  ]);

  verifier("lecture des éléments globaux", elements.error);
  verifier("lecture des relations globales", relations.error);

  return {
    elements: validerLignesSupabase(elements.data, "carteGlobale.elements").map((ligne, index) =>
      validerElementGlobal(ligneVersEntite(ligne), `carteGlobale.elements[${index}]`),
    ),
    relations: validerLignesSupabase(relations.data, "carteGlobale.relations").map((ligne, index) =>
      validerRelationGlobale(ligneVersEntite(ligne), `carteGlobale.relations[${index}]`),
    ),
  };
}

export async function lireSelectionsCarteGlobale(
  dorsaleFournie?: DorsaleCompte,
): Promise<SelectionCarteGlobale[]> {
  const { supabase, userId } = dorsaleFournie ?? (await dorsaleCompte());
  const { data, error } = await supabase
    .from("carte_globale_selections")
    .select("element_id,selectionne_le")
    .eq("user_id", userId)
    .order("selectionne_le", { ascending: true });
  verifier("lecture des sélections de carte globale", error);
  return validerLignesSupabase(data, "carteGlobale.selections").map((ligne, index) =>
    validerSelectionCarteGlobale(ligneVersEntite(ligne), `carteGlobale.selections[${index}]`),
  );
}

export const chargerCarteGlobale = cache(lireCarteGlobale);
export const chargerSelectionsCarteGlobale = cache(lireSelectionsCarteGlobale);
