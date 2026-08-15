import type { Metadata } from "next";
import {
  parcourirWorkflow,
  statistiquesGraphe,
  type GrapheWorkflow,
} from "@/lib/domain/workflow-graphe";
import {
  exporterDOT,
  exporterJSON,
  matriceAdjacence,
} from "@/lib/domain/workflow-export";
import {
  GrapheWorkflowViz,
  type DonneesPerspectiveGraphe,
} from "@/components/dev/graphe-workflow";
import { scannerWorkflow } from "@/lib/domain/workflow-scanner";
import { scannerUxJourney } from "@/lib/domain/workflow-ux-scanner";

export const metadata: Metadata = {
  title: "Workflow — Dev — Système pédagogique",
  robots: { index: false, follow: false },
};

/**
 * Outil de développement : la page doit toujours refléter l'état courant du
 * code. Les graphes (Architecture, UX Synthèse et UX Atomique) sont construits
 * dynamiquement à chaque requête sans persistance ni duplication.
 */
export const dynamic = "force-dynamic";

function preparerPerspective(
  graphe: GrapheWorkflow,
  titre: string,
): DonneesPerspectiveGraphe {
  const resultat = parcourirWorkflow(graphe, "page:/");
  const stats = statistiquesGraphe(resultat, graphe);

  const profondeurs: Record<string, number> = {};
  for (const [id, p] of resultat.profondeurs) {
    profondeurs[id] = p;
  }

  const dot = exporterDOT(resultat.noeuds, resultat.liens, {
    titre,
    stats,
    avecLibelles: true,
    avecLibellesAretes: true,
    avecConditions: true,
  });
  const jsonExport = exporterJSON(resultat, graphe);
  const matrice = matriceAdjacence(resultat.noeuds, resultat.liens);

  return {
    noeuds: resultat.noeuds,
    liens: resultat.liens,
    inatteignables: resultat.inatteignables,
    profondeurs,
    stats,
    dot,
    jsonExport,
    matriceNoeuds: matrice.noeuds,
    matriceData: matrice.matrice,
  };
}

/**
 * Page `/dev/workflow` — visualisation interactive triple perspective.
 *
 * Combine :
 *   1. Vue Parcours UX Synthèse (Macro-UX) : carrefours majeurs (~45 nœuds).
 *   2. Vue Parcours UX Atomique : exhaustivité totale des boutons et sous-onglets (~89 nœuds).
 *   3. Vue Architecture (Code / AST) : introspection filesystem et server actions.
 */
export default async function PageWorkflow() {
  const [grapheArch, grapheUxMacro, grapheUxAtomique] = await Promise.all([
    scannerWorkflow(),
    scannerUxJourney({ mode: "macro" }),
    scannerUxJourney({ mode: "atomique" }),
  ]);

  const perspectiveArch = preparerPerspective(
    grapheArch,
    "Architecture Code (AST)",
  );
  const perspectiveUx = preparerPerspective(
    grapheUxMacro,
    "Parcours UX Synthèse (Macro)",
  );
  const perspectiveUxAtomique = preparerPerspective(
    grapheUxAtomique,
    "Parcours UX Atomique",
  );

  return (
    <main className="flex h-[calc(100vh-3.25rem)] flex-col">
      <GrapheWorkflowViz
        architecture={perspectiveArch}
        ux={perspectiveUx}
        uxAtomique={perspectiveUxAtomique}
      />
    </main>
  );
}
