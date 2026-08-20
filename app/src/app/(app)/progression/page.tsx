import { Suspense } from "react";
import { chargerContexte } from "@/lib/store/context";
import { compteCourant } from "@/lib/supabase/server";
import { resoudreIdentite } from "@/lib/domain/identite";
import { SqueletteContenu } from "@/components/layout/squelette";
import { calculerActivite } from "@/lib/engine/historique";
import { resumeCarriere } from "@/lib/engine/carriere";
import { resumeCroissance } from "@/lib/engine/croissance";
import { ensemblesProposes } from "@/lib/engine/ensembles";
import { EntetePage } from "@/components/layout/entete-page";
import { CarteEtatGlobal } from "@/components/dashboard/etat-global";
import { CarteActivite } from "@/components/dashboard/activite";
import { CarteCarriere } from "@/components/progression/carte-carriere";
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
 * à l'ancienneté : le seul classement du produit vient des observations, et c'est le
 * score global. Les totaux affichés comptent des faits — séances tenues,
 * exercices menés, observations enregistrées, jours actifs — sans jamais s'agréger
 * en une note parallèle qui monterait toute seule avec le temps passé.
 */
export default async function PageProgression() {
  return (
    <>
      <EntetePage
        titre="Progression"
        sousTitre="Ce que vos exercices disent de votre niveau — et ce qu'ils ne disent pas encore."
      />
      <Suspense fallback={<SqueletteContenu />}>
        <ContenuProgression />
      </Suspense>
    </>
  );
}

async function ContenuProgression() {
  const [ctx, compte] = await Promise.all([
    chargerContexte(),
    compteCourant(),
  ]);
  const themes = ctx.themes;
  const identite = resoudreIdentite(compte, ctx.donnees.user);

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
    observations: ctx.observationsEffectives,
    now: ctx.now,
  });

  const croissance = resumeCroissance({
    sessions: ctx.donnees.sessions,
    tentatives: ctx.donnees.attempts,
    observations: ctx.observationsEffectives,
    skillsParCode: ctx.referentiel.parCode,
    dureesEstimees: ctx.dureesEstimees,
    now: ctx.now,
    /*
      La fenêtre passe de 8 à 12 observations : c'est celle que tenait la carte
      « Progression récente », retirée juste en dessous. Les deux appelaient
      `evenementsRecents` sur les mêmes observations, avec le même moteur, et
      rendaient la même liste à deux endroits d'un même écran. Reprendre la
      fenêtre la plus large ne perd donc aucune ligne.
    */
    limiteEvenements: 12,
  });

  /*
    Les vues de l'Atelier ne sont plus construites ici.

    Elles servaient au niveau « Ce que tu construis », qui rendait une grille
    des domaines et une grille des thèmes — deux secondes vues de ce que la
    page classe déjà plus haut et de ce que l'Atelier tient par ailleurs. Avec
    elles disparaissent la relecture du corpus documentaire, la reconstruction
    de l'index des liens et la lecture du journal du référentiel : trois
    chargements que cet écran payait à chaque ouverture pour deux grilles qui
    n'apprenaient rien.
  */
  const ensemblesSuggeres = ensemblesProposes({
    sessions: ctx.donnees.sessions,
    exercices: ctx.donnees.exercises,
    observations: ctx.observationsEffectives,
    themes,
    referentiel: ctx.referentiel,
  }).propositions;

  const intitules = Object.fromEntries(
    ctx.referentiel.skills.map((skill) => [skill.code, skill.intitule]),
  );

  return (
    <div className="space-y-6 [&>*]:min-w-0">
      <section id="bilan" className="scroll-mt-6">
      <CarteCarriere
        user={ctx.donnees.user}
        identite={identite}
        carriere={carriere}
        global={ctx.global}
      />

      {/* Une année pleine, étalée sur toute la largeur de la carte. */}
      <CarteActivite activite={activite} now={ctx.now} semaines={52} cellule={16} />

      <CarteEtatGlobal global={ctx.global} etats={ctx.etats} />

      </section>

      {/*
        Le bilan de croissance, repris de l'accueil de l'Atelier : ce que la
        journée et la semaine ont produit, et les paliers franchis.
      */}
      <section>
        <TitreSection>Ce que le travail récent a produit</TitreSection>
        <BilanCroissanceLie
          resume={croissance}
          ensemblesSuggeres={ensemblesSuggeres}
          intitules={intitules}
        />
      </section>

      {/*
        « Dernières observations » vivait ici, sous la forme d'une seconde liste des
        mêmes événements que le niveau 2 du bilan — même source, même moteur,
        même ordre, à douze lignes contre huit. Le niveau 2 en dit davantage :
        il distingue une première mesure d'un palier franchi. C'est lui qu'on
        garde, avec la fenêtre de douze.
      */}

      {/*
        Le vocabulaire du produit. Observation, niveau, autonomie, confiance,
        robustesse : cinq mots qui gouvernent tout ce qui est affiché plus haut,
        et dont c'est ici la place — au pied des mesures qu'ils définissent.
      */}
      <Glossaire />
    </div>
  );
}
