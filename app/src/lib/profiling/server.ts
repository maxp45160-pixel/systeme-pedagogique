/**
 * Profilage serveur — mesure des temps d'exécution des opérations coûteuses.
 *
 * Mode « full profiling » : chaque opération instrumentée enregistre sa durée
 * dans un registre global (par requête serveur). Le registre est exposé via
 * `/api/profiling` et affiché sur `/dev/profil`.
 *
 * Le registre est volontairement en mémoire, par processus : il sert au
 * débogage et au traçage, pas à la production. Aucune donnée n'est persistée.
 */

import { performance } from "node:perf_hooks";

export interface Mesure {
  /** Nom de l'opération instrumentée. */
  operation: string;
  /** Durée en millisecondes. */
  dureeMs: number;
  /** Horodatage de début (epoch ms). */
  debut: number;
  /** Métadonnées optionnelles (nombre de lignes, taille, etc.). */
  details?: Record<string, number | string | boolean>;
}

const PROFILAGE_ACTIF =
  process.env.NODE_ENV === "development" || process.env.PROFILAGE === "1";

/**
 * Registre global des mesures.
 *
 * Stocké sur `globalThis` et non dans une variable de module : en mode dev,
 * Next.js crée des instances de module distinctes pour les pages et les route
 * handlers. Un tableau module-level serait donc lu vide par `/api/profiling`
 * alors que les pages l'auraient rempli. `globalThis` est partagé par toutes
 * les instances.
 */
const CLE_GLOBAL = "__profilage_registre__";

function registreGlobal(): Mesure[] {
  const g = globalThis as unknown as Record<string, Mesure[] | undefined>;
  if (!g[CLE_GLOBAL]) g[CLE_GLOBAL] = [];
  return g[CLE_GLOBAL]!;
}

/** Enregistre une mesure dans le registre. */
export function enregistrerMesure(mesure: Mesure): void {
  if (!PROFILAGE_ACTIF) return;
  const registre = registreGlobal();
  registre.push(mesure);
  // Garde-fou : on ne laisse jamais le registre grossir sans borne.
  if (registre.length > 500) registre.splice(0, registre.length - 500);
}

/**
 * Mesure la durée d'une fonction asynchrone et l'enregistre.
 *
 * Accepte aussi bien une `Promise` qu'un thenable (le builder Supabase n'est
 * pas une `Promise` native mais se comporte comme tel).
 *
 * @example
 * const resultat = await mesurer("lireTout", () => lireTout());
 */
export async function mesurer<T>(
  operation: string,
  fn: () => PromiseLike<T>,
  details?: Record<string, number | string | boolean>,
): Promise<T> {
  if (!PROFILAGE_ACTIF) return fn();

  const debut = performance.now();
  try {
    return await fn();
  } finally {
    enregistrerMesure({
      operation,
      dureeMs: performance.now() - debut,
      debut: Date.now(),
      details,
    });
  }
}

/** Mesure la durée d'une fonction synchrone et l'enregistre. */
export function mesurerSync<T>(
  operation: string,
  fn: () => T,
  details?: Record<string, number | string | boolean>,
): T {
  if (!PROFILAGE_ACTIF) return fn();

  const debut = performance.now();
  try {
    return fn();
  } finally {
    enregistrerMesure({
      operation,
      dureeMs: performance.now() - debut,
      debut: Date.now(),
      details,
    });
  }
}

/** Renvoie une copie du registre, triée par durée décroissante. */
export function mesuresActuelles(): Mesure[] {
  return [...registreGlobal()].sort((a, b) => b.dureeMs - a.dureeMs);
}

/** Vide le registre. */
export function viderRegistre(): void {
  registreGlobal().length = 0;
}

/** Le profilage est-il actif ? */
export function profilageActif(): boolean {
  return PROFILAGE_ACTIF;
}