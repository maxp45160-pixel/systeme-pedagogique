import type { Metadata } from "next";
import {
  GRAPHE_WORKFLOW,
  parcourirWorkflow,
  statistiquesGraphe,
} from "@/lib/domain/workflow-graphe";
import {
  exporterDOT,
  exporterJSON,
  matriceAdjacence,
} from "@/lib/domain/workflow-export";
import { GrapheWorkflowViz } from "@/components/dev/graphe-workflow";

export const metadata: Metadata = {
  title: "Workflow — Dev — Système pédagogique",
  robots: { index: false, follow: false },
};

/**
 * Page `/dev/workflow` — visualisation interactive du graphe de workflow.
 *
 * Le graphe et les statistiques sont calculés côté serveur (couche 3,
 * recalculable). Les Maps sont sérialisées en Records pour le passage en
 * props vers le composant client.
 */
export default function PageWorkflow() {
  const resultat = parcourirWorkflow(GRAPHE_WORKFLOW, "page:/");
  const stats = statistiquesGraphe(resultat, GRAPHE_WORKFLOW);

  // Sérialiser les Maps pour le client
  const profondeurs: Record<string, number> = {};
  for (const [id, p] of resultat.profondeurs) profondeurs[id] = p;

  // Pré-calculer les exports pour le panneau
  const dot = exporterDOT(resultat.noeuds, resultat.liens, {
    avecLibelles: true,
    avecLibellesAretes: true,
    avecConditions: true,
  });
  const json = exporterJSON(resultat, GRAPHE_WORKFLOW);
  const matrice = matriceAdjacence(resultat.noeuds, resultat.liens);

  return (
    <main className="flex h-[calc(100vh-3.25rem)] flex-col">
      <GrapheWorkflowViz
        noeuds={resultat.noeuds}
        liens={resultat.liens}
        inatteignables={resultat.inatteignables}
        profondeurs={profondeurs}
        stats={stats}
        dot={dot}
        jsonExport={json}
        matriceNoeuds={matrice.noeuds}
        matriceData={matrice.matrice}
      />
    </main>
  );
}
