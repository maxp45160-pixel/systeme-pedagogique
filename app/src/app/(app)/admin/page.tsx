import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { EntetePage } from "@/components/layout/entete-page";
import { SqueletteContenu } from "@/components/layout/squelette";
import { CockpitAdmin } from "@/components/admin/cockpit-admin";
import { estAdministrateur, lireAccesCourant, listerComptes } from "@/lib/store/acces";
import { calculerStatistiquesAdmin } from "@/lib/domain/admin-kpi";
import { obtenirDiagnosticSysteme } from "@/lib/store/systeme";
import { chargerEtatMoteur, type EtatMoteur } from "@/lib/store/auto-evaluation";
import { chargerRefutationRelecture } from "@/lib/store/propositions-referentiel";
import { lireRefutation, type LectureRefutation } from "@/lib/domain/propositions-referentiel";
import { REGLAGES_PAR_DEFAUT } from "@/lib/engine/reglages";
import { scannerWorkflow } from "@/lib/dev/workflow-scanner";
import { scannerUxJourney } from "@/lib/dev/workflow-ux-scanner";
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
import type { DonneesPerspectiveGraphe } from "@/components/dev/graphe-workflow";

export const metadata: Metadata = {
  title: "Comptes et accès — Système pédagogique",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function perspectiveVide(): DonneesPerspectiveGraphe {
  return {
    noeuds: [],
    liens: [],
    inatteignables: [],
    profondeurs: {},
    stats: {
      totalNoeuds: 0,
      totalLiens: 0,
      atteignables: 0,
      inatteignables: 0,
      degreSortantMoyen: 0,
      degreEntrantMoyen: 0,
      puits: [],
      sources: [],
      diametreBFS: 0,
    },
    dot: "",
    jsonExport: {
      format: "workflow-graphe",
      version: 1,
      racine: "page:/",
      noeuds: [],
      liens: [],
      inatteignables: [],
      profondeurs: {},
      statistiques: {
        totalNoeuds: 0,
        totalLiens: 0,
        atteignables: 0,
        inatteignables: 0,
        diametreBFS: 0,
      },
    },
    matriceNoeuds: [],
    matriceData: [],
  };
}

function preparerPerspective(
  graphe: GrapheWorkflow,
  titre: string,
): DonneesPerspectiveGraphe {
  if (graphe.noeuds.length === 0) {
    return perspectiveVide();
  }

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

export default async function PageAdmin(props: {
  searchParams?: Promise<{ onglet?: string }>;
}) {
  const params = props.searchParams ? await props.searchParams : undefined;
  return (
    <>
      <EntetePage
        titre="Comptes et accès"
        sousTitre="Pilotage global, KPIs d'activité, sécurité des accès, diagnostic système et outils de développement."
      />
      <Suspense fallback={<SqueletteContenu />}>
        <ContenuAdmin onglet={params?.onglet} />
      </Suspense>
    </>
  );
}

const GRAPHE_VIDE: GrapheWorkflow = { noeuds: [], liens: [] };

/**
 * L'etat rendu tant que l'onglet Moteur n'a pas ete ouvert.
 *
 * `metriques` vide, et non quatre metriques a zero : un zero se lirait
 * comme rien de mesure la ou la verite est pas encore lu. Les reglages, eux,
 * sont bien ceux du code -- c'est l'etat reel quand le journal est vide.
 */
const MOTEUR_NON_CHARGE: EtatMoteur = {
  metriques: [],
  reglages: REGLAGES_PAR_DEFAUT,
  journal: [],
  proposition: null,
};

/**
 * L'état rendu tant que l'onglet Relecture n'a pas été ouvert.
 *
 * Une lecture vide, et non des compteurs à zéro : `lireRefutation([])` rend
 * exactement ce que dit la vérité — rien n'a été lu. Fabriquer des zéros ferait
 * afficher « 0 % de rétention » là où la mesure n'a simplement pas été chargée.
 */
const RELECTURE_NON_CHARGEE: LectureRefutation = lireRefutation([]);

async function ContenuAdmin({ onglet }: { onglet?: string }) {
  const [admin, acces] = await Promise.all([estAdministrateur(), lireAccesCourant()]);
  if (!admin || !acces) notFound();

  const chargerWorkflow = onglet === "workflow";
  // Comme le workflow : cinq lectures pour l'auto-évaluation, dont le journal
  // du moteur. Aucune raison de les payer sur l'onglet des indicateurs.
  const chargerMoteur = onglet === "moteur";
  // Même raison : la rétention lit tout l'historique des propositions.
  const chargerRelecture = onglet === "relecture";

  const [comptes, diagnostic, etatMoteur, refutationRelecture, grapheArch, grapheUxMacro, grapheUxAtomique] =
    await Promise.all([
      listerComptes(),
      obtenirDiagnosticSysteme(),
      chargerMoteur ? chargerEtatMoteur() : Promise.resolve(MOTEUR_NON_CHARGE),
      chargerRelecture
        ? chargerRefutationRelecture()
        : Promise.resolve(RELECTURE_NON_CHARGEE),
      chargerWorkflow ? scannerWorkflow() : Promise.resolve(GRAPHE_VIDE),
      chargerWorkflow ? scannerUxJourney({ mode: "macro" }) : Promise.resolve(GRAPHE_VIDE),
      chargerWorkflow ? scannerUxJourney({ mode: "atomique" }) : Promise.resolve(GRAPHE_VIDE),
    ]);

  const kpis = calculerStatistiquesAdmin(comptes);

  const perspectivesWorkflow = {
    architecture: preparerPerspective(grapheArch, "Architecture Code (AST)"),
    ux: preparerPerspective(grapheUxMacro, "Parcours UX Synthèse (Macro)"),
    uxAtomique: preparerPerspective(grapheUxAtomique, "Parcours UX Atomique"),
  };

  return (
    <CockpitAdmin
      comptes={comptes}
      moiId={acces.userId}
      kpis={kpis}
      diagnostic={diagnostic}
      etatMoteur={etatMoteur}
      refutationRelecture={refutationRelecture}
      perspectivesWorkflow={perspectivesWorkflow}
    />
  );
}
