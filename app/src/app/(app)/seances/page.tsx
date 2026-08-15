import { Suspense } from "react";
import { chargerContexte } from "@/lib/store/context";
import { SqueletteContenu } from "@/components/layout/squelette";
import { EntetePage } from "@/components/layout/entete-page";
import { chargerDonneesSeance } from "@/components/seances/donnees-seance";
import { VueSeanceDetail } from "@/components/seances/vue-seance-detail";
import { FileSeances } from "@/components/seances/file-seances";
import { CahierSeances, RechercheCahier } from "@/components/seances/cahier-seances";
import { ConcepteurSeance, type PresetSeance } from "@/components/seances/concepteur-seance";
import { TEMPS_DECLARE_MAX } from "@/lib/domain/seance";

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
    composer?: string;
    code?: string | string[];
    intention?: string;
    temps?: string;
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

  if (recherche.composer === "1") {
    return (
      <Suspense fallback={<SqueletteContenu />}>
        <CompositeurDepuisLien
          codesParametres={recherche.code}
          intention={recherche.intention}
          temps={recherche.temps}
        />
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

async function CompositeurDepuisLien({
  codesParametres,
  intention,
  temps,
}: {
  codesParametres?: string | string[];
  intention?: string;
  temps?: string;
}) {
  const donnees = await chargerDonneesSeance();
  const codesDemandes = (Array.isArray(codesParametres) ? codesParametres : codesParametres ? [codesParametres] : [])
    .filter((code, index, liste) => liste.indexOf(code) === index);
  const codesActifs = new Set(donnees.actifs.map((skill) => skill.code));
  const codesVises = codesDemandes.filter((code) => codesActifs.has(code));
  const codeRepli = donnees.recommandations[0]?.etat.skill.code;
  const codes = codesVises.length > 0 ? codesVises : codeRepli ? [codeRepli] : [];
  const duree = Math.min(
    TEMPS_DECLARE_MAX,
    Math.max(5, Math.round(Number(temps) || 45)),
  );
  const domaines = [...new Set(codes.flatMap((code) => {
    const skill = donnees.actifs.find((candidate) => candidate.code === code);
    return skill ? [skill.domaine] : [];
  }))];
  const preset: PresetSeance | undefined = codes.length > 0
    ? {
        libelle: codes.length === 1 ? `Compétence : ${codes[0]}` : "Séance ciblée",
        codesVises: codes,
        nombreExercices: 3,
        dureeCibleMin: duree,
        ...(domaines.length === 1 ? { domaine: domaines[0] } : {}),
      }
    : undefined;

  return (
    <>
      <EntetePage
        titre="Composer une séance"
        sousTitre="Le travail se construit en plusieurs exercices, calibrés sur le temps disponible."
      />
      <div className="mx-auto max-w-5xl">
        <ConcepteurSeance
          {...donnees}
          preset={preset}
          contexteInitial={intention}
          ouvertParDefaut
          libelle="Ouvrir le compositeur"
        />
      </div>
    </>
  );
}

async function ContenuHub({ recherche }: { recherche?: string }) {
  const [ctx, donnees] = await Promise.all([chargerContexte(), chargerDonneesSeance()]);

  return (
    <div className="space-y-8">
      <RechercheCahier recherche={recherche} />

      {/*
        Le cahier tient l'historique ; il ne déclenche plus la composition.
        Une séance naît d'une note opérationnelle « Séance d'exercices »,
        capturée depuis le tableau de bord — c'est ce qui lui donne sa fiche et
        sa place dans l'Atelier. « Refaire la séance » reste ci-dessous : rejouer
        n'est pas composer.
      */}
      <FileSeances seances={ctx.donnees.sessions} />

      <CahierSeances
        seances={ctx.donnees.sessions}
        donnees={donnees}
        recherche={recherche}
      />
    </div>
  );
}
