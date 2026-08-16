import { Suspense } from "react";
import { chargerContexte } from "@/lib/store/context";
import { chargerThemes } from "@/lib/store/themes";
import { SqueletteContenu } from "@/components/layout/squelette";
import { calculerActivite, evenementsRecents } from "@/lib/engine/historique";
import { resumeCarriere } from "@/lib/engine/carriere";
import { resumeCroissance } from "@/lib/engine/croissance";
import { ensemblesProposes } from "@/lib/engine/ensembles";
import { construireVuesAtelier } from "@/lib/documents/vue-atelier";
import { reconstruireIndexDepuisApercus } from "@/lib/documents/index";
import { lireApercusDocuments } from "@/lib/store/documents";
import { lireChangementsReferentiel } from "@/lib/store/referentiel";
import { EntetePage } from "@/components/layout/entete-page";
import { CarteEtatGlobal } from "@/components/dashboard/etat-global";
import { CarteProgressionRecente } from "@/components/dashboard/progression-recente";
import { CarteActivite } from "@/components/dashboard/activite";
import { CarteCarriere, ClassementDomaines } from "@/components/progression/carte-carriere";
import { BilanCroissanceLie } from "@/components/progression/bilan-croissance-lie";
import { Glossaire } from "@/components/ui/glossaire";
import { TitreSection } from "@/components/ui/primitives";

/**
 * Le profil : ce que la pratique a totalisé, et ce qu'elle a produit récemment.
 *
 * Cette page rassemble trois lectures qui vivaient ailleurs et se cherchaient :
 * le bloc « Vue d'ensemble » du tableau de bord, le bilan de croissance qui
 * servait d'accueil à l'Atelier, et la carte de profil. Aucune n'était à sa
 * place — le tableau de bord doit dire quoi faire maintenant, l'Atelier doit
 * ouvrir sur le corpus. Toutes trois répondent à la même question : où j'en
 * suis.
 *
 * ## Ce que cette page ne fait pas
 *
 * Elle ne classe pas. Pas de niveau de profil, pas de rang, pas de titre gagné
 * à l'ancienneté : le seul classement du produit vient des preuves, et c'est le
 * score global. Les totaux affichés comptent des faits — séances tenues,
 * exercices menés, preuves enregistrées, jours actifs — sans jamais s'agréger
 * en une note parallèle qui monterait toute seule avec le temps passé.
 */
export default async function PageProgression() {
  return (
    <>
      <EntetePage
        titre="Progression"
        sousTitre="Ce que les preuves accumulées disent de ton niveau — et ce qu'elles ne disent pas encore."
      />
      <Suspense fallback={<SqueletteContenu />}>
        <ContenuProgression />
      </Suspense>
    </>
  );
}

async function ContenuProgression() {
  const [ctx, themes, aperçus, changementsReferentiel] = await Promise.all([
    chargerContexte(),
    chargerThemes(),
    lireApercusDocuments(),
    lireChangementsReferentiel(),
  ]);

  const evenements = evenementsRecents(ctx.preuvesEffectives, ctx.referentiel.parCode, 12, ctx.now);
  // `dureesEstimees`, et non `donnees.exercises` : le plafond du temps retenu
  // pour un abandon doit connaître aussi les diagnostics et les exercices sortis
  // du périmètre, que la liste filtrée n'expose pas (ADR-071).
  const activite = calculerActivite(
    ctx.donnees.sessions,
    ctx.now,
    ctx.donnees.attempts,
    ctx.dureesEstimees,
  );

  const carriere = resumeCarriere({
    sessions: ctx.donnees.sessions,
    tentatives: ctx.donnees.attempts,
    preuves: ctx.preuvesEffectives,
    now: ctx.now,
  });

  const croissance = resumeCroissance({
    sessions: ctx.donnees.sessions,
    tentatives: ctx.donnees.attempts,
    preuves: ctx.preuvesEffectives,
    skillsParCode: ctx.referentiel.parCode,
    dureesEstimees: ctx.dureesEstimees,
    now: ctx.now,
  });

  /*
   * Les vues de l'Atelier servent au niveau « Ce que je construis » du bilan :
   * il y nomme les domaines et les thèmes vers lesquels le travail converge.
   * L'index documentaire est reconstruit ici pour la même raison qu'à
   * l'Atelier — les vues en ont besoin pour rattacher les fiches.
   */
  const index = reconstruireIndexDepuisApercus(aperçus, [
    ...ctx.referentiel.skills.map((skill) => skill.code),
    ...ctx.donnees.exercises.flatMap((exercice) => [exercice.id, `exercice:${exercice.id}`]),
  ]);
  const codesAvecDependances = new Set<string>([
    ...ctx.donnees.exercises.flatMap((exercice) => exercice.competences),
    ...themes.flatMap((theme) => theme.codes),
    ...ctx.donnees.sessions.flatMap((session) => session.skillCodes),
    ...index.entrants.keys(),
  ]);
  const vues = construireVuesAtelier(
    ctx.referentiel,
    ctx.etats,
    ctx.donnees.exercises,
    ctx.donnees.attempts,
    index,
    ctx.preuvesEffectives,
    changementsReferentiel,
    codesAvecDependances,
    themes,
  );

  const ensemblesSuggeres = ensemblesProposes({
    sessions: ctx.donnees.sessions,
    exercices: ctx.donnees.exercises,
    preuves: ctx.preuvesEffectives,
    themes,
    referentiel: ctx.referentiel,
  }).propositions;

  const intitules = Object.fromEntries(
    ctx.referentiel.skills.map((skill) => [skill.code, skill.intitule]),
  );

  return (
    <div className="space-y-6 [&>*]:min-w-0">
      <CarteCarriere user={ctx.donnees.user} carriere={carriere} global={ctx.global} />

      {/* Une année pleine, étalée sur toute la largeur de la carte. */}
      <CarteActivite activite={activite} now={ctx.now} semaines={52} cellule={16} />

      <ClassementDomaines global={ctx.global} />

      <CarteEtatGlobal global={ctx.global} etats={ctx.etats} />

      {/*
        Le bilan de croissance, repris de l'accueil de l'Atelier : ce que la
        journée et la semaine ont produit, les paliers franchis, les ensembles
        que le travail dessine.
      */}
      <section>
        <TitreSection>Ce que le travail récent a produit</TitreSection>
        <BilanCroissanceLie
          resume={croissance}
          domaines={vues.domaines}
          themes={vues.themes}
          ensemblesSuggeres={ensemblesSuggeres}
          intitules={intitules}
        />
      </section>

      {/*
        La progression récente n'est plus dépliable : elle était au repos
        derrière un `<details>` parce qu'elle encombrait l'écran d'entrée. Sur
        une page qu'on ouvre pour la lire, la replier n'aurait plus de raison —
        et la fenêtre passe de 6 à 12 preuves, puisque la place existe.
      */}
      <section>
        <TitreSection>Dernières preuves</TitreSection>
        <CarteProgressionRecente evenements={evenements} />
      </section>

      {/*
        Le vocabulaire du produit. Preuve, niveau, autonomie, confiance,
        robustesse : cinq mots qui gouvernent tout ce qui est affiché plus haut,
        et dont c'est ici la place — au pied des mesures qu'ils définissent.
      */}
      <Glossaire />
    </div>
  );
}
