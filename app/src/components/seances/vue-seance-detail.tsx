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
  avancementSeance,
  ecartBesoinRealise,
  peutReprendreSeance,
  statutSeance,
  tentativeDeSeance,
} from "@/lib/domain/seance";
import { jourDeLaSeance } from "@/lib/domain/pages-cahier";
import { urlExercice } from "@/lib/domain/navigation-exercice";
import { formatDateCourte, formatDuree } from "@/lib/engine/dates";
import { Carte, CodeCompetence, EnTeteCarte, Etiquette, EtatVide, classesLienBouton } from "@/components/ui/primitives";
import { ActionSeance } from "@/components/seances/action-seance";
import { Pomodoro } from "@/components/seances/pomodoro";
import { OutilSeance } from "@/components/seances/outil-seance";
import { MargeCahier } from "@/components/seances/marge-cahier";
import { lireMarge } from "@/lib/store/marge";
import { FocusActe } from "@/components/exercices/focus-acte";
import { TiroirTuteur } from "@/components/tuteur/tiroir-tuteur";
import { construireEtatInitialTuteur } from "@/lib/tutor/etat-initial";
import { calibragesPourModale, competencesPourModale } from "@/components/exercices/proprietes-generation";
import { VueExercice } from "@/components/exercices/vue-exercice";
import { ResumeExerciceCahier } from "@/components/seances/resume-exercice-cahier";
import { CarteImpact, LienApresImpact } from "@/components/exercices/carte-impact";
import { impactCumule, impactTentative } from "@/lib/engine/impact";

export type EtapeRecherche = {
  correction?: string;
  evaluer?: string;
  bilan?: string;
  abandon?: string;
};

/*
  Les panneaux des intercalaires.
  ------------------------------------------------------------------
  Sur mobile, un panneau flottant ancré à sa languette sortirait de
  l'écran : il devient une nappe `fixed`, large de la fenêtre. Au-delà,
  il s'ancre à sa languette — et l'ancrage suit l'alignement des
  languettes elles-mêmes :

   - **sur la page du cahier**, elles commencent à gauche (les onglets
     d'un séparateur) : le panneau s'ouvre donc à partir du bord gauche.
     Le centrer sur une languette de gauche le faisait déborder du cadre,
     que `overflow-hidden` coupait net ;
   - **en plein écran**, elles sont centrées comme le reste du bandeau :
     le panneau l'est aussi.

  ⚠️ Les quatre variantes sont écrites en toutes lettres : Tailwind lit
  les classes dans la source, une chaîne assemblée à l'exécution ne
  produirait aucun style.
*/
const CLASSES_PANNEAU_BASE =
  "fixed left-4 right-4 top-28 z-30 mt-2 shadow-xl sm:absolute sm:right-auto sm:top-auto";
const CLASSES_PANNEAU_CADRE = "rounded-lg border border-bordure bg-surface p-3";

const PANNEAU_LARGE_GAUCHE = "sm:left-0 sm:translate-x-0 sm:w-[min(34rem,calc(100vw-6rem))]";
const PANNEAU_LARGE_CENTRE = "sm:left-1/2 sm:-translate-x-1/2 sm:w-[min(34rem,calc(100vw-2rem))]";
const PANNEAU_ETROIT_GAUCHE = "sm:left-0 sm:translate-x-0 sm:w-[min(24rem,calc(100vw-6rem))]";
const PANNEAU_ETROIT_CENTRE = "sm:left-1/2 sm:-translate-x-1/2 sm:w-[min(24rem,calc(100vw-2rem))]";

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
  plein = true,
}: {
  id: string;
  exerciceDemande?: string;
  recherche?: EtapeRecherche;
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

  const jourDeLaPage = jourDeLaSeance(seance);
  const urlSeance = `/seances?session=${encodeURIComponent(seance.id)}`;

  // Les languettes suivent le bandeau : à gauche sur la page, centrées en
  // plein écran — et leurs panneaux s'ancrent du même côté.
  const panneauLarge = `${CLASSES_PANNEAU_BASE} ${CLASSES_PANNEAU_CADRE} ${plein ? PANNEAU_LARGE_CENTRE : PANNEAU_LARGE_GAUCHE}`;
  const panneauMinuteur = `${CLASSES_PANNEAU_BASE} ${plein ? PANNEAU_ETROIT_CENTRE : PANNEAU_ETROIT_GAUCHE}`;

  return (
    <div
      className={
        plein
          ? "fixed inset-0 z-50 overflow-y-auto bg-surface"
          : "overflow-hidden rounded-lg border border-bordure bg-surface"
      }
    >
      <header
        className={
          plein
            ? "sticky top-0 z-20 border-b border-bordure bg-surface/95 backdrop-blur"
            : "border-b border-bordure bg-surface-2/30"
        }
      >
        <div className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 ${plein ? "mx-auto max-w-7xl" : ""}`}>
          <div className="min-w-0">
            <p className="text-[0.6875rem] uppercase tracking-wider text-texte-discret">
              {plein ? "Concentration" : "Séance de cette page"}
            </p>
            <div className="mt-0.5 flex items-center gap-2">
              <h1 className="truncate font-serif text-lg font-medium">
                {seance.besoinDeclare?.intention || "Séance"}
              </h1>
              <Etiquette ton={LIBELLES_STATUT[statut].ton}>{LIBELLES_STATUT[statut].texte}</Etiquette>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-texte-attenue">{traites} / {avancement.total} traité{traites > 1 ? "s" : ""}</span>
            {/*
              Le plein écran est un mode, pas une destination : on y entre et on
              en sort sans quitter la séance, et l'URL le dit (`focus=1`).
            */}
            {plein ? (
              <Link href={urlSeance} className={classesLienBouton("secondaire", "petite")}>
                Quitter le plein écran
              </Link>
            ) : (
              <Link href={`${urlSeance}&focus=1`} className={classesLienBouton("secondaire", "petite")}>
                Plein écran
              </Link>
            )}
            <Link
              href={`/seances?jour=${encodeURIComponent(jourDeLaPage)}`}
              className={classesLienBouton("secondaire", "petite")}
            >
              {plein ? "Sortir vers le cahier" : "Replier"}
            </Link>
          </div>
          <div className="h-1.5 basis-full overflow-hidden rounded-full bg-surface-3" aria-label={`${traites} activités traitées sur ${avancement.total}`}>
            <div
              className="h-full rounded-full bg-primaire transition-[width]"
              style={{ width: `${avancement.total > 0 ? Math.round((traites / avancement.total) * 100) : 0}%` }}
            />
          </div>
        </div>
        {statut === "en-cours" && (
          /*
            Les outils de la séance sont les intercalaires du cahier : des
            languettes posées sur la ligne, alignées à gauche comme les onglets
            d'un séparateur. Ils étaient une barre de pastilles centrée et
            flottante — le vocabulaire d'une application posée sur la page, pas
            celui de l'objet qui la porte.
          */
          <div className={`px-4 sm:px-6 ${plein ? "mx-auto w-full max-w-7xl" : ""}`}>
            <nav
              aria-label="Outils de séance"
              className={`flex max-w-full flex-wrap items-end gap-0.5 border-b border-bordure ${
                plein ? "justify-center" : ""
              }`}
            >
              <OutilSeance
                variante="intercalaire"
                libelle="Exercices"
                contenuClassName={panneauLarge}
              >
                <ListeActivites activites={activites} parId={parId} avancement={avancement} seanceId={seance.id} plein={plein} compacte />
              </OutilSeance>
              <OutilSeance
                variante="intercalaire"
                libelle="Pomodoro"
                contenuClassName={panneauMinuteur}
              >
                <Pomodoro compteId={ctx.donnees.user.id} />
              </OutilSeance>
              {/*
                La marge suit le travail. C'est pendant un exercice qu'on se dit
                « il faudra revoir ça » — et jusqu'ici le workspace n'offrait
                aucun endroit où l'écrire : la seule zone de saisie du cahier
                était l'annotation d'une séance déjà terminée.
              */}
              <OutilSeance
                variante="intercalaire"
                libelle="Marge"
                contenuClassName={panneauLarge}
              >
                <MargeCahier lignes={marge} compteId={ctx.donnees.user.id} compacte />
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
                  declencheur="intercalaire"
                />
              )}
            </nav>
          </div>
        )}
      </header>

      <main className={`px-4 py-5 sm:px-6 ${plein ? "mx-auto max-w-7xl" : ""}`}>
        {statut === "planifiee" && (
          <div className="mx-auto max-w-3xl space-y-5">
            <Carte accent>
              <EnTeteCarte titre="Séance prête" legende={seance.planifieePour ? `Prévue le ${formatDateCourte(seance.planifieePour)}` : undefined} />
              <div className="space-y-4 px-5 py-4">
                {seance.besoinDeclare?.intention && <p className="text-sm italic">« {seance.besoinDeclare.intention} »</p>}
                <p className="text-sm text-texte-attenue">
                  {activites.length} exercice{activites.length > 1 ? "s" : ""}
                  {seance.blueprint ? ` · environ ${formatDuree(seance.blueprint.dureeCibleMin)}` : ""}
                </p>
                <div className="flex flex-wrap gap-2">
                  <ActionSeance action={demarrerSeance} seanceId={seance.id} libelle="Démarrer" />
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
                      actions={<LienApresImpact href="/" libelle="Prochaine action recommandée" />}
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
