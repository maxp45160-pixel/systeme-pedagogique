import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { chargerContexte } from "@/lib/store/context";
import { chargerReferentiel } from "@/lib/store/referentiel";
import { cleJour, formatDateAujourdhui, formatDuree } from "@/lib/engine/dates";
import { SquelettePage } from "@/components/layout/squelette";
import { calculerActivite } from "@/lib/engine/historique";
import { CarteProchaineAction } from "@/components/dashboard/prochaine-action";
import { BlocAujourdHui } from "@/components/dashboard/bloc-aujourd-hui";
import { PistesAlternatives } from "@/components/dashboard/pistes-alternatives";
import { AvisPropositions } from "@/components/dashboard/avis-propositions";
import { IconeCalendrier, IconeDossier, IconeFleche } from "@/components/ui/icones";
import { BandeauInfo, classesLienBouton } from "@/components/ui/primitives";
import { AbandonnerExerciceCarte } from "@/components/dashboard/abandonner-exercice-carte";
import { statutSeance } from "@/lib/domain/seance";
import { chargerActionProposee } from "@/lib/store/adaptive-learning";
import { urlComposerAutonome } from "@/lib/domain/navigation-exercice";
import {
  lireContexteInstant,
  type ContexteInstant,
} from "@/lib/engine/action-unifiee";
import { DashboardTour } from "@/components/onboarding/dashboard-tour";
import { BandeauRepriseBienveillante } from "@/components/dashboard/bandeau-reprise-bienveillante";
import { construireSeancesDuJour } from "@/lib/engine/seances-du-jour";
import { calibragesPourModale, competencesPourModale } from "@/lib/domain/proprietes-generation";

export default async function TableauDeBord(props: {
  searchParams: Promise<{ temps?: string; capacite?: string; explication?: string }>;
}) {
  const recherche = await props.searchParams;
  const instant = lireContexteInstant(recherche);
  const dateJour = formatDateAujourdhui();

  return (
    <Suspense fallback={<SquelettePage />}>
      <ContenuTableauDeBord
        instant={instant}
        dateJour={dateJour}
        explicationEnregistree={recherche.explication === "enregistree"}
      />
    </Suspense>
  );
}

/**
 * Le bandeau ne parle plus que d'exercices : depuis le retrait des autres
 * familles (ADR-070), c'est le seul travail qui puisse rester ouvert.
 */
function titreExercicesEnCours(exercices: number): string {
  return exercices === 1 ? "Vous avez un exercice en cours" : `Vous avez ${exercices} exercices en cours`;
}

async function ContenuTableauDeBord({
  instant,
  dateJour,
  explicationEnregistree,
}: {
  instant: ContexteInstant;
  dateJour: string;
  explicationEnregistree: boolean;
}) {
  /*
   * Compte neuf : il n'y a rien à mettre sur ce tableau de bord, et une grille
   * de tirets ne dit pas quoi faire. On envoie construire le référentiel — la
   * seule action possible tant qu'il n'existe pas (ADR-026).
   *
   * Le test passe sur une lecture légère du seul référentiel, AVANT
   * `chargerContexte()` : sur un compte neuf, le contexte complet (états,
   * recommandations, calibrations…) serait calculé puis jeté à 100 % par la
   * redirection. `chargerReferentiel` est mémoïsé par requête : sur un compte
   * établi, l'appel ne coûte rien de plus — `chargerContexte` reprend le
   * résultat en cache quand il emprunte le chemin lent.
   */
  const apercuReferentiel = await chargerReferentiel();
  if (apercuReferentiel.skills.length === 0) {
    redirect("/demarrer");
  }

  const ctx = await chargerContexte();

  const action = await chargerActionProposee(ctx, instant);
  const activite = calculerActivite(
    ctx.donnees.sessions,
    ctx.now,
    ctx.donnees.attempts,
    ctx.dureesEstimees,
  );
  const aucuneObservation = ctx.global.nombreObservations === 0;

  // Détection du temps d'inactivité pour l'accueil bienveillant
  let joursSansActivite = 0;
  if (activite.derniereSeance) {
    const diffMs = ctx.now.getTime() - new Date(activite.derniereSeance).getTime();
    joursSansActivite = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  }

  const seancesActives = [...ctx.donnees.sessions]
    .filter((seance) => statutSeance(seance) === "en-cours")
    .sort((a, b) => b.date.localeCompare(a.date));
  const seancesOuvertes = ctx.donnees.sessions.filter((seance) => {
    const statut = statutSeance(seance);
    return statut === "planifiee" || statut === "en-cours";
  });
  const vueSeancesDuJour = construireSeancesDuJour(seancesOuvertes, cleJour(ctx.now));
  const aUneSeanceAujourdhui =
    vueSeancesDuJour.enCours.length > 0 || vueSeancesDuJour.planifiees.length > 0;

  const exercicesDesSeancesActives = new Set(
    seancesActives
      .flatMap((seance) =>
        seance.activites
          .filter((activite) => activite.type === "exercice")
          .map((activite) => activite.ref),
      ),
  );

  const parId = new Map(ctx.donnees.exercises.map((e) => [e.id, e]));
  const enCours = ctx.donnees.attempts
    .filter((a) => a.statut === "en-cours" && !exercicesDesSeancesActives.has(a.exerciseId))
    .flatMap((a) => {
      const exercice = parId.get(a.exerciseId);
      if (!exercice) return [];
      const minutes = Math.max(
        1,
        Math.round((ctx.now.getTime() - new Date(a.debut).getTime()) / 60_000),
      );
      return [{ id: a.id, exercice, depuis: minutes }];
    })
    .sort((a, b) => a.depuis - b.depuis);

  const recommandationsFile = action?.kind === "exercice" ? action.recommandations : ctx.recommandations;
  const premiereRecommandation = recommandationsFile[0];
  const competencesGeneration = competencesPourModale(ctx.referentiel.actifs);
  const calibragesGeneration = calibragesPourModale(ctx.referentiel.actifs, ctx.calibrations);

  return (
    <div className="space-y-6 sm:space-y-8">
      {explicationEnregistree && (
        <BandeauInfo ton="succes" className="justify-between gap-3">
          <span>
            <strong className="font-semibold">Explication enregistrée.</strong> Une observation de compréhension a été ajoutée à votre suivi.
          </span>
          <Link href="/app" className="shrink-0 font-medium text-primaire hover:underline">
            Fermer
          </Link>
        </BandeauInfo>
      )}

      {/* Accueil bienveillant après interruption */}
      <BandeauRepriseBienveillante
        userId={ctx.donnees.user.id}
        joursSansActivite={joursSansActivite}
        nombreCompetencesActives={ctx.referentiel.actifs.length}
        recommandationTitre={premiereRecommandation?.etat.skill.intitule}
        recommandationCode={premiereRecommandation?.etat.skill.code}
      />

      {/* L'en-tête dit seulement où l'on est et si une séance attend aujourd'hui. */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-bordure/50 pb-5 sm:pb-6">
        <div className="min-w-0">
          <div className="font-serif text-xs italic text-texte-discret">{dateJour}</div>
          <h1 className="mt-1 font-serif text-2xl font-medium leading-tight tracking-tight sm:text-3xl">
            Tableau de bord
          </h1>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">
          {!aUneSeanceAujourdhui && (
            <p className="flex items-center gap-2 text-sm text-texte-attenue">
              <IconeCalendrier className="size-4 text-texte-discret" aria-hidden />
              Rien de planifié aujourd&apos;hui
            </p>
          )}
          <Link
            href="/atelier"
            className={`${classesLienBouton("secondaire", "petite")} group`}
          >
            <IconeDossier className="size-3.5 text-primaire" aria-hidden />
            <span>Organiser dans Mes cours</span>
            <IconeFleche className="size-3 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>

      {aUneSeanceAujourdhui && (
        <BlocAujourdHui
          sessions={seancesOuvertes}
          initialView={vueSeancesDuJour}
          compteId={ctx.donnees.user.id}
          domaines={ctx.referentiel.domaines.map(({ id, nom }) => ({ id, nom }))}
        />
      )}

      <Suspense fallback={null}>
        <AvisPropositions />
      </Suspense>

      {/* Le premier écran ne contient que le choix immédiat. */}
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-12 lg:gap-5">
        <div className="min-w-0 space-y-4 lg:col-span-8 [&>*:last-child]:h-full">
          {/* Alerte si des exercices sont déjà en cours */}
          {enCours.length > 0 && (
            <BandeauInfo ton="primaire">
              <div className="min-w-0" data-testid="travaux-en-cours">
                <p className="text-xs font-semibold">{titreExercicesEnCours(enCours.length)}</p>
                <ul className="mt-1.5 space-y-1.5">
                  {enCours.map(({ id, exercice, depuis }) => (
                    <li
                      key={id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primaire/20 bg-surface/80 px-2.5 py-1.5 text-xs shadow-xs"
                    >
                      <div className="flex flex-wrap items-baseline gap-2 min-w-0">
                        <Link
                          href={urlComposerAutonome(exercice.competences[0], exercice.dureeEstimeeMin)}
                          className="font-semibold text-primaire hover:underline truncate"
                        >
                          {exercice.titre}
                        </Link>
                        <span className="text-[0.6875rem] text-texte-discret">
                          commencé il y a {formatDuree(depuis)} · {exercice.competences.join(", ")}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Link
                          href={urlComposerAutonome(exercice.competences[0], exercice.dureeEstimeeMin)}
                          className={`${classesLienBouton("principal")} !py-0.5 !px-2 !text-xs`}
                        >
                          Reprendre →
                        </Link>
                        <AbandonnerExerciceCarte
                          attemptId={id}
                          exerciceId={exercice.id}
                          titreExercice={exercice.titre}
                          dureeMin={depuis}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </BandeauInfo>
          )}

          <div className="[&>*]:min-w-0">
            <CarteProchaineAction
              recommandations={recommandationsFile}
              referentiel={ctx.referentiel}
              now={ctx.now}
              compteId={ctx.donnees.user.id}
              instant={instant}
              activite={
                action?.kind === "activite" || action?.kind === "note" ? action.action : undefined
              }
              facteursInstant={action?.facteurs ?? []}
              reservesInstant={action?.reserves ?? []}
              competencesGeneration={competencesGeneration}
              calibragesGeneration={calibragesGeneration}
            />
          </div>
        </div>

        <div className="min-w-0 lg:col-span-4">
          <PistesAlternatives
            recommandations={recommandationsFile}
          />
        </div>
      </div>

      <DashboardTour autoDemarrage={aucuneObservation} />
    </div>
  );
}
