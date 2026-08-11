import { Suspense } from "react";
import { chargerContexte } from "@/lib/store/context";
import { chargerThemes } from "@/lib/store/themes";
import { SqueletteContenu } from "@/components/layout/squelette";
import { EntetePage } from "@/components/layout/entete-page";
import {
  calibragesPourModale,
} from "@/components/exercices/proprietes-generation";
import {
  ConcepteurSeance,
  type DonneesSeance,
} from "@/components/seances/concepteur-seance";
import { VueSeanceDetail } from "@/components/seances/vue-seance-detail";
import { FileSeances } from "@/components/seances/file-seances";
import { CahierSeances, RechercheCahier } from "@/components/seances/cahier-seances";

/**
 * Pôle Cahier (ADR-061, étendu par ADR-062).
 *
 * Sans `session` : un hub — composer au centre, une file épinglée des séances
 * en cours et planifiées, puis un cahier chronologique des séances réalisées.
 * Plus de quatre onglets : ni Progression, ni Journal, ni Bibliothèque.
 *
 * Avec `session=<id>` : le workspace — le déroulé de la séance en cours, dans
 * le shell pour l'instant, destiné à devenir plein écran au-dessus du nav.
 */
export default async function PageSeances(props: {
  searchParams: Promise<{
    session?: string;
    exercice?: string;
    correction?: string;
    evaluer?: string;
    bilan?: string;
    abandon?: string;
    q?: string;
  }>;
}) {
  const recherche = await props.searchParams;
  const { session, exercice } = recherche;

  if (session) {
    return (
      <Suspense fallback={<SqueletteContenu />}>
        <VueSeanceDetail id={session} exerciceDemande={exercice} recherche={recherche} />
      </Suspense>
    );
  }

  return (
    <>
      <EntetePage
        titre="Cahier"
        sousTitre="Travaille une séance, puis retrouve l’essentiel de ce que tu en as tiré."
      />
      <Suspense fallback={<SqueletteContenu />}>
        <ContenuHub recherche={recherche.q} />
      </Suspense>
    </>
  );
}

async function ContenuHub({ recherche }: { recherche?: string }) {
  const [ctx, themes] = await Promise.all([chargerContexte(), chargerThemes()]);

  const donnees: DonneesSeance = {
    etats: ctx.etats,
    actifs: ctx.referentiel.actifs,
    exercices: ctx.donnees.exercises,
    tentatives: ctx.donnees.attempts,
    calibrations: Array.from(ctx.calibrations.entries()),
    calibragesModale: calibragesPourModale(ctx.referentiel.actifs, ctx.calibrations),
    recommandations: ctx.recommandations,
    domaines: ctx.referentiel.domaines.map((d) => ({ id: d.id, nom: d.nom, prefixe: d.prefixe })),
    themes,
    compteId: ctx.donnees.user.id,
  };

  return (
    <div className="space-y-8">
      <RechercheCahier recherche={recherche} />

      {/* CTA centré — l'entrée principale de la composition. */}
      <div className="flex justify-center">
        <ConcepteurSeance {...donnees} libelle="Composer une séance" />
      </div>

      <FileSeances seances={ctx.donnees.sessions} />

      <CahierSeances
        seances={ctx.donnees.sessions}
        donnees={donnees}
        recherche={recherche}
      />
    </div>
  );
}
