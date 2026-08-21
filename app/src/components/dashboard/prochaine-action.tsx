import Link from "next/link";
import type { Recommandation } from "@/lib/engine/recommend";
import type { Referentiel } from "@/lib/domain/types";
import { libelleDomaine } from "@/lib/domain/referentiel-compte";
import {
  estActiviteExercice,
  idDocumentDepuisActivite,
  idExerciceDepuisActivite,
  PREFIXE_ACTIVITE_RESSOURCE,
} from "@/lib/domain/adaptive-learning";
import { prochaineRevision } from "@/lib/engine/spaced";
import {
  Carte,
  Bouton,
  classesLienBouton,
  CodeCompetence,
  Etiquette,
  EtatVide,
} from "@/components/ui/primitives";
import { Depliant } from "@/components/ui/explication";
import { IconeFeuille, IconeFleche } from "@/components/ui/icones";
import { formatDuree } from "@/lib/engine/dates";
import { BoutonRefusRecommandation } from "@/components/dashboard/refus-recommandation";
import { FeedbackRecommandation } from "@/components/dashboard/feedback-recommandation";
import { demarrerExerciceEnFocus } from "@/lib/store/seance-actions";
import type { ReactNode } from "react";
import {
  LIBELLES_FAMILLE,
  type ContexteInstant,
} from "@/lib/engine/action-unifiee";
import type {
  RecommendationFactor,
  RecommendedLearningAction,
} from "@/lib/domain/adaptive-learning";

/**
 * Ce que l'arbitrage à l'instant T a pesé, et ce qu'il ne prétend pas savoir.
 *
 * Sans contribution chiffrée : ces facteurs sont qualitatifs (le temps tient,
 * la capacité correspond, l'objectif est servi). Leur donner un nombre
 * laisserait croire qu'ils entrent dans le même score que les facteurs du
 * classement, ce qui est faux — ils arbitrent, ils ne classent pas.
 */
function BlocInstant({
  facteurs,
  reserves,
}: {
  facteurs: readonly RecommendationFactor[];
  reserves: readonly string[];
}) {
  if (facteurs.length === 0 && reserves.length === 0) return null;
  return (
    <div className="mt-3 border-t border-bordure/60 pt-2">
      {facteurs.length > 0 && (
        <>
          <p className="mb-1.5 text-texte-attenue">En ce moment :</p>
          <ul className="space-y-1">
            {facteurs.map((facteur, i) => (
              <li key={`${facteur.kind}-${i}`} className="text-texte-attenue">
                · {facteur.label}
              </li>
            ))}
          </ul>
        </>
      )}
      {reserves.map((reserve, i) => (
        <p key={i} className="mt-1 text-texte-discret">
          {reserve}
        </p>
      ))}
    </div>
  );
}

function lienActivite(action: RecommendedLearningAction, instant?: ContexteInstant): string {
  if (action.activityId && estActiviteExercice(action.activityId)) {
    const code = action.target.skillCodes[0];
    const temps = instant?.tempsMin ?? action.durationMinutes;
    return `/seances?composer=1${code ? `&code=${encodeURIComponent(code)}` : ""}&temps=${temps}`;
  }
  /*
   * Une note opérationnelle mène à son propre espace de travail. Le mode de
   * travail n'est pas transmis : cet écran ne le lit pas, et un paramètre
   * inutilisé dans une URL partageable laisse croire qu'il fait quelque chose.
   */
  const noteId = action.activityId ? idDocumentDepuisActivite(action.activityId) : null;
  if (noteId) return `/atelier?note=${encodeURIComponent(noteId)}&retour=${encodeURIComponent("/")}`;
  /*
   * Les exécutions et demandes de génération n'ont plus de surface : la
   * machinerie « Produire » est retirée (ADR-070) et l'arbitrage ne reçoit
   * aucune demande de génération. Leurs URLs — `?run=` et `?generation=` —
   * n'étaient lues par aucun écran, et le pôle `/projets` n'existe plus.
   * Le cahier reste le point d'entrée neutre.
   */
  return "/seances";
}

/**
 * « Que dois-je faire maintenant ? »
 *
 * Carte centrale de l'application : une seule action mise en avant, avec sa
 * justification. La raison affichée est produite par le moteur à partir des
 * facteurs réellement dominants — ce n'est pas un texte d'encouragement.
 */
export function CarteProchaineAction({
  recommandations,
  referentiel,
  now,
  compteId,
  actionPrincipale,
  instant,
  activite,
  facteursInstant = [],
  reservesInstant = [],
}: {
  recommandations: readonly Recommandation[];
  referentiel: Referentiel;
  now: Date;
  compteId: string;
  /** Entrée vers le compositeur prérempli par la recommandation courante. */
  actionPrincipale?: ReactNode;
  /**
   * Temps et capacité déclarés pour maintenant. Ils servent à l'arbitrage et
   * sont transmis au workspace, mais ne sont pas affichés dans cette carte.
   */
  instant?: ContexteInstant;
  /**
   * Action retenue quand ce n'est pas un exercice de la file (ADR-066). La
   * carte reste la même — seul son contenu change de nature.
   */
  activite?: RecommendedLearningAction;
  facteursInstant?: readonly RecommendationFactor[];
  reservesInstant?: readonly string[];
}) {
  const principale = recommandations[0];

  if (activite) {
    return (
      <CarteActionActivite
        action={activite}
        instant={instant}
        facteursInstant={facteursInstant}
        reservesInstant={reservesInstant}
      />
    );
  }

  if (!principale) {
    // `recommander()` (lib/engine/recommend.ts) rend une liste vide dans deux
    // cas réels, pas un edge-case théorique : toutes les compétences actives
    // ont été récemment refusées (R1), ou chacune a déjà épuisé ses exercices
    // (`toutRefuse`). Le moteur ne distingue pas les deux pour l'appelant —
    // le message ne prétend donc pas savoir lequel, il dit ce qui est vrai
    // dans les deux cas. Cette carte est promise par le sous-titre du tableau
    // de bord (« Ta prochaine action ») : elle ne peut pas s'évanouir sans
    // un mot à la place.
    return (
      <Carte accent>
        <div data-tour="action-prioritaire">
          <EtatVide
            titre="Rien à vous proposer pour l'instant"
            message="Vous avez fait le tour pour le moment. Ajoutez un cours ou une note, et on repart de là."
            action={actionPrincipale ?? <Link href="/seances" className={classesLienBouton("secondaire")}>Ouvrir le cahier</Link>}
          />
        </div>
      </Carte>
    );
  }

  const { etat, exercice, difficulteCible, dureeEstimeeMin } = principale;
  const revision = prochaineRevision(etat, now);

  return (
    <Carte accent className="relative overflow-hidden">
      {/* Épine en haut : signale la carte prioritaire de l'écran. */}
      <div className="absolute inset-x-0 top-0 h-1 bg-primaire" aria-hidden />
      {/* Filigrane botanique : discret, purement décoratif. */}
      <IconeFeuille
        className="pointer-events-none absolute -bottom-8 -right-6 size-36 text-primaire opacity-[0.05]"
      />

      <div
        className="relative p-4 sm:p-5"
        data-testid="prochaine-action"
        data-tour="action-prioritaire"
        data-nature="exercice"
        data-competence={etat.skill.code}
        data-exercice={exercice?.id}
      >
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primaire/15 px-2.5 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-primaire">
              <span className="size-1.5 rounded-full bg-primaire animate-pulse" aria-hidden />
              Priorité du jour
            </span>
            <Etiquette>{libelleDomaine(referentiel, etat.skill.domaine)}</Etiquette>
            <span className="text-bordure-contraste" aria-hidden>·</span>
            <div className="flex items-center gap-1.5 text-xs text-texte-attenue">
              <span className="font-medium text-texte">
                Diff. {exercice?.difficulte ?? difficulteCible}/5
              </span>
              <span className="text-bordure-contraste" aria-hidden>·</span>
              <span>≈ {formatDuree(dureeEstimeeMin)}</span>
            </div>
            {revision.due && <Etiquette ton="alerte">Révision due</Etiquette>}
          </div>

          <BoutonRefusRecommandation code={etat.skill.code} exerciceId={exercice?.id} />
        </div>

        <h2 className="mt-3 font-serif text-lg sm:text-xl font-medium leading-snug tracking-tight text-texte">
          {exercice ? exercice.titre : etat.skill.intitule}
        </h2>

        {exercice ? (
          <p className="mt-1 text-xs text-texte-attenue">
            Compétence : <strong className="font-medium text-texte">{etat.skill.intitule}</strong>
          </p>
        ) : (
          <p className="mt-1 text-xs sm:text-sm text-texte-attenue leading-relaxed">
            {etat.prochaineEtape}
          </p>
        )}

        <div className="mt-4 border-t border-bordure/60 pt-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {actionPrincipale ?? (exercice ? (
                <form action={demarrerExerciceEnFocus.bind(null, exercice.id)}>
                  <Bouton type="submit" variante="principal" className="shadow-xs">
                    Commencer l’exercice
                    <IconeFleche className="size-4" />
                  </Bouton>
                </form>
              ) : etat.niveau === 0 ? (
                <Link
                  href={`/expliquer?code=${encodeURIComponent(etat.skill.code)}`}
                  className={classesLienBouton("principal")}
                >
                  Expliquer le concept
                  <IconeFleche className="size-4" />
                </Link>
              ) : (
                /*
                 * Aucun exercice n'existe encore pour cette compétence : ce lien
                 * ouvre le compositeur, qui proposera de GÉNÉRER les exercices
                 * manquants avant de commencer. Le dire au lieu de laisser
                 * croire qu'un exercice attend déjà (honnêteté du parcours).
                 */
                <Link
                  href={`/seances?composer=1&code=${encodeURIComponent(etat.skill.code)}&temps=${encodeURIComponent(String(instant?.tempsMin ?? dureeEstimeeMin))}`}
                  className={classesLienBouton("principal")}
                  title="Aucun exercice existe encore : tu pourras les générer puis commencer"
                >
                  Générer puis commencer
                  <IconeFleche className="size-4" />
                </Link>
              ))}
              <Link
                href={`/atelier?document=${encodeURIComponent(etat.skill.code)}`}
                className={classesLienBouton("secondaire")}
              >
                Fiche compétence
              </Link>
            </div>
          </div>

          <Depliant resume="Pourquoi cette recommandation ?" className="w-full">
            <div className="mt-2.5 rounded-xl border border-bordure bg-surface-2 p-3.5 text-xs shadow-2xs space-y-3">
              <div>
                <p className="font-semibold text-texte mb-1.5 flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-primaire" aria-hidden />
                  Facteurs déterminants :
                </p>
                <ul className="space-y-1 text-texte-attenue pl-3">
                  {principale.facteurs.slice(0, 2).map((f, i) => (
                    <li key={i}>• {f.libelle}</li>
                  ))}
                </ul>
              </div>

              <BlocInstant facteurs={facteursInstant} reserves={reservesInstant} />

              {principale.calibration && principale.calibration.verdicts.length > 0 && (
                <div className="border-t border-bordure/60 pt-2.5">
                  <p className="font-semibold text-texte mb-1">
                    Difficulté {principale.difficulteCible}/5 —{" "}
                    {principale.calibration.difficulteConseillee === null
                      ? "d'après votre niveau :"
                      : "d'après vos exercices précédents :"}
                  </p>
                  <ul className="space-y-1 text-texte-attenue pl-3">
                    {principale.calibration.verdicts.map((v) => (
                      <li key={v.exerciceId}>
                        • <span className="font-medium text-texte">{v.titre}</span> (diff. {v.difficulte}) — {v.raison}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="border-t border-bordure/60 pt-2 flex justify-end">
                <FeedbackRecommandation code={etat.skill.code} compteId={compteId} />
              </div>
            </div>
          </Depliant>
        </div>
      </div>
    </Carte>
  );
}

/**
 * La même carte, quand l'action retenue n'est pas un exercice.
 */
function CarteActionActivite({
  action,
  instant,
  facteursInstant,
  reservesInstant,
}: {
  action: RecommendedLearningAction;
  instant?: ContexteInstant;
  facteursInstant: readonly RecommendationFactor[];
  reservesInstant: readonly string[];
}) {
  const estNote = Boolean(action.activityId && idDocumentDepuisActivite(action.activityId));
  const estRessource = action.activityId?.startsWith(PREFIXE_ACTIVITE_RESSOURCE) ?? false;
  const codeRefusable = action.target.skillCodes[0];
  const libelle = action.source === "reprise"
    ? "Reprendre l’activité"
    : action.source === "generation"
      ? "Préparer le contenu"
      : estRessource
        ? "Travailler sur cette ressource"
      : estNote
        ? "Reprendre ce travail"
        : "Commencer l’activité";

  return (
    <Carte accent className="relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1 bg-primaire" aria-hidden />
      <IconeFeuille
        className="pointer-events-none absolute -bottom-8 -right-6 size-36 text-primaire opacity-[0.05]"
      />

      <div
        className="relative p-4 sm:p-5"
        data-testid="prochaine-action"
        data-tour="action-prioritaire"
        data-nature={estRessource ? "ressource" : estNote ? "note" : "activite"}
        data-family={action.family}
      >
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primaire/15 px-2.5 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-primaire">
              <span className="size-1.5 rounded-full bg-primaire animate-pulse" aria-hidden />
              Priorité du jour
            </span>
            <Etiquette ton="primaire">{LIBELLES_FAMILLE[action.family]}</Etiquette>
            <span className="text-xs text-texte-attenue">≈ {formatDuree(action.durationMinutes)}</span>
            {action.segmented && <Etiquette ton="info">Reprenable plus tard</Etiquette>}
          </div>

          <BoutonRefusRecommandation
            code={codeRefusable}
            exerciceId={action.activityId}
          />
        </div>

        <h2 className="mt-3 font-serif text-lg sm:text-xl font-medium leading-snug tracking-tight text-texte">
          {action.title}
        </h2>

        {facteursInstant[0] && (
          <p className="mt-1.5 max-w-2xl text-xs sm:text-sm text-texte-attenue leading-relaxed">{facteursInstant[0].label}</p>
        )}

        {action.target.skillCodes.length > 0 && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-[0.6875rem] font-medium uppercase tracking-wider text-texte-discret">
              Compétences ciblées :
            </span>
            <div className="flex flex-wrap gap-1">
              {action.target.skillCodes.map((code) => (
                <CodeCompetence key={code} code={code} />
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 border-t border-bordure/60 pt-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {action.activityId && idExerciceDepuisActivite(action.activityId) ? (
                <form
                  action={demarrerExerciceEnFocus.bind(
                    null,
                    idExerciceDepuisActivite(action.activityId)!,
                  )}
                >
                  <Bouton type="submit" variante="principal" className="shadow-xs">
                    {libelle}
                    <IconeFleche className="size-4" />
                  </Bouton>
                </form>
              ) : (
                <Link href={lienActivite(action, instant)} className={classesLienBouton("principal")}>
                  {libelle}
                  <IconeFleche className="size-4" />
                </Link>
              )}
            </div>
          </div>

          <Depliant resume="Pourquoi cette recommandation ?" className="w-full">
            <div className="mt-2.5 rounded-xl border border-bordure bg-surface-2 p-3.5 text-xs shadow-2xs space-y-2">
              <p className="font-semibold text-texte mb-1 flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-primaire" aria-hidden />
                Facteurs déterminants :
              </p>
              <ul className="space-y-1 text-texte-attenue pl-3">
                {facteursInstant.map((facteur, i) => (
                  <li key={`${facteur.kind}-${i}`}>
                    • {facteur.label}
                  </li>
                ))}
              </ul>
              {reservesInstant.map((reserve, i) => (
                <p key={i} className="mt-1 text-texte-discret">
                  {reserve}
                </p>
              ))}
            </div>
          </Depliant>
        </div>
      </div>
    </Carte>
  );
}
