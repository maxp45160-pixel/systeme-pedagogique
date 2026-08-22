/**
 * Mécanique commune aux deux scanners de workflow (`workflow-scanner.ts`,
 * `workflow-ux-scanner.ts`).
 *
 * Le constructeur de graphe et la passe de navigation persistante étaient
 * recopiés entre les perspectives — trois copies des closures
 * `ajouterNoeud`/`connecter`, deux copies du parcours des layouts. Une copie
 * diverge déjà (déduplication documentée d'un seul côté) ; ce module est
 * l'autorité unique.
 *
 * ## Frontière (AGENTS.md)
 *
 * Couche 3 (Décide) : tout est dérivé du code analysé, rien n'est stocké.
 */

import type { FichierAstAnalyse } from "./workflow-ast-parser";
import { resoudreNavigationPartagee } from "./workflow-ast-parser";
import type { LienWorkflow, NoeudWorkflow } from "@/lib/domain/workflow-graphe";

export interface ConstructionGraphe {
  noeuds: NoeudWorkflow[];
  liens: LienWorkflow[];
  /** Index par identifiant — les passes testent l'existence avant de relier. */
  parId: Map<string, NoeudWorkflow>;
  ajouterNoeud(noeud: NoeudWorkflow): void;
  connecter(lien: LienWorkflow): void;
}

/**
 * Le constructeur qu'utilisaient les trois fonctions de construction, recopié
 * trois fois. La clé de déduplication porte sur le trajet complet
 * (source→cible→type→libellé), pas sur le geste : plusieurs boutons d'une même
 * vue produisent des arêtes jumelles qui ne diffèrent que par leur
 * déclencheur, et les compter double gonflait les degrés en masquant la
 * topologie réelle.
 */
export function creerConstructionGraphe(): ConstructionGraphe {
  const noeuds: NoeudWorkflow[] = [];
  const liens: LienWorkflow[] = [];
  const parId = new Map<string, NoeudWorkflow>();
  const vusLiens = new Set<string>();

  return {
    noeuds,
    liens,
    parId,
    ajouterNoeud(noeud) {
      if (!parId.has(noeud.id)) {
        parId.set(noeud.id, noeud);
        noeuds.push(noeud);
      }
    },
    connecter(lien) {
      const cle = `${lien.source}→${lien.target}→${lien.type}→${lien.libelle}`;
      if (!vusLiens.has(cle)) {
        vusLiens.add(cle);
        liens.push(lien);
      }
    },
  };
}

/**
 * Navigation persistante du cadre (rail + barre mobile) : déclarée dans les
 * layouts partagés, présente sur tous les écrans du groupe de routes. Sans
 * cette passe, `/aide`, `/compte` ou `/progression` sembleraient inaccessibles
 * depuis la plupart des pages alors qu'ils sont partout.
 *
 * ## Le hub `cadre:rail`
 *
 * Le rail est UN objet d'interface présent sur TOUS les écrans — pas N×M
 * liens distincts. Le relier en pairwise fabriquait plus de cent arêtes
 * jumelles qui noyaient le graphe sans rien dire de plus : la topologie réelle
 * est une étoile. Chaque écran porte désormais une seule arête vers le hub,
 * et le hub une arête par destination. Les sources diffèrent selon la
 * perspective — pages seules pour le graphe d'architecture, pages ET variantes
 * searchParams pour la perspective UX (une variante `?document` porte le même
 * rail que sa page de base) — mais la passe elle-même est une seule
 * implémentation.
 */
export function relierNavigationPartagee(
  construction: ConstructionGraphe,
  analyses: Map<string, FichierAstAnalyse>,
  sources: readonly { id: string; relatif: string }[],
  declencheur?: string,
): void {
  const navPartagee = resoudreNavigationPartagee(analyses);
  const HUB = "cadre:rail";
  construction.ajouterNoeud({
    id: HUB,
    type: "cadre",
    libelle: "Rail & barre mobile",
    badge: "Cadre",
    description:
      "Navigation persistante du cadre : les mêmes destinations, depuis chaque écran.",
  });

  const destinations = new Set<string>();
  for (const cibles of navPartagee.values()) {
    for (const cible of cibles) destinations.add(`page:${cible}`);
  }

  // Seuls les écrans sous un layout qui déclare la navigation portent le rail :
  // `/login` et les routes d'authentification vivent hors du cadre.
  for (const src of sources) {
    const encadre = [...navPartagee.keys()].some((dossier) =>
      src.relatif.startsWith(`${dossier}/`),
    );
    if (!encadre || !construction.parId.has(src.id) || src.id === HUB) continue;
    construction.connecter({
      source: src.id,
      target: HUB,
      type: "navigation",
      libelle: "Rail",
      ...(declencheur ? { declencheur } : {}),
      cadre: true,
    });
  }

  for (const dest of destinations) {
    if (!construction.parId.has(dest)) continue;
    construction.connecter({
      source: HUB,
      target: dest,
      type: "navigation",
      libelle: "Destination du rail",
      cadre: true,
    });
  }
}
