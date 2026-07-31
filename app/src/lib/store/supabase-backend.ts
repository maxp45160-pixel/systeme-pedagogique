/**
 * Traduction entre les entités du domaine (camelCase) et les lignes
 * PostgreSQL (snake_case).
 *
 * Règle unique, et elle est structurante : **seules les clés de premier
 * niveau deviennent des colonnes**. Tout ce qui est imbriqué (`dimensions`,
 * `source`, `activites`, `occurrences`, `bilan`, `criteres`…) part tel quel
 * dans une colonne `jsonb` et conserve donc son camelCase. Le moteur relit ces
 * objets sans transformation : les convertir en profondeur casserait
 * silencieusement les calculs.
 *
 * Les noms de champs du domaine sont tous en camelCase simple (pas
 * d'acronyme collé type `URL`), la conversion est donc réversible sans
 * table d'exceptions.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@/lib/domain/types";
import type { Collections } from "./db";

/** Collections tabulaires — `user` est traité à part (table `profiles`). */
export type CleListe = Exclude<keyof Collections, "user">;

export const TABLES: Record<CleListe, string> = {
  evidence: "evidence",
  exercises: "exercises",
  attempts: "attempts",
  sessions: "sessions",
};

/** Colonnes de service, jamais exposées au domaine. */
const COLONNES_TECHNIQUES = new Set(["user_id", "created_at", "updated_at"]);

export function versColonne(cle: string): string {
  return cle.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

export function versChamp(colonne: string): string {
  return colonne.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

/**
 * Ligne SQL → entité du domaine.
 *
 * Les `NULL` sont supprimés plutôt que transmis : un champ optionnel absent
 * doit être `undefined`, sinon `dureeMin: null` traverse le moteur et
 * s'affiche comme une durée nulle mesurée, ce qu'interdit le protocole
 * anti-hallucination (§7 : ne jamais fabriquer un 0 trompeur).
 */
export function ligneVersEntite<T>(ligne: Record<string, unknown>): T {
  const sortie: Record<string, unknown> = {};
  for (const [colonne, valeur] of Object.entries(ligne)) {
    if (COLONNES_TECHNIQUES.has(colonne)) continue;
    if (valeur === null) continue;
    sortie[versChamp(colonne)] = valeur;
  }
  return sortie as T;
}

/** Entité du domaine → ligne SQL, rattachée au compte. */
export function entiteVersLigne(
  entite: object,
  userId: string,
): Record<string, unknown> {
  const sortie: Record<string, unknown> = { user_id: userId };
  for (const [cle, valeur] of Object.entries(entite)) {
    if (valeur === undefined) continue;
    sortie[versColonne(cle)] = valeur;
  }
  return sortie;
}

/* ------------------------------------------------------------------ */
/* Profil                                                              */
/* ------------------------------------------------------------------ */

/**
 * Le profil ne suit pas la règle générale : il est fusionné avec les valeurs
 * par défaut, car un compte fraîchement créé par le trigger SQL n'a ni
 * formation ni objectifs renseignés, et l'interface doit rester lisible.
 */
export function profilVersUser(
  ligne: Record<string, unknown>,
  defaut: User,
): User {
  const texte = (v: unknown, repli: string) =>
    typeof v === "string" && v.trim().length > 0 ? v : repli;

  return {
    id: String(ligne.id),
    prenom: texte(ligne.prenom, defaut.prenom),
    formation: texte(ligne.formation, defaut.formation),
    objectifMoyenTerme: texte(ligne.objectif_moyen_terme, defaut.objectifMoyenTerme),
    objectifLongTerme: texte(ligne.objectif_long_terme, defaut.objectifLongTerme),
    debutSuivi: texte(ligne.debut_suivi, defaut.debutSuivi),
    preferencesPedagogiques: Array.isArray(ligne.preferences_pedagogiques)
      ? (ligne.preferences_pedagogiques as string[])
      : (defaut.preferencesPedagogiques ?? []),
  };
}

// La traduction inverse (User → colonnes `profiles`) n'existe pas : aucun
// écran n'édite le profil. Elle sera à réécrire le jour où cet écran existera
// — cinq lignes symétriques de `profilVersUser` — plutôt que maintenue à vide.

/* ------------------------------------------------------------------ */
/* Diagnostic                                                          */
/* ------------------------------------------------------------------ */

/**
 * Une erreur Supabase n'est jamais avalée en silence : elle est journalisée
 * puis relancée. Le fallback JSON de la version précédente masquait aussi
 * bien une coupure réseau qu'un schéma désynchronisé, et laissait croire à
 * une sauvegarde réussie alors que rien n'était écrit.
 */
export function verifier(
  contexte: string,
  erreur: { message: string; code?: string } | null,
): void {
  if (!erreur) return;
  const detail = erreur.code ? `${erreur.code} — ${erreur.message}` : erreur.message;
  throw new Error(`Supabase (${contexte}) : ${detail}`);
}

export type ClientSupabase = SupabaseClient;
