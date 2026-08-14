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

/**
 * Attribue son indice à chaque domaine : dédoublonné puis trié.
 *
 * Le graphe et l'arbre de l'Atelier doivent teinter un domaine à l'identique.
 * Ils y parviennent en partageant cette règle et en lui donnant le même
 * ensemble d'identifiants — pas en la réimplémentant chacun de leur côté.
 */
export function indexerDomaines(
  ids: Iterable<string | null | undefined>,
): { indexDomaine: Map<string, number>; totalDomaines: number } {
  const domaines = [...new Set([...ids].filter((id): id is string => Boolean(id)))].sort();
  return {
    indexDomaine: new Map(domaines.map((id, index) => [id, index])),
    totalDomaines: domaines.length,
  };
}

/** Table prête à l'emploi pour un rendu qui n'a pas besoin des indices. */
export function paletteDomaines(ids: Iterable<string | null | undefined>): Record<string, string> {
  const { indexDomaine, totalDomaines } = indexerDomaines(ids);
  const palette: Record<string, string> = {};
  for (const [id, index] of indexDomaine) palette[id] = couleurDomaine(index, totalDomaines);
  return palette;
}
