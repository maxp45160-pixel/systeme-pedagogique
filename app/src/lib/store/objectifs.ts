import "server-only";

import { cache } from "react";

import type { DorsaleCompte } from "./db";
import { dorsaleCompte } from "./db";
import {
  validerEvenementLigne,
  validerObjectifLigne,
  validerParcoursLigne,
} from "./validation-objectifs";
import { validerLignesSupabase } from "./validation-supabase";
import { verifier } from "./supabase-backend";
import type { EvenementLot4, Objectif, Parcours } from "@/lib/domain/objectifs";

const COLONNES_OBJECTIF = [
  "id",
  "formulation",
  "cible_type",
  "cible_element_global_id",
  "cible_domaine_local_id",
  "cible_competence_local_code",
  "cible_relation_globale_id",
  "priorite",
  "horizon",
  "echeance_le",
  "statut",
  "version",
  "archive_le",
  "created_at",
  "updated_at",
].join(",");

const COLONNES_PARCOURS = [
  "id",
  "objectif_id",
  "contexte",
  "cible_type",
  "cible_element_global_id",
  "cible_domaine_local_id",
  "cible_competence_local_code",
  "cible_relation_globale_id",
  "statut",
  "version",
  "archive_le",
  "created_at",
  "updated_at",
].join(",");

const COLONNES_EVENEMENT = [
  "id",
  "request_id",
  "type",
  "acteur",
  "consentement",
  "survenu_le",
  "objectif_id",
  "parcours_id",
  "session_id",
  "provenance",
  "payload",
].join(",");

export async function lireObjectifs(dorsaleFournie?: DorsaleCompte): Promise<Objectif[]> {
  const { supabase, userId } = dorsaleFournie ?? (await dorsaleCompte());
  const { data, error } = await supabase
    .from("objectifs")
    .select(COLONNES_OBJECTIF)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  verifier("lecture des objectifs", error);
  return validerLignesSupabase(data, "objectifs").map((ligne, index) =>
    validerObjectifLigne(ligne, `objectifs[${index}]`),
  );
}

export async function lireParcours(dorsaleFournie?: DorsaleCompte): Promise<Parcours[]> {
  const { supabase, userId } = dorsaleFournie ?? (await dorsaleCompte());
  const { data, error } = await supabase
    .from("parcours")
    .select(COLONNES_PARCOURS)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  verifier("lecture des parcours", error);
  return validerLignesSupabase(data, "parcours").map((ligne, index) =>
    validerParcoursLigne(ligne, `parcours[${index}]`),
  );
}

export async function lireEvenements(dorsaleFournie?: DorsaleCompte): Promise<EvenementLot4[]> {
  const { supabase, userId } = dorsaleFournie ?? (await dorsaleCompte());
  const { data, error } = await supabase
    .from("evenements")
    .select(COLONNES_EVENEMENT)
    .eq("user_id", userId)
    .order("survenu_le", { ascending: true })
    .order("created_at", { ascending: true });
  verifier("lecture des événements du lot 4", error);
  return validerLignesSupabase(data, "evenements").map((ligne, index) =>
    validerEvenementLigne(ligne, `evenements[${index}]`),
  );
}

export const chargerObjectifs = cache(lireObjectifs);
export const chargerParcours = cache(lireParcours);
export const chargerEvenements = cache(lireEvenements);
