/**
 * Profilage serveur — mesure des temps d'exécution des opérations coûteuses.
 *
 * Mode « full profiling » : chaque opération instrumentée enregistre sa durée
 * dans un registre global (par requête serveur). Le registre est exposé via
 * `/api/profiling` et affiché sur `/dev/profil`.
 *
 * Deux notions distinctes, à ne pas confondre :
 *
 *   * **disponible** (`profilageActif`) — l'outillage peut mesurer dans ce
 *     processus. Vrai en `NODE_ENV=development`, avec `PROFILAGE=1`, ou dès
 *     qu'un « Démarrer » a levé le drapeau runtime : on peut donc profiler un
 *     build de production sans le redémarrer ;
 *   * **en cours d'enregistrement** (`enregistrementActif`) — on collecte
 *     *maintenant*. À l'arrêt par défaut.
 *
 * Les séparer est ce qui rend le bouton « Arrêter » utile : sans cela, en
 * développement, `profilageActif()` reste vrai quoi qu'il arrive et la
 * collecte ne s'arrête jamais — tout ce qui précède le geste à mesurer noie
 * la mesure.
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

/**
 * Drapeaux runtime, sur `globalThis`.
 *
 * `globalThis` est partagé par toutes les instances de module en dev (Next.js
 * crée des instances distinctes pour les pages et les route handlers) — même
 * raison que pour le registre ci-dessous. Un drapeau module-level ne serait
 * pas vu par la route `/api/profiling`, et le démarrage déclenché depuis
 * l'API resterait invisible des pages.
 */
const CLE_DRAPEAU = "__profilage_actif__";
const CLE_ENREGISTREMENT = "__profilage_enregistrement__";

function drapeauGlobal(cle: string): boolean {
  const g = globalThis as unknown as Record<string, boolean | undefined>;
  return g[cle] === true;
}

function poserDrapeau(cle: string, valeur: boolean): void {
  const g = globalThis as unknown as Record<string, boolean | undefined>;
  g[cle] = valeur;
}

/**
 * Le profilage est-il disponible dans ce processus ?
 *
 * Vrai si la variable d'environnement l'a activé au démarrage, OU si le
 * drapeau runtime a été levé par le bouton du panneau.
 */
export function profilageActif(): boolean {
  return (
    process.env.NODE_ENV === "development" ||
    process.env.PROFILAGE === "1" ||
    drapeauGlobal(CLE_DRAPEAU)
  );
}

/** L'enregistrement serveur est-il en cours ? */
export function enregistrementActif(): boolean {
  return profilageActif() && drapeauGlobal(CLE_ENREGISTREMENT);
}

/**
 * Démarre ou arrête l'enregistrement serveur.
 *
 * Démarrer lève aussi le drapeau de disponibilité — c'est ce qui permet de
 * profiler un build où aucune variable d'environnement ne l'a demandé — et
 * vide le registre : une session de mesure commence sur une table nette,
 * sinon le total affiché mélange deux observations.
 *
 * Arrêter conserve le registre. On arrête précisément pour lire ce que l'on
 * vient de mesurer ; le vider ici détruirait l'objet de la manœuvre. C'est à
 * `DELETE /api/profiling` — le bouton « Vider » — de le faire, sur demande.
 */
export function definirEnregistrement(actif: boolean): void {
  if (actif) {
    poserDrapeau(CLE_DRAPEAU, true);
    viderRegistre();
  }
  poserDrapeau(CLE_ENREGISTREMENT, actif);
}

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
  if (!enregistrementActif()) return;
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
  if (!enregistrementActif()) return fn();

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
  if (!enregistrementActif()) return fn();

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
