/**
 * Couleurs automatiques par domaine — teinte HSL tournante.
 *
 * Chaque domaine reçoit une teinte régulièrement espacée sur le cercle
 * chromatique. Pas de champ en base, pas de migration : l'indice suffit
 * tant que l'ordre des domaines est stable (et il l'est — `domaines.ordre`
 * est persisté).
 *
 * La variante saturée couvre les nœuds pleins et les arêtes.
 */
/** Teinte saturée pour les nœuds pleins et les arêtes. */
export function couleurDomaine(index: number, total: number): string {
  const hue = total > 0 ? (index / total) * 360 : 0;
  return `hsl(${hue}, 55%, 55%)`;
}
