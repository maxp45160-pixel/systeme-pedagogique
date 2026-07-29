/**
 * Persistance — dorsale unique : Supabase (ADR-015).
 *
 * À n'importer que depuis du code serveur (pages serveur, Server Functions,
 * route handlers). Aucun composant client ne doit référencer ce module.
 *
 * Les données vivent dans PostgreSQL, isolées par compte via les politiques
 * RLS — la seule barrière d'autorisation à laquelle le système accorde sa
 * confiance. Sans session valide, aucune lecture ni écriture n'est possible :
 * il n'existe plus de chemin de persistance non authentifié.
 *
 * Le journal JSON local a été supprimé le 28/07/2026. Il était exclusif de
 * Supabase et jamais synchronisé avec lui, ce qui en faisait une source
 * d'analyses fausses (voir ADR-002, conservée pour l'historique).
 */

import "server-only";

import { cache } from "react";

import { redirect } from "next/navigation";
import { compteCourant, createServeurClient } from "@/lib/supabase/server";
import {
  TABLES,
  entiteVersLigne,
  ligneVersEntite,
  profilVersUser,
  userVersProfil,
  verifier,
  type CleListe,
  type ClientSupabase,
} from "./supabase-backend";
import type {
  Exercise,
  ExerciseAttempt,
  LearningSession,
  SkillEvidence,
  User,
} from "@/lib/domain/types";

export interface Collections {
  user: User;
  evidence: SkillEvidence[];
  exercises: Exercise[];
  attempts: ExerciseAttempt[];
  sessions: LearningSession[];
}

/**
 * Valeurs de repli d'un compte Supabase, employées tant que le trigger
 * `handle_new_user` n'a pas écrit la ligne `profiles`. Volontairement neutres :
 * attribuer une formation non déclarée à un nouvel inscrit serait exactement
 * l'invention de données que le protocole interdit.
 */
function profilNeutre(id: string, courriel: string | undefined): User {
  return {
    id,
    prenom: courriel?.split("@")[0] ?? "Utilisateur",
    formation: "Formation à renseigner",
    objectifMoyenTerme: "Objectif à moyen terme à renseigner",
    objectifLongTerme: "Objectif à long terme à renseigner",
    debutSuivi: new Date().toISOString().slice(0, 10),
    preferencesPedagogiques: [],
  };
}

/* ------------------------------------------------------------------ */
/* Accès à la dorsale                                                  */
/* ------------------------------------------------------------------ */

export interface DorsaleCompte {
  supabase: ClientSupabase;
  userId: string;
  courriel: string | undefined;
}

/**
 * Résout la dorsale du compte connecté.
 *
 * L'absence de session redirige vers l'écran de connexion (`/login`) :
 * depuis ADR-015 il n'existe plus de persistance hors compte.
 */
export const dorsaleCompte = cache(async (): Promise<DorsaleCompte> => {
  const compte = await compteCourant();
  const supabase = compte ? await createServeurClient() : null;
  if (!compte || !supabase) {
    redirect("/login");
  }
  return { supabase, userId: compte.id, courriel: compte.email };
});

/* ------------------------------------------------------------------ */
/* API publique                                                        */
/* ------------------------------------------------------------------ */

export async function lire<K extends keyof Collections>(
  nom: K,
  dorsaleFournie?: DorsaleCompte,
): Promise<Collections[K]> {
  const { supabase, userId, courriel } = dorsaleFournie ?? (await dorsaleCompte());
  const defaut = profilNeutre(userId, courriel);

  if (nom === "user") {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    verifier("lecture du profil", error);
    // Profil absent : le trigger `handle_new_user` n'a pas encore tourné.
    return (data ? profilVersUser(data, defaut) : defaut) as Collections[K];
  }

  const { data, error } = await supabase
    .from(TABLES[nom as CleListe])
    .select("*")
    .eq("user_id", userId);
  verifier(`lecture de « ${nom} »`, error);

  return ((data ?? []) as Record<string, unknown>[]).map((l) =>
    ligneVersEntite(l),
  ) as Collections[K];
}

/**
 * Remplace intégralement une collection.
 *
 * Côté Supabase, « remplacer » se traduit par un upsert de la nouvelle liste
 * suivi de la suppression des lignes disparues — et non par un `DELETE` global
 * puis réinsertion, qui perdrait les `created_at` et laisserait la table vide
 * si l'insertion échouait.
 */
export async function ecrire<K extends keyof Collections>(
  nom: K,
  valeur: Collections[K],
): Promise<void> {
  const { supabase, userId } = await dorsaleCompte();

  if (nom === "user") {
    const { error } = await supabase
      .from("profiles")
      .update(userVersProfil(valeur as User))
      .eq("id", userId);
    verifier("mise à jour du profil", error);
    return;
  }

  const table = TABLES[nom as CleListe];
  const elements = valeur as unknown as { id: string }[];

  if (elements.length > 0) {
    // Clé primaire composite : la cible du conflit est nommée explicitement
    // plutôt que déduite, pour ne pas dépendre de l'introspection PostgREST.
    const { error } = await supabase
      .from(table)
      .upsert(elements.map((e) => entiteVersLigne(e, userId)), {
        onConflict: "user_id,id",
      });
    verifier(`écriture de « ${nom} »`, error);
  }

  // Diff explicite plutôt qu'un filtre `not.in` construit par concaténation :
  // les identifiants partiraient dans une chaîne de filtre PostgREST, où une
  // virgule ou un guillemet suffirait à changer le sens de la requête.
  const { data: existants, error: erreurLecture } = await supabase
    .from(table)
    .select("id")
    .eq("user_id", userId);
  verifier(`inventaire de « ${nom} »`, erreurLecture);

  const conserves = new Set(elements.map((e) => e.id));
  const aSupprimer = ((existants ?? []) as { id: string }[])
    .map((l) => l.id)
    .filter((id) => !conserves.has(id));

  if (aSupprimer.length > 0) {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq("user_id", userId)
      .in("id", aSupprimer);
    verifier(`purge de « ${nom} »`, error);
  }
}

/** Ajoute un élément en fin de collection. Le journal ne réécrit pas le passé. */
export async function ajouter<K extends CleListe>(
  nom: K,
  element: Collections[K][number],
  dorsaleFournie?: DorsaleCompte,
): Promise<Collections[K][number]> {
  const { supabase, userId } = dorsaleFournie ?? (await dorsaleCompte());
  const { error } = await supabase
    .from(TABLES[nom])
    .insert(entiteVersLigne(element as object, userId));
  verifier(`ajout dans « ${nom} »`, error);
  return element;
}

/** Insère plusieurs éléments en une seule requête. */
export async function ajouterPlusieurs<K extends CleListe>(
  nom: K,
  elements: Collections[K][number][],
  dorsaleFournie?: DorsaleCompte,
): Promise<void> {
  if (elements.length === 0) return;
  const { supabase, userId } = dorsaleFournie ?? (await dorsaleCompte());
  const { error } = await supabase
    .from(TABLES[nom])
    .insert(elements.map((e) => entiteVersLigne(e as object, userId)));
  verifier(`ajout groupé dans « ${nom} »`, error);
}

/**
 * Remplace un élément identifié par `id`.
 *
 * Réservé aux entités qui ont un cycle de vie propre (tentative en cours,
 * statut d'erreur, étape de projet). Les preuves, elles, ne sont jamais
 * modifiées après écriture : c'est ce qui rend l'historique auditable.
 */
export async function remplacer<K extends CleListe>(
  nom: K,
  id: string,
  maj: (precedent: Collections[K][number]) => Collections[K][number],
  dorsaleFournie?: DorsaleCompte,
): Promise<Collections[K][number] | null> {
  const { supabase, userId } = dorsaleFournie ?? (await dorsaleCompte());
  const table = TABLES[nom];

  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  verifier(`lecture de « ${nom} » avant mise à jour`, error);
  if (!data) return null;

  const suivant = maj(ligneVersEntite(data));
  const { error: erreurMaj } = await supabase
    .from(table)
    .update(entiteVersLigne(suivant as object, userId))
    .eq("user_id", userId)
    .eq("id", id);
  verifier(`mise à jour de « ${nom} »`, erreurMaj);
  return suivant;
}

export async function lireTout(): Promise<Collections> {
  const dorsale = await dorsaleCompte();
  const [user, evidence, exercises, attempts, sessions] = await Promise.all([
    lire("user", dorsale),
    lire("evidence", dorsale),
    lire("exercises", dorsale),
    lire("attempts", dorsale),
    lire("sessions", dorsale),
  ]);
  return { user, evidence, exercises, attempts, sessions };
}

/** Identifiant lisible et trié chronologiquement. */
export function nouvelId(prefixe: string): string {
  return `${prefixe}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
