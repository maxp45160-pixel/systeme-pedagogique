import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { chargerContexte } from "@/lib/store/context";
import { chargerThemes } from "@/lib/store/themes";
import { formatDuree } from "@/lib/engine/dates";
import { SqueletteContenu } from "@/components/layout/squelette";
import { calculerActivite, evenementsRecents } from "@/lib/engine/historique";
import { EntetePage } from "@/components/layout/entete-page";
import { CarteEtatGlobal } from "@/components/dashboard/etat-global";
import { CarteProchaineAction } from "@/components/dashboard/prochaine-action";
import {
  calibragesPourModale,
} from "@/components/exercices/proprietes-generation";
import { CarteProgressionRecente } from "@/components/dashboard/progression-recente";
import { CarteActivite } from "@/components/dashboard/activite";
import { CarteProfil } from "@/components/dashboard/carte-profil";
import { CaptureNotes } from "@/components/dashboard/capture-notes";
import { PilotageReferentiel } from "@/components/dashboard/pilotage-referentiel";
import {
  ConcepteurSeance,
  type DonneesSeance,
} from "@/components/seances/concepteur-seance";
import { Depliant } from "@/components/ui/explication";
import { Glossaire } from "@/components/ui/glossaire";
import { BandeauInfo, Bouton, Carte, classesLienBouton, TitreSection } from "@/components/ui/primitives";
import { abandonnerExercice } from "@/lib/store/actions";
import { statutSeance } from "@/lib/domain/seance";

export default function TableauDeBord() {
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
        <ContenuTableauDeBord />
      </Suspense>
    </>
  );
}

async function ContenuTableauDeBord() {
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

  const themes = await chargerThemes();

  const evenements = evenementsRecents(ctx.donnees.evidence, ctx.referentiel.parCode, 6, ctx.now);
  const activite = calculerActivite(ctx.donnees.sessions, ctx.now);
  const aucunePreuve = ctx.global.nombrePreuves === 0;

  // Mêmes données que `/seances` (lot 3) : le concepteur ne recopie aucune
  // logique, il lit ce que le lot 1 a déjà dérivé.
  const donneesSeance: DonneesSeance = {
    etats: ctx.etats,
    actifs: ctx.referentiel.actifs,
    exercices: ctx.donnees.exercises,
    tentatives: ctx.donnees.attempts,
    calibrations: Array.from(ctx.calibrations.entries()),
    calibragesModale: calibragesPourModale(ctx.referentiel.actifs, ctx.calibrations),
    recommandations: ctx.recommandations,
    contexteDocumentaire: Array.from(ctx.contexteDocumentaire.entries()),
    domaines: ctx.referentiel.domaines.map((d) => ({ id: d.id, nom: d.nom, prefixe: d.prefixe })),
    themes,
    compteId: ctx.donnees.user.id,
  };

  const seanceActive = ctx.donnees.sessions.find(
    (seance) => statutSeance(seance) === "en-cours",
  );
  const exercicesDeLaSeanceActive = new Set(
    seanceActive?.activites
      .filter((activite) => activite.type === "exercice")
      .map((activite) => activite.ref) ?? [],
  );

  // Tentatives ouvertes, résolues contre le corpus. Un exercice archivé ou
  // supprimé entre-temps ne doit pas produire une ligne sans titre.
  const parId = new Map(ctx.donnees.exercises.map((e) => [e.id, e]));
  const enCours = ctx.donnees.attempts
    .filter((a) => a.statut === "en-cours" && !exercicesDeLaSeanceActive.has(a.exerciseId))
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
          <div className="min-w-0">
            <p className="text-sm font-medium">
              {enCours.length === 1
                ? "Tu as un exercice en cours"
                : `Tu as ${enCours.length} exercices en cours`}
            </p>
            <ul className="mt-2 space-y-1.5">
              {enCours.map(({ id, exercice, depuis }) => (
                <li key={exercice.id} className="flex flex-wrap items-baseline gap-2 text-xs">
                  <Link
                    href={`/exercices/${exercice.id}`}
                    className="font-medium text-primaire hover:underline"
                  >
                    {exercice.titre}
                  </Link>
                  <span className="text-texte-discret">
                    commencé il y a {formatDuree(depuis)} · {exercice.competences.join(", ")}
                  </span>
                  <form action={abandonnerExercice.bind(null, id, exercice.id, depuis, undefined)}>
                    <Bouton type="submit" variante="secondaire" taille="petite">
                      Abandonner
                    </Bouton>
                  </form>
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
            <div className="px-5 py-5 sm:px-6">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-primaire">Action prioritaire</p>
              <h2 className="mt-2 font-serif text-2xl font-medium">Reprendre la séance</h2>
              <p className="mt-2 text-sm text-texte-attenue">Retrouve l&apos;exercice, le minuteur et le tuteur dans le workspace, sans changer de contexte.</p>
              <Link href={`/seances?session=${encodeURIComponent(seanceActive.id)}`} className={`${classesLienBouton("principal")} mt-4`}>
                Reprendre la séance
              </Link>
            </div>
          </Carte>
        ) : (
          <CarteProchaineAction
            recommandations={ctx.recommandations}
            referentiel={ctx.referentiel}
            calibrages={calibragesPourModale(ctx.referentiel.actifs, ctx.calibrations)}
            now={ctx.now}
            compteId={ctx.donnees.user.id}
          />
        )}
      </div>

      <PilotageReferentiel
        referentiel={ctx.referentiel}
        compteId={ctx.donnees.user.id}
      />

      <div className="grid gap-4 lg:grid-cols-3 [&>*]:min-w-0">
        <Carte id="composer-seance" className="scroll-mt-6">
          <div className="flex h-full flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-6">
            <div>
              <p className="text-sm font-medium">Composer une séance</p>
              <p className="mt-1 text-xs text-texte-attenue">
                La recommandation ci-dessus est déjà le point de départ de la composition.
              </p>
            </div>
            <ConcepteurSeance {...donneesSeance} libelle="Composer une séance" />
          </div>
        </Carte>
        <CaptureNotes />
        <CarteProfil user={ctx.donnees.user} />
      </div>

      {/*
        Vue d'ensemble : tout le reste, en retrait derrière un titre discret.
        Aucune donnée retirée — seulement hiérarchisée, et réordonnée pour que
        le bandeau d'activité soit lisible sans défilement : l'ancienne grille
        `lg:grid-cols-3` ne servait à rien, tous ses enfants occupaient les trois
        pistes. `[&>*]:min-w-0` empêche un intitulé en `truncate` d'élargir la
        piste.
      */}
      <section>
        <TitreSection>Vue d&apos;ensemble</TitreSection>
        <div className="space-y-6 [&>*]:min-w-0">
          {/* Une année pleine, étalée sur toute la largeur de la carte. */}
          <CarteActivite activite={activite} now={ctx.now} semaines={52} cellule={16} />

          <CarteEtatGlobal global={ctx.global} etats={ctx.etats} />

          {/*
            La progression récente est une lecture de contrôle, pas une lecture
            d'entrée : elle passe au repos derrière un `<details>` natif, donc
            sans JavaScript. Rien n'est retiré.
          */}
          <Depliant resume={`Progression récente — ${evenements.length} dernière${evenements.length > 1 ? "s" : ""} preuve${evenements.length > 1 ? "s" : ""}`}>
            <CarteProgressionRecente evenements={evenements} />
          </Depliant>

          {/*
            Le vocabulaire du produit, à portée de clic depuis l'écran d'entrée
            (audit §1.5). Preuve, niveau, autonomie, confiance, robustesse : cinq
            mots qui gouvernent tout ce qui est affiché plus haut, et qu'aucun
            écran ne définissait.
          */}
          <Glossaire />
        </div>
      </section>
    </div>
  );
}
