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

type RefGraphe<T> = { current: T };
type NoeudManipulable = NoeudPositionne & { fx?: number | null; fy?: number | null };

/**
 * Pan, drag, survol et zoom molette des deux graphes Canvas.
 * Les refs restent possédées par le composant : réinstaller les écouteurs
 * ne réinitialise ni un geste en cours, ni la caméra, ni le dessin courant.
 * Pointercancel garde le comportement historique de pointerup (clic compris).
 * Le cleanup retire seulement les écouteurs, sans modifier la simulation.
 */
export function lierInteractionsCanvas<N extends NoeudManipulable>(
  canvas: HTMLCanvasElement,
  {
    cameraRef, tailleRef, dragRef, panRef, deplaceRef, survolIdRef,
    simulationRef, dessinerRef, noeudSousCurseur, surClic, zoomMin,
  }: {
    cameraRef: RefGraphe<{ x: number; y: number; zoom: number }>;
    tailleRef: RefGraphe<{ largeur: number; hauteur: number }>;
    dragRef: RefGraphe<{ noeud: N } | null>;
    panRef: RefGraphe<{ x: number; y: number } | null>;
    deplaceRef: RefGraphe<boolean>;
    survolIdRef: RefGraphe<string | null>;
    simulationRef: RefGraphe<{ alphaTarget: (alpha: number) => { restart: () => unknown } } | null>;
    dessinerRef: RefGraphe<() => void>;
    noeudSousCurseur: (x: number, y: number) => N | null;
    surClic: (noeud: N) => void;
    zoomMin: number;
  },
): () => void {
  function coordsRelatives(e: { clientX: number; clientY: number }): [number, number] {
    const rect = canvas.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  }

  function onPointerDown(e: PointerEvent) {
    const [x, y] = coordsRelatives(e);
    deplaceRef.current = false;
    const n = noeudSousCurseur(x, y);
    if (n) {
      dragRef.current = { noeud: n };
      simulationRef.current?.alphaTarget(0.3).restart();
      n.fx = n.x;
      n.fy = n.y;
    } else {
      panRef.current = { x: e.clientX, y: e.clientY };
    }
    canvas.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent) {
    const [x, y] = coordsRelatives(e);
    if (dragRef.current) {
      deplaceRef.current = true;
      const { largeur, hauteur } = tailleRef.current;
      const camera = cameraRef.current;
      dragRef.current.noeud.fx = (x - largeur / 2) / camera.zoom - camera.x;
      dragRef.current.noeud.fy = (y - hauteur / 2) / camera.zoom - camera.y;
      dessinerRef.current();
      return;
    }
    if (panRef.current) {
      deplaceRef.current = true;
      const dx = e.clientX - panRef.current.x;
      const dy = e.clientY - panRef.current.y;
      panRef.current = { x: e.clientX, y: e.clientY };
      cameraRef.current.x += dx / cameraRef.current.zoom;
      cameraRef.current.y += dy / cameraRef.current.zoom;
      dessinerRef.current();
      return;
    }
    const n = noeudSousCurseur(x, y);
    const idSuivant = n?.id ?? null;
    if (survolIdRef.current !== idSuivant) {
      survolIdRef.current = idSuivant;
      dessinerRef.current();
    }
  }

  function onPointerUp(e: PointerEvent) {
    if (dragRef.current) {
      dragRef.current.noeud.fx = null;
      dragRef.current.noeud.fy = null;
      simulationRef.current?.alphaTarget(0);
      if (!deplaceRef.current) surClic(dragRef.current.noeud);
      dragRef.current = null;
    }
    panRef.current = null;
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch {
      /* déjà relâché */
    }
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const [x, y] = coordsRelatives(e);
    const { largeur, hauteur } = tailleRef.current;
    const camera = cameraRef.current;
    // Point du monde sous le curseur avant zoom, pour l'y garder après.
    const mondeX = (x - largeur / 2) / camera.zoom - camera.x;
    const mondeY = (y - hauteur / 2) / camera.zoom - camera.y;
    const facteur = Math.exp(-e.deltaY * 0.001);
    camera.zoom = Math.min(4.5, Math.max(zoomMin, camera.zoom * facteur));
    camera.x = (x - largeur / 2) / camera.zoom - mondeX;
    camera.y = (y - hauteur / 2) / camera.zoom - mondeY;
    dessinerRef.current();
  }

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  return () => {
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("pointercancel", onPointerUp);
    canvas.removeEventListener("wheel", onWheel);
  };
}
