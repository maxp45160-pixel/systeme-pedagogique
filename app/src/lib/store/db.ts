/**
 * Persistance sur disque — journal append-only en JSON.
 *
 * À n'importer que depuis du code serveur (pages serveur, Server Functions,
 * route handlers). Aucun composant client ne doit référencer ce module.
 *
 * Choix : un fichier par collection, dans `data/store/`. Les diffs git
 * restent lisibles et le contenu reste inspectable à la main, ce qui prolonge
 * la logique du système de fichiers `.txt` existant.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
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
 * Lit une collection. Un fichier absent ou illisible renvoie la valeur vide :
 * l'application démarre sans configuration, et une corruption ne fabrique
 * jamais de données de remplacement.
 */
export async function lire<K extends keyof Collections>(nom: K): Promise<Collections[K]> {
  try {
    const brut = await fs.readFile(fichier(nom), "utf8");
    return JSON.parse(brut) as Collections[K];
  } catch {
    return VIDE[nom];
  }
}

/** Écriture atomique : fichier temporaire puis renommage. */
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

/** Ajoute un élément en fin de collection. Le journal ne réécrit pas le passé. */
export async function ajouter<K extends CleListe>(
  nom: K,
  element: Collections[K][number],
): Promise<Collections[K][number]> {
  const actuel: unknown[] = await lire(nom);
  await ecrire(nom, [...actuel, element] as Collections[K]);
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
  const actuel = (await lire(nom)) as { id: string }[];
  const index = actuel.findIndex((e) => e.id === id);
  if (index === -1) return null;
  const suivant = maj(actuel[index] as Collections[K][number]);
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
