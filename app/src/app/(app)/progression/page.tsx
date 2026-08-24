import { Suspense } from "react";
import { redirect } from "next/navigation";
import { chargerContexte } from "@/lib/store/context";
import { compteCourant } from "@/lib/supabase/server";
import { resoudreIdentite } from "@/lib/domain/identite";
import { genererBilanMarkdown } from "@/lib/domain/export-bilan";
import { SqueletteContenu } from "@/components/layout/squelette";
import { resumeCarriere } from "@/lib/engine/carriere";
import { resumeCroissance } from "@/lib/engine/croissance";
import { evolutionScore } from "@/lib/engine/evolution";
import {
  resoudreFiltreDomaine,
} from "@/lib/engine/lecture-domaine";
import { EntetePage } from "@/components/layout/entete-page";
import { Carte, CorpsCarte, EnTeteCarte } from "@/components/ui/primitives";
import { Depliant } from "@/components/ui/explication";
import { CourbeEvolution } from "@/components/charts";
import { CarteCarriere } from "@/components/progression/carte-carriere";
import { FaitsMarquants } from "@/components/progression/faits-marquants";
import { CartePratique } from "@/components/progression/carte-pratique";
import { ComparaisonDomaines } from "@/components/progression/comparaison-domaines";
import { TopCompetences } from "@/components/progression/top-competences";
import { BilanCroissanceLie } from "@/components/progression/bilan-croissance-lie";
import { FiltreDomaines } from "@/components/progression/filtre-domaines";
import { ModaleExportBilan } from "@/components/progression/modale-export-bilan";
import { Glossaire } from "@/components/ui/glossaire";
import { libelleMesureLisible } from "@/lib/ui/mesures-lisibles";

/**
 * La Progression : le profil de carrière — ce que la pratique a totalisé,
 * ce qu'elle a changé, et ce que valent les mesures.
 *
 * C'est l'écran qu'on ouvre pour voir ce que le travail a produit, pas pour
 * décider quoi faire : le tableau de bord pilote, l'Atelier visualise et
 * travaille, ici on relit. L'ampleur visuelle (héros, faits marquants,
 * trajectoire) porte des faits comptés et des lectures dérivées d'eux ;
 * aucune mécanique inventée — pas d'XP, pas de rang sur le temps passé
 * (ADR-017), les conversions parlantes restent des fonctions des observations
 * (ADR-097).
 *
 * ## Ce que cette page ne fait plus
 *
 * Elle ne répète plus le tableau de bord. La grille d'activité annuelle et
 * la couverture du référentiel y vivaient en double — le widget Continuité
 * du bord et la synthèse du référentiel les portent déjà ; ce qui reste ici
 * est ce qu'aucun autre écran ne montre : l'évolution du score rejouée depuis
 * le journal, les faits marquants de toute la pratique, et le bilan de ce
 * que le travail récent a changé.
 *
 * ## Lecture par domaine (`?domaine=`)
 *
 * La lecture d'un seul domaine vit dans l'Atelier : la vue domaine y a un mode
 * « Progression », alimenté par le même calcul que celui qui vivait ici. Le
 * paramètre `?domaine=` redirige donc vers `/atelier?document=…&vue=progression`
 * — une seule surface pour la question « où j'en suis dans ce domaine ». Il
 * reste validé contre les domaines réels du compte : un identifiant inconnu
 * est ignoré proprement, la page retombe sur sa vue globale plutôt que de
 * rediriger vers un périmètre qui n'existe pas.
 */
export default async function PageProgression(props: {
  searchParams: Promise<{ domaine?: string }>;
}) {
  const recherche = await props.searchParams;

  return (
    <Suspense fallback={<SqueletteContenu />}>
      <ContenuProgression filtreDemande={recherche.domaine} />
    </Suspense>
  );
}

async function ContenuProgression({ filtreDemande }: { filtreDemande?: string }) {
  const [ctx, compte] = await Promise.all([
    chargerContexte(),
    compteCourant(),
  ]);
  const identite = resoudreIdentite(compte, ctx.donnees.user);

  // Validation du paramètre AVANT tout calcul : un identifiant inconnu ne
  // doit pas rediriger ni coûter une lecture — la page retombe sur sa vue
  // globale. Un identifiant valide emmène vers la surface unique de la lecture
  // par domaine : la vue domaine de l'Atelier, mode « Progression ».
  const filtre = resoudreFiltreDomaine(filtreDemande, ctx.referentiel.domaines);
  if (filtre !== null) {
    redirect(`/atelier?document=${encodeURIComponent(filtre)}&vue=progression`);
  }
  const domainesDuFiltre = ctx.referentiel.domaines
    .filter((domaine) => !domaine.archive)
    .map((domaine) => ({ id: domaine.id, nom: domaine.nom }));

  const intitules = Object.fromEntries(
    ctx.referentiel.skills.map((skill) => [skill.code, skill.intitule]),
  );

  const carriere = resumeCarriere({
    sessions: ctx.donnees.sessions,
    tentatives: ctx.donnees.attempts,
    observations: ctx.observationsEffectives,
    now: ctx.now,
  });

  const bilanMarkdown = genererBilanMarkdown({
    identite,
    dateExport: ctx.now,
    scoreGlobal: ctx.global.scoreGlobal,
    nombreCompetences: ctx.referentiel.actifs.length,
    nombreExercices: carriere.exercicesMenes,
    joursActifs: carriere.joursActifsTotal,
    etats: ctx.etats,
    skillsParCode: ctx.referentiel.parCode,
    engagements: ctx.donnees.engagements,
  });

  const dateFormatee = ctx.now.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <EntetePage
        titre="Progression"
        sousTitre="Ce que vos exercices disent de votre niveau — et ce qu'ils ne disent pas encore."
        actions={
          <ModaleExportBilan
            bilanMarkdown={bilanMarkdown}
            nomApprenant={identite?.nom}
            dateExport={dateFormatee}
          />
        }
      />
      <div className="space-y-8 [&>*]:min-w-0">
        <FiltreDomaines domaines={domainesDuFiltre} />
        <VueGlobale
          ctx={ctx}
          identite={identite}
          intitules={intitules}
        />
        <Glossaire />
      </div>
    </>
  );
}

type ContextePage = Awaited<ReturnType<typeof chargerContexte>>;

/** La lecture d'ensemble : le profil de carrière, sans filtre. */
function VueGlobale({
  ctx,
  identite,
  intitules,
}: {
  ctx: ContextePage;
  identite?: ReturnType<typeof resoudreIdentite>;
  intitules: Record<string, string>;
}) {
  const carriere = resumeCarriere({
    sessions: ctx.donnees.sessions,
    tentatives: ctx.donnees.attempts,
    observations: ctx.observationsEffectives,
    now: ctx.now,
  });

  /*
    La fenêtre passe de 8 à 12 observations : c'est celle que tenait la carte
    « Progression récente » retirée avec l'accueil de l'Atelier. Reprendre la
    fenêtre la plus large ne perd aucune ligne.
  */
  const croissance = resumeCroissance({
    sessions: ctx.donnees.sessions,
    tentatives: ctx.donnees.attempts,
    observations: ctx.observationsEffectives,
    skillsParCode: ctx.referentiel.parCode,
    dureesEstimees: ctx.dureesEstimees,
    now: ctx.now,
    limiteEvenements: 8,
  });

  // Rejeu du journal : la courbe et les compteurs d'événements sortent de la
  // même passe, recalculés à chaque requête, jamais stockés (ADR-001).
  const evolution = evolutionScore({
    observations: ctx.observationsEffectives,
    skillsParCode: ctx.referentiel.parCode,
    now: ctx.now,
  });

  // Répartition des compétences par niveau — la seule lecture du lot « mesures »
  // qui reste sur la page : elle rejoint le héros, où sa place est visuelle.
  const repartition: Record<number, number> = {};
  for (const e of ctx.etats) {
    if (e.niveau !== null) repartition[e.niveau] = (repartition[e.niveau] ?? 0) + 1;
  }

  return (
    <>
      {/*
        Trois zones hiérarchisées, dans l'ordre où on se les pose :

          1. **Le héros** — qui, depuis quand, le grand score, sa répartition :
             la carte d'identité de la pratique.
          2. **Les faits marquants** — paliers franchis, compétences
             explorées, meilleure série, ancrage : ce qu'on balaie en entrant.
          3. **Le poste de lecture** — à gauche l'inventaire (totaux, domaines),
             à droite la trajectoire (courbe du score, bilan de ce que le
             travail récent a changé).

        L'ancienne zone « Le détail des mesures » a été retirée : niveau moyen,
        répartition analytique et compteurs mensuels y formaient un écran de
        lecture qu'aucun geste n'appelait. Ce qui portait encore une information
        unique (la répartition) rejoint le héros ; le détail par compétence vit
        dans l'Atelier, qui en est la surface canonique.
      */}
      <CarteCarriere
        user={ctx.donnees.user}
        identite={identite}
        carriere={carriere}
        global={ctx.global}
        variation7j={evolution.variation7j}
        repartition={repartition}
      />

      <FaitsMarquants evolution={evolution} carriere={carriere} global={ctx.global} />

      {/* Poste de lecture : l'inventaire à gauche, la trajectoire et sa
          méthode à droite. Le bilan de croissance vit en dessous, pleine
          largeur — une liste d'événements dans une colonne étroite ne fait
          qu'allonger l'écran. */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12 lg:gap-5">
        <div className="space-y-4 min-w-0 lg:col-span-4">
          <CartePratique carriere={carriere} />
          <ComparaisonDomaines parDomaine={ctx.global.parDomaine} />
        </div>

        <div className="space-y-4 min-w-0 lg:col-span-8">
          <CourbeEtMethode evolution={evolution} facteurs={ctx.global.facteurs} reserves={ctx.global.reserves} />
          <TopCompetences etats={ctx.etats} />
        </div>
      </div>

      {/* Le bilan de croissance, repris de l'accueil de l'Atelier. */}
      <BilanCroissanceLie resume={croissance} intitules={intitules} />
    </>
  );
}

/**
 * La courbe du score et sa méthode repliée.
 */
function CourbeEtMethode({
  evolution,
  facteurs,
  reserves,
}: {
  evolution: ReturnType<typeof evolutionScore>;
  facteurs: Array<{ libelle: string; valeur: string }>;
  reserves: string[];
}) {
  if (evolution.points.length === 0) return null;
  return (
    <Carte>
      <EnTeteCarte
        titre="Évolution du score"
        legende="Chaque point correspond à un résultat qui a fait évoluer votre repère global."
      />
      <CorpsCarte>
        <CourbeEvolution points={evolution.points} />

        {/*
          La méthode reste à portée de clic, repliée : un grand nombre
          ne doit pas se présenter comme plus certain qu'il n'est, mais
          la démonstration n'a pas à occuper l'écran.
        */}
        <div className="mt-4 border-t border-bordure pt-3">
          <Depliant resume="D'où viennent ces chiffres ?">
            <div className="rounded-md border border-bordure bg-surface-2 p-3 text-xs">
              <dl className="space-y-1">
                {facteurs.map((f, i) => (
                  <div
                    key={i}
                    className="flex flex-wrap items-baseline justify-between gap-3 border-b border-bordure/60 pb-1 last:border-0"
                  >
                    <dt className="text-texte-attenue">{libelleMesureLisible(f.libelle)}</dt>
                    <dd className="chiffres font-medium">{f.valeur}</dd>
                  </div>
                ))}
              </dl>
              <ul className="mt-3 space-y-1 text-texte-discret">
                {reserves.map((reserve, i) => (
                  <li key={i}>· {reserve}</li>
                ))}
              </ul>
            </div>
          </Depliant>
        </div>
      </CorpsCarte>
    </Carte>
  );
}
