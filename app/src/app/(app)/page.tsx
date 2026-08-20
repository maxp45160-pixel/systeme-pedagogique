import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { chargerContexte } from "@/lib/store/context";
import { formatDuree } from "@/lib/engine/dates";
import { SquelettePage } from "@/components/layout/squelette";
import { calculerActivite } from "@/lib/engine/historique";
import { CarteSeanceActive } from "@/components/dashboard/carte-seance-active";
import { CarteProchaineAction } from "@/components/dashboard/prochaine-action";
import { PistesAlternatives } from "@/components/dashboard/pistes-alternatives";
import { SyntheseReferentiel } from "@/components/dashboard/synthese-referentiel";
import { MiniActivite } from "@/components/dashboard/mini-activite";
import { IconeFleche } from "@/components/ui/icones";
import { BandeauInfo, Bouton, classesLienBouton } from "@/components/ui/primitives";
import { abandonnerExercice } from "@/lib/store/actions";
import { statutSeance } from "@/lib/domain/seance";
import { chargerActionProposee } from "@/lib/store/adaptive-learning";
import { urlComposerAutonome } from "@/lib/domain/navigation-exercice";
import {
  lireContexteInstant,
  type ContexteInstant,
} from "@/lib/engine/action-unifiee";
import { DashboardTour } from "@/components/onboarding/dashboard-tour";
import { BoutonIntentionDashboard } from "@/components/intention/bouton-intention";

export default async function TableauDeBord(props: {
  searchParams: Promise<{ temps?: string; capacite?: string }>;
}) {
  const instant = lireContexteInstant(await props.searchParams);
  const dateJour = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  return (
    <Suspense fallback={<SquelettePage />}>
      <ContenuTableauDeBord instant={instant} dateJour={dateJour} />
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
}: {
  instant: ContexteInstant;
  dateJour: string;
}) {
  const ctx = await chargerContexte();

  // Compte neuf : il n'y a rien à mettre sur ce tableau de bord, et une grille
  // de tirets ne dit pas quoi faire. On envoie construire le référentiel — la
  // seule action possible tant qu'il n'existe pas (ADR-026).
  if (ctx.referentiel.skills.length === 0) {
    redirect("/demarrer");
  }

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

  return (
    <div className="space-y-3.5 sm:space-y-4">
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
            <strong className="font-medium text-texte">{ctx.global.nombreObservations}</strong> exercice{ctx.global.nombreObservations > 1 ? "s" : ""}
          </span>
          <span className="text-bordure-contraste" aria-hidden>·</span>
          <span>
            <strong className="font-medium text-texte">{activite.joursActifs30}</strong>/30 j.
          </span>
          <IconeFleche className="size-3 text-texte-discret transition-transform group-hover:translate-x-0.5 group-hover:text-primaire" />
        </Link>
      </div>

      {/* Déclencheur d'intention compact */}
      <BoutonIntentionDashboard />

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
                        <form action={abandonnerExercice.bind(null, id, exercice.id, depuis, undefined)}>
                          <Bouton type="submit" variante="secondaire" taille="petite">
                            Abandonner
                          </Bouton>
                        </form>
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

          {/* Pistes alternatives suggérées */}
          <PistesAlternatives
            recommandations={recommandationsFile}
            referentiel={ctx.referentiel}
          />
        </div>

        {/* Colonne droite : Repères contextuels passifs (Vision du Référentiel + Continuité) */}
        <div className="space-y-3.5 sm:space-y-4 lg:col-span-5 xl:col-span-4 min-w-0">
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
