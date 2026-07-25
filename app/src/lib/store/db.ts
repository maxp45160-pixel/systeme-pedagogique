/**
 * Persistance hybride — Supabase avec fallback JSON local.
 *
 * À n'importer que depuis du code serveur (pages serveur, Server Functions,
 * route handlers). Aucun composant client ne doit référencer ce module.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { createServerSupabaseClient } from "@/lib/supabase/server";
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
  preferencesPedagogiques: [
    "Approche mixte calcul manuel + Python — pas de passage à l'automatisation intégrale.",
    "Rappels réguliers et incitation à recalculer/reformuler les notions déjà vues plutôt que rappel passif ; construire une base solide avant d'avancer.",
  ],
};

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

function fichier(nom: keyof Collections): string {
  return path.join(RACINE, `${nom}.json`);
}

async function assurerRacine(): Promise<void> {
  await fs.mkdir(RACINE, { recursive: true });
}

/**
 * Lit une collection. Si Supabase est configuré et qu'un utilisateur est connecté,
 * tente la lecture dans Supabase. En cas d'absence ou d'échec, fallback sur le fichier JSON local.
 */
export async function lire<K extends keyof Collections>(nom: K): Promise<Collections[K]> {
  try {
    const supabase = await createServerSupabaseClient();
    if (supabase) {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;

      if (userId) {
        if (nom === "user") {
          const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", userId)
            .maybeSingle();

          if (profile) {
            return {
              id: profile.id,
              prenom: profile.prenom || authData.user.user_metadata?.full_name || "Utilisateur",
              formation: profile.formation || UTILISATEUR_PAR_DEFAUT.formation,
              objectifMoyenTerme: profile.objectif_moyen_terme || UTILISATEUR_PAR_DEFAUT.objectifMoyenTerme,
              objectifLongTerme: profile.objectif_long_terme || UTILISATEUR_PAR_DEFAUT.objectifLongTerme,
              debutSuivi: profile.debut_suivi || UTILISATEUR_PAR_DEFAUT.debutSuivi,
              preferencesPedagogiques: profile.preferences_pedagogiques || UTILISATEUR_PAR_DEFAUT.preferencesPedagogiques,
            } as Collections[K];
          }
        } else {
          // Tables correspondant aux collections
          const tablesMap: Record<string, string> = {
            evidence: "evidence",
            sessions: "sessions",
            attempts: "attempts",
            errors: "errors",
          };

          const tableName = tablesMap[nom];
          if (tableName) {
            const { data: rows } = await supabase
              .from(tableName)
              .select("*")
              .eq("user_id", userId);

            if (rows && rows.length > 0) {
              return rows as unknown as Collections[K];
            }
          }
        }
      }
    }
  } catch {
    // Ignorer et passer au fallback local
  }

  // Fallback JSON local
  try {
    const brut = await fs.readFile(fichier(nom), "utf8");
    return JSON.parse(brut) as Collections[K];
  } catch {
    return VIDE[nom];
  }
}

/** Écriture atomique sur le fichier JSON local. */
export async function ecrire<K extends keyof Collections>(
  nom: K,
  valeur: Collections[K],
): Promise<void> {
  await assurerRacine();
  const cible = fichier(nom);
  const temporaire = `${cible}.tmp`;
  await fs.writeFile(temporaire, JSON.stringify(valeur, null, 2), "utf8");
  await fs.rename(temporaire, cible);
}

/** Collections tabulaires — tout sauf `user`, qui est un objet unique. */
type CleListe = Exclude<keyof Collections, "user">;

/** Ajoute un élément en fin de collection (Supabase + Local). */
export async function ajouter<K extends CleListe>(
  nom: K,
  element: Collections[K][number],
): Promise<Collections[K][number]> {
  try {
    const supabase = await createServerSupabaseClient();
    if (supabase) {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;

      if (userId) {
        const tablesMap: Record<string, string> = {
          evidence: "evidence",
          sessions: "sessions",
          attempts: "attempts",
          errors: "errors",
        };

        const tableName = tablesMap[nom];
        if (tableName) {
          await supabase.from(tableName).insert({
            ...(element as object),
            user_id: userId,
          });
        }
      }
    }
  } catch {
    // Ignorer les erreurs réseau/Supabase et poursuivre l'écriture locale
  }

  const actuel: unknown[] = await lire(nom);
  await ecrire(nom, [...actuel, element] as Collections[K]);
  return element;
}

/** Remplace un élément identifié par `id` (Supabase + Local). */
export async function remplacer<K extends CleListe>(
  nom: K,
  id: string,
  maj: (precedent: Collections[K][number]) => Collections[K][number],
): Promise<Collections[K][number] | null> {
  const actuel = (await lire(nom)) as { id: string }[];
  const index = actuel.findIndex((e) => e.id === id);
  if (index === -1) return null;
  const suivant = maj(actuel[index] as Collections[K][number]);

  try {
    const supabase = await createServerSupabaseClient();
    if (supabase) {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;

      if (userId) {
        const tablesMap: Record<string, string> = {
          evidence: "evidence",
          sessions: "sessions",
          attempts: "attempts",
          errors: "errors",
        };

        const tableName = tablesMap[nom];
        if (tableName) {
          await supabase
            .from(tableName)
            .update(suivant as object)
            .eq("id", id)
            .eq("user_id", userId);
        }
      }
    }
  } catch {
    // Ignorer
  }

  const copie = [...actuel];
  copie[index] = suivant as { id: string };
  await ecrire(nom, copie as Collections[K]);
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
