/**
 * Mécanique commune aux graphes Canvas + d3-force.
 *
 * Deux consommateurs — le graphe du référentiel (`competences/graphe`) et la
 * visualisation workflow (`dev/graphe-workflow.tsx`) — avaient recopié à
 * l'identique la conservation des positions, le filtrage des liens simulables,
 * la lecture de `prefers-reduced-motion` et le redimensionnement DPR. Une seule
 * implémentation chacun : une divergence ici serait invisible jusqu'à ce qu'un
 * graphe se comporte différemment de l'autre.
 *
 * Ce module ne configure aucune force : les layouts diffèrent volontairement
 * (clusters polaires par domaine contre colonnes BFS/clusters de groupes).
 */

/** Un nœud porté par la simulation d3-force — les champs de vitesse sont mutés par elle. */
export interface NoeudPositionne {
  id: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

/**
 * Repart des positions précédentes quand le nœud existait déjà — évite que
 * chaque bascule de filtre relance le graphe depuis zéro. Mute `suivants`.
 */
export function conserverPositions<N extends NoeudPositionne>(
  anciens: readonly N[],
  suivants: N[],
): void {
  const parId = new Map(anciens.map((n) => [n.id, n]));
  for (const suivant of suivants) {
    const ancien = parId.get(suivant.id);
    if (ancien && ancien.x !== undefined) {
      suivant.x = ancien.x;
      suivant.y = ancien.y;
      suivant.vx = ancien.vx;
      suivant.vy = ancien.vy;
    }
  }
}

/**
 * Les liens dont les deux bouts existent, **clonés** : `forceLink` mute
 * `source`/`target` en références de nœuds, il ne faut jamais lui donner les
 * objets du graphe source.
 */
export function liensRelies<L extends { source: string; target: string }, N>(
  liens: readonly L[],
  parId: Map<string, N>,
): L[] {
  return liens
    .filter((l) => parId.has(l.source) && parId.has(l.target))
    .map((l) => ({ ...l }));
}

/** L'utilisateur demande moins d'animation (réglage système). */
export function mouvementReduit(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Redimensionnement du canevas gérant le DPR via `ResizeObserver` plutôt que
 * du polling par frame (défaut de la première version). Retourne le cleanup.
 *
 * @param surRedimensionnement appelé après chaque mise à l'échelle avec la
 *   taille CSS du canevas — y mettre à jour l'état local puis dessiner.
 */
export function observerTailleCanvas(
  conteneur: HTMLElement,
  canvas: HTMLCanvasElement,
  surRedimensionnement: (taille: { largeur: number; hauteur: number }) => void,
): () => void {
  function redimensionner() {
    const rect = conteneur.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const taille = { largeur: rect.width, hauteur: rect.height };
    canvas.width = Math.max(1, Math.round(taille.largeur * dpr));
    canvas.height = Math.max(1, Math.round(taille.hauteur * dpr));
    canvas.style.width = `${taille.largeur}px`;
    canvas.style.height = `${taille.hauteur}px`;
    const ctx = canvas.getContext("2d");
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    surRedimensionnement(taille);
  }

  redimensionner();
  const observateur = new ResizeObserver(redimensionner);
  observateur.observe(conteneur);
  return () => observateur.disconnect();
}
