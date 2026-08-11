/**
 * Configuration du moteur de layout — d3-force (ADR-056).
 *
 * Remplace le moteur écrit à la main de la version précédente : répulsion
 * O(n²) sur chaque paire à chaque frame, sans quadtree, dans une boucle
 * `requestAnimationFrame` qui ne s'arrêtait jamais. `d3-force` fournit :
 *
 *   - `forceManyBody` : répulsion par quadtree Barnes-Hut, O(n log n) ;
 *   - une décroissance d'`alpha` : la simulation converge puis DORT — plus
 *     de rAF perpétuel une fois le graphe stabilisé ;
 *   - `forceLink`/`forceCollide`/`forceX`/`forceY` : ce que le moteur maison
 *     réimplémentait à la main (ressort, anti-chevauchement, gravité).
 *
 * Ce module ne dessine rien : il construit et retourne la simulation, à
 * charge du composant de piloter son cycle de vie (démarrage, `tick()`,
 * `stop()`, redémarrage sur interaction).
 */

import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import type { LienGraphe, NoeudGraphe } from "@/lib/domain/graphe";
import type { ReglagesGraphe } from "./reglages-graphe";

export interface NoeudSimule extends NoeudGraphe, SimulationNodeDatum {
  /** Rayon affiché, dérivé de `poidsAffichage` et du type — voir `rendu-canvas.ts`. */
  rayon: number;
}

/**
 * `forceLink` MUTE les liens à l'initialisation : `source`/`target` sont
 * fournis en id (`string`, voir `LienGraphe`) mais `d3-force` les remplace
 * par une référence directe au nœud une fois la simulation démarrée — le
 * type doit refléter les deux états, pas seulement celui de départ.
 */
export interface LienSimule extends Omit<LienGraphe, "source" | "target">, SimulationLinkDatum<NoeudSimule> {
  source: string | NoeudSimule;
  target: string | NoeudSimule;
}

const RAYON_PAR_TYPE: Record<NoeudGraphe["type"], number> = {
  competence: 6,
  theme: 10,
  exercice: 4,
};

export function rayonNoeud(n: NoeudGraphe): number {
  const base = RAYON_PAR_TYPE[n.type];
  // Racine carrée : un poids 4× plus grand donne une aire 4× plus grande,
  // pas un rayon 4× plus grand — sinon les gros nœuds écrasent tout à l'œil.
  return base + Math.sqrt(n.poidsAffichage) * 2.2;
}

export function creerNoeudsSimules(noeuds: NoeudGraphe[]): NoeudSimule[] {
  return noeuds.map((n) => ({ ...n, rayon: rayonNoeud(n) }));
}

/**
 * Distance de repos et force d'un lien selon son type — un prérequis tire
 * plus fort qu'une similarité de vocabulaire, qui reste décorative.
 */
const STRENGTH_PAR_TYPE: Record<LienGraphe["type"], number> = {
  prerequis: 0.9,
  theme: 0.5,
  exercice: 0.4,
  similarite: 0.15,
};

export function creerSimulation(
  noeuds: NoeudSimule[],
  liens: LienSimule[],
  forces: ReglagesGraphe["forces"],
): Simulation<NoeudSimule, LienSimule> {
  return forceSimulation(noeuds)
    .force("charge", forceManyBody<NoeudSimule>().strength(-forces.repulsion))
    .force(
      "link",
      forceLink<NoeudSimule, LienSimule>(liens)
        .id((n) => n.id)
        .distance((l) => forces.distanceLiens / Math.max(0.2, l.poids))
        .strength((l) => STRENGTH_PAR_TYPE[l.type] * Math.max(0.2, l.poids)),
    )
    .force(
      "collide",
      forceCollide<NoeudSimule>((n) => n.rayon + 6),
    )
    .force("x", forceX(0).strength(forces.centrage))
    .force("y", forceY(0).strength(forces.centrage))
    .force("center", forceCenter(0, 0).strength(0.02))
    .alphaDecay(0.025)
    .alphaMin(0.005);
}
