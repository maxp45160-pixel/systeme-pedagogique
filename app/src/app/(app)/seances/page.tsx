import { Suspense } from "react";
import Link from "next/link";
import { chargerContexte } from "@/lib/store/context";
import { SqueletteContenu } from "@/components/layout/squelette";
import { EntetePage } from "@/components/layout/entete-page";
import { SelecteurSegmente } from "@/components/ui/primitives";
import {
  calibragesPourModale,
} from "@/components/exercices/proprietes-generation";
import {
  ConcepteurSeance,
  type DonneesSeance,
} from "@/components/seances/concepteur-seance";
import { VueHistorique } from "@/components/seances/vue-historique";
import { PanneauProgression } from "@/components/suivi/panneau-progression";
import { PanneauJournal } from "@/components/suivi/panneau-journal";
import { Bibliotheque } from "@/components/exercices/bibliotheque";

/**
 * Pôle Séances (lot 3).
 *
 * Le pilotage vit ici : composer, planifier, dérouler, et relire (historique).
 * « Progression » et « Journal » sont ré-exportés depuis `/competences` ; la
 * « Bibliothèque » est l'ancien `/exercices`, allégé.
 */

type Vue = "accueil" | "progression" | "journal" | "bibliotheque";

const VUES: { cle: Vue; libelle: string }[] = [
  { cle: "accueil", libelle: "Historique" },
  { cle: "progression", libelle: "Progression" },
  { cle: "journal", libelle: "Journal" },
  { cle: "bibliotheque", libelle: "Bibliothèque" },
];

export default async function PageSeances(props: {
  searchParams: Promise<{ vue?: string; periode?: string; recherche?: string }>;
}) {
  const { vue: vueBrute, periode, recherche } = await props.searchParams;
  const vue: Vue =
    vueBrute === "progression"
      ? "progression"
      : vueBrute === "journal"
        ? "journal"
        : vueBrute === "bibliotheque"
          ? "bibliotheque"
          : "accueil";

  return (
    <>
      <EntetePage
        titre="Séances"
        sousTitre="Compose une séance, planifie-la ou déroule-la — et relis ce qui a été fait."
        actions={
          <SelecteurSegmente
            options={VUES.map((v) => ({ cle: v.cle, libelle: v.libelle }))}
            actif={vue}
            rendreItem={(o, classesItem, estActifItem) => (
              <Link
                href={`/seances${o.cle === "accueil" ? "" : `?vue=${o.cle}`}`}
                aria-current={estActifItem ? "page" : undefined}
                className={classesItem}
              >
                {o.libelle}
              </Link>
            )}
          />
        }
      />

      <Suspense key={`${vue}-${periode ?? ""}-${recherche ?? ""}`} fallback={<SqueletteContenu />}>
        <ContenuSeances vue={vue} periode={periode ?? "mois"} recherche={recherche} />
      </Suspense>
    </>
  );
}

async function ContenuSeances({
  vue,
  periode,
  recherche,
}: {
  vue: Vue;
  periode: string;
  recherche?: string;
}) {
  const ctx = await chargerContexte();

  const donnees: DonneesSeance = {
    etats: ctx.etats,
    actifs: ctx.referentiel.actifs,
    exercices: ctx.donnees.exercises,
    tentatives: ctx.donnees.attempts,
    calibrations: Array.from(ctx.calibrations.entries()),
    calibragesModale: calibragesPourModale(ctx.referentiel.actifs, ctx.calibrations),
    recommandations: ctx.recommandations,
    domaines: ctx.referentiel.domaines.map((d) => ({ id: d.id, nom: d.nom })),
    compteId: ctx.donnees.user.id,
  };

  if (vue === "progression") {
    return <PanneauProgression periode={periode} base="/seances" />;
  }

  if (vue === "journal") {
    return <PanneauJournal recherche={recherche} base="/seances" />;
  }

  if (vue === "bibliotheque") {
    return <Bibliotheque />;
  }

  return (
    <div className="space-y-6">
      <ConcepteurSeance {...donnees} />
      <VueHistorique seances={ctx.donnees.sessions} donnees={donnees} />
    </div>
  );
}
