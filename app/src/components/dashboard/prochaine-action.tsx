import Link from "next/link";
import type { Recommandation } from "@/lib/engine/recommend";
import { DIFFICULTES, LIBELLES_DIMENSIONS, type Referentiel } from "@/lib/domain/types";
import { libelleDomaine } from "@/lib/domain/referentiel-compte";
import {
  idDocumentDepuisActivite,
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
  JaugeNiveau,
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
          <p className="mb-1.5 text-texte-attenue">Pour le moment présent :</p>
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

/** Toute action d'apprentissage ouvre désormais le compositeur de séance. */
function lienActivite(action: RecommendedLearningAction, instant?: ContexteInstant): string {
  const prefixe = "legacy-exercise:";
  if (action.activityId?.startsWith(prefixe)) {
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
  if (noteId) return `/atelier?note=${encodeURIComponent(noteId)}`;
  // Le contexte d'instant voyage avec le lien : c'est lui qui a fixé la durée
  // et la taille de segment du contrat, et l'écran suivant doit pouvoir le
  // reconstruire à l'identique — rien n'ayant été enregistré.
  const mode = `focus=${action.proposedMode.focus}`
    + `&guidance=${action.proposedMode.guidance}`
    + `&tools=${action.proposedMode.toolPower}`
    + (instant ? `&temps=${instant.tempsMin}&capacite=${instant.capacite}` : "");
  // Un projet ouvert se reprend dans son pôle, pas dans le cahier (ADR-067).
  const pole = action.family === "produire" ? "/projets" : "/seances";
  if (action.runId) return `${pole}?run=${encodeURIComponent(action.runId)}&${mode}`;
  if (action.generationRequestId) {
    return `/seances?generation=${encodeURIComponent(action.generationRequestId)}&${mode}`;
  }
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
  recommandations: Recommandation[];
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
  const [principale, ...alternatives] = recommandations;

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
            titre="Aucune action à recommander pour l'instant"
            message="Soit tout a déjà été proposé récemment et écarté, soit chaque compétence active a épuisé ses exercices. Capture une note opérationnelle pour engager un travail, ou reviens plus tard."
            action={actionPrincipale ?? <Link href="/seances" className={classesLienBouton("secondaire")}>Ouvrir le cahier</Link>}
          />
        </div>
      </Carte>
    );
  }

  const { etat, exercice, raison, difficulteCible, dureeEstimeeMin } = principale;
  const revision = prochaineRevision(etat, now);

  return (
    <Carte accent className="relative overflow-hidden">
      {/* Épine pine en haut : signale la carte prioritaire de l'écran. */}
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-primaire" aria-hidden />
            <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-primaire mr-1">
              Prochaine meilleure action
            </span>
            <Etiquette ton="primaire" mono>
              {etat.skill.code}
            </Etiquette>
            <Etiquette>{libelleDomaine(referentiel, etat.skill.domaine)}</Etiquette>
            <Etiquette className="chiffres">
              Diff. {exercice?.difficulte ?? difficulteCible}/5 ·{" "}
              {DIFFICULTES[exercice?.difficulte ?? difficulteCible]}
            </Etiquette>
            <Etiquette>≈ {formatDuree(dureeEstimeeMin)}</Etiquette>
            {etat.preuves.length === 0 && <Etiquette ton="info">Diagnostic</Etiquette>}
            {revision.due && <Etiquette ton="alerte">Révision due</Etiquette>}
          </div>

          <BoutonRefusRecommandation code={etat.skill.code} exerciceId={exercice?.id} />
        </div>

        <h2 className="mt-2 font-serif text-lg sm:text-xl font-medium leading-snug tracking-tight">
          {exercice ? exercice.titre : etat.prochaineEtape}
        </h2>

        <p className="mt-1 max-w-2xl text-xs sm:text-sm text-texte-attenue">{raison}</p>

        <div className="mt-2.5 flex items-center justify-between gap-3 rounded-lg border border-bordure bg-surface-2 px-3 py-1.5 text-xs">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 min-w-0">
            <span className="font-medium truncate">{etat.skill.intitule}</span>
            <span className="chiffres text-[0.6875rem] text-texte-discret">
              {etat.niveau === null
                ? "Niveau inconnu — jamais évaluée"
                : `Niveau ${etat.niveau}/5 · confiance ${etat.confiance}`}
            </span>
          </div>
          <div className="w-16 shrink-0">
            <JaugeNiveau niveau={etat.niveau} taille="compacte" />
          </div>
        </div>

        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2.5 border-t border-bordure/60 pt-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {actionPrincipale ?? (exercice ? (
              <form action={demarrerExerciceEnFocus.bind(null, exercice.id)}>
                <Bouton type="submit" variante="principal">
                  Commencer
                  <IconeFleche className="size-4" />
                </Bouton>
              </form>
            ) : (
              <Link
                href={`/seances?composer=1&code=${encodeURIComponent(etat.skill.code)}&temps=${encodeURIComponent(String(instant?.tempsMin ?? dureeEstimeeMin))}`}
                className={classesLienBouton("principal")}
              >
                Composer une séance
                <IconeFleche className="size-4" />
              </Link>
            ))}
            <Link
              href={`/atelier?document=${encodeURIComponent(etat.skill.code)}`}
              className={classesLienBouton("secondaire")}
            >
              Voir la compétence
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <FeedbackRecommandation code={etat.skill.code} compteId={compteId} />
            <Depliant resume="Pourquoi cette action ?">
              <div className="mt-2 rounded-md border border-bordure bg-surface-2 p-2.5 text-xs">
                <p className="mb-1.5 text-texte-attenue">
                  Facteurs pris en compte pour {etat.skill.code}, du plus au moins déterminant :
                </p>
                <dl className="space-y-0.5">
                  {principale.facteurs.map((f, i) => (
                    <div
                      key={i}
                      className="flex items-baseline justify-between gap-3 border-b border-bordure/60 pb-0.5 last:border-0"
                    >
                      <dt className="text-texte-attenue">{f.libelle}</dt>
                      <dd
                        className={`chiffres shrink-0 font-medium ${
                          f.contribution < 0 ? "text-texte-discret" : ""
                        }`}
                      >
                        {f.contribution > 0 ? "+" : ""}
                        {Math.round(f.contribution)}
                      </dd>
                    </div>
                  ))}
                </dl>

                <BlocInstant facteurs={facteursInstant} reserves={reservesInstant} />

                {principale.calibration && principale.calibration.verdicts.length > 0 && (
                  <div className="mt-2.5 border-t border-bordure/60 pt-1.5">
                    <p className="mb-1 text-texte-attenue">
                      Difficulté {principale.difficulteCible}/5 —{" "}
                      {principale.calibration.difficulteConseillee === null
                        ? "déduite du niveau :"
                        : "dérivée de tes tentatives :"}
                    </p>
                    <ul className="space-y-0.5">
                      {principale.calibration.verdicts.map((v) => (
                        <li key={v.exerciceId} className="text-texte-attenue">
                          · <span className="font-medium">{v.titre}</span> (diff. {v.difficulte})
                          — {v.raison}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {alternatives.length > 0 && (
                  <>
                    <p className="mt-2 mb-1 text-texte-attenue">Suivantes dans la file :</p>
                    <ul className="space-y-0.5">
                      {alternatives.slice(0, 3).map((r) => (
                        <li key={r.etat.skill.code} className="flex items-baseline gap-2">
                          <CodeCompetence code={r.etat.skill.code} />
                          <Link
                            href={`/atelier?document=${encodeURIComponent(r.etat.skill.code)}`}
                            className="min-w-0 flex-1 truncate text-texte-attenue hover:text-texte"
                          >
                            {r.etat.skill.intitule}
                          </Link>
                          <span className="chiffres shrink-0 text-texte-discret">
                            {Math.round(r.valeur)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </Depliant>
          </div>
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
    ? "Reprendre"
    : action.source === "generation"
      ? "Préparer le contenu"
      : estRessource
        ? "Travailler sur cette ressource"
      : estNote
        ? "Reprendre ce travail"
        : "Commencer";

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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-primaire" aria-hidden />
            <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-primaire mr-1">
              Prochaine meilleure action
            </span>
            <Etiquette ton="primaire">{LIBELLES_FAMILLE[action.family]}</Etiquette>
            <Etiquette>≈ {formatDuree(action.durationMinutes)}</Etiquette>
            {action.segmented && <Etiquette ton="info">Reprenable plus tard</Etiquette>}
          </div>

          {codeRefusable && (
            <BoutonRefusRecommandation
              code={codeRefusable}
              exerciceId={action.activityId}
            />
          )}
        </div>

        <h2 className="mt-2 font-serif text-lg sm:text-xl font-medium leading-snug tracking-tight">
          {action.title}
        </h2>

        {facteursInstant[0] && (
          <p className="mt-1 max-w-2xl text-xs sm:text-sm text-texte-attenue">{facteursInstant[0].label}</p>
        )}

        {action.target.skillCodes.length > 0 && (
          <div className="mt-2.5 flex items-center gap-2 flex-wrap">
            <span className="text-[0.6875rem] font-medium uppercase tracking-wider text-texte-discret">
              Compétences visées :
            </span>
            <div className="flex flex-wrap gap-1">
              {action.target.skillCodes.map((code) => (
                <CodeCompetence key={code} code={code} />
              ))}
            </div>
          </div>
        )}

        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2.5 border-t border-bordure/60 pt-2.5">
          <div className="flex items-center gap-2">
            {action.activityId?.startsWith("legacy-exercise:") ? (
              <form
                action={demarrerExerciceEnFocus.bind(
                  null,
                  action.activityId.slice("legacy-exercise:".length),
                )}
              >
                <Bouton type="submit" variante="principal">
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

          <Depliant resume="Pourquoi cette action ?">
            <div className="mt-2 rounded-md border border-bordure bg-surface-2 p-2.5 text-xs">
              <p className="mb-1.5 text-texte-attenue">
                Facteurs pris en compte, du plus au moins déterminant :
              </p>
              <ul className="space-y-0.5">
                {facteursInstant.map((facteur, i) => (
                  <li key={`${facteur.kind}-${i}`} className="text-texte-attenue">
                    · {facteur.label}
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
