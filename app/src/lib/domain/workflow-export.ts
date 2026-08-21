/**
 * Export du graphe de workflow en formats mathématiques formels.
 *
 * Ce module transforme le résultat du BFS (`workflow-graphe.ts`) en objets
 * standard de la théorie des graphes :
 *
 *   - **matrice d'adjacence** — `A[i][j] = 1` s'il existe une arête du nœud
 *     `i` au nœud `j` (graphe orienté) ;
 *   - **format DOT** — le format textuel de Graphviz, pour visualisation et
 *     analyse externe (`dot -Tsvg`, `networkx`, etc.) ;
 *   - **JSON** — sérialisation complète, pour consommation par un script.
 *
 * ## Usage prévu
 *
 * Ces exports alimentent des outils d'analyse de graphes : centralité
 * (degré, PageRank), chemins critiques, composantes fortement connexes,
 * détection de goulots d'étranglement dans le workflow utilisateur.
 *
 * ## Frontière (AGENTS.md)
 *
 * Couche 3 (Décide) : tout est dérivé, rien n'est stocké. Le module ne
 * connaît pas le référentiel — il reçoit le graphe en paramètre.
 */

import {
  type GrapheWorkflow,
  type LienWorkflow,
  type NoeudWorkflow,
  type ResultatBFS,
  type StatistiquesGraphe,
} from "./workflow-graphe";

/* ------------------------------------------------------------------ */
/* Matrice d'adjacence                                                 */
/* ------------------------------------------------------------------ */

export interface MatriceAdjacence {
  /** Identifiants des nœuds, dans l'ordre des lignes/colonnes. */
  noeuds: string[];
  /** `A[i][j] = 1` si une arête existe du nœud `i` au nœud `j`. */
  matrice: number[][];
  /** Nombre d'arêtes (multiples comptées une seule fois par paire). */
  nombreAretes: number;
}

/**
 * Construit la matrice d'adjacence binaire du graphe orienté.
 *
 * Les nœuds sont ordonnés selon l'ordre de découverte du BFS (ou l'ordre de
 * déclaration si `resultat` est absent). Une arête multiple (deux liens entre
 * les mêmes nœuds) ne compte qu'une fois — la matrice est binaire.
 */
export function matriceAdjacence(
  noeuds: NoeudWorkflow[],
  liens: LienWorkflow[],
): MatriceAdjacence {
  const ids = noeuds.map((n) => n.id);
  const index = new Map(ids.map((id, i) => [id, i]));
  const n = ids.length;
  const matrice: number[][] = Array.from({ length: n }, () => Array<number>(n).fill(0));

  let nombreAretes = 0;
  const vues = new Set<string>();
  for (const lien of liens) {
    const i = index.get(lien.source);
    const j = index.get(lien.target);
    if (i === undefined || j === undefined) continue;
    const cle = `${i},${j}`;
    if (vues.has(cle)) continue;
    vues.add(cle);
    matrice[i][j] = 1;
    nombreAretes++;
  }

  return { noeuds: ids, matrice, nombreAretes };
}

/* ------------------------------------------------------------------ */
/* Format DOT (Graphviz)                                               */
/* ------------------------------------------------------------------ */

/**
 * Échappe un identifiant pour le format DOT.
 *
 * Les identifiants contiennent des caractères réservés (`/`, `?`, `=`, `{`,
 * `}`) : on les met entre guillemets et on échappe les guillemets internes.
 */
function dotId(id: string): string {
  return `"${id.replace(/"/g, '\\"')}"`;
}

export interface OptionsDOT {
  /** Nom du graphe (défaut : `workflow`). */
  nom?: string;
  /** Titre descriptif pour l'en-tête (ex: "Parcours UX Atomique"). */
  titre?: string;
  /** Statistiques du graphe à inclure en en-tête. */
  stats?: StatistiquesGraphe;
  /** Inclure les libellés des nœuds comme attributs `label`. */
  avecLibelles?: boolean;
  /** Inclure les libellés des arêtes comme attributs `label`. */
  avecLibellesAretes?: boolean;
  /** Inclure les conditions comme attributs `style=dashed`. */
  avecConditions?: boolean;
}

/**
 * Sérialise le graphe au format DOT (Graphviz).
 *
 * Le graphe est orienté (`digraph`). Les nœuds reçoivent une forme selon leur
 * type : `box` pour les pages, `ellipse` pour les modales, `diamond` pour les
 * actions, `note` pour les étapes, `folder` pour les tiroirs.
 */
export function exporterDOT(
  noeuds: NoeudWorkflow[],
  liens: LienWorkflow[],
  options: OptionsDOT = {},
): string {
  const nom = options.nom ?? "workflow";
  const lignes: string[] = [];

  if (options.stats) {
    const s = options.stats;
    lignes.push("/*");
    lignes.push(`Métriques — ${options.titre ?? "Parcours Workflow"}`);
    lignes.push("");
    lignes.push("|V| nœuds");
    lignes.push(`    ${s.totalNoeuds}`);
    lignes.push("|E| arêtes");
    lignes.push(`    ${s.totalLiens}`);
    lignes.push("Atteignables");
    lignes.push(`    ${s.atteignables}`);
    lignes.push("Inatteignables");
    lignes.push(`    ${s.inatteignables}`);
    lignes.push("Diamètre BFS");
    lignes.push(`    ${s.diametreBFS}`);
    lignes.push("Degré sortant moy.");
    lignes.push(`    ${s.degreSortantMoyen.toFixed(2)}`);
    lignes.push("");
    lignes.push(`${s.puits.length} puits (fins de parcours) :`);
    lignes.push("");
    for (const p of s.puits) {
      lignes.push(`    • ${p}`);
    }
    lignes.push("*/");
    lignes.push("");
  }

  lignes.push(`digraph ${nom} {`);
  lignes.push("  rankdir=LR;");
  lignes.push("  node [fontname=\"Helvetica\"];");
  lignes.push("  edge [fontname=\"Helvetica\", fontsize=10];");

  const FORME: Record<NoeudWorkflow["type"], string> = {
    page: "box",
    "sous-vue": "component",
    modal: "ellipse",
    tiroir: "folder",
    etape: "note",
    action: "diamond",
  };

  // Regrouper par groupe si présent
  const parGroupe = new Map<string, NoeudWorkflow[]>();
  const sansGroupe: NoeudWorkflow[] = [];

  for (const noeud of noeuds) {
    if (noeud.groupe) {
      const liste = parGroupe.get(noeud.groupe) ?? [];
      liste.push(noeud);
      parGroupe.set(noeud.groupe, liste);
    } else {
      sansGroupe.push(noeud);
    }
  }

  function ecrireNoeud(noeud: NoeudWorkflow) {
    const attrs = [`shape=${FORME[noeud.type]}`];
    if (options.avecLibelles !== false) {
      const lib = noeud.badge ? `[${noeud.badge}] ${noeud.libelle}` : noeud.libelle;
      attrs.push(`label=${dotId(lib)}`);
    }
    if (noeud.url) {
      attrs.push(`URL=${dotId(noeud.url)}`);
    }
    if (noeud.description) {
      attrs.push(`tooltip=${dotId(noeud.description)}`);
    }
    lignes.push(`    ${dotId(noeud.id)} [${attrs.join(", ")}];`);
  }

  if (parGroupe.size > 0) {
    for (const [groupe, liste] of parGroupe.entries()) {
      lignes.push(`  subgraph cluster_${groupe} {`);
      lignes.push(`    label=${dotId(`Cluster ${groupe.toUpperCase()}`)};`);
      lignes.push("    style=rounded;");
      lignes.push("    color=\"#2f6f4f22\";");
      for (const noeud of liste) {
        ecrireNoeud(noeud);
      }
      lignes.push("  }");
    }
    for (const noeud of sansGroupe) {
      ecrireNoeud(noeud);
    }
  } else {
    for (const noeud of noeuds) {
      ecrireNoeud(noeud);
    }
  }

  for (const lien of liens) {
    const attrs: string[] = [];
    if (options.avecLibellesAretes !== false) {
      const texteLien = lien.declencheur
        ? `${lien.libelle}\\n(${lien.declencheur})`
        : lien.libelle;
      attrs.push(`label=${dotId(texteLien)}`);
    }
    if (lien.declencheur) {
      attrs.push(`tooltip=${dotId(`Déclencheur: ${lien.declencheur}`)}`);
    }
    if (options.avecConditions && lien.condition) {
      attrs.push("style=dashed");
      attrs.push(`tooltip=${dotId(lien.condition)}`);
    }
    const suffixe = attrs.length > 0 ? ` [${attrs.join(", ")}]` : "";
    lignes.push(`  ${dotId(lien.source)} -> ${dotId(lien.target)}${suffixe};`);
  }

  lignes.push("}");
  return lignes.join("\n");
}

/* ------------------------------------------------------------------ */
/* JSON complet                                                        */
/* ------------------------------------------------------------------ */

export interface ExportJSON {
  format: "workflow-graphe";
  version: 1;
  racine: string;
  noeuds: NoeudWorkflow[];
  liens: LienWorkflow[];
  inatteignables: NoeudWorkflow[];
  profondeurs: Record<string, number>;
  statistiques: {
    totalNoeuds: number;
    totalLiens: number;
    atteignables: number;
    inatteignables: number;
    diametreBFS: number;
  };
}

/**
 * Sérialise le graphe complet en JSON, prêt à être consommé par un script
 * d'analyse externe (Python/networkx, R/igraph, etc.).
 */
export function exporterJSON(
  resultat: ResultatBFS,
  graphe: GrapheWorkflow,
  racine = "page:/",
): ExportJSON {
  const profondeurs: Record<string, number> = {};
  for (const [id, p] of resultat.profondeurs) profondeurs[id] = p;

  return {
    format: "workflow-graphe",
    version: 1,
    racine,
    noeuds: resultat.noeuds,
    liens: resultat.liens,
    inatteignables: resultat.inatteignables,
    profondeurs,
    statistiques: {
      totalNoeuds: graphe.noeuds.length,
      totalLiens: graphe.liens.length,
      atteignables: resultat.noeuds.length,
      inatteignables: resultat.inatteignables.length,
      diametreBFS: Math.max(0, ...resultat.profondeurs.values()),
    },
  };
}
