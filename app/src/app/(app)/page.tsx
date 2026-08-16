import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { chargerContexte } from "@/lib/store/context";
import { formatDuree } from "@/lib/engine/dates";
import { SqueletteContenu } from "@/components/layout/squelette";
import { calculerActivite } from "@/lib/engine/historique";
import { EntetePage } from "@/components/layout/entete-page";
import { CarteProchaineAction } from "@/components/dashboard/prochaine-action";
import { CaptureNotes } from "@/components/dashboard/capture-notes";
import { ChoixTravail } from "@/components/dashboard/choix-travail";
import { lireApercusDocuments } from "@/lib/store/documents";
import { recommanderActionsDocumentaires } from "@/lib/documents/recommandations";
import { IconeFleche } from "@/components/ui/icones";
import { BandeauInfo, Bouton, Carte, classesLienBouton } from "@/components/ui/primitives";
import { abandonnerExercice } from "@/lib/store/actions";
import { statutSeance } from "@/lib/domain/seance";
import { chargerActionProposee } from "@/lib/store/adaptive-learning";
import {
  lireContexteInstant,
  type ContexteInstant,
} from "@/lib/engine/action-unifiee";
import { DashboardTour } from "@/components/onboarding/dashboard-tour";

export default async function TableauDeBord(props: {
  searchParams: Promise<{ temps?: string; capacite?: string }>;
}) {
  const instant = lireContexteInstant(await props.searchParams);
  // La date du jour ne dépend d'aucune lecture : `ctx.now` n'est rien d'autre
  // qu'un `new Date()` posé à l'entrée de `chargerContexte`.
  const dateJour = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  return (
    <>
      {/*
        Le sous-titre ne se dédouble plus selon qu'il existe ou non des preuves :
        la variante « une seule action suffit » disait, en plus court, ce que
        l'encart d'initialisation ci-dessous dit déjà en entier. Une phrase de
        moins, aucune information perdue — et un en-tête qui n'attend plus la
        lecture des preuves pour s'afficher.
      */}
      <EntetePage
        titre="Tableau de bord"
        surtitre={dateJour}
        sousTitre="Ta prochaine action — le reste suit, en retrait."
      />

      <Suspense fallback={<SqueletteContenu />}>
        <ContenuTableauDeBord instant={instant} />
      </Suspense>
    </>
  );
}

/**
 * Le bandeau ne parle plus que d'exercices : depuis le retrait des autres
 * familles (ADR-070), c'est le seul travail qui puisse rester ouvert.
 */
function titreExercicesEnCours(exercices: number): string {
  return exercices === 1 ? "Tu as un exercice en cours" : `Tu as ${exercices} exercices en cours`;
}

async function ContenuTableauDeBord({ instant }: { instant: ContexteInstant }) {
  const ctx = await chargerContexte();

  // Compte neuf : il n'y a rien à mettre sur ce tableau de bord, et une grille
  // de tirets ne dit pas quoi faire. On envoie construire le référentiel — la
  // seule action possible tant qu'il n'existe pas (ADR-026).
  //
  // La redirection vit ici, pas dans le layout : les autres écrans ont chacun
  // un état vide qui dit ce qui manque, et forcer un passage obligatoire les
  // rendrait inaccessibles à quelqu'un qui veut simplement regarder.
  if (ctx.referentiel.skills.length === 0) {
    redirect("/demarrer");
  }

  /*
    L'arbitrage à l'instant T (ADR-066) n'a pas d'écran à lui : il alimente la
    carte d'action déjà en place. En mode `legacy`, il ne lit aucune table
    adaptative — seulement les exercices et les tentatives qui existent déjà.

    Les travaux ouverts d'une autre famille rejoignent le bandeau « en cours »
    plus bas, au lieu d'un second bandeau qui dirait la même chose ailleurs.

    Les aperçus documentaires sont relus ici : ils alimentent les pistes de
    `CaptureNotes`, dont le dépôt de ressource est revenu sur cet écran.
  */
  const [action, aperçusDocuments] = await Promise.all([
    chargerActionProposee(ctx, instant),
    lireApercusDocuments(),
  ]);
  const recommandationsDocumentaires = recommanderActionsDocumentaires(aperçusDocuments);

  /*
    Les deux priorités que `ChoixTravail` propose comme cibles.

    Mêmes recommandations que la carte d'action juste au-dessus — c'est
    volontaire : le bouton propose de travailler ce que le moteur recommande,
    et « autre sujet » reste ouvert à côté.
  */
  const recommandationsTravail = (
    action?.kind === "exercice" ? action.recommandations : ctx.recommandations
  )
    .slice(0, 2)
    .map((recommandation) => ({
      code: recommandation.etat.skill.code,
      intitule: recommandation.etat.skill.intitule,
      domaineId: recommandation.etat.skill.domaine,
      domaineNom:
        ctx.referentiel.domainesParId.get(recommandation.etat.skill.domaine)?.nom ??
        recommandation.etat.skill.domaine,
      raison: recommandation.raison,
    }));

  // `dureesEstimees`, et non `donnees.exercises` : le plafond du temps retenu
  // pour un abandon doit connaître aussi les diagnostics et les exercices sortis
  // du périmètre, que la liste filtrée n'expose pas (ADR-071).
  const activite = calculerActivite(
    ctx.donnees.sessions,
    ctx.now,
    ctx.donnees.attempts,
    ctx.dureesEstimees,
  );
  const aucunePreuve = ctx.global.nombrePreuves === 0;

  /*
   * TOUTES les séances ouvertes, et non la première trouvée : plusieurs peuvent
   * l'être depuis le 16/08/2026. N'en retenir qu'une ferait remonter les
   * exercices des autres dans le bandeau « travail entamé » ci-dessous, comme
   * s'ils traînaient hors séance — alors qu'ils sont exactement là où on les a
   * laissés.
   */
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

  // Tentatives ouvertes, résolues contre le corpus. Un exercice archivé ou
  // supprimé entre-temps ne doit pas produire une ligne sans titre.
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

  return (
    <div className="space-y-6">
      {/*
        Au démarrage, l'écran est volontairement vide (protocole anti-hallucination).
        La note est resserrée à une ligne et renvoie directement à l'action.
      */}
      {aucunePreuve && (
        <BandeauInfo>
          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-info" aria-hidden />
          <p className="text-texte-attenue">
            <strong className="font-medium text-info">Système en cours d&apos;initialisation.</strong>{" "}
            Aucun niveau ne s&apos;affiche tant qu&apos;un diagnostic n&apos;a pas eu lieu — commence par
            l&apos;action ci-dessous.
          </p>
        </BandeauInfo>
      )}

      {/*
        Un exercice ouvert se signale.

        Le statut d'une tentative est dérivé à chaque rendu et n'était lu nulle
        part hors de la liste d'exercices : deux tentatives « en cours »
        pouvaient traîner en base sans qu'aucun écran ne le dise, et
        `CarteProchaineAction` affichait « Commencer » sans consulter
        `attempts`. Reprendre un travail entamé demandait de se souvenir soi-même
        qu'il existait, puis d'aller le chercher au filtre.

        Placé AVANT l'action prioritaire : ce qui est déjà commencé passe avant
        ce qu'il faudrait commencer.
      */}
      {enCours.length > 0 && (
        <BandeauInfo ton="primaire">
          <div className="min-w-0" data-testid="travaux-en-cours">
            <p className="text-sm font-medium">{titreExercicesEnCours(enCours.length)}</p>
            <ul className="mt-2.5 space-y-2">
              {enCours.map(({ id, exercice, depuis }) => (
                <li
                  key={exercice.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primaire/20 bg-surface/80 px-3 py-2 text-xs shadow-xs"
                >
                  <div className="flex flex-wrap items-baseline gap-2 min-w-0">
                    <Link
                      href={`/exercices/${exercice.id}`}
                      className="font-semibold text-primaire hover:underline"
                    >
                      {exercice.titre}
                    </Link>
                    <span className="text-texte-discret">
                      commencé il y a {formatDuree(depuis)} · {exercice.competences.join(", ")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      href={`/exercices/${exercice.id}`}
                      className={`${classesLienBouton("principal")} !py-1 !px-2.5 !text-xs`}
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

      {/* Une séance entamée passe avant toute nouvelle recommandation. */}
      <div className="[&>*]:min-w-0">
        {seanceActive ? (
          <Carte accent className="relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-1 bg-primaire" aria-hidden />
            <div className="px-5 py-5 sm:px-6" data-tour="action-prioritaire">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-primaire">Action prioritaire</p>
              <h2 className="mt-2 font-serif text-2xl font-medium">
                {seancesActives.length > 1 ? "Reprendre la dernière séance" : "Reprendre la séance"}
              </h2>
              <p className="mt-2 text-sm text-texte-attenue">Retrouve l&apos;exercice, le minuteur et le tuteur dans le workspace, sans changer de contexte.</p>
              {/*
                Plusieurs séances peuvent être ouvertes. Le tableau de bord en
                désigne une — la plus récemment commencée — et le dit, plutôt
                que de laisser croire qu'il n'y en a qu'une. Les autres se
                retrouvent dans la file du cahier.
              */}
              {seancesActives.length > 1 && (
                <p className="mt-1 text-xs text-texte-discret">
                  {seancesActives.length} séances sont ouvertes.{" "}
                  <Link href="/seances" className="font-medium text-primaire hover:underline">
                    Voir la file du cahier
                  </Link>
                </p>
              )}
              <Link href={`/seances?session=${encodeURIComponent(seanceActive.id)}`} className={`${classesLienBouton("principal")} mt-4`}>
                Reprendre la séance
              </Link>
            </div>
          </Carte>
        ) : (
          <CarteProchaineAction
            recommandations={action?.kind === "exercice" ? action.recommandations : ctx.recommandations}
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

      {/*
        Les deux gestes de création dont l'objet est déjà connu, rendus
        directement — les cartes d'origine, reprises telles quelles.

        Les faire passer par le `+` obligeait à formuler en phrase un besoin
        déjà nommé, puis à attendre une traduction pour retomber sur la même
        destination. Le `+` garde ce qu'il sait faire de mieux : les besoins
        qui ne se rangent pas d'avance — projet, extension du référentiel.

        Deux intentions distinctes, deux cartes : une note support ne mesure
        rien, un travail produit des preuves.
      */}
      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <ChoixTravail
          recommandations={recommandationsTravail}
          competences={ctx.referentiel.actifs.map((skill) => ({
            code: skill.code,
            intitule: skill.intitule,
            domaine: skill.domaine,
          }))}
          domaines={ctx.referentiel.domaines.map((domaine) => ({
            id: domaine.id,
            nom: domaine.nom,
            prefixe: domaine.prefixe,
          }))}
          compteId={ctx.donnees.user.id}
        />
        <CaptureNotes recommandations={recommandationsDocumentaires} />
      </div>

      {/*
        Le reste tenait sur cet écran en six cartes de plus : capture de note,
        choix de travail, pilotage du référentiel, profil, activité, état
        global, progression récente, glossaire. Trois d'entre elles étaient des
        points d'entrée de création — elles sont maintenant derrière le `+`, qui
        demande un besoin au lieu d'un objet. Les trois lectures restantes ont
        leur propre page : elles se consultent, elles ne se pilotent pas, et les
        garder ici obligeait à défiler pour retrouver l'action prioritaire, qui
        est la seule raison d'ouvrir cet écran.
      */}
      <BandeauProgression
        preuves={ctx.global.nombrePreuves}
        competencesActives={ctx.referentiel.actifs.length}
        joursActifs30={activite.joursActifs30}
      />

      <DashboardTour autoDemarrage={aucunePreuve} />
    </div>
  );
}

/**
 * Trois chiffres et un lien — ce qui reste du bloc « Vue d'ensemble ».
 *
 * Aucune donnée n'est perdue : tout ce qui était affiché ici l'est encore, sur
 * `/progression`. Ce qui change, c'est qu'on ne le traverse plus pour arriver
 * à l'action du jour.
 */
function BandeauProgression({
  preuves,
  competencesActives,
  joursActifs30,
}: {
  preuves: number;
  competencesActives: number;
  joursActifs30: number;
}) {
  return (
    <Link
      href="/progression"
      className="group flex flex-wrap items-center justify-between gap-4 rounded-xl border border-bordure bg-surface px-5 py-4 transition-colors hover:border-primaire/35 sm:px-6"
    >
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
        <span className="text-sm">
          <span className="font-medium">{preuves}</span>{" "}
          <span className="text-texte-discret">preuve{preuves > 1 ? "s" : ""}</span>
        </span>
        <span className="text-sm">
          <span className="font-medium">{competencesActives}</span>{" "}
          <span className="text-texte-discret">
            compétence{competencesActives > 1 ? "s" : ""} active{competencesActives > 1 ? "s" : ""}
          </span>
        </span>
        <span className="text-sm">
          <span className="font-medium">{joursActifs30}</span>{" "}
          <span className="text-texte-discret">
            jour{joursActifs30 > 1 ? "s" : ""} actif{joursActifs30 > 1 ? "s" : ""} sur 30
          </span>
        </span>
      </div>
      <span className="flex items-center gap-1.5 text-xs font-medium text-primaire">
        Voir ma progression
        <IconeFleche className="size-3.5" />
      </span>
    </Link>
  );
}
