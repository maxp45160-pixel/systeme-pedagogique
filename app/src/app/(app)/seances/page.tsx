import { Suspense } from "react";
import { chargerContexte } from "@/lib/store/context";
import { SqueletteContenu } from "@/components/layout/squelette";
import { EntetePage } from "@/components/layout/entete-page";
import { chargerDonneesSeance } from "@/components/seances/donnees-seance";
import { VueSeanceDetail } from "@/components/seances/vue-seance-detail";
import { FileSeances } from "@/components/seances/file-seances";
import { CahierSeances, RechercheCahier } from "@/components/seances/cahier-seances";
import { ActivityWorkspace } from "@/components/adaptive/activity-workspace";
import { GenerationReview } from "@/components/adaptive/generation-review";
import { CoquilleWorkspace } from "@/components/seances/coquille-workspace";
import { parseWorkModeSettings, type WorkModeSettings } from "@/lib/domain/adaptive-learning";
import { lireContexteInstant, type ContexteInstant } from "@/lib/engine/action-unifiee";

function workModeFromQuery(values: { focus?: string; guidance?: string; tools?: string }): WorkModeSettings | undefined {
  if (!values.focus && !values.guidance && !values.tools) return undefined;
  return parseWorkModeSettings({ focus: values.focus, guidance: values.guidance, toolPower: values.tools });
}

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
    run?: string;
    generation?: string;
    q?: string;
    focus?: string;
    guidance?: string;
    tools?: string;
    temps?: string;
    capacite?: string;
  }>;
}) {
  const recherche = await props.searchParams;
  const { session, exercice, run, generation } = recherche;
  const recommendedMode = workModeFromQuery(recherche);

  /*
    Un travail d'une autre famille se déroule dans le même chrome qu'une séance :
    plein écran, en-tête collant, sortie visible. Sans cette coquille, la page
    disparaissait entièrement au profit du contenu, navigation comprise.
  */
  if (run) {
    return (
      <CoquilleWorkspace surtitre="Espace de travail" titre="Concentration">
        <Suspense fallback={<SqueletteContenu />}>
          <ActivityWorkspace runId={run} recommendedMode={recommendedMode} />
        </Suspense>
      </CoquilleWorkspace>
    );
  }

  if (generation) {
    return (
      <CoquilleWorkspace surtitre="Espace de travail" titre="Préparer le contenu">
        <Suspense fallback={<SqueletteContenu />}>
          <GenerationWorkspace
            generationRequestId={generation}
            initialMode={recommendedMode}
            instant={lireContexteInstant(recherche)}
          />
        </Suspense>
      </CoquilleWorkspace>
    );
  }

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

async function GenerationWorkspace({
  generationRequestId,
  initialMode,
  instant,
}: {
  generationRequestId: string;
  initialMode?: WorkModeSettings;
  instant: ContexteInstant;
}) {
  const ctx = await chargerContexte();
  return (
    <GenerationReview
      accountId={ctx.donnees.user.id}
      generationRequestId={generationRequestId}
      initialMode={initialMode}
      instant={{ tempsMin: instant.tempsMin, capacite: instant.capacite }}
    />
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
