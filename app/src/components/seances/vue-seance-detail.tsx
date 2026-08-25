import Link from "next/link";
import { notFound } from "next/navigation";
import { chargerContexte } from "@/lib/store/context";
import {
  abandonnerSeance,
  annulerSeance,
  demarrerSeance,
  reprendreSeance,
  terminerSeance,
} from "@/lib/store/seance-actions";
import {
  attendPreparationSeance,
  avancementSeance,
  ecartBesoinRealise,
  estModeEpreuve,
  peutReprendreSeance,
  preparationInstantaneeSeance,
  statutSeance,
  tentativeDeSeance,
} from "@/lib/domain/seance";
import { jourDeLaSeance } from "@/lib/domain/pages-cahier";
import { urlExercice } from "@/lib/domain/navigation-exercice";
import { formatDateCourte, formatDuree } from "@/lib/engine/dates";
import { Carte, CodeCompetence, EnTeteCarte, Etiquette, EtatVide, classesLienBouton } from "@/components/ui/primitives";
import { ActionSeance } from "@/components/seances/action-seance";
import { ActionPreparerSeance } from "@/components/seances/action-preparer-seance";
import { Pomodoro } from "@/components/seances/pomodoro";
import { ChronoEpreuve } from "@/components/seances/chrono-epreuve";
import { OutilSeance } from "@/components/seances/outil-seance";
import { CalculatriceSeance } from "@/components/seances/calculatrice-seance";
import { MargeCahier } from "@/components/seances/marge-cahier";
import { lireMarge } from "@/lib/store/marge";
import { FocusActe } from "@/components/exercices/focus-acte";
import { TiroirTuteur } from "@/components/tuteur/tiroir-tuteur";
import { construireEtatInitialTuteur } from "@/lib/tutor/etat-initial";
import { calibragesPourModale, competencesPourModale } from "@/lib/domain/proprietes-generation";
import { VueExercice } from "@/components/exercices/vue-exercice";
import { ResumeExerciceCahier } from "@/components/seances/resume-exercice-cahier";
import { CarteImpact, LienApresImpact } from "@/components/exercices/carte-impact";
import { impactCumule, impactTentative } from "@/lib/engine/impact";
import { SasSeance } from "@/components/seances/sas-seance";
import { IconeExercices, IconeMinuteur, IconeNote } from "@/components/ui/icones";

export type EtapeRecherche = {
  evaluer?: string;
  bilan?: string;
  abandon?: string;
};

/*
  Les panneaux des outils.
  ------------------------------------------------------------------
  Sur mobile, un panneau flottant ancré à son bouton sortirait de
  l'écran : il devient une nappe `fixed`, large de la fenêtre. Au-delà,
  il s'ancre à son bouton — et l'ancrage suit l'alignement des boutons
  eux-mêmes :

   - **sur la page du cahier**, les outils commencent à gauche (les
     onglets d'un séparateur) : le panneau s'ouvre donc à partir du bord
     gauche. Le centrer sur un bouton de gauche le faisait déborder du
     cadre, que `overflow-hidden` coupait net ;
   - **en plein écran**, ils vivent dans le groupe de droite de
     l'en-tête : le panneau s'ouvre vers le bord droit.

  ⚠️ Les variantes sont écrites en toutes lettres : Tailwind lit les
  classes dans la source, une chaîne assemblée à l'exécution ne
  produirait aucun style.
*/
const CLASSES_PANNEAU_BASE =
  "fixed left-4 right-4 top-28 z-[var(--superposition-menu)] mt-2 shadow-xl sm:absolute sm:top-auto";
const CLASSES_PANNEAU_CADRE = "rounded-lg border border-bordure bg-surface p-3";

const PANNEAU_LARGE_GAUCHE =
  "sm:right-auto sm:left-0 sm:translate-x-0 sm:w-[min(34rem,calc(100vw-6rem))]";
const PANNEAU_LARGE_DROITE =
  "sm:left-auto sm:right-0 sm:translate-x-0 sm:w-[min(34rem,calc(100vw-2rem))]";
const PANNEAU_ETROIT_GAUCHE =
  "sm:right-auto sm:left-0 sm:translate-x-0 sm:w-[min(24rem,calc(100vw-6rem))]";
const PANNEAU_ETROIT_DROITE =
  "sm:left-auto sm:right-0 sm:translate-x-0 sm:w-[min(24rem,calc(100vw-2rem))]";

const LIBELLES_STATUT = {
  planifiee: { texte: "Planifiée", ton: "info" as const },
  "en-cours": { texte: "En cours", ton: "primaire" as const },
  terminee: { texte: "Terminée", ton: "succes" as const },
  abandonnee: { texte: "Abandonnée", ton: "danger" as const },
};

export async function VueSeanceDetail({
  id,
  exerciceDemande,
  recherche,
  sas = false,
  plein = true,
}: {
  id: string;
  exerciceDemande?: string;
  recherche?: EtapeRecherche;
  /**
   * L'URL porte `sas=1` : on vient d'entrer en travail (ADR-103).
   *
   * Lu ici plutôt que par `useSearchParams()` côté client pour que le sas soit
   * peint au premier rendu — il apparaîtrait sinon APRÈS l'exercice, ce qui
   * est l'inverse d'une coupure.
   */
  sas?: boolean;
  /**
   * Plein écran, ou déroulé à sa place dans la page du cahier.
   *
   * Le workspace était un calque `fixed inset-0` qui **remplaçait** le cahier :
   * travailler, c'était en sortir. Le déroulé vit désormais sur la page du jour
   * de la séance, et le plein écran redevient ce qu'il doit être — un mode de
   * concentration qu'on choisit, pas le seul endroit où le travail existe.
   */
  plein?: boolean;
}) {
  const ctx = await chargerContexte();
  const seance = ctx.donnees.sessions.find((candidate) => candidate.id === id);
  if (!seance) notFound();

  const statut = statutSeance(seance);
  /*
   * Préparation différée (ADR-131) : une séance protocole planifiée peut
   * attendre encore des exercices. L'état est dérivé ici, une fois, pour
   * l'habillage de la carte planifiée — le bouton d'entrée change avec lui.
   */
  const preparationEnAttente = attendPreparationSeance(seance);
  /*
   * Mode épreuve (22/08/2026) : un fait posé à la création, lu ici pour
   * l'habillage — chrono affiché, aides du tuteur masquées pendant le déroulé.
   * Aucune mesure n'en dépend : le déroulé, le bilan et l'autonomie restent
   * exactement ceux d'une séance ordinaire.
   */
  const epreuve = estModeEpreuve(seance);
  /*
   * Une séance abandonnée se relit comme une séance terminée : le déroulé est
   * figé, les traces restent. La seule différence tient à ce qu'on peut encore
   * en faire — la reprendre s'il reste des activités jamais ouvertes.
   */
  const close = statut === "terminee" || statut === "abandonnee";
  const avancement = avancementSeance(seance, ctx.donnees.attempts);
  const reprenable = peutReprendreSeance(seance, avancement);
  const parId = new Map(ctx.donnees.exercises.map((item) => [item.id, item]));
  const activites = seance.activites.filter(
    (activite) => activite.type === "exercice" && parId.has(activite.ref),
  );
  const ids = activites.map((activite) => activite.ref);
  const demandeDansSeance = exerciceDemande && ids.includes(exerciceDemande) ? exerciceDemande : undefined;
  const explicite = close
    ? demandeDansSeance
    : demandeDansSeance &&
        (avancement.enCours.includes(demandeDansSeance) || avancement.restants.includes(demandeDansSeance))
      ? demandeDansSeance
      : undefined;
  const exerciceActif =
    explicite ?? avancement.enCours.find((ref) => ids.includes(ref)) ??
    avancement.restants.find((ref) => ids.includes(ref));

  /*
   * L'impact de la séance entière, quand elle est close.
   *
   * `impactCumule` fusionne les compétences travaillées plusieurs fois : deux
   * exercices sur la même compétence donnent un seul écart, du niveau d'avant
   * le premier à celui d'après le dernier. Les additionner ferait dire deux
   * fois à un même progrès qu'il a eu lieu.
   */
  /*
   * La relecture d'un exercice seul dans une séance close montre le même
   * impact, borné à cet exercice : arriver ici par « Retour au déroulé » ne
   * doit pas faire perdre ce que le travail a changé.
   */
  const impactExplicite = (() => {
    if (!close || !explicite) return null;
    const exercice = parId.get(explicite);
    const tentative = exercice ? tentativeDeSeance(seance, explicite, ctx.donnees.attempts) : undefined;
    if (!exercice || !tentative) return null;
    return impactTentative({
      exercice,
      tentative,
      observations: ctx.observationsEffectives,
      skillsParCode: ctx.referentiel.parCode,
      calibrations: ctx.calibrations,
      now: ctx.now,
    });
  })();

  const impactSeance = close && !explicite
    ? impactCumule(
      activites.flatMap((activite) => {
        const exercice = parId.get(activite.ref);
        const tentative = exercice
          ? tentativeDeSeance(seance, activite.ref, ctx.donnees.attempts)
          : undefined;
        if (!exercice || !tentative) return [];
        const impact = impactTentative({
          exercice,
          tentative,
          observations: ctx.observationsEffectives,
          skillsParCode: ctx.referentiel.parCode,
          calibrations: ctx.calibrations,
          now: ctx.now,
        });
        return impact ? [impact] : [];
      }),
    )
    : null;
  const suivant = [...avancement.enCours, ...avancement.restants]
    .find((ref) => ref !== exerciceActif && ids.includes(ref));
  const traites = avancement.menes.length + avancement.abandonnes.length;
  const peutTerminer = avancement.enCours.length === 0 && avancement.restants.length === 0;

  const competencesParExercice = new Map(
    ctx.donnees.exercises.map((item) => [item.id, item.competences]),
  );
  const ecart = ecartBesoinRealise(seance, ctx.donnees.attempts, competencesParExercice);

  const etatTuteur = statut === "en-cours" && exerciceActif
    ? await construireEtatInitialTuteur(ctx, exerciceActif)
    : null;
  // Lue seulement quand la barre d'outils existe : relire une séance close n'a
  // pas besoin de la marge.
  const marge = statut === "en-cours" ? await lireMarge() : [];

  /*
   * La largeur suit l'ACTE, pas l'écran.
   *
   * Avant de commencer, il n'y a qu'un énoncé à lire : la colonne de lecture
   * (`--colonne`) est la bonne mesure. Dès qu'une tentative est ouverte,
   * `VueExercice` passe en deux colonnes — énoncé à gauche, réponse à droite —
   * et 704 px les écrasait toutes les deux : l'énoncé tombait à cinq mots par
   * ligne et le champ de réponse devenait une fente. L'écran s'ouvre donc au
   * moment où l'on se met à écrire, et se referme quand on relit.
   */
  const travailOuvert = avancement.enCours.length > 0;
  const colonnePlein = travailOuvert ? "max-w-6xl" : "max-w-[var(--colonne)]";

  const jourDeLaPage = jourDeLaSeance(seance);
  const urlSeance = `/seances?session=${encodeURIComponent(seance.id)}`;
  // La même URL sans `sas`, posée par le sas dès son affichage : un
  // rechargement pendant les deux secondes ne doit pas le rejouer.
  const urlSansSas = plein ? `${urlSeance}&focus=1` : urlSeance;

  // Les outils suivent le bandeau : à gauche sur la page, à droite dans
  // l'en-tête du plein écran — et leurs panneaux s'ancrent du même côté.
  const panneauLarge = `${CLASSES_PANNEAU_BASE} ${CLASSES_PANNEAU_CADRE} ${plein ? PANNEAU_LARGE_DROITE : PANNEAU_LARGE_GAUCHE}`;
  const panneauMinuteur = `${CLASSES_PANNEAU_BASE} ${plein ? PANNEAU_ETROIT_DROITE : PANNEAU_ETROIT_GAUCHE}`;

  return (
    /*
     * Le plein écran est la MÊME pièce que le Bureau, éclairée pareil
     * (ADR-103). Il rendait jusqu'ici un `bg-surface` plat sur toute la
     * fenêtre, en `max-w-7xl` : on quittait visuellement l'application pour
     * entrer dans un écran générique. La lampe et la colonne rétablissent la
     * continuité — on reste au même endroit, on s'y concentre davantage.
     */
    <div
      className={
        plein
          ? /*
             * La séance N'EST PLUS un calque `fixed inset-0`.
             *
             * Elle recouvrait l'écran entier, rail compris : entrer dans une
             * séance faisait disparaître d'un coup la navigation, la
             * couverture, la date et la bande de semaine. On ne se déplaçait
             * pas dans l'application, on était téléporté ailleurs — c'est de
             * là que venait la cassure, pas du dessin.
             *
             * Elle occupe désormais la zone de contenu, et le rail reste. Les
             * marges négatives annulent les paddings verticaux du cadre
             * (`pt-6 lg:pt-8`, `pb-24 lg:pb-12`) pour que la surface parte
             * bien du haut et descende jusqu'au bas.
             */
            "apparition relative isolate -mt-6 -mb-24 flex min-h-[calc(100dvh-3rem)] flex-col lg:-mt-8 lg:-mb-12 lg:min-h-dvh"
          : "overflow-hidden rounded-lg border border-bordure bg-surface"
      }
    >
      {plein && (
        <div aria-hidden className="bureau-lampe pointer-events-none fixed inset-0 -z-10" />
      )}
      {statut === "en-cours" && (
        <SasSeance
          actif={sas}
          urlApres={urlSansSas}
          intention={seance.besoinDeclare?.intention}
          codes={seance.skillCodes}
          nombreExercices={activites.length}
          dureeCibleMin={seance.blueprint?.dureeCibleMin}
        />
      )}
      <header
        className={
          plein
            ? "sticky top-0 z-20 border-b border-bordure/60 bg-fond/85 backdrop-blur"
            : "border-b border-bordure bg-surface-2/30"
        }
      >
        {/*
          Une seule ligne, et pas de sur-titre.

          « CONCENTRATION » en capitales au-dessus du titre annonçait l'état
          d'esprit qu'on est censé avoir — le seul élément de l'écran qui ne
          servait à rien qu'à se nommer. Le mode se voit : le rail a disparu,
          la page est une colonne. Il n'a pas besoin d'être écrit.
        */}
        <div className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5 sm:px-6 ${plein ? `mx-auto ${colonnePlein}` : ""}`}>
          <div className="flex min-w-0 items-center gap-2">
            {epreuve && (
              <span
                title="Mode épreuve"
                className="flex size-5 shrink-0 items-center justify-center rounded-full border border-primaire/30 bg-primaire-faible text-primaire"
              >
                <IconeMinuteur className="size-3" />
              </span>
            )}
            <h1 className="truncate font-serif text-base font-medium">
              {seance.besoinDeclare?.intention || "Séance"}
            </h1>
            <Etiquette ton={LIBELLES_STATUT[statut].ton}>{LIBELLES_STATUT[statut].texte}</Etiquette>
          </div>

          {/*
            Une seule rangée : pilotage ET outils.

            L'en-tête empilait deux bandes — la ligne de titre, puis une barre
            d'outils centrée collée sous le filet d'avancement. Six contrôles
            bordés sur deux rangées pesaient plus lourd que le travail
            lui-même. Tout vit désormais dans le groupe de droite, dans un
            ordre de lecture : avancement, chrono (mode épreuve), outils,
            sortie. `flex-wrap` renvoie les outils sous le titre quand la
            fenêtre manque de largeur.
          */}
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            <span className="chiffres mr-1 text-xs text-texte-discret">
              {traites} / {avancement.total}
            </span>
            {epreuve && statut === "en-cours" && (
              <ChronoEpreuve
                compteId={ctx.donnees.user.id}
                dureeFocusMin={seance.blueprint?.dureeCibleMin}
              />
            )}
            {statut === "en-cours" && (
              <>
                {/*
                  ⚠️ Les outils ne sont plus des « intercalaires ».

                  `classesIntercalaire` dessinait des languettes de séparateur
                  de cahier : bordure transparente, texte atténué, aucun fond.
                  La forme se justifiait quand l'interface peignait un cahier —
                  ADR-101 a retiré cet habillage, et la languette est restée
                  orpheline. Ce sont des contrôles : ils portent un fond, un
                  contour, une icône et un état actif lisible (ADR-103).
                */}
                <OutilSeance
                  variante="outil"
                  libelle="Exercices"
                  icone={<IconeExercices className="size-3.5" />}
                  contenuClassName={panneauLarge}
                >
                  <ListeActivites activites={activites} parId={parId} avancement={avancement} seanceId={seance.id} plein={plein} compacte />
                </OutilSeance>
                <OutilSeance
                  variante="outil"
                  libelle="Pomodoro"
                  icone={<IconeMinuteur className="size-3.5" />}
                  contenuClassName={panneauMinuteur}
                >
                  {/* Même défaut de durée que le chrono du mode épreuve : les deux
                      affichages du minuteur ne doivent pas se contredire. */}
                  <Pomodoro
                    compteId={ctx.donnees.user.id}
                    {...(epreuve && seance.blueprint?.dureeCibleMin
                      ? { dureeFocusDefaut: seance.blueprint.dureeCibleMin }
                      : {})}
                  />
                </OutilSeance>
                {/*
                  La calculatrice est un support, pas une évidence : elle se
                  montre ou se cache depuis les réglages du compte (Apparence &
                  Compte), et la préférence reste sur l'appareil.
                */}
                <CalculatriceSeance compteId={ctx.donnees.user.id} />
                {/*
                  La marge suit le travail. C'est pendant un exercice qu'on se
                  dit « il faudra revoir ça » — et jusqu'ici le workspace
                  n'offrait aucun endroit où l'écrire : la seule zone de saisie
                  du cahier était l'annotation d'une séance déjà terminée.
                */}
                <OutilSeance
                  variante="outil"
                  libelle="Marge"
                  icone={<IconeNote className="size-3.5" />}
                  indice={marge.filter((ligne) => !ligne.faite).length || undefined}
                  contenuClassName={panneauLarge}
                >
                  <MargeCahier lignes={marge} compacte />
                </OutilSeance>
                {etatTuteur && exerciceActif && (
                  <TiroirTuteur
                    etatInitial={etatTuteur}
                    exerciceCible={exerciceActif}
                    codesCompetences={ctx.etats.map((etat) => etat.skill.code)}
                    compteId={ctx.donnees.user.id}
                    domainesExistants={ctx.referentiel.domaines.map((domaine) => ({ id: domaine.id, nom: domaine.nom, prefixe: domaine.prefixe }))}
                    competencesModale={competencesPourModale(ctx.referentiel.actifs)}
                    calibragesModale={calibragesPourModale(ctx.referentiel.actifs, ctx.calibrations)}
                    libelle="Tuteur IA"
                    declencheur="outil"
                  />
                )}
              </>
            )}
            {/*
              ⚠️ Plus de bascule « plein écran ».

              Elle BOUCLAIT : depuis qu'une séance ouverte ouvre directement le
              mode travail, `?session=X` redirige vers `&focus=1` — et le
              bouton « Quitter le plein écran » pointait précisément sur
              `?session=X`. Un aller-retour infini.

              Elle n'avait de toute façon plus d'objet : une séance qui attend
              un geste n'a qu'un mode, et une séance close se relit sur la page
              du jour. Une sortie, une seule, écrite.
            */}
            <Link
              href={`/seances?jour=${encodeURIComponent(jourDeLaPage)}`}
              className={classesLienBouton("secondaire", "petite")}
            >
              {plein ? "Séances" : "Replier"}
            </Link>
          </div>
        </div>

        {/*
          L'avancement devient un filet de 2 px collé au bas de l'en-tête —
          même grammaire que le filet du minuteur au Bureau. La barre de 6 px
          arrondie, posée en pleine largeur sous le titre, pesait autant que le
          titre lui-même pour une information qu'on ne consulte pas : on la
          remarque quand elle bouge, pas quand on lit.
        */}
        <div
          className="h-0.5 w-full bg-surface-3"
          role="progressbar"
          aria-valuenow={avancement.total > 0 ? Math.round((traites / avancement.total) * 100) : 0}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${traites} activités traitées sur ${avancement.total}`}
        >
          <div
            className="h-full bg-primaire transition-[width] duration-500"
            style={{ width: `${avancement.total > 0 ? Math.round((traites / avancement.total) * 100) : 0}%` }}
          />
        </div>
      </header>
      {/*
        La colonne de lecture, la même qu'au Bureau (`--colonne`, 704 px).
        `max-w-7xl` laissait l'énoncé courir sur près de mille pixels : au-delà
        d'une certaine longueur de ligne, l'œil perd le début de la suivante —
        et c'est ici qu'on lit le plus longtemps de toute l'application.
      */}
      <main className={`px-4 py-6 sm:px-6 ${plein ? `mx-auto ${colonnePlein}` : ""}`}>
        {statut === "planifiee" && (
          <div className="mx-auto max-w-3xl space-y-5">
            <Carte accent>
              <EnTeteCarte
                titre={preparationEnAttente ? "Séance planifiée" : "Séance prête"}
                legende={seance.planifieePour ? `Prévue le ${formatDateCourte(seance.planifieePour)}` : undefined}
              />
              <div className="space-y-4 px-5 py-4">
                {seance.besoinDeclare?.intention && <p className="text-sm italic">« {seance.besoinDeclare.intention} »</p>}
                <p className="text-sm text-texte-attenue">
                  {preparationEnAttente ? (
                    <>
                      {activites.length > 0 && `${activites.length} exercice${activites.length > 1 ? "s" : ""} déjà là, `}
                      {Math.max((seance.blueprint?.nombreExercices ?? 0) - activites.length, 0)} à générer par le tuteur au démarrage
                    </>
                  ) : (
                    <>
                      {activites.length} exercice{activites.length > 1 ? "s" : ""}
                    </>
                  )}
                  {seance.blueprint ? ` · environ ${formatDuree(seance.blueprint.dureeCibleMin)}` : ""}
                </p>
                <div className="flex flex-wrap gap-2">
                  {preparationEnAttente ? (
                    <ActionPreparerSeance
                      seanceId={seance.id}
                      compteId={ctx.donnees.user.id}
                      instantanee={preparationInstantaneeSeance(seance)}
                    />
                  ) : (
                    <ActionSeance action={demarrerSeance} seanceId={seance.id} libelle="Démarrer" />
                  )}
                  <ActionSeance action={annulerSeance} seanceId={seance.id} libelle="Annuler" variante="danger" />
                </div>
              </div>
            </Carte>
            <ListeActivites activites={activites} parId={parId} avancement={avancement} seanceId={seance.id} liens={false} />
          </div>
        )}

        {statut === "en-cours" && (
          <div className="space-y-5">
            {exerciceActif ? (
              <VueExercice
                params={Promise.resolve({ id: exerciceActif })}
                searchParams={Promise.resolve(recherche ?? {})}
                navigation={{ seanceId: seance.id, plein }}
                integree
                etatInitialTuteurFourni={etatTuteur ?? undefined}
                activiteSuivanteId={suivant}
                seancePeutTerminer={peutTerminer}
              />
            ) : (
              <div className="mx-auto max-w-2xl">
                <FocusActe cle={`seance-prete-a-conclure-${seance.id}-${traites}`} cible="titre-seance-a-conclure" />
                <Carte accent>
                  <div className="px-5 py-8 text-center">
                    <h2 id="titre-seance-a-conclure" tabIndex={-1} className="font-serif text-xl font-medium outline-none">Toutes les activités sont traitées</h2>
                    <p className="mt-2 text-sm text-texte-attenue">Elle reste ouverte tant que vous ne la clôturez pas.</p>
                    {peutTerminer && (
                      <div className="mt-4">
                        <ActionSeance action={terminerSeance} seanceId={seance.id} libelle="Terminer la séance" />
                      </div>
                    )}
                  </div>
                </Carte>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-3 border-t border-bordure pt-5">
              {peutTerminer && exerciceActif && (
                <ActionSeance action={terminerSeance} seanceId={seance.id} libelle="Terminer la séance" />
              )}
              {/*
                La porte de sortie d'une séance qu'on ne veut pas mener. Elle
                n'efface rien : les exercices déjà menés gardent leurs observations,
                et la séance reste relisible. Sans elle, une séance ouverte au
                mauvais moment restait ouverte indéfiniment.
              */}
              <ActionSeance
                action={abandonnerSeance}
                seanceId={seance.id}
                libelle="Abandonner la séance"
                variante="secondaire"
                taille="petite"
              />
            </div>
          </div>
        )}

        {close && (
          <div className="mx-auto max-w-3xl space-y-5">
            <FocusActe cle={`seance-terminee-${seance.id}`} cible="titre-seance-terminee" />
            {explicite ? (
              <>
                <div>
                  <Link href={`/seances?session=${encodeURIComponent(seance.id)}`} className={classesLienBouton("secondaire", "petite")}>
                    Retour au déroulé de la séance
                  </Link>
                </div>
                {impactExplicite && (
                  <CarteImpact
                    impact={impactExplicite}
                    actions={
                      <LienApresImpact
                        href={`/seances?session=${encodeURIComponent(seance.id)}`}
                        libelle="Revenir à la séance"
                      />
                    }
                  />
                )}
                <ResumeExerciceCahier
                  exercice={parId.get(explicite)!}
                  tentative={tentativeDeSeance(seance, explicite, ctx.donnees.attempts)}
                />
              </>
            ) : (
              <>
                {/*
                  L'impact cumulé n'est présenté qu'à la clôture normale. Sur
                  une séance abandonnée, il enroberait le travail dans un bilan
                  de séance « réussie » que personne n'a validé — les observations
                  des exercices menés existent, elles se lisent exercice par
                  exercice ci-dessous.
                */}
                {statut === "terminee" && impactSeance && impactSeance.renforcees.length > 0 ? (
                  <div id="titre-seance-terminee" tabIndex={-1} className="outline-none">
                    <CarteImpact
                      titre="Ce que cette séance vient d'ajouter"
                      impact={{
                        travail: {
                          titre: `Séance du ${formatDateCourte(seance.date)}`,
                          dureeMin: seance.dureeMin ?? impactSeance.dureeMin,
                          difficulte: 0,
                          resultat: "reussi",
                          indicesUtilises: 0,
                        },
                        renforcees: impactSeance.renforcees,
                        observations: impactSeance.observations,
                        consequences: impactSeance.consequences,
                        aRetravailler: [],
                      }}
                      actions={<LienApresImpact href="/app" libelle="Prochaine action recommandée" />}
                    />
                  </div>
                ) : (
                  <Carte accent>
                    <EnTeteCarte
                      id="titre-seance-terminee"
                      titre={statut === "abandonnee" ? "Séance abandonnée" : "Séance terminée"}
                      legende={`Séance du ${formatDateCourte(seance.date)}`}
                    />
                    <div className="space-y-2 px-5 py-4 text-sm">
                      <p>{seance.resultat ?? `${avancement.menes.length} exercice(s) mené(s)`}</p>
                      {typeof seance.dureeMin === "number" && <p className="text-texte-attenue">Durée observée : {formatDuree(seance.dureeMin)}</p>}
                      {statut === "abandonnee" && (
                        <p className="text-texte-attenue">
                          Ce qui a été mené garde ses observations : un abandon ne retire rien.
                        </p>
                      )}
                      {reprenable && (
                        <div className="pt-1">
                          <ActionSeance
                            action={reprendreSeance}
                            seanceId={seance.id}
                            libelle="Reprendre là où j’en étais →"
                            taille="petite"
                          />
                        </div>
                      )}
                    </div>
                  </Carte>
                )}
                <div className="space-y-4">
                  {activites.map((activite) => {
                    const exercice = parId.get(activite.ref)!;
                    return (
                      <ResumeExerciceCahier
                        key={activite.ref}
                        exercice={exercice}
                        tentative={tentativeDeSeance(seance, activite.ref, ctx.donnees.attempts)}
                      />
                    );
                  })}
                </div>
                {ecart && (
                  <Carte>
                    <EnTeteCarte titre="Besoin et réalisé" />
                    <div className="space-y-2 px-5 py-4">{ecart.constats.map((constat) => <p key={constat} className="text-xs text-texte-attenue">{constat}</p>)}</div>
                  </Carte>
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function ListeActivites({
  activites,
  parId,
  avancement,
  seanceId,
  plein = false,
  compacte = false,
  liens = true,
}: {
  activites: { type: string; ref: string; libelle: string }[];
  parId: Map<string, { competences: string[]; difficulte: number; dureeEstimeeMin: number }>;
  avancement: ReturnType<typeof avancementSeance>;
  seanceId: string;
  plein?: boolean;
  compacte?: boolean;
  liens?: boolean;
}) {
  if (activites.length === 0) return <EtatVide titre="Aucune activité" message="Cette séance ne contient aucun exercice disponible." />;
  const contenu = (
    <ul className="divide-y divide-bordure">
      {activites.map((activite) => {
        const exercice = parId.get(activite.ref);
        const etat = avancement.menes.includes(activite.ref) ? "Mené" : avancement.enCours.includes(activite.ref) ? "En cours" : avancement.abandonnes.includes(activite.ref) ? "Abandonné" : "À faire";
        return (
          <li key={activite.ref} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              {liens ? <Link href={urlExercice(activite.ref, { seanceId, plein })} className="text-sm font-medium text-primaire hover:underline">{activite.libelle}</Link> : <p className="text-sm font-medium">{activite.libelle}</p>}
              {exercice && !compacte && <div className="mt-1 flex flex-wrap gap-1.5 text-[0.6875rem] text-texte-discret">{exercice.competences.map((code) => <CodeCompetence key={code} code={code} />)}<span>· Difficulté {exercice.difficulte}/5</span><span>· ≈ {formatDuree(exercice.dureeEstimeeMin)}</span></div>}
            </div>
            <Etiquette ton={etat === "Mené" ? "succes" : etat === "En cours" ? "primaire" : etat === "Abandonné" ? "danger" : undefined}>{etat}</Etiquette>
          </li>
        );
      })}
    </ul>
  );
  return compacte ? contenu : <Carte><EnTeteCarte titre="Exercices" />{contenu}</Carte>;
}
