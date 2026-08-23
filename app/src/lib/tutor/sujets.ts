/**
 * Détection locale des sujets multiples déclarés d'un coup.
 *
 * Le champ d'amorçage accueille le pluriel — « macroéconomie, statistiques,
 * développement web ». Sans cette lecture, une telle demande arrivait au
 * tuteur comme un seul sujet indécoupable, et une seule branche en sortait là
 * où la personne en attendait trois.
 *
 * Heuristique volontairement simple : séparation par virgules,
 * points-virgules, retours à la ligne et « et ». Rien de sémantique — ce qui
 * est mal séparé reste un sujet unique, et le prompt garde la main sur le
 * découpage réel des branches.
 */

const SEPARATEURS = /[,;\n]|\bet\b/giu;

export function separerSujets(sujet: string): string[] {
  return sujet
    .split(SEPARATEURS)
    .map((morceau) => morceau.trim())
    .filter((morceau) => morceau.length > 1);
}
