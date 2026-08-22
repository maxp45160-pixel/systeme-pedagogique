/**
 * Primitives partagées de la traversée « sortie du modèle → valeur du domaine ».
 *
 * Chaque parseur de proposition applique la même règle d'ADR-034 : une valeur
 * illisible fait échouer la conversion, elle n'est jamais remplacée par un
 * défaut. Ce module ne porte que ce qui doit rester identique entre tous ces
 * chemins — le résultat, et la première marche de la lecture. Le reste
 * (bornes, énumérations, champs) reste propre à chaque proposition.
 *
 * Module pur : aucune entrée/sortie, aucun accès base.
 */

/** Une conversion réussit avec sa valeur, ou échoue en accumulant ses raisons. */
export type Conversion<T> =
  | { ok: true; valeur: T }
  | { ok: false; erreurs: string[] };

/**
 * L'objet JSON que le modèle devait rendre, ou rien.
 *
 * Un tableau n'est pas un objet : le laisser passer ferait lire des champs
 * fantômes plutôt qu'échouer net.
 */
export function objet(valeur: unknown): Record<string, unknown> | null {
  return typeof valeur === "object" && valeur !== null && !Array.isArray(valeur)
    ? (valeur as Record<string, unknown>)
    : null;
}
