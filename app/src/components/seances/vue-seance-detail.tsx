import Link from "next/link";
import { notFound } from "next/navigation";
import { chargerContexte } from "@/lib/store/context";
import { demarrerSeance, terminerSeance, annulerSeance } from "@/lib/store/seance-actions";
import { avancementSeance, ecartBesoinRealise, statutSeance, tentativeDeSeance } from "@/lib/domain/seance";
import { urlExercice } from "@/lib/domain/navigation-exercice";
import { formatDateCourte, formatDuree } from "@/lib/engine/dates";
import { Bouton, Carte, CodeCompetence, EnTeteCarte, Etiquette, EtatVide, classesLienBouton } from "@/components/ui/primitives";
import { Pomodoro } from "@/components/dashboard/pomodoro";
import { OutilSeance } from "@/components/seances/outil-seance";
import { FocusActe } from "@/components/exercices/focus-acte";
import { TiroirTuteur } from "@/components/tuteur/tiroir-tuteur";
import { construireEtatInitialTuteur } from "@/lib/tutor/etat-initial";
import { calibragesPourModale, competencesPourModale } from "@/components/exercices/proprietes-generation";
import { VueExercice } from "@/components/exercices/vue-exercice";
import { ResumeExerciceCahier } from "@/components/seances/resume-exercice-cahier";

type EtapeRecherche = {
  correction?: string;
  evaluer?: string;
  bilan?: string;
  abandon?: string;
};

const LIBELLES_STATUT = {
  planifiee: { texte: "Planifiée", ton: "info" as const },
  "en-cours": { texte: "En cours", ton: "primaire" as const },
  terminee: { texte: "Terminée", ton: "succes" as const },
};

export async function VueSeanceDetail({
  id,
  exerciceDemande,
  recherche,
}: {
  id: string;
  exerciceDemande?: string;
  recherche?: EtapeRecherche;
}) {
  const ctx = await chargerContexte();
  const seance = ctx.donnees.sessions.find((candidate) => candidate.id === id);
  if (!seance) notFound();

  const statut = statutSeance(seance);
  const avancement = avancementSeance(seance, ctx.donnees.attempts);
  const parId = new Map(ctx.donnees.exercises.map((item) => [item.id, item]));
  const activites = seance.activites.filter(
    (activite) => activite.type === "exercice" && parId.has(activite.ref),
  );
  const ids = activites.map((activite) => activite.ref);
  const demandeDansSeance = exerciceDemande && ids.includes(exerciceDemande) ? exerciceDemande : undefined;
  const explicite = statut === "terminee"
    ? demandeDansSeance
    : demandeDansSeance &&
        (avancement.enCours.includes(demandeDansSeance) || avancement.restants.includes(demandeDansSeance))
      ? demandeDansSeance
      : undefined;
  const exerciceActif =
    explicite ?? avancement.enCours.find((ref) => ids.includes(ref)) ??
    avancement.restants.find((ref) => ids.includes(ref));
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

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-surface">
      <header className="sticky top-0 z-20 border-b border-bordure bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <p className="text-[0.6875rem] uppercase tracking-wider text-texte-discret">Workspace séance</p>
            <div className="mt-0.5 flex items-center gap-2">
              <h1 className="truncate font-serif text-lg font-medium">Concentration</h1>
              <Etiquette ton={LIBELLES_STATUT[statut].ton}>{LIBELLES_STATUT[statut].texte}</Etiquette>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-texte-attenue">{traites} / {avancement.total} traité{traites > 1 ? "s" : ""}</span>
            <Link href="/seances" className={classesLienBouton("secondaire", "petite")}>
              Sortir vers le cahier
            </Link>
          </div>
          <div className="h-1.5 basis-full overflow-hidden rounded-full bg-surface-3" aria-label={`${traites} activités traitées sur ${avancement.total}`}>
            <div
              className="h-full rounded-full bg-primaire transition-[width]"
              style={{ width: `${avancement.total > 0 ? Math.round((traites / avancement.total) * 100) : 0}%` }}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
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
                  <form action={demarrerSeance.bind(null, seance.id)}><Bouton type="submit" variante="principal">Démarrer</Bouton></form>
                  <form action={annulerSeance.bind(null, seance.id)}><Bouton type="submit" variante="danger">Annuler</Bouton></form>
                </div>
              </div>
            </Carte>
            <ListeActivites activites={activites} parId={parId} avancement={avancement} seanceId={seance.id} liens={false} />
          </div>
        )}

        {statut === "en-cours" && (
          <div className="space-y-5">
            <nav
              aria-label="Outils de séance"
              className="sticky top-2 z-20 mx-auto flex w-fit max-w-full flex-wrap items-center justify-center gap-1 rounded-xl border border-bordure bg-surface/95 p-1 shadow-sm backdrop-blur"
            >
              <OutilSeance
                libelle="Exercices"
                contenuClassName="fixed left-4 right-4 top-28 z-10 mt-2 rounded-lg border border-bordure bg-surface p-3 shadow-xl sm:absolute sm:left-1/2 sm:right-auto sm:top-auto sm:w-[min(34rem,calc(100vw-2rem))] sm:-translate-x-1/2"
              >
                <ListeActivites activites={activites} parId={parId} avancement={avancement} seanceId={seance.id} compacte />
              </OutilSeance>
              <OutilSeance
                libelle="Pomodoro"
                contenuClassName="fixed left-4 right-4 top-28 z-10 mt-2 shadow-xl sm:absolute sm:left-1/2 sm:right-auto sm:top-auto sm:w-[min(24rem,calc(100vw-2rem))] sm:-translate-x-1/2"
              >
                <Pomodoro compteId={ctx.donnees.user.id} />
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
                />
              )}
            </nav>

            {(recherche?.bilan === "1" || recherche?.abandon === "1") && suivant && (
              <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-lg border border-primaire/30 bg-primaire-faible px-4 py-3 shadow-xs">
                <div>
                  <p className="text-sm font-semibold text-primaire">Activité validée !</p>
                  <p className="text-xs text-texte-attenue">La prochaine activité de ta séance est prête.</p>
                </div>
                <Link href={urlExercice(suivant, { seanceId: seance.id })} className={classesLienBouton("principal", "petite")}>
                  Passer à l’activité suivante →
                </Link>
              </div>
            )}

            {(recherche?.bilan === "1" || recherche?.abandon === "1") && !suivant && peutTerminer && (
              <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-lg border border-succes/30 bg-succes-faible px-4 py-3 shadow-xs">
                <div>
                  <p className="text-sm font-semibold text-succes">Toutes les activités sont terminées !</p>
                  <p className="text-xs text-texte-attenue">Tu peux maintenant clôturer cette séance et enregistrer ton bilan global.</p>
                </div>
                <form action={terminerSeance.bind(null, seance.id)}>
                  <Bouton type="submit" variante="principal" taille="petite">
                    Terminer la séance →
                  </Bouton>
                </form>
              </div>
            )}

            {exerciceActif ? (
              <VueExercice
                params={Promise.resolve({ id: exerciceActif })}
                searchParams={Promise.resolve(recherche ?? {})}
                navigation={{ seanceId: seance.id }}
                integree
                etatInitialTuteurFourni={etatTuteur ?? undefined}
              />
            ) : (
              <div className="mx-auto max-w-2xl">
                <FocusActe cle={`seance-prete-a-conclure-${seance.id}-${traites}`} cible="titre-seance-a-conclure" />
                <Carte accent>
                  <div className="px-5 py-8 text-center">
                    <h2 id="titre-seance-a-conclure" tabIndex={-1} className="font-serif text-xl font-medium outline-none">Toutes les activités sont traitées</h2>
                    <p className="mt-2 text-sm text-texte-attenue">La séance reste ouverte tant que tu ne la termines pas explicitement.</p>
                    {peutTerminer && (
                      <form action={terminerSeance.bind(null, seance.id)} className="mt-4">
                        <Bouton type="submit" variante="principal">Terminer la séance</Bouton>
                      </form>
                    )}
                  </div>
                </Carte>
              </div>
            )}

            {peutTerminer && exerciceActif && (
              <div className="flex justify-center border-t border-bordure pt-5">
                <form action={terminerSeance.bind(null, seance.id)}>
                  <Bouton type="submit" variante="principal">Terminer la séance</Bouton>
                </form>
              </div>
            )}
          </div>
        )}

        {statut === "terminee" && (
          <div className="mx-auto max-w-3xl space-y-5">
            <FocusActe cle={`seance-terminee-${seance.id}`} cible="titre-seance-terminee" />
            {explicite ? (
              <>
                <div>
                  <Link href={`/seances?session=${encodeURIComponent(seance.id)}`} className={classesLienBouton("secondaire", "petite")}>
                    Retour au déroulé de la séance
                  </Link>
                </div>
                <ResumeExerciceCahier
                  exercice={parId.get(explicite)!}
                  tentative={tentativeDeSeance(seance, explicite, ctx.donnees.attempts)}
                />
              </>
            ) : (
              <>
                <Carte accent>
                  <EnTeteCarte id="titre-seance-terminee" titre="Séance terminée" legende={`Séance du ${formatDateCourte(seance.date)}`} />
                  <div className="space-y-2 px-5 py-4 text-sm">
                    <p>{seance.resultat ?? `${avancement.menes.length} exercice(s) mené(s)`}</p>
                    {typeof seance.dureeMin === "number" && <p className="text-texte-attenue">Durée observée : {formatDuree(seance.dureeMin)}</p>}
                  </div>
                </Carte>
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
  compacte = false,
  liens = true,
}: {
  activites: { type: string; ref: string; libelle: string }[];
  parId: Map<string, { competences: string[]; difficulte: number; dureeEstimeeMin: number }>;
  avancement: ReturnType<typeof avancementSeance>;
  seanceId: string;
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
              {liens ? <Link href={urlExercice(activite.ref, { seanceId })} className="text-sm font-medium text-primaire hover:underline">{activite.libelle}</Link> : <p className="text-sm font-medium">{activite.libelle}</p>}
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
