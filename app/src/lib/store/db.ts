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
import { mesurer } from "@/lib/profiling/server";
import {
  TABLES,
  entiteVersLigne,
  ligneVersEntite,
  profilVersUser,
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
    const { data, error } = await mesurer(`supabase:profiles`, () =>
      supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle(),
    );
    verifier("lecture du profil", error);
    // Profil absent : le trigger `handle_new_user` n'a pas encore tourné.
    return (data ? profilVersUser(data, defaut) : defaut) as Collections[K];
  }

  const { data, error } = await mesurer(`supabase:${TABLES[nom as CleListe]}`, () =>
    supabase
      .from(TABLES[nom as CleListe])
      .select("*")
      .eq("user_id", userId),
  );
  verifier(`lecture de « ${nom} »`, error);

  return ((data ?? []) as Record<string, unknown>[]).map((l) =>
    ligneVersEntite(l),
  ) as Collections[K];
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
 * Met à jour les champs fournis d'un élément identifié par `id`, et renvoie
 * l'entité telle qu'elle existe désormais en base — le tout en une requête.
 *
 * Réservé aux entités qui ont un cycle de vie propre (tentative en cours, note
 * de séance). Les preuves, elles, ne sont jamais modifiées après écriture :
 * c'est ce qui rend l'historique auditable.
 *
 * Seuls les champs présents dans `champs` sont écrits — `entiteVersLigne` omet
 * les absents. L'appelant n'a donc pas à relire l'entité pour la reconstruire,
 * et il n'y a plus de fenêtre entre la lecture et l'écriture.
 *
 * Un champ vaut `null` pour être **effacé**, jamais `undefined` : `undefined`
 * signifie « ne pas toucher ». La distinction est nécessaire, sans quoi vider
 * une note de séance ne ferait rien du tout.
 *
 * Renvoie `null` si aucune ligne ne correspond, ce qui couvre aussi le cas où
 * elle appartient à un autre compte : le filtre `user_id` double ici la
 * politique RLS, qui reste la barrière de confiance.
 */
export type Champs<T> = { [P in keyof T]?: T[P] | null };

export async function modifier<K extends CleListe>(
  nom: K,
  id: string,
  champs: Champs<Collections[K][number]>,
  dorsaleFournie?: DorsaleCompte,
): Promise<Collections[K][number] | null> {
  const { supabase, userId } = dorsaleFournie ?? (await dorsaleCompte());

  const { data, error } = await supabase
    .from(TABLES[nom])
    .update(entiteVersLigne(champs as object, userId))
    .eq("user_id", userId)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  verifier(`mise à jour de « ${nom} »`, error);

  return data ? (ligneVersEntite(data) as Collections[K][number]) : null;
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
