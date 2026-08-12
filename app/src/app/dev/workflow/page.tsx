import type { Metadata } from "next";
import {
  parcourirWorkflow,
  statistiquesGraphe,
} from "@/lib/domain/workflow-graphe";
import {
  exporterDOT,
  exporterJSON,
  matriceAdjacence,
} from "@/lib/domain/workflow-export";
import { GrapheWorkflowViz } from "@/components/dev/graphe-workflow";
import { scannerWorkflow } from "@/lib/domain/workflow-scanner";

export const metadata: Metadata = {
  title: "Workflow — Dev — Système pédagogique",
  robots: { index: false, follow: false },
};

/**
 * Outil de développement : la page doit toujours refléter l'état courant du
 * code. Le graphe est construit par introspection des fichiers source à
 * chaque requête — pas de cache, pas de constante manuelle à synchroniser.
 */
export const dynamic = "force-dynamic";

/**
 * Page `/dev/workflow` — visualisation interactive du graphe de workflow.
 *
 * Le graphe est construit dynamiquement par `scannerWorkflow()` qui lit
 * le filesystem et les fichiers source (routes, `<Link>`, `router.push`,
 * `redirect`, `<Modale>`). Le BFS et les statistiques restent inchangés.
 *
 * Les Maps sont sérialisées en Records pour le passage en props vers le
 * composant client.
 */
export default async function PageWorkflow() {
  const graphe = await scannerWorkflow();
  const resultat = parcourirWorkflow(graphe, "page:/");
  const stats = statistiquesGraphe(resultat, graphe);

  // Sérialiser les Maps pour le client
  const profondeurs: Record<string, number> = {};
  for (const [id, p] of resultat.profondeurs) profondeurs[id] = p;

  // Pré-calculer les exports pour le panneau
  const dot = exporterDOT(resultat.noeuds, resultat.liens, {
    avecLibelles: true,
    avecLibellesAretes: true,
    avecConditions: true,
  });
  const json = exporterJSON(resultat, graphe);
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
