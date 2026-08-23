import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { chargerContexte } from "@/lib/store/context";
import { chargerReferentiel } from "@/lib/store/referentiel";
import { formatDateAujourdhui, formatDuree } from "@/lib/engine/dates";
import { SquelettePage } from "@/components/layout/squelette";
import { calculerActivite } from "@/lib/engine/historique";
import { CarteSeanceActive } from "@/components/dashboard/carte-seance-active";
import { CarteProchaineAction } from "@/components/dashboard/prochaine-action";
import { PistesAlternatives } from "@/components/dashboard/pistes-alternatives";
import { SyntheseReferentiel } from "@/components/dashboard/synthese-referentiel";
import { AvisPropositions } from "@/components/dashboard/avis-propositions";
import { MiniActivite } from "@/components/dashboard/mini-activite";
import { IconeFleche } from "@/components/ui/icones";
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
import { BoutonIntentionDashboard } from "@/components/intention/bouton-intention";
import { CarteEcheances } from "@/components/dashboard/carte-echeances";
import { BoutonEcheance } from "@/components/dashboard/bouton-echeance";

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

  const seancesActives = [...ctx.donnees.sessions]
    .filter((seance) => statutSeance(seance) === "en-cours")
    .sort((a, b) => b.date.localeCompare(a.date));
  const seanceActive = seancesActives[0];

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

  /*
   * La pastille annonce des EXERCICES, elle doit donc en compter — pas les
   * observations. `nombreObservations` cumule toutes les observations de
   * toutes les compétences : trois exercices menés deux fois affichaient « 6 ».
   * Le compte honnête est le nombre d'exercices réellement tentés, dérivé des
   * tentatives (P3 : le chiffre affiché dit ce qu'il compte).
   */
  const exercicesTravailles = new Set(ctx.donnees.attempts.map((a) => a.exerciseId)).size;

  return (
    <div className="space-y-3.5 sm:space-y-4">
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
      {/* En-tête épuré avec résumé de progression intégré */}
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-bordure/40 pb-2.5">
        <div className="min-w-0">
          <div className="font-serif text-xs italic text-texte-discret">{dateJour}</div>
          <h1 className="font-serif text-xl sm:text-2xl font-medium leading-tight tracking-tight">
            Tableau de bord
          </h1>
          <p className="mt-0.5 text-xs text-texte-attenue">
            Ce qu&apos;il y a de mieux à faire maintenant, et le reste juste en dessous.
          </p>
        </div>

        <Link
          href="/progression"
          className="group flex flex-wrap items-center gap-2.5 rounded-full border border-bordure bg-surface px-3.5 py-1.5 text-xs text-texte-attenue shadow-xs transition-colors hover:border-primaire/40 hover:text-texte"
          title="Voir le détail de ma progression"
        >
          <span>
            <strong className="font-medium text-texte">{ctx.referentiel.actifs.length}</strong> compétences
          </span>
          <span className="text-bordure-contraste" aria-hidden>·</span>
          <span>
            <strong className="font-medium text-texte">{exercicesTravailles}</strong> exercice{exercicesTravailles > 1 ? "s" : ""}
          </span>
          <span className="text-bordure-contraste" aria-hidden>·</span>
          <span>
            <strong className="font-medium text-texte">{activite.joursActifs30}</strong>/30 j.
          </span>
          <IconeFleche className="size-3 text-texte-discret transition-transform group-hover:translate-x-0.5 group-hover:text-primaire" />
        </Link>
      </div>

      {/* Déclencheur d'intention compact + entrée dédiée « échéance » */}
      <div className="space-y-1.5">
        <BoutonIntentionDashboard />
        <div className="flex justify-end px-1">
          <BoutonEcheance
            competences={ctx.referentiel.actifs.map(({ code, intitule }) => ({ code, intitule }))}
          />
        </div>
      </div>

      {/* Grille principale asymétrique : Flux d'action (gauche) + Repères contextuels (droite) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5 items-start">
        {/* Colonne gauche : Focus d'action immédiat & Pistes alternatives */}
        <div className="space-y-3.5 sm:space-y-4 lg:col-span-7 xl:col-span-8 min-w-0">
          {/* Alerte si des exercices sont déjà en cours */}
          {enCours.length > 0 && (
            <BandeauInfo ton="primaire">
              <div className="min-w-0" data-testid="travaux-en-cours">
                <p className="text-xs font-semibold">{titreExercicesEnCours(enCours.length)}</p>
                <ul className="mt-1.5 space-y-1.5">
                  {enCours.map(({ id, exercice, depuis }) => (
                    <li
                      key={exercice.id}
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

          {/* Action prioritaire (reprise de séance ou action recommandée) */}
          <div className="[&>*]:min-w-0">
            {seanceActive ? (
              <CarteSeanceActive
                seance={seanceActive}
                totalSeancesOuvertes={seancesActives.length}
                referentiel={ctx.referentiel}
                now={ctx.now}
              />
            ) : (
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
              />
            )}
          </div>

          {/* Échéances déclarées (fait daté) — absente tant que rien n'est déclaré */}
          <CarteEcheances
            engagements={ctx.donnees.engagements}
            etatsParCode={ctx.etatsParCode}
            now={ctx.now}
          />

          {/* Pistes alternatives suggérées */}
          <PistesAlternatives
            recommandations={recommandationsFile}
            referentiel={ctx.referentiel}
          />
        </div>

        {/* Colonne droite : Repères contextuels passifs (Vision du Référentiel + Continuité) */}
        <div className="space-y-3.5 sm:space-y-4 lg:col-span-5 xl:col-span-4 min-w-0">
          {/*
            Les propositions de référentiel (ADR-108), au-dessus de la synthèse
            parce qu'elles appellent un geste là où la synthèse décrit un état.

            Sous `Suspense` avec un repli VIDE : c'est une lecture de plus, sur
            une table qui ne sert qu'à cet avis, et le tableau de bord ne doit
            pas l'attendre. Un repli vide plutôt qu'un squelette — un squelette
            annoncerait un bloc qui, le plus souvent, ne s'affichera pas.
          */}
          <Suspense fallback={null}>
            <AvisPropositions />
          </Suspense>

          <SyntheseReferentiel
            referentiel={ctx.referentiel}
            global={ctx.global}
            etats={ctx.etats}
          />

          <MiniActivite activite={activite} now={ctx.now} />
        </div>
      </div>

      <DashboardTour autoDemarrage={aucuneObservation} />
    </div>
  );
}
