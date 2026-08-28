import { Suspense } from "react";
import { redirect } from "next/navigation";
import { chargerContexte } from "@/lib/store/context";
import { chargerReferentiel } from "@/lib/store/referentiel";
import { compteCourant } from "@/lib/supabase/server";
import { formatDateAujourdhui } from "@/lib/engine/dates";
import { SquelettePage } from "@/components/layout/squelette";
import { chargerActionProposee } from "@/lib/store/adaptive-learning";
import {
  lireContexteInstant,
  type ContexteInstant,
} from "@/lib/engine/action-unifiee";
import { TableauBordOrchestration } from "@/components/dashboard/tableau-bord-orchestration";
import { construireVueTableauBordOrchestration } from "@/lib/engine/dashboard-orchestration";
import { DashboardTour } from "@/components/onboarding/dashboard-tour";
import { prenomPourSalutation, resoudreIdentite } from "@/lib/domain/identite";
import { estModuleActif } from "@/lib/domain/usage-domaine";

export default async function TableauDeBord(props: {
  searchParams: Promise<{ temps?: string; capacite?: string }>;
}) {
  const recherche = await props.searchParams;
  const instant = lireContexteInstant(recherche);

  return (
    <Suspense fallback={<SquelettePage />}>
      <ContenuTableauDeBord instant={instant} />
    </Suspense>
  );
}

async function ContenuTableauDeBord({ instant }: { instant: ContexteInstant }) {
  const apercuReferentiel = await chargerReferentiel();
  if (apercuReferentiel.skills.length === 0) redirect("/demarrer");

  const [ctx, compte] = await Promise.all([chargerContexte(), compteCourant()]);
  const action = await chargerActionProposee(ctx, instant);
  const recommendations = action?.kind === "exercice" ? action.recommandations : ctx.recommandations;
  const view = construireVueTableauBordOrchestration({
    now: ctx.now,
    sessions: ctx.donnees.sessions,
    engagements: ctx.donnees.engagements,
    skillStates: ctx.etats,
    recommendations,
  });
  const identite = resoudreIdentite(compte, ctx.donnees.user);
  const prenom = prenomPourSalutation(identite, compte);
  const date = formatDateAujourdhui(ctx.now);
  const dateAffichee = date.charAt(0).toLocaleUpperCase("fr-FR") + date.slice(1);

  return (
    <div className="space-y-5 sm:space-y-6">
      <header className="px-1 pb-1">
        <h1 className="font-serif text-[2.5rem] font-medium leading-none tracking-tight text-texte sm:text-[3.25rem]">
          Bonjour {prenom}
        </h1>
        <p className="mt-4 font-serif text-lg text-texte-attenue">{dateAffichee}</p>
      </header>

      <TableauBordOrchestration
        view={view}
        competences={ctx.referentiel.actifs.map(({ code, intitule }) => ({ code, intitule }))}
        modules={ctx.referentiel.domaines
          .filter(estModuleActif)
          .map(({ id, nom }) => ({ id, nom }))}
      />
      <DashboardTour autoDemarrage={ctx.global.nombreObservations === 0} />
    </div>
  );
}
