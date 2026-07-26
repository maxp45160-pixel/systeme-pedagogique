/**
 * Persistance — deux dorsales, une seule active par requête.
 *
 * À n'importer que depuis du code serveur (pages serveur, Server Functions,
 * route handlers). Aucun composant client ne doit référencer ce module.
 *
 * - **Compte connecté** (Supabase configuré + session valide) : les données
 *   vivent dans PostgreSQL, isolées par compte via les politiques RLS.
 * - **Sinon** : journal append-only en JSON dans `data/store/`, mono-utilisateur.
 *   Les diffs git restent lisibles et le contenu inspectable à la main, ce qui
 *   prolonge la logique du système de fichiers `.txt` existant.
 *
 * Le choix est **exclusif** : on ne lit jamais l'un pour écrire dans l'autre.
 * Une double écriture ferait diverger les deux copies dès la première panne
 * réseau, et le disque n'est de toute façon pas persistant sur Vercel.
 */

import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
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
  ErrorItem,
  Exercise,
  ExerciseAttempt,
  KnowledgeItem,
  LearningSession,
  Objectif,
  Project,
  Reading,
  SkillEvidence,
  User,
} from "@/lib/domain/types";

const RACINE = path.join(process.cwd(), "data", "store");

export interface Collections {
  user: User;
  evidence: SkillEvidence[];
  exercises: Exercise[];
  attempts: ExerciseAttempt[];
  errors: ErrorItem[];
  projects: Project[];
  readings: Reading[];
  knowledge: KnowledgeItem[];
  sessions: LearningSession[];
  objectives: Objectif[];
}

export const UTILISATEUR_PAR_DEFAUT: User = {
  id: "user-1",
  prenom: "Maxime",
  formation: "BUT QLIO (Qualité, Logistique Industrielle et Organisation)",
  objectifMoyenTerme: "Préparer un Master ITI interdisciplinaire en technologies innovantes",
  objectifLongTerme: "Devenir chercheur en ingénierie des systèmes complexes",
  debutSuivi: "2026-07-24",
  // Préférences déclarées le 25/07/2026 (cf. synthese_profil_competences_2026-07-25.md).
  preferencesPedagogiques: [
    "Approche mixte calcul manuel + Python — pas de passage à l'automatisation intégrale.",
    "Rappels réguliers et incitation à recalculer/reformuler les notions déjà vues plutôt que rappel passif ; construire une base solide avant d'avancer.",
  ],
};

/**
 * Valeurs de repli d'un compte Supabase. Volontairement neutres : le profil
 * historique ci-dessus décrit Maxime, pas un compte quelconque, et l'appliquer
 * à tout nouvel inscrit lui attribuerait une formation qu'il n'a pas déclarée.
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

const VIDE: { [K in keyof Collections]: Collections[K] } = {
  user: UTILISATEUR_PAR_DEFAUT,
  evidence: [],
  exercises: [],
  attempts: [],
  errors: [],
  projects: [],
  readings: [],
  knowledge: [],
  sessions: [],
  objectives: [],
};

/* ------------------------------------------------------------------ */
/* Choix de la dorsale                                                 */
/* ------------------------------------------------------------------ */

export interface DorsaleCompte {
  supabase: ClientSupabase;
  userId: string;
  courriel: string | undefined;
}

/**
 * Renvoie la dorsale Supabase si — et seulement si — un compte est connecté.
 * `null` signifie « journal JSON local », pas « erreur ».
 */
export async function dorsaleCompte(): Promise<DorsaleCompte | null> {
  const compte = await compteCourant();
  if (!compte) return null;
  const supabase = await createServeurClient();
  if (!supabase) return null;
  return { supabase, userId: compte.id, courriel: compte.email };
}

/* ------------------------------------------------------------------ */
/* Journal local                                                       */
/* ------------------------------------------------------------------ */

function fichier(nom: keyof Collections): string {
  return path.join(RACINE, `${nom}.json`);
}

async function assurerRacine(): Promise<void> {
  await fs.mkdir(RACINE, { recursive: true });
}

/**
 * Un fichier absent ou illisible renvoie la valeur vide : l'application
 * démarre sans configuration, et une corruption ne fabrique jamais de
 * données de remplacement.
 */
async function lireLocal<K extends keyof Collections>(nom: K): Promise<Collections[K]> {
  try {
    const brut = await fs.readFile(fichier(nom), "utf8");
    return JSON.parse(brut) as Collections[K];
  } catch {
    return VIDE[nom];
  }
}

/** Écriture atomique : fichier temporaire puis renommage. */
async function ecrireLocal<K extends keyof Collections>(
  nom: K,
  valeur: Collections[K],
): Promise<void> {
  await assurerRacine();
  const cible = fichier(nom);
  const temporaire = `${cible}.tmp`;
  await fs.writeFile(temporaire, JSON.stringify(valeur, null, 2), "utf8");
  await fs.rename(temporaire, cible);
}

/** Lecture du journal local, exposée pour la migration vers un compte. */
export const lireJournalLocal = lireLocal;

/* ------------------------------------------------------------------ */
/* API publique                                                        */
/* ------------------------------------------------------------------ */

export async function lire<K extends keyof Collections>(nom: K): Promise<Collections[K]> {
  const dorsale = await dorsaleCompte();
  if (!dorsale) return lireLocal(nom);

  const { supabase, userId, courriel } = dorsale;
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
  const dorsale = await dorsaleCompte();
  if (!dorsale) return ecrireLocal(nom, valeur);

  const { supabase, userId } = dorsale;

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
): Promise<Collections[K][number]> {
  const dorsale = await dorsaleCompte();
  if (dorsale) {
    const { supabase, userId } = dorsale;
    const { error } = await supabase
      .from(TABLES[nom])
      .insert(entiteVersLigne(element as object, userId));
    verifier(`ajout dans « ${nom} »`, error);
    return element;
  }

  const actuel: unknown[] = await lireLocal(nom);
  await ecrireLocal(nom, [...actuel, element] as Collections[K]);
  return element;
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
): Promise<Collections[K][number] | null> {
  const dorsale = await dorsaleCompte();

  if (dorsale) {
    const { supabase, userId } = dorsale;
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

  const actuel = (await lireLocal(nom)) as { id: string }[];
  const index = actuel.findIndex((e) => e.id === id);
  if (index === -1) return null;
  const suivant = maj(actuel[index] as Collections[K][number]);
  const copie = [...actuel];
  copie[index] = suivant as { id: string };
  await ecrireLocal(nom, copie as Collections[K]);
  return suivant;
}

export async function lireTout(): Promise<Collections> {
  const [
    user,
    evidence,
    exercises,
    attempts,
    errors,
    projects,
    readings,
    knowledge,
    sessions,
    objectives,
  ] = await Promise.all([
    lire("user"),
    lire("evidence"),
    lire("exercises"),
    lire("attempts"),
    lire("errors"),
    lire("projects"),
    lire("readings"),
    lire("knowledge"),
    lire("sessions"),
    lire("objectives"),
  ]);
  return {
    user,
    evidence,
    exercises,
    attempts,
    errors,
    projects,
    readings,
    knowledge,
    sessions,
    objectives,
  };
}

/** Identifiant lisible et trié chronologiquement. */
export function nouvelId(prefixe: string): string {
  return `${prefixe}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function storeEstInitialise(): Promise<boolean> {
  try {
    await fs.access(fichier("exercises"));
    return true;
  } catch {
    return false;
  }
}
