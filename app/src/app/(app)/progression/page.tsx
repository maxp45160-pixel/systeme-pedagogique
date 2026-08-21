import { Suspense } from "react";
import { chargerContexte } from "@/lib/store/context";
import { compteCourant } from "@/lib/supabase/server";
import { resoudreIdentite } from "@/lib/domain/identite";
import { SqueletteContenu } from "@/components/layout/squelette";
import { calculerActivite } from "@/lib/engine/historique";
import { resumeCarriere } from "@/lib/engine/carriere";
import { resumeCroissance } from "@/lib/engine/croissance";
import { EntetePage } from "@/components/layout/entete-page";
import { CarteEtatGlobal } from "@/components/dashboard/etat-global";
import { CarteActivite } from "@/components/dashboard/activite";
import { CarteCarriere } from "@/components/progression/carte-carriere";
import { BilanCroissanceLie } from "@/components/progression/bilan-croissance-lie";
import { Glossaire } from "@/components/ui/glossaire";
import { TitreSection } from "@/components/ui/primitives";

/**
 * La Progression : où j'en suis, ce que le travail a produit, et ce que
 * valent les mesures.
 *
 * Cette page rassemble trois lectures qui vivaient ailleurs et se cherchaient :
 * le bloc « Vue d'ensemble » du tableau de bord, le bilan de croissance qui
 * servait d'accueil à l'Atelier, et la carte de profil. Aucune n'était à sa
 * place — le tableau de bord doit dire quoi faire maintenant, l'Atelier doit
 * ouvrir sur le corpus. Toutes trois répondent à la même question : où j'en
 * suis. Elles se lisent maintenant en trois zones hiérarchisées — état
 * présent, trajectoire, détail des mesures.
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

  const intitules = Object.fromEntries(
    ctx.referentiel.skills.map((skill) => [skill.code, skill.intitule]),
  );

  return (
    <div className="space-y-10 [&>*]:min-w-0">
      {/*
        Trois zones hiérarchisées, dans l'ordre où on se les pose :

          1. **Où j'en suis maintenant** — le héros : score global, confiance,
             et les totaux de carrière qui disent depuis quand.
          2. **Trajectoire** — la continuité (grille d'activité) et ce que le
             travail récent a produit (bilan de croissance) : deux lectures du
             même mouvement, réunies sous un même titre.
          3. **Le détail des mesures** — niveau moyen, répartition, robustesse :
             la lecture analytique, pour qui veut comprendre les chiffres.

        Direction visuelle : les tokens existants, aucune couleur ni brique
        nouvelle. Une refonte « vibrante » avait été envisagée et écartée —
        ce produit n'est pas un outil de motivation (ADR-017), et l'écran doit
        porter des faits comptés, pas de l'énergie.
      */}
      <CarteCarriere
        user={ctx.donnees.user}
        identite={identite}
        carriere={carriere}
        global={ctx.global}
      />

      <section id="trajectoire" className="scroll-mt-6 space-y-4">
        <TitreSection legende="La continuité et ce que le travail récent a produit">
          Trajectoire
        </TitreSection>

        {/* Une année pleine, étalée sur toute la largeur de la carte. */}
        <CarteActivite activite={activite} now={ctx.now} semaines={52} cellule={16} />

        {/* Le bilan de croissance, repris de l'accueil de l'Atelier. */}
        <BilanCroissanceLie resume={croissance} intitules={intitules} />
      </section>

      <section id="mesures" className="scroll-mt-6 space-y-4">
        <TitreSection legende="Des repères, pas des notes">Le détail des mesures</TitreSection>
        <CarteEtatGlobal global={ctx.global} etats={ctx.etats} />
      </section>

      {/*
        Le vocabulaire du produit. Observation, niveau, autonomie, confiance,
        robustesse : cinq mots qui gouvernent tout ce qui est affiché plus haut,
        et dont c'est ici la place — au pied des mesures qu'ils définissent.
      */}
      <Glossaire />
    </div>
  );
}
