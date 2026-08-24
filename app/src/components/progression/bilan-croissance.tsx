"use client";

import Link from "next/link";
import type { ResumeCroissance, FenetreCroissance } from "@/lib/engine/croissance";
import { urlComposerAutonome } from "@/lib/domain/navigation-exercice";
import { Carte, CodeCompetence, classesLienBouton, cx } from "@/components/ui/primitives";
import { IconeFleche } from "@/components/ui/icones";
import { formatDateRelative, formatDuree } from "@/lib/engine/dates";

/**
 * Le bilan de croissance — ce que le travail récent a produit.
 *
 * Il était l'accueil de l'Atelier. C'était sa mauvaise place : on ouvre
 * l'Atelier pour retrouver une note ou une compétence, et on tombait sur un
 * bilan de la semaine qu'il fallait traverser. Un bilan répond à « où j'en
 * suis », pas à « où est ma fiche » — il appartient à `/progression`.
 *
 * Deux niveaux de lecture, dans l'ordre où on se les pose :
 *   1. **Ce que tu as fait** — l'activité brute, deux fenêtres ;
 *   2. **Ce que ça a changé** — les niveaux avant/après, les paliers franchis.
 *
 * Aucun calcul ici : tout arrive dérivé de `resumeCroissance`. Un composant
 * qui recalculerait une mesure serait un second endroit où la règle vit.
 */
export function BilanCroissance({
  resume,
  ouvrirElement,
}: {
  resume: ResumeCroissance;
  intitules?: Record<string, string>;
  /** Ouvre une fiche dans l'Atelier — c'est là que vivent les éléments cités. */
  ouvrirElement: (id: string) => void;
}) {
  return (
    <div className="space-y-8">
      <NiveauActivite resume={resume} />
      <NiveauCroissance resume={resume} ouvrirElement={ouvrirElement} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Niveau 1 — Ce que j'ai fait                                         */
/* ------------------------------------------------------------------ */

function NiveauActivite({ resume }: { resume: ResumeCroissance }) {
  return (
    <section>
      <TitreNiveau titre="Ce que vous avez fait" />
      {resume.vide ? (
        <div className="mt-3 rounded-xl border border-dashed border-bordure-contraste bg-surface px-4 py-6 text-center">
          <p className="text-xs leading-relaxed text-texte-discret">
            Rien enregistré sur les sept derniers jours.
            <br />
            Cet espace se remplit tout seul dès qu&apos;un travail est terminé — vous n&apos;avez rien à y ranger.
          </p>
          {/*
            Le bilan ne se contente pas de constater le vide : il rend le geste
            suivant atteignable. La boucle génération → évaluation → adaptation
            repart d'ici, pas seulement du tableau de bord.
          */}
          <Link href="/seances?composer=1" className={`${classesLienBouton("principal", "compacte")} mt-3`}>
            Composer une séance
          </Link>
        </div>
      ) : (
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <CarteFenetre fenetre={resume.jour} accent />
          <CarteFenetre fenetre={resume.semaine} />
        </div>
      )}
    </section>
  );
}

function CarteFenetre({ fenetre, accent = false }: { fenetre: FenetreCroissance; accent?: boolean }) {
  const rien = fenetre.observations === 0 && fenetre.exercicesMenes === 0 && fenetre.minutes === 0;

  return (
    <Carte accent={accent} className="p-5">
      <p className={cx("text-xs font-semibold uppercase tracking-wider", accent ? "text-primaire" : "text-texte-discret")}>
        {fenetre.libelle}
      </p>

      {rien ? (
        <p className="mt-3 text-xs text-texte-discret">Aucun travail enregistré.</p>
      ) : (
        <>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
            <Mesure libelle="Travaillé" valeur={fenetre.minutes > 0 ? formatDuree(fenetre.minutes) : "—"} />
            <Mesure libelle="Exercices" valeur={String(fenetre.exercicesMenes)} />
            <Mesure libelle="Observations" valeur={String(fenetre.observations)} />
            <Mesure libelle="Compétences" valeur={String(fenetre.competencesTravaillees.length)} />
          </dl>

          {fenetre.competencesTravaillees.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {fenetre.competencesTravaillees.map((code) => (
                <CodeCompetence key={code} code={code} />
              ))}
            </div>
          )}
        </>
      )}
    </Carte>
  );
}

/**
 * Une mesure et son libellé.
 *
 * Un tiret quand il n'y a rien, jamais un zéro : ne pas avoir noté sa durée
 * n'est pas avoir travaillé zéro minute (P2).
 */
function Mesure({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div>
      <dt className="text-[0.625rem] uppercase tracking-wide text-texte-discret">{libelle}</dt>
      <dd className="chiffres mt-0.5 text-lg font-medium text-texte">{valeur}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Niveau 2 — Ce que ça a changé                                       */
/* ------------------------------------------------------------------ */

/**
 * Monter d'un palier, au sens strict — même règle que `croissance.ts`.
 *
 * Elle est redéfinie ici plutôt qu'importée parce que le moteur ne l'expose
 * pas : elle n'a de sens que pour dire une chose à l'écran. Si un troisième
 * appelant en a besoin, c'est à ce moment qu'elle remontera dans le moteur.
 */
function estProgression(evenement: ResumeCroissance["evenements"][number]): boolean {
  return (
    evenement.niveauAvant !== null &&
    evenement.niveauApres !== null &&
    evenement.niveauApres > evenement.niveauAvant
  );
}

const EST_PREMIERE_MESURE = (e: ResumeCroissance["evenements"][number]): boolean =>
  e.niveauAvant === null && e.niveauApres !== null;

function NiveauCroissance({
  resume,
  ouvrirElement,
}: {
  resume: ResumeCroissance;
  ouvrirElement: (id: string) => void;
}) {
  const { evenements, semaine } = resume;

  return (
    <section>
      <TitreNiveau titre="Ce que ça a changé" legende="Chaque ligne est une observation, et son effet réel sur le niveau." />

      {/*
        Les compteurs de la semaine ouvrent en grands : ils répondent en un coup
        d'œil, la liste explique. L'un sans l'autre laisserait soit une
        impression sans détail, soit un détail sans impression.
      */}
      {(semaine.franchissements > 0 || semaine.premieresMesures > 0) && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <CompteurSemaine valeur={semaine.franchissements} libelle="palier(s) franchi(s) cette semaine" ton="accent" />
          <CompteurSemaine
            valeur={semaine.premieresMesures}
            libelle="compétence(s) mesurée(s) pour la première fois"
            ton="info"
          />
        </div>
      )}

      {evenements.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-bordure-contraste bg-surface px-4 py-6 text-center text-xs text-texte-discret">
          Aucune observation enregistrée pour l&apos;instant. Rien ne s&apos;affiche avant qu&apos;il y en ait une.
        </p>
      ) : (
        /*
          Deux colonnes dès que la largeur le permet : une liste pleine largeur
          aligne des lignes de trois mots sur mille pixels et étire l'écran en
          hauteur sans rien dire de plus.
        */
        <ul className="mt-3 grid gap-2 md:grid-cols-2">
          {evenements.map((evenement, index) => {
            const premiere = EST_PREMIERE_MESURE(evenement);
            const progression = estProgression(evenement);

            /*
              La couleur ne porte jamais seule l'information : le rail gauche
              accélère le balayage (accent = un palier), mais chaque ligne dit
              aussi sa nature en texte et en chiffres visibles.
            */
            const rail = progression
              ? "border-l-accent"
              : premiere
                ? "border-l-info"
                : evenement.franchissement
                  ? "border-l-alerte"
                  : "border-l-bordure";

            return (
              <li
                key={`${evenement.date}-${evenement.skillCode}-${index}`}
                className={`relative rounded-xl border border-bordure border-l-[3px] bg-surface shadow-[var(--ombre-carte)] transition-colors hover:bg-surface-2 ${rail}`}
              >
                {/*
                  La ligne entière est cliquable sans l'être par un `<button>`
                  qui contiendrait un `<Link>` : un lien dans un bouton est un
                  HTML invalide et une hydrotation qui râle. Le bouton plein
                  cadre ouvre la fiche ; le lien « Travailler », au-dessus, reste
                  atteignable séparément.
                */}
                <button
                  type="button"
                  onClick={() => ouvrirElement(evenement.skillCode)}
                  className="absolute inset-0 z-0 rounded-xl"
                  aria-label={`Ouvrir la fiche de ${evenement.skillCode}`}
                />
                <div className="relative z-10 flex items-center justify-between gap-3 px-4 py-3">
                  <span className="pointer-events-none min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <CodeCompetence code={evenement.skillCode} />
                      {premiere ? (
                        <span className="text-sm font-medium text-texte">Première mesure</span>
                      ) : evenement.niveauAvant !== null && evenement.niveauApres !== null ? (
                        /*
                          La transition avant/après est le cœur de la ligne :
                          l'ancien niveau s'efface, le nouveau se lit d'un coup
                          d'œil. Une redescente prend la teinte d'alerte — une
                          information honnête, pas une punition.
                        */
                        <span className="chiffres flex items-baseline gap-1.5">
                          <span className="text-sm text-texte-discret">{evenement.niveauAvant}</span>
                          <IconeFleche className="size-3 self-center text-texte-discret" />
                          <span className={cx("text-lg font-semibold leading-none", progression ? "text-succes" : "text-alerte")}>
                            {evenement.niveauApres}
                          </span>
                        </span>
                      ) : (
                        <span className="text-sm text-texte-attenue">
                          {evenement.resultat === "reussi"
                            ? "Réussi, niveau confirmé"
                            : evenement.resultat === "partiel"
                              ? "Partiellement réussi"
                              : "Non abouti"}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-xs font-medium text-texte">
                      {evenement.intitule}
                    </span>
                    <span className="mt-0.5 block truncate text-[0.6875rem] text-texte-discret">
                      {evenement.contexte}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="pointer-events-none text-[0.6875rem] text-texte-discret">
                      {formatDateRelative(evenement.date)}
                    </span>
                    {/*
                      Une ligne qui n'a pas progressé ne reste pas un point mort :
                      elle propose le geste qui la fait bouger. Le compositeur est
                      prérempli avec la compétence concernée — la boucle repart de
                      l'écran où le recul s'est constaté.
                    */}
                    {!progression && !premiere && (
                      <Link
                        href={urlComposerAutonome(evenement.skillCode, undefined)}
                        className="text-[0.6875rem] font-medium text-primaire transition-colors hover:text-primaire-fort hover:underline"
                      >
                        Travailler →
                      </Link>
                    )}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Le compteur de semaine en vignette : un grand chiffre, puis son sens. */
function CompteurSemaine({
  valeur,
  libelle,
  ton,
}: {
  valeur: number;
  libelle: string;
  ton: "accent" | "info";
}) {
  return (
    <div
      className={cx(
        "rounded-xl border p-4",
        ton === "accent"
          ? "border-accent/30 bg-accent/5"
          : "border-info/25 bg-info-faible",
      )}
    >
      <p className="chiffres text-3xl font-semibold tracking-tight text-texte">{valeur}</p>
      <p className="mt-1 text-xs leading-snug text-texte-attenue">{libelle}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function TitreNiveau({ titre, legende }: { titre: string; legende?: string }) {
  return (
    <div>
      <h2 className="font-serif text-xl font-medium tracking-tight">{titre}</h2>
      {legende && <p className="mt-0.5 text-xs text-texte-attenue">{legende}</p>}
    </div>
  );
}
