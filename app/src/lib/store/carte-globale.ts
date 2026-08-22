import "server-only";

import { cache } from "react";

import type {
  CarteGlobale,
  CorrespondanceCarteGlobale,
  SelectionCarteGlobale,
} from "@/lib/domain/carte-globale";
import { dorsaleCompte, type DorsaleCompte } from "./db";
import {
  estTableAbsente,
  ligneVersEntite,
  signalerTableAbsente,
  verifier,
} from "./supabase-backend";
import {
  validerElementGlobal,
  validerRelationGlobale,
  validerSelectionCarteGlobale,
  validerCorrespondanceCarteGlobale,
} from "./validation-carte-globale";
import { validerLignesSupabase } from "./validation-supabase";

const COLONNES_ELEMENT = "id,type,nom,description,statut,provenance,version,valide_le";
const COLONNES_RELATION = "id,source_id,cible_id,type,statut,provenance,version,valide_le";
const COLONNES_CORRESPONDANCE = "competence_code,element_global_id,acteur,provenance,rattache_le";

/*
 * ──────────────────────────────────────────────────────────────────────
 * LA CARTE GLOBALE EST UNE SURFACE OPTIONNELLE
 * ──────────────────────────────────────────────────────────────────────
 *
 * `chargerContexte` lit ces trois fonctions à CHAQUE rendu de CHAQUE page,
 * dans le même `Promise.all` que les données du compte. Tant qu'elles
 * relançaient l'erreur brute, une base où les migrations du lot 3 et du lot 7
 * n'avaient pas été jouées ne rendait plus une seule page — pas la carte
 * globale : l'application entière, tableau de bord et Bureau compris.
 *
 * Le voisin immédiat dans ce même `Promise.all` avait déjà la bonne
 * discipline : `chargerToutRPC` renvoie `null` quand la fonction SQL n'existe
 * pas encore, et le chemin lent prend le relais — « aucune casse ». Les deux
 * lectures posaient donc deux règles opposées sur la même ligne de code.
 *
 * ⚠️ La tolérance est **strictement** bornée à l'absence de table
 * (`estTableAbsente`), et elle parle (`signalerTableAbsente`). Toute autre
 * erreur — refus RLS, colonne manquante, réseau — continue de remonter par
 * `verifier`. Une carte vide parce que la table n'existe pas n'invente
 * aucune donnée : elle constate qu'une fonctionnalité n'est pas déployée.
 * Une carte vide parce qu'on a avalé un refus d'autorisation, elle, mentirait.
 */
const MIGRATION_CARTE = "20260820134723_twiny_lot_3_carte_globale_overlay_minimal.sql";
const MIGRATION_CORRESPONDANCES = "20260820190000_twiny_lot_7_correspondances_relations.sql";

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

  if (estTableAbsente(elements.error) || estTableAbsente(relations.error)) {
    signalerTableAbsente("carte_globale_elements / carte_globale_relations", MIGRATION_CARTE);
    return { elements: [], relations: [] };
  }
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
  if (estTableAbsente(error)) {
    signalerTableAbsente("carte_globale_selections", MIGRATION_CARTE);
    return [];
  }
  verifier("lecture des sélections de carte globale", error);
  return validerLignesSupabase(data, "carteGlobale.selections").map((ligne, index) =>
    validerSelectionCarteGlobale(ligneVersEntite(ligne), `carteGlobale.selections[${index}]`),
  );
}

export async function lireCorrespondancesCarteGlobale(
  dorsaleFournie?: DorsaleCompte,
): Promise<CorrespondanceCarteGlobale[]> {
  const { supabase, userId } = dorsaleFournie ?? (await dorsaleCompte());
  const { data, error } = await supabase
    .from("carte_globale_correspondances")
    .select(COLONNES_CORRESPONDANCE)
    .eq("user_id", userId)
    .order("rattache_le", { ascending: true });
  if (estTableAbsente(error)) {
    signalerTableAbsente("carte_globale_correspondances", MIGRATION_CORRESPONDANCES);
    return [];
  }
  verifier("lecture des correspondances locales et globales", error);
  return validerLignesSupabase(data, "carteGlobale.correspondances").map((ligne, index) =>
    validerCorrespondanceCarteGlobale(
      ligneVersEntite(ligne),
      `carteGlobale.correspondances[${index}]`,
    ),
  );
}

export const chargerCarteGlobale = cache(lireCarteGlobale);
export const chargerSelectionsCarteGlobale = cache(lireSelectionsCarteGlobale);
export const chargerCorrespondancesCarteGlobale = cache(lireCorrespondancesCarteGlobale);
