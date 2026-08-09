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
  convertirResultatRPC,
  entiteVersLigne,
  ligneVersEntite,
  profilVersUser,
  verifier,
  type CleListe,
  type ClientSupabase,
  type ResultatRPC,
} from "./supabase-backend";
import type {
  Exercise,
  ExerciseAttempt,
  LearningSession,
  RefusRecommandation,
  SkillEvidence,
  User,
} from "@/lib/domain/types";

export interface Collections {
  user: User;
  evidence: SkillEvidence[];
  exercises: Exercise[];
  attempts: ExerciseAttempt[];
  sessions: LearningSession[];
  refusRecommandations: RefusRecommandation[];
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

/**
 * Ordre chronologique par défaut des collections temporelles.
 *
 * PostgreSQL ne garantit AUCUN ordre de retour. Les appelants qui traitent la
 * position dans le tableau comme une date — `derniereTerminee`,
 * `derniereAbandonnee`, l'exercice que le tuteur croit en cours — lisaient
 * l'ordre d'arrivée de la base, sans garantie (audit §2.5). Ce tri rend
 * l'ordre déterministe à la source, au lieu de le laisser dépendre de la
 * couche UI.
 */
const ORDRE_PAR_DEFAUT: Partial<Record<CleListe, { colonne: "debut" | "date"; asc: boolean }>> = {
  attempts: { colonne: "debut", asc: true },
  sessions: { colonne: "date", asc: true },
  evidence: { colonne: "date", asc: true },
};

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

  const ordre = ORDRE_PAR_DEFAUT[nom as CleListe];
  const { data, error } = await mesurer(`supabase:${TABLES[nom as CleListe]}`, () => {
    let requete = supabase.from(TABLES[nom as CleListe]).select("*").eq("user_id", userId);
    if (ordre) requete = requete.order(ordre.colonne, { ascending: ordre.asc });
    return requete;
  });
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
  const [user, evidence, exercises, attempts, sessions, refusRecommandations] =
    await Promise.all([
      lire("user", dorsale),
      lire("evidence", dorsale),
      lire("exercises", dorsale),
      lire("attempts", dorsale),
      lire("sessions", dorsale),
      lire("refusRecommandations", dorsale),
    ]);
  return { user, evidence, exercises, attempts, sessions, refusRecommandations };
}

/* ------------------------------------------------------------------ */
/* RPC groupée                                                         */
/* ------------------------------------------------------------------ */

/**
 * Résultat brut de la fonction PostgreSQL `charger_tout`.
 *
 * Elle renvoie les huit tables en un seul aller-retour — profil, données
 * et référentiel — ce qui réduit la latence de ~750 ms (7 round-trips
 * parallèles) à ~100 ms (1 round-trip).
 *
 * La conversion vit dans `supabase-backend.ts` : elle est pure, donc testable
 * (ce module-ci est `server-only`).
 */
export type { ResultatRPC };

/**
 * Charge toutes les données du compte en un seul appel RPC.
 *
 * Renvoie `null` si la fonction SQL n'existe pas encore en base **ou si sa
 * charge utile ne porte pas toutes les clés attendues** — le code appelant se
 * rabat alors sur `lireTout` + `chargerReferentiel`.
 */
export async function chargerToutRPC(): Promise<ResultatRPC | null> {
  const dorsale = await dorsaleCompte();
  const { supabase, userId, courriel } = dorsale;
  const defaut = profilNeutre(userId, courriel);

  try {
    const { data, error } = await mesurer("rpc:charger_tout", () =>
      supabase.rpc("charger_tout"),
    );

    if (error) {
      // La fonction n'existe pas encore — fallback silencieux.
      console.warn("[profiling] charger_tout RPC indisponible, fallback :", error.message);
      return null;
    }

    return convertirResultatRPC(data, defaut);
  } catch (e) {
    console.warn("[profiling] charger_tout RPC erreur :", e);
    return null;
  }
}

/** Identifiant lisible et trié chronologiquement. */
export function nouvelId(prefixe: string): string {
  return `${prefixe}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
