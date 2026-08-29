import Link from "next/link";
import { notFound } from "next/navigation";
import { chargerContexte } from "@/lib/store/context";
import { LienRetour } from "@/components/ui/lien-retour";
import { libelleDomaine } from "@/lib/domain/referentiel-compte";
import { DIFFICULTES, LIBELLES_DIMENSIONS, type Difficulte } from "@/lib/domain/types";
import { demarrerTentative } from "@/lib/store/actions";
import { demarrerExerciceEnFocus, terminerSeance } from "@/lib/store/seance-actions";
import { ActionSeance } from "@/components/seances/action-seance";
import {
  BandeauInfo,
  Bouton,
  Carte,
  classesLienBouton,
  CodeCompetence,
  cx,
  EnTeteCarte,
  Etiquette,
  JaugeNiveau,
} from "@/components/ui/primitives";
import { PanneauPliable } from "@/components/ui/panneau-pliable";
import { Markdown } from "@/components/ui/markdown";
import { DemarrageAuto } from "@/components/exercices/auto-demarrage";
import { BilanAssiste } from "@/components/exercices/bilan-assiste";
import { BoutonAbandon } from "@/components/exercices/abandon";
import { BoutonEditer } from "@/components/exercices/bouton-editer";
import { BoutonRetirerExercice } from "@/components/exercices/bouton-retirer";
import { ZoneReponse } from "@/components/exercices/zone-reponse";
import { FocusActe } from "@/components/exercices/focus-acte";
import { motifBlocageBilan, reponseSuffisante } from "@/lib/domain/tentative";
import { indicesMasquesEnEpreuve } from "@/lib/domain/seance";
import { IconeFleche } from "@/components/ui/icones";
import { formatDateCourte, formatDuree } from "@/lib/engine/dates";
import { CarteImpact, LienApresImpact } from "@/components/exercices/carte-impact";
import { impactTentative, suiteApresTravail } from "@/lib/engine/impact";
import { tentativeMenee } from "@/lib/engine/calibration";
import {
  amorceConsigne,
  amorceExercice,
  amorceIndice,
  amorceMethode,
} from "@/lib/tutor/amorces";
import { construireEtatInitialTuteur } from "@/lib/tutor/etat-initial";
import { TiroirTuteur, type ActionContextuelleTuteur } from "@/components/tuteur/tiroir-tuteur";
import {
  calibragesPourModale,
  competencesPourModale,
} from "@/lib/domain/proprietes-generation";
import {
  urlExercice,
  type ContexteNavigationExercice,
} from "@/lib/domain/navigation-exercice";

export async function VueExercice(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    correction?: string;
    /** Ancien paramètre conservé : il ouvre désormais directement le bilan du tuteur. */
    evaluer?: string;
    bilan?: string;
    abandon?: string;
  }>;
  navigation?: ContexteNavigationExercice;
  integree?: boolean;
  /** Affiche une tentative archivée sans permettre de créer une nouvelle observation. */
  lectureSeule?: boolean;
  etatInitialTuteurFourni?: Awaited<ReturnType<typeof construireEtatInitialTuteur>>;
  /** L'activité suivante dans la séance en cours, pour enchaîner sans friction. */
  activiteSuivanteId?: string;
  /** Vrai si toutes les activités de la séance sont désormais traitées. */
  seancePeutTerminer?: boolean;
}) {
  const { id } = await props.params;
  const { evaluer, bilan, abandon } = await props.searchParams;

  const ctx = await chargerContexte();
  const exercice = ctx.donnees.exercises.find((e) => e.id === id);
  if (!exercice) notFound();

  const sessionNavigation = props.navigation
    ? ctx.donnees.sessions.find((session) => session.id === props.navigation?.seanceId)
    : null;
  /*
   * Mode épreuve (22/08/2026) : pendant le déroulé d'une séance posée en
   * conditions réelles, les aides sont masquées — la seule autorité du
   * masquage est `indicesMasquesEnEpreuve`. Le bilan reste identique :
   * l'autonomie se dérive toujours des indices RÉELLEMENT consultés, et un
   * exercice mené sans aide disponible reste une observation comme une autre.
   */
  const aidesMasquees = sessionNavigation ? indicesMasquesEnEpreuve(sessionNavigation) : false;

  /*
   * Mode épreuve : l'action « Besoin d'un indice ? » disparaît pendant le
   * déroulé. Les autres entrées du tuteur restent — comprendre une consigne ou
   * relire la méthode n'est pas recevoir la solution.
   */
  const actionsTuteur: ActionContextuelleTuteur[] = [
    { libelle: "Besoin d'un indice ?", amorce: amorceIndice(exercice.competences[0]) },
    { libelle: "Comprendre la consigne", amorce: amorceConsigne(exercice.competences[0]) },
    { libelle: "Rappel de méthode", amorce: amorceMethode(exercice.competences[0]) },
    { libelle: "Poser une question", amorce: "" },
  ].filter((action) => !(aidesMasquees && /indice/i.test(action.libelle)));
  const tentatives = ctx.donnees.attempts.filter((a) => a.exerciseId === exercice.id);
  const tentativesDeCetteSeance = sessionNavigation
    ? tentatives.filter((a) => a.debut >= sessionNavigation.date)
    : tentatives;
  // Le cahier relit une séance : une tentative éventuellement ouverte ailleurs
  // ne doit jamais rendre cet écran éditable ni ouvrir un nouveau parcours.
  const enCours = props.lectureSeule
    ? null
    : tentativesDeCetteSeance.find((a) => a.statut === "en-cours") ?? null;
  // PostgreSQL ne garantit aucun ordre de retour : la « dernière » tentative ne
  // se lit pas en fin de tableau, elle se trie sur sa date (audit §2.5).
  const derniereTerminee =
    [...tentativesDeCetteSeance]
      .filter((a) => a.statut === "terminee")
      .sort((a, b) => (b.fin ?? b.debut).localeCompare(a.fin ?? a.debut))[0] ?? null;
  const derniereCloturee =
    [...tentativesDeCetteSeance]
      .filter((a) => a.statut !== "en-cours")
      .sort((a, b) => (b.fin ?? b.debut).localeCompare(a.fin ?? a.debut))[0] ?? null;

  /*
   * Deux chemins mènent désormais à `?abandon=1` :
   *
   * - l'abandon DÉRIVÉ — la tentative n'a pas duré le quart de la durée
   *   estimée, `tentativeMenee` refuse d'en conclure quoi que ce soit (ADR-030) ;
   * - l'abandon DÉLIBÉRÉ — la personne a cliqué « Abandonner ».
   *
   * Le bandeau invoquait la durée dans les deux cas. Sur un abandon délibéré
   * après 40 minutes de travail, il aurait affirmé une chose fausse à propos
   * de ce qui venait de se passer. On lit donc la même règle que le serveur
   * pour savoir laquelle des deux phrases est vraie.
   */
  const derniereAbandonnee =
    [...tentatives]
      .filter((a) => a.statut === "abandonnee")
      .sort((a, b) => (b.fin ?? b.debut).localeCompare(a.fin ?? a.debut))[0] ?? null;
  const abandonDelibere = derniereAbandonnee
    ? tentativeMenee(derniereAbandonnee, exercice)
    : false;

  /*
   * L'impact n'est calculé que si l'écran l'affiche.
   *
   * `impactTentative` rejoue l'historique de chaque compétence touchée — deux
   * `computeSkillState` par compétence. Le payer à chaque ouverture d'exercice,
   * y compris pendant la recherche, serait un coût pour rien : la carte
   * n'apparaît qu'au retour du bilan.
   */
  const impact = bilan === "1" && derniereTerminee
    ? impactTentative({
      exercice,
      tentative: derniereTerminee,
      observations: ctx.observationsEffectives,
      skillsParCode: ctx.referentiel.parCode,
      calibrations: ctx.calibrations,
      now: ctx.now,
    })
    : null;

  /*
   * L'effet du travail sur la prochaine action : dérivé par le moteur sur la
   * compétence principale, APRÈS la tentative — les observations qu'elle vient
   * de produire sont déjà dans le contexte. Hors lecture seule seulement :
   * un cahier archivé ne propose pas d'enchaîner.
   */
  const codePrincipal = exercice.competences[0];
  const etatApres = codePrincipal ? ctx.etatsParCode.get(codePrincipal) : undefined;
  const suite = impact && !props.lectureSeule && etatApres
    ? suiteApresTravail({
      etatApres,
      calibrations: ctx.calibrations,
      exercices: ctx.donnees.exercises,
      tentatives: ctx.donnees.attempts,
      now: ctx.now,
      exercicesExclus: new Set([exercice.id]),
    })
    : null;

  const cible = ctx.etatsParCode.get(exercice.competences[0]);
  /*
   * Deux actes : Chercher → Mesurer.
   *
   * La correction de référence reste hors d'atteinte PENDANT le travail :
   * ni l'énoncé ouvert, ni le bilan du tuteur ne la montrent — le tuteur relit
   * la réponse côté serveur et rend une proposition dans le bilan. L'ancienne
   * URL `?correction=1` a été retirée avec l'écran qu'elle ouvrait — seul
   * `?evaluer=1` entre en mesure.
   *
   * Après coup, elle devient consultable (25/08/2026) : un exercice terminé
   * sans qu'on puisse jamais lire ce qui était attendu laissait le bilan sans
   * point de comparaison — « pourquoi ce verdict ? ». Le panneau est replié,
   * explicite (« réponse attendue »), et n'existe que SANS tentative en cours :
   * jamais pendant qu'on cherche.
   */
  const enMesure = evaluer === "1";
  // L'énoncé reste toujours atteignable — c'est le contexte, pas une action.
  // Il ne se replie que dans l'acte Mesurer, jamais avant : la recherche doit
  // garder l'énoncé sous les yeux.
  const foldEnonce = Boolean(enCours) && enMesure;

  /*
   * Suggestion de durée : le temps d'horloge depuis l'ouverture de la
   * tentative, **plafonné**. Une tentative ouverte la veille et reprise le
   * lendemain produisait une pré-remplisse de plusieurs centaines de minutes —
   * un temps d'horloge, pas un temps travaillé (`dureeEstimeeMin` n'est pas
   * une mesure, et la suggestion ne doit pas en fabriquer une absurde).
   *
   * Le plafond de 240 min est celui du garde-fou existant sur les durées
   * retenues à la clôture : au-delà, la valeur est manifestement du temps
   * d'horloge et la personne corrigera à la main.
   */
  const PLAFOND_DUREE_SUGGEREE_MIN = 240;
  const dureeSuggeree = enCours
    ? Math.min(
        PLAFOND_DUREE_SUGGEREE_MIN,
        Math.max(
          1,
          Math.round((ctx.now.getTime() - new Date(enCours.debut).getTime()) / 60_000),
        ),
      )
    : exercice.dureeEstimeeMin;

  // Contexte pédagogique partagé par tous les tiroirs du tuteur.
  const etatInitialTuteur = props.lectureSeule
    ? null
    : props.etatInitialTuteurFourni ?? await construireEtatInitialTuteur(ctx, exercice.id);
  const codesCompetences = ctx.etats.map((e) => e.skill.code);
  const domainesExistants = ctx.referentiel.domaines.map((d) => ({
    id: d.id,
    nom: d.nom,
    prefixe: d.prefixe,
  }));

  const navigation = props.navigation;
  const largeurVue = enCours ? "mx-auto max-w-6xl" : "mx-auto max-w-3xl";
  const lienCompositeur = `/seances?composer=1&code=${encodeURIComponent(exercice.competences[0] ?? "")}&temps=${exercice.dureeEstimeeMin}`;

  return (
    <div className={largeurVue}>
      {!props.integree && <LienRetour href="/seances" libelle="Toutes les séances" />}

      {/*
        Abandon : aucune observation écrite, et il faut le dire.

        Le silence serait pire que le zéro qu'on vient de refuser d'écrire —
        l'utilisateur croirait sa mesure enregistrée. On annonce ce qui n'a pas
        été fait, et pourquoi (P3 : aucune valeur sans source, y compris quand
        la valeur est « rien »).

        Exclusif avec le bandeau « Observation enregistrée » ci-dessous — un seul
        verdict sur cette tentative peut être vrai, l'URL ne doit pas pouvoir
        afficher les deux.
      */}
      {abandon === "1" && bilan !== "1" && (
        <BandeauInfo ton="info" className="mb-4">
        <div>
          <FocusActe cle={`abandon-${derniereAbandonnee?.id ?? exercice.id}`} cible="titre-abandon-exercice" />
          <p id="titre-abandon-exercice" tabIndex={-1} className="text-sm font-medium text-info outline-none">Cet exercice ne compte pas</p>
          <p className="mt-1 text-xs text-texte-attenue">
            {abandonDelibere ? (
              <>
                Vous avez clos cette tentative sans la mener à son terme : elle est marquée
                comme abandonnée. Un abandon n&apos;est pas un échec — un échec est une
                mesure, il suppose qu&apos;on ait essayé. Votre niveau sur{" "}
                {exercice.competences.join(", ")} est inchangé.
              </>
            ) : (
              <>
                La tentative a duré moins d&apos;un quart de la durée estimée
                ({exercice.dureeEstimeeMin} min) sans être réussie : elle est marquée comme
                abandonnée. En tirer un niveau reviendrait à confondre « pas mesuré » et
                « raté » — votre niveau sur{" "}
                {exercice.competences.join(", ")} est inchangé.
              </>
            )}
          </p>
          <p className="mt-1 text-xs text-texte-discret">
            La tentative reste au journal : elle explique pourquoi aucune difficulté
            n&apos;est conseillée pour le prochain exercice.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {navigation ? (
              props.activiteSuivanteId ? (
                <Link
                  href={urlExercice(props.activiteSuivanteId, navigation)}
                  className={classesLienBouton("principal", "petite")}
                >
                  Passer à l’activité suivante →
                </Link>
              ) : props.seancePeutTerminer ? (
                <ActionSeance
                  action={terminerSeance}
                  seanceId={navigation.seanceId}
                  libelle="Clôturer la séance →"
                  taille="petite"
                />
              ) : (
                <Link
                  href={`/seances?session=${encodeURIComponent(navigation.seanceId)}`}
                  className={classesLienBouton("principal", "petite")}
                >
                  Continuer la séance
                </Link>
              )
            ) : (
              <Link href={lienCompositeur} className={classesLienBouton("principal", "petite")}>
                Reprendre dans une séance
              </Link>
            )}
            {etatInitialTuteur && (
              <TiroirTuteur
                etatInitial={etatInitialTuteur}
                exerciceCible={exercice.id}
                amorce={amorceExercice(exercice.competences[0] ?? "", {
                  difficulteConseillee: Math.max(
                    1,
                    (ctx.calibrations.get(exercice.competences[0] ?? "")?.difficulteConseillee ?? 2) - 1,
                  ) as Difficulte,
                  dimensionFaible:
                    ctx.calibrations.get(exercice.competences[0] ?? "")?.dimensionFaible
                      ?.dimension ?? null,
                })}
                codesCompetences={codesCompetences}
                compteId={ctx.donnees.user.id}
                domainesExistants={domainesExistants}
                competencesModale={competencesPourModale(ctx.referentiel.actifs)}
                calibragesModale={calibragesPourModale(ctx.referentiel.actifs, ctx.calibrations)}
                libelle="En demander un plus abordable"
              />
            )}
            {!props.integree && (
              <Link href="/seances" className={classesLienBouton("secondaire", "petite")}>
                Historique des séances
              </Link>
            )}
          </div>
        </div>
        </BandeauInfo>
      )}

      {/*
        Bilan après enregistrement — l'impact, pas deux nombres.
        La carte est alimentée par `impactTentative`, qui rejoue le journal pour
        dire le niveau AVANT et APRÈS. Le bandeau précédent affichait l'état
        courant seul : on ne pouvait pas savoir si quelque chose avait bougé.
      */}
      {bilan === "1" && derniereTerminee && impact && (
        <div className="mb-4">
          <FocusActe cle={`bilan-${derniereTerminee.id}`} cible="titre-bilan-exercice" />
          <div id="titre-bilan-exercice" tabIndex={-1} className="outline-none">
            <CarteImpact
              impact={impact}
              lienCompetence={!props.integree}
              suite={suite ?? undefined}
              controleSuite={
                suite ? (
                  suite.exerciceSuivant ? (
                    <form action={demarrerExerciceEnFocus.bind(null, suite.exerciceSuivant.id)}>
                      <Bouton type="submit" variante="principal" className="shadow-xs">
                        Enchaîner : {suite.exerciceSuivant.titre}
                        <IconeFleche className="size-4" />
                      </Bouton>
                    </form>
                  ) : codePrincipal ? (
                    <Link
                      href={`/seances?composer=1&code=${encodeURIComponent(codePrincipal)}&temps=${exercice.dureeEstimeeMin}`}
                      className={classesLienBouton("secondaire")}
                    >
                      Générer puis travailler au niveau {suite.difficulteConseillee}/5
                    </Link>
                  ) : null
                ) : null
              }
              actions={
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {navigation ? (
                    props.activiteSuivanteId ? (
                      <LienApresImpact
                        href={urlExercice(props.activiteSuivanteId, navigation)}
                        libelle="Passer à l’activité suivante"
                        variante="principal"
                      />
                    ) : props.seancePeutTerminer ? (
                      <ActionSeance
                        action={terminerSeance}
                        seanceId={navigation.seanceId}
                        libelle="Clôturer la séance →"
                        variante="principal"
                      />
                    ) : (
                      <LienApresImpact
                        href={`/seances?session=${encodeURIComponent(navigation.seanceId)}`}
                        libelle="Continuer la séance"
                        variante="principal"
                      />
                    )
                  ) : (
                    <>
                      <LienApresImpact
                        href="/app"
                        libelle="Prochaine action recommandée"
                        variante="principal"
                      />
                      {exercice.competences[0] && (
                        <LienApresImpact
                          href={`/atelier?document=${encodeURIComponent(exercice.competences[0])}`}
                          libelle="Voir la fiche dans mes cours"
                          variante="secondaire"
                        />
                      )}
                      <LienApresImpact
                        href="/seances"
                        libelle="Historique des séances"
                        variante="discret"
                      />
                    </>
                  )}
                </div>
              }
            />
          </div>
        </div>
      )}

      {/* -------------------------------- En-tête ------------------------- */}
      <header className="mb-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Etiquette>{libelleDomaine(ctx.referentiel, exercice.domaine)}</Etiquette>
          <Etiquette>
            Difficulté {exercice.difficulte}/5 · {DIFFICULTES[exercice.difficulte]}
          </Etiquette>
          <Etiquette>≈ {formatDuree(exercice.dureeEstimeeMin)}</Etiquette>
          {exercice.diagnostic && <Etiquette ton="info">Diagnostic</Etiquette>}
          {/*
            Une correction du contenu se signale (ADR-047). Une observation ancienne
            mesure une tentative sur l'énoncé d'ALORS : sans cette étiquette, le
            journal paraîtrait cohérent alors que le support a changé.
          */}
          {exercice.modifieLe && (
            <Etiquette>Contenu corrigé le {formatDateCourte(exercice.modifieLe)}</Etiquette>
          )}
        </div>
        <h1 className="mt-2.5 text-xl font-semibold tracking-tight">{exercice.titre}</h1>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          {exercice.competences.map((c) => {
            const e = ctx.etatsParCode.get(c);
            const contenu = (
              <>
                <CodeCompetence code={c} />
                <span className="w-14">
                  <JaugeNiveau niveau={e?.niveau ?? null} taille="compacte" />
                </span>
                <span className="chiffres text-[0.6875rem] text-texte-discret">
                  {e?.niveau ?? "—"}/5
                </span>
              </>
            );
            return props.integree ? (
              <div key={c} className="flex items-center gap-2 rounded-md border border-bordure px-2 py-1">
                {contenu}
              </div>
            ) : (
              <Link key={c} href={`/atelier?document=${encodeURIComponent(c)}`} className="flex items-center gap-2 rounded-md border border-bordure px-2 py-1 transition-colors hover:bg-surface-2">
                {contenu}
              </Link>
            );
          })}
          {/*
            Corriger un exercice (ADR-047). Rendu par la fiche, comme
            `BoutonGenerer` : la fiche est un composant serveur et ne porte ni
            état ni `onClick`. Masqué pendant une tentative — modifier l'énoncé
            en cours de mesure rendrait l'observation illisible.

            ⚠️ **Retirer un exercice n'est PAS proposé depuis une séance**
            (22/08/2026). Le bouton s'affichait à côté de l'énoncé qu'on
            s'apprêtait à traiter, en rouge, juste avant « Commencer
            l'exercice » : on offrait de détruire l'objet qu'on venait faire.
            Retirer un exercice est un geste de bibliothèque — il regarde le
            catalogue, pas le travail en cours — et il a déjà sa place à
            l'Atelier, sur la fiche de l'exercice et sur celle de la
            compétence. La séance, elle, a été composée AVEC cet exercice :
            l'enlever en plein déroulé viderait la composition de son sens.
          */}
          {!props.lectureSeule && !navigation && (
            <>
              {!enCours && <BoutonEditer exercice={exercice} tentatives={tentatives.length} />}
              <BoutonRetirerExercice
                exerciceId={exercice.id}
                titre={exercice.titre}
                tentatives={tentatives.length}
                destination="/atelier"
              />
            </>
          )}
        </div>

      </header>

      <div className={enCours ? "grid gap-4 lg:grid-cols-2 lg:items-start" : "space-y-4"}>
        <div
          className={
            enCours
              ? "min-h-0 space-y-4 lg:col-start-1 lg:row-start-1 lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto lg:pr-1"
              : "space-y-4"
          }
        >
        {/* -------------------------------- Énoncé -------------------------- */}
        {foldEnonce ? (
          <PanneauPliable ouvertParDefaut={false} titre={<span className="text-sm font-medium">Énoncé</span>}>
            <div className="px-4 py-3.5 text-sm">
              <Markdown contenu={exercice.enonce} />
            </div>
          </PanneauPliable>
        ) : (
          <Carte>
            <EnTeteCarte titre="Énoncé" />
            <div className="px-4 py-3.5 text-sm">
              <Markdown contenu={exercice.enonce} />
            </div>
          </Carte>
        )}

        {/* -------------------------------- Données ------------------------- */}
        {exercice.donnees && exercice.donnees.length > 0 && (
          foldEnonce ? (
            <PanneauPliable ouvertParDefaut={false} titre={<span className="text-sm font-medium">Données</span>}>
              <ul className="divide-y divide-bordure">
                {exercice.donnees.map((d, i) => (
                  <li key={i} className="flex flex-wrap items-baseline justify-between gap-3 px-4 py-2">
                    <span className="text-xs text-texte-attenue">{d.libelle}</span>
                    <span className="chiffres text-sm font-medium">{d.valeur}</span>
                  </li>
                ))}
              </ul>
            </PanneauPliable>
          ) : (
            <Carte>
              <EnTeteCarte titre="Données" />
              <ul className="divide-y divide-bordure">
                {exercice.donnees.map((d, i) => (
                  <li key={i} className="flex flex-wrap items-baseline justify-between gap-3 px-4 py-2">
                    <span className="text-xs text-texte-attenue">{d.libelle}</span>
                    <span className="chiffres text-sm font-medium">{d.valeur}</span>
                  </li>
                ))}
              </ul>
            </Carte>
          )
        )}

        </div>

        {/* ------------------------ Démarrage / résolution ------------------ */}
        {/*
          Démarrage automatique dans le déroulé d'une séance : ouvrir le
          travail EST commencer. Hors séance, et pour refaire un exercice
          déjà mené dans la même séance, le geste reste explicite.
        */}
        {!props.lectureSeule && !enCours && props.integree && !derniereTerminee && (
          <DemarrageAuto exerciseId={exercice.id} />
        )}
        {!props.lectureSeule && !enCours && props.integree && derniereTerminee && (
          <Carte accent>
            <div className="px-4 py-3.5">
              <p className="text-sm">
                Cet exercice a déjà été mené dans cette séance. Vous pouvez le refaire : la nouvelle
                tentative comptera comme les autres.
              </p>
              <form action={demarrerTentative.bind(null, exercice.id)}>
                <Bouton type="submit" variante="principal" taille="petite">
                  Refaire l&apos;exercice
                  <IconeFleche className="size-4" />
                </Bouton>
              </form>
            </div>
          </Carte>
        )}
        {!props.lectureSeule && !enCours && !props.integree && !derniereTerminee && (
          <Carte accent>
            <div className="px-4 py-3.5">
              <p className="text-sm">
                Prenez le temps de chercher avant de demander de l&apos;aide. La résolution reste
                la vôtre ; le tuteur intervient seulement quand vous en avez besoin.
              </p>
              {cible?.observations.length === 0 && (
                <p className="mt-2 text-xs text-texte-attenue">
                  Il s&apos;agit du premier diagnostic sur {exercice.competences[0]}. L&apos;objectif
                  n&apos;est pas de réussir mais de situer votre niveau réel : une réponse partielle est
                  une information utile.
                </p>
              )}
              <Link href={lienCompositeur} className={classesLienBouton("principal", "petite")}>
                Composer une séance
                <IconeFleche className="size-4" />
              </Link>
            </div>
          </Carte>
        )}

        {/*
          -------------------- Après coup --------------------
          La réponse attendue, consultable une fois l'exercice terminé et
          AUCUNE tentative en cours (25/08/2026). Repliée par défaut : c'est un
          document de comparaison, pas un contenu qui s'offre au regard de qui
          rouvre l'exercice pour le refaire — même précaution que la correction
          repliée dans la fiche (`titresReplies` du Markdown).
        */}
        {!enCours && derniereCloturee && (
          <PanneauPliable
            ouvertParDefaut={false}
            titre={<span className="text-sm font-medium">Réponse attendue</span>}
            sousEntete={
              <p className="mt-0.5 text-xs text-texte-attenue">
                {derniereCloturee.statut === "abandonnee"
                  ? "Exercice clos sans mesure — ce qui était attendu, si vous souhaitez comparer."
                  : "Exercice terminé — ce qui était attendu, pour relire votre bilan avec un point de comparaison."}
              </p>
            }
          >
            <div className="px-4 py-3.5 text-sm">
              <Markdown contenu={exercice.correction} />
            </div>
          </PanneauPliable>
        )}

        {enCours && (
          <div className="space-y-4 lg:col-start-2 lg:row-start-1">
            {aidesMasquees && (
              <p className="text-[0.6875rem] text-texte-discret">
                Mode épreuve : les aides sont masquées jusqu&apos;à la fin de la séance.
              </p>
            )}
            {/*
              Ce qui sera évalué — les critères AVANT la réponse (25/08/2026).
              Le testeur devinait le contrat au moment du bilan, après coup :
              il ne pouvait ni viser ce qui serait jugé, ni expliquer son
              propre verdict. Les critères existent déjà (ils portent la
              grille du bilan) ; les afficher ici ne révèle rien de la
              correction — c'est le contrat de l'évaluation, pas sa réponse.
              En mode épreuve, ce contrat reste visible : savoir sur quoi on
              est jugé n'est pas une aide, c'est la règle du jeu.
            */}
            <Carte>
              <EnTeteCarte titre="Ce qui sera évalué" />
              <ul className="divide-y divide-bordure">
                {exercice.criteres.map((critere, index) => (
                  <li key={index} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2">
                    <span className="min-w-0 flex-1 text-xs">{critere.libelle}</span>
                    <span className="shrink-0 text-[0.6875rem] text-texte-discret">
                      {LIBELLES_DIMENSIONS[critere.dimension]}
                    </span>
                  </li>
                ))}
              </ul>
            </Carte>
            {/*
              Votre réponse — vivante dans l'acte Chercher, repliée dès que le
              bilan du tuteur est ouvert. Elle reste modifiable avant l'envoi
              au tuteur.
            */}
            <PanneauPliable
              ouvertParDefaut={!enMesure}
              titre={<span className="text-sm font-medium">Votre réponse</span>}
              sousEntete={
                <p className="mt-0.5 text-xs text-texte-attenue">
                  Rédigez votre méthode, pas seulement le résultat final
                </p>
              }
            >
              <div className="px-4 py-3.5">
                <ZoneReponse
                  attemptId={enCours.id}
                  valeur={enCours.reponse}
                  compteId={ctx.donnees.user.id}
                  urlCorrection={urlExercice(exercice.id, navigation, "evaluer")}
                />
                {/*
                  Le tiroir porte l'identifiant de l'exercice : le tuteur reçoit
                  l'énoncé et le brouillon enregistré. Les déclencheurs contextuels
                  pré-remplissent la question sans révéler la solution.
                */}
                {etatInitialTuteur && (
                  <div className="mt-3">
                    <TiroirTuteur
                      etatInitial={etatInitialTuteur}
                      exerciceCible={exercice.id}
                      codesCompetences={codesCompetences}
                      compteId={ctx.donnees.user.id}
                      domainesExistants={domainesExistants}
                      competencesModale={competencesPourModale(ctx.referentiel.actifs)}
                      calibragesModale={calibragesPourModale(ctx.referentiel.actifs, ctx.calibrations)}
                       declencheur="barre-contextuelle"
                       actionsContextuelles={actionsTuteur}
                     />
                  </div>
                )}
              </div>
            </PanneauPliable>

            {/* ---------------- Acte : demander la correction au tuteur ------ */}
            {!enMesure && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-bordure px-1 py-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium">Correction par le tuteur</p>
                  <p className="text-micro text-texte-attenue">
                    Le tuteur relira votre réponse et vous proposera un bilan.
                  </p>
                </div>
                <Link
                  href={urlExercice(exercice.id, navigation, "evaluer")}
                  className={cx(classesLienBouton("principal", "petite"))}
                >
                  Demander la correction
                  <IconeFleche className="size-4" />
                </Link>
              </div>
            )}

            {/*
              Pendant le travail, la correction de référence reste côté serveur.
              Le clic ci-dessus ouvre directement le bilan assisté ; aucune
              étape du parcours ne rend le texte de correction. Elle ne devient
              consultable qu'après coup, via le panneau « Réponse attendue »
              ci-dessus — jamais pendant qu'une tentative est ouverte.
            */}
            {/* -------------------- Acte : Mesurer ----------------------------
              Énoncé et réponse sont repliés : seul le bilan proposé par le
              tuteur — ou le blocage qui l'empêche — reste déployé.

              La condition `reponseSuffisante` porte sur `enCours.reponse` —
              ce que la BASE porte — et non sur le texte à l'écran : la zone
              de réponse enregistre automatiquement en base, mais cette
              valeur-là est figée au rendu serveur. La navigation vers le
              bilan relit la base. D'où le message, qui dit que la trace
              écrite manque.

              Mesuré le 07/08/2026 : 16 des 37 tentatives terminées n'avaient
              aucune réponse. La règle change donc réellement le parcours, et
              sa sortie est le bouton « Abandonner » rendu en pied de section —
               disponible dans les trois actes, sans coûter la révélation de la
               correction.
            */}
            {enMesure && (
              <>
                <FocusActe cle="mesurer" cible="titre-mesurer" />
                {reponseSuffisante(enCours.reponse) ? (
                  <Carte accent>
                    <EnTeteCarte
                      id="titre-mesurer"
                      titre="Évaluation"
                      legende="C'est cette étape qui produit l'observation"
                    />
                    <div className="px-4 py-3.5">
                      {/*
                        `BilanAssiste` rend le formulaire uniquement après une
                        correction recevable. En cas d'échec ou d'expiration,
                        il propose une reprise explicite ou « Terminer sans
                        mesure » : aucune auto-évaluation de secours ne peut
                        fabriquer une observation sans correction.
                      */}
                      <BilanAssiste
                        exercice={exercice}
                        attemptId={enCours.id}
                        dureeSuggeree={dureeSuggeree}
                        indicesUtilises={enCours.indicesUtilises}
                        compteId={ctx.donnees.user.id}
                        navigation={navigation}
                      />
                    </div>
                  </Carte>
                ) : (
                  <Carte>
                    <EnTeteCarte
                      id="titre-mesurer"
                      titre="Évaluation"
                      legende="Elle attend votre réponse écrite"
                    />
                    <div className="px-4 py-3.5">
                      <p className="text-xs text-texte-attenue">
                        {motifBlocageBilan(enCours.reponse)}
                      </p>
                      <p className="mt-2 text-xs text-texte-discret">
                        Si vous ne voulez pas mener cet exercice, closez-le franchement : aucune
                        observation ne sera écrite, et votre niveau restera inchangé. Le bouton
                        « Abandonner cette tentative » est disponible en bas de page, dans
                        les trois actes.
                      </p>
                    </div>
                  </Carte>
                )}
              </>
            )}

            {/*
              -------------------- Pied de section — Abandonner -----------------
              Disponible dans les trois actes, quel que soit l'état du brouillon.
              Abandonner ne doit pas coûter la révélation de la correction (audit
              §2.2) : ce n'est pas une sortie qu'on atteint en traversant Comparer,
              c'est une sortie qui existe toujours. Et symétriquement, dès qu'un
              brouillon suffisant existe, le bouton ne doit pas disparaître.
            */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-bordure px-1 py-2">
              <div className="min-w-0">
                <p className="text-xs font-medium">Abandonner</p>
                <p className="text-micro text-texte-attenue">Cet exercice ne comptera pas.</p>
              </div>
              <BoutonAbandon
                attemptId={enCours.id}
                exerciceId={exercice.id}
                dureeMin={dureeSuggeree}
                codes={exercice.competences}
                navigation={navigation}
              />
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/* `ZoneReponse` vit désormais dans `components/exercices/zone-reponse.tsx` :
   le brouillon doit survivre à une navigation, ce qui demande du client. */
