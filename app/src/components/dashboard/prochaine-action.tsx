import Link from "next/link";
import type { Recommandation } from "@/lib/engine/recommend";
import { DIFFICULTES, LIBELLES_DIMENSIONS, type Referentiel } from "@/lib/domain/types";
import { libelleDomaine } from "@/lib/domain/referentiel-compte";
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
import { BoutonGenerer } from "@/components/exercices/bouton-generer";
import { BoutonRefusRecommandation } from "@/components/dashboard/refus-recommandation";
import { FeedbackRecommandation } from "@/components/dashboard/feedback-recommandation";
import {
  competencesPourModale,
  type CalibrageModale,
} from "@/components/exercices/proprietes-generation";
import type { ReactNode } from "react";
import { demarrerExerciceEnFocus } from "@/lib/store/seance-actions";
import { classesChamp } from "@/components/ui/champ";
import {
  LIBELLES_CAPACITE,
  LIBELLES_FAMILLE,
  type ContexteInstant,
} from "@/lib/engine/action-unifiee";
import type {
  MentalCapacity,
  RecommendationFactor,
  RecommendedLearningAction,
} from "@/lib/domain/adaptive-learning";

const CAPACITES: MentalCapacity[] = ["faible", "standard", "elevee"];

/**
 * Ce dont la personne dispose maintenant — deux champs, une ligne.
 *
 * Formulaire GET : rien n'est écrit, rien n'est persisté. Le temps et la
 * capacité décrivent cet instant, pas un trait de la personne ; les remettre
 * dans l'URL suffit à recalculer, et laisse la page partageable et rechargeable
 * sans effet de bord. C'est aussi ce qui permet à l'arbitrage de fonctionner
 * sans aucune des tables de la boucle adaptative.
 */
function ControleInstant({ instant }: { instant?: ContexteInstant }) {
  if (!instant) return null;
  return (
    <form
      method="get"
      action="/"
      className="mt-3 flex flex-wrap items-center gap-2 text-xs"
      data-testid="controle-instant"
    >
      <label htmlFor="instant-temps" className="text-texte-discret">
        J&apos;ai
      </label>
      <input
        id="instant-temps"
        name="temps"
        type="number"
        min={5}
        max={480}
        step={5}
        defaultValue={instant.tempsMin}
        className={`${classesChamp("compacte", false)} chiffres w-16`}
      />
      <span className="text-texte-discret">min,</span>
      <label htmlFor="instant-capacite" className="sr-only">
        Capacité mentale ressentie
      </label>
      <select
        id="instant-capacite"
        name="capacite"
        defaultValue={instant.capacite}
        className={`${classesChamp("compacte", false)} w-auto`}
      >
        {CAPACITES.map((capacite) => (
          <option key={capacite} value={capacite}>
            {LIBELLES_CAPACITE[capacite]}
          </option>
        ))}
      </select>
      <Bouton type="submit" variante="secondaire" taille="petite">
        Recalculer
      </Bouton>
    </form>
  );
}

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

/** `/exercices/…` pour un exercice, l'espace de travail pour tout le reste. */
function lienActivite(action: RecommendedLearningAction, instant?: ContexteInstant): string {
  const prefixe = "legacy-exercise:";
  if (action.activityId?.startsWith(prefixe)) {
    return `/exercices/${encodeURIComponent(action.activityId.slice(prefixe.length))}`;
  }
  // Le contexte d'instant voyage avec le lien : c'est lui qui a fixé la durée
  // et la taille de segment du contrat, et l'écran suivant doit pouvoir le
  // reconstruire à l'identique — rien n'ayant été enregistré.
  const mode = `focus=${action.proposedMode.focus}`
    + `&guidance=${action.proposedMode.guidance}`
    + `&tools=${action.proposedMode.toolPower}`
    + (instant ? `&temps=${instant.tempsMin}&capacite=${instant.capacite}` : "");
  if (action.runId) return `/seances?run=${encodeURIComponent(action.runId)}&${mode}`;
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
  calibrages,
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
  /**
   * Calibrages de toutes les compétences actives, indexés par code.
   *
   * La modale laisse changer de compétence : lui passer la seule calibration
   * de la recommandation principale ferait afficher la difficulté d'une autre
   * compétence que celle visée.
   */
  calibrages: Record<string, CalibrageModale>;
  now: Date;
  compteId: string;
  /** Entrée vers le compositeur prérempli par la recommandation courante. */
  actionPrincipale?: ReactNode;
  /**
   * Temps et capacité déclarés pour maintenant. Absent, la carte se comporte
   * comme avant : le contrôle ne s'affiche pas et rien n'est arbitré.
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
        <EtatVide
          titre="Aucune action à recommander pour l'instant"
          message="Soit tout a déjà été proposé récemment et écarté, soit chaque compétence active a épuisé ses exercices. Compose une séance personnalisée, ou reviens plus tard."
          action={actionPrincipale ?? <Link href="/seances" className={classesLienBouton("secondaire")}>Composer une séance</Link>}
        />
        {/*
          Le contrôle reste accessible ici : quand rien ne tient dans le temps
          déclaré, la première chose à pouvoir changer est le temps déclaré.
        */}
        {instant && (
          <div className="px-5 pb-4 sm:px-6">
            <ControleInstant instant={instant} />
          </div>
        )}
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
        className="pointer-events-none absolute -bottom-8 -right-6 size-40 text-primaire opacity-[0.06]"
      />

      {/*
        Les attributs de test vivent sur ce `<div>`, pas sur `Carte` : la
        primitive ne rediffuse pas les props inconnues, et TypeScript ne signale
        pas un attribut à trait d'union — il serait silencieusement perdu.
      */}
      <div
        className="relative px-5 py-4 sm:px-6"
        data-testid="prochaine-action"
        data-nature="exercice"
        data-competence={etat.skill.code}
        data-exercice={exercice?.id}
      >
        <div className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-primaire" aria-hidden />
          <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-primaire">
            Prochaine meilleure action
          </span>
        </div>

        <ControleInstant instant={instant} />

        <h2 className="mt-2 font-serif text-[1.45rem] font-medium leading-snug tracking-tight">
          {exercice ? exercice.titre : etat.prochaineEtape}
        </h2>

        <p className="mt-2 max-w-xl text-sm text-texte-attenue">{raison}</p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Etiquette ton="primaire" mono>
            {etat.skill.code}
          </Etiquette>
          <Etiquette>{libelleDomaine(referentiel, etat.skill.domaine)}</Etiquette>
          <Etiquette className="chiffres">
            Difficulté {exercice?.difficulte ?? difficulteCible}/5 ·{" "}
            {DIFFICULTES[exercice?.difficulte ?? difficulteCible]}
          </Etiquette>
          <Etiquette>≈ {formatDuree(dureeEstimeeMin)}</Etiquette>
          {etat.preuves.length === 0 && <Etiquette ton="info">Diagnostic</Etiquette>}
          {revision.due && <Etiquette ton="alerte">Révision due</Etiquette>}
        </div>

        <div className="mt-3 rounded-md border border-bordure bg-surface-2 px-3 py-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium">{etat.skill.intitule}</p>
              <p className="chiffres mt-0.5 text-[0.6875rem] text-texte-discret">
                {etat.niveau === null
                  ? "Niveau inconnu — jamais évaluée"
                  : `Niveau actuel ${etat.niveau}/5 · confiance ${etat.confiance}`}
              </p>
            </div>
            <div className="w-20 shrink-0 pt-1">
              <JaugeNiveau niveau={etat.niveau} taille="compacte" />
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {actionPrincipale ?? (exercice ? (
            <form action={demarrerExerciceEnFocus.bind(null, exercice.id)}>
              <Bouton type="submit" variante="principal">
                Commencer en focus
                <IconeFleche className="size-4" />
              </Bouton>
            </form>
          ) : (
            /*
              Repli assumé : aucun exercice disponible pour cette compétence —
              soit elle n'en a jamais eu, soit le seul qui existait vient
              d'échouer et ne revient pas sans progrès démontré. La modale de
              génération remplace le détour par le tuteur : on crée là où on est.
            */
            <BoutonGenerer
              competences={competencesPourModale(referentiel.actifs)}
              competenceInitiale={etat.skill.code}
              calibrages={calibrages}
              compteId={compteId}
              libelle="Générer un exercice"
              ouvrirDansCahierApresAcceptation
            />
          ))}
          <Link
            href={`/atelier?document=${encodeURIComponent(etat.skill.code)}`}
            className={classesLienBouton("secondaire")}
          >
            Voir la compétence
          </Link>
          <BoutonRefusRecommandation code={etat.skill.code} exerciceId={exercice?.id} />
        </div>

        <div className="mt-4 border-t border-bordure pt-3">
          <FeedbackRecommandation code={etat.skill.code} compteId={compteId} />
        </div>

        <div className="mt-3 border-t border-bordure pt-3">
          <Depliant resume="Pourquoi cette action plutôt qu'une autre ?">
            <div className="rounded-md border border-bordure bg-surface-2 p-3 text-xs">
              <p className="mb-2 text-texte-attenue">
                Facteurs pris en compte pour {etat.skill.code}, du plus au moins déterminant :
              </p>
              <dl className="space-y-1">
                {principale.facteurs.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-baseline justify-between gap-3 border-b border-bordure/60 pb-1 last:border-0"
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

              {/*
                3ᵉ maillon (ADR-028). La difficulté visée n'est plus déduite du
                seul niveau : elle vient de ce que la dernière tentative a
                produit. Un nombre qui bouge doit dire pourquoi (P3).
              */}
              {principale.calibration && principale.calibration.verdicts.length > 0 && (
                <div className="mt-3 border-t border-bordure/60 pt-2">
                  <p className="mb-1.5 text-texte-attenue">
                    Difficulté {principale.difficulteCible}/5 —{" "}
                    {principale.calibration.difficulteConseillee === null
                      ? "déduite du niveau, faute de tentative exploitable :"
                      : "dérivée de tes tentatives :"}
                  </p>
                  <ul className="space-y-1">
                    {principale.calibration.verdicts.map((v) => (
                      <li key={v.exerciceId} className="text-texte-attenue">
                        · <span className="font-medium">{v.titre}</span> (difficulté {v.difficulte})
                        — {v.raison}
                      </li>
                    ))}
                  </ul>
                  {principale.calibration.dimensionFaible && (
                    <p className="mt-1.5 text-texte-attenue">
                      Dimension la plus faible :{" "}
                      <span className="font-medium">
                        {LIBELLES_DIMENSIONS[principale.calibration.dimensionFaible.dimension]}
                      </span>{" "}
                      ({principale.calibration.dimensionFaible.moyenne} sur{" "}
                      {principale.calibration.dimensionFaible.observations} tentative
                      {principale.calibration.dimensionFaible.observations > 1 ? "s" : ""}) — c&apos;est
                      elle qu&apos;il faut faire travailler.
                    </p>
                  )}
                  {principale.calibration.explication.reserves.map((r, i) => (
                    <p key={i} className="mt-1 text-texte-discret">
                      {r}
                    </p>
                  ))}
                </div>
              )}

              {alternatives.length > 0 && (
                <>
                  <p className="mt-3 mb-1.5 text-texte-attenue">Suivantes dans la file :</p>
                  <ul className="space-y-1">
                    {alternatives.slice(0, 4).map((r) => (
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
    </Carte>
  );
}

/**
 * La même carte, quand l'action retenue n'est pas un exercice.
 *
 * Même épine, même filigrane, même surtitre, même dépliant : ce qui change est
 * ce qu'on va faire, pas la façon dont l'écran le présente. « Difficulté n/5 »
 * cède la place à la famille — c'est la seule information qui n'a pas
 * d'équivalent, un parcours d'exploration n'ayant pas de difficulté calibrée.
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
  const libelle = action.source === "reprise"
    ? "Reprendre"
    : action.source === "generation"
      ? "Préparer le contenu"
      : "Commencer";

  return (
    <Carte accent className="relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1 bg-primaire" aria-hidden />
      <IconeFeuille
        className="pointer-events-none absolute -bottom-8 -right-6 size-40 text-primaire opacity-[0.06]"
      />

      <div
        className="relative px-5 py-4 sm:px-6"
        data-testid="prochaine-action"
        data-nature="activite"
        data-family={action.family}
      >
        <div className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-primaire" aria-hidden />
          <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-primaire">
            Prochaine meilleure action
          </span>
        </div>

        <ControleInstant instant={instant} />

        <h2 className="mt-2 font-serif text-[1.45rem] font-medium leading-snug tracking-tight">
          {action.title}
        </h2>

        {facteursInstant[0] && (
          <p className="mt-2 max-w-xl text-sm text-texte-attenue">{facteursInstant[0].label}</p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Etiquette ton="primaire">{LIBELLES_FAMILLE[action.family]}</Etiquette>
          <Etiquette>≈ {formatDuree(action.durationMinutes)}</Etiquette>
          {action.segmented && <Etiquette ton="info">Reprenable plus tard</Etiquette>}
        </div>

        {action.target.skillCodes.length > 0 && (
          <div className="mt-3 rounded-md border border-bordure bg-surface-2 px-3 py-2">
            <p className="text-xs font-medium">Compétences visées</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {action.target.skillCodes.map((code) => (
                <CodeCompetence key={code} code={code} />
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link href={lienActivite(action, instant)} className={classesLienBouton("principal")}>
            {libelle}
            <IconeFleche className="size-4" />
          </Link>
        </div>

        <div className="mt-4 border-t border-bordure pt-3">
          <Depliant resume="Pourquoi cette action plutôt qu'une autre ?">
            <div className="rounded-md border border-bordure bg-surface-2 p-3 text-xs">
              <p className="mb-2 text-texte-attenue">
                Facteurs pris en compte, du plus au moins déterminant :
              </p>
              <ul className="space-y-1">
                {facteursInstant.map((facteur, i) => (
                  <li key={`${facteur.kind}-${i}`} className="text-texte-attenue">
                    · {facteur.label}
                  </li>
                ))}
              </ul>
              {reservesInstant.map((reserve, i) => (
                <p key={i} className="mt-2 text-texte-discret">
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
