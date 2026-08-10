/**
 * Couleurs automatiques par domaine — teinte HSL tournante.
 *
 * Chaque domaine reçoit une teinte régulièrement espacée sur le cercle
 * chromatique. Pas de champ en base, pas de migration : l'indice suffit
 * tant que l'ordre des domaines est stable (et il l'est — `domaines.ordre`
 * est persisté).
 *
 * Les deux variantes (saturée / claire) couvrent les deux cas d'usage :
 * nœud plein et halo / fond de cluster.
 */

/** Teinte saturée pour les nœuds pleins et les arêtes. */
export function couleurDomaine(index: number, total: number): string {
  const hue = total > 0 ? (index / total) * 360 : 0;
  return `hsl(${hue}, 55%, 55%)`;
}

/** Teinte claire pour les halos, fonds de cluster, arêtes secondaires. */
export function couleurDomaineClaire(index: number, total: number): string {
  const hue = total > 0 ? (index / total) * 360 : 0;
  return `hsl(${hue}, 45%, 85%)`;
}

/** Teinte très foncée pour le texte sur fond clair. */
export function couleurDomaineFoncee(index: number, total: number): string {
  const hue = total > 0 ? (index / total) * 360 : 0;
  return `hsl(${hue}, 40%, 30%)`;
}
