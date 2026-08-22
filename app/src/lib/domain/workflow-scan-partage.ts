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
import type { LienWorkflow, NoeudWorkflow } from "./workflow-graphe";

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
 * Les sources diffèrent selon la perspective — pages seules pour le graphe
 * d'architecture, pages ET variantes searchParams pour la perspective UX
 * (une variante `?document` porte le même rail que sa page de base) — mais la
 * passe elle-même est une seule implémentation.
 */
export function relierNavigationPartagee(
  construction: ConstructionGraphe,
  analyses: Map<string, FichierAstAnalyse>,
  sources: readonly { id: string; relatif: string }[],
  declencheur?: string,
): void {
  const navPartagee = resoudreNavigationPartagee(analyses);
  for (const src of sources) {
    for (const [dossier, cibles] of navPartagee.entries()) {
      if (!src.relatif.startsWith(`${dossier}/`)) continue;
      for (const cible of cibles) {
        const targetId = `page:${cible}`;
        if (!construction.parId.has(targetId) || targetId === src.id) continue;
        construction.connecter({
          source: src.id,
          target: targetId,
          type: "navigation",
          libelle: "Navigation persistante",
          ...(declencheur ? { declencheur } : {}),
          cadre: true,
        });
      }
    }
  }
}
