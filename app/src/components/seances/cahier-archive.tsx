"use client";

/**
 * Le Cahier — l'archive du Bureau (ADR-102).
 *
 * ## Pourquoi c'est un mode, pas une page
 *
 * Le pôle mélangeait deux besoins opposés sur le même écran : « où je
 * travaille maintenant » et « ce que j'ai écrit avant ». Le second empêchait
 * le premier d'être calme — calendrier, flèches, onglets de séances en
 * suspens et champ de recherche occupaient le haut et le bas de la page du
 * jour, en permanence.
 *
 * Les séparer en deux ROUTES aurait posé deux destinations dans le rail pour
 * un même pôle, et `estActif` en aurait allumé deux à la fois. Un mode dans
 * l'URL (`?vue=cahier`) sépare les besoins sans dupliquer la destination :
 * mêmes données, même route, deux lectures.
 *
 * ## Ce que le Cahier montre que le Bureau ne montre pas
 *
 *  - Un mois en grille : chaque jour écrit, avec ce qu'il a produit.
 *  - Les séances en suspens, sur d'autres jours que celui affiché.
 *  - La recherche plein texte, qui traverse toutes les dates.
 *
 * Rien n'y est stocké : `resumesDuMois` relit et compte à chaque affichage.
 */

import { useMemo } from "react";
import { Carte, Etiquette, cx } from "@/components/ui/primitives";
import {
  IconeChevronDroit,
  IconeChevronGauche,
  IconeFeuille,
} from "@/components/ui/icones";
import { formatDuree } from "@/lib/engine/dates";
import {
  moisDecale,
  resumesDuMois,
  type ResumeJour,
} from "@/lib/domain/pages-cahier";
import type { EntreesCahier } from "@/components/seances/bureau";
import { OngletsSeancesOuvertes } from "@/components/seances/file-seances";
import { CahierSeances, RechercheCahier } from "@/components/seances/cahier-seances";

export function CahierArchive({
  mois,
  jours,
  entrees,
  recherche,
  onChangerJour,
  onChangerMois,
  onFermer,
}: {
  mois: string;
  jours: string[];
  entrees: EntreesCahier;
  /** Terme de recherche actif : le mois cède la place aux résultats. */
  recherche?: string;
  onChangerJour: (jour: string) => void;
  onChangerMois: (mois: string) => void;
  onFermer: () => void;
}) {
  const { seances, tentatives, donnees, notes, projets = [] } = entrees;
  const resumes = useMemo(
    () => resumesDuMois(mois, jours, { seances, notes, projets, tentatives }),
    [mois, jours, seances, notes, projets, tentatives],
  );

  const enRecherche = Boolean(recherche?.trim());

  return (
    <div className="space-y-5">
      <div className="sticky top-0 z-30 -mx-4 flex h-11 items-center justify-between gap-3 border-b border-bordure bg-fond/85 px-4 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex min-w-0 items-center gap-2 text-xs text-texte-discret">
          <span className="font-medium text-texte-attenue">Cahier</span>
          <span aria-hidden>·</span>
          <span className="truncate">l’archive du Bureau</span>
        </div>
        <button
          type="button"
          onClick={onFermer}
          className="flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-texte-discret transition-colors hover:bg-surface-2 hover:text-texte"
        >
          <IconeChevronGauche className="size-4" />
          Revenir au Bureau
        </button>
      </div>

      {/*
        Les onglets « en suspens » vivent ICI, pas au Bureau. Une dette qu'on
        ne peut pas traiter maintenant n'a rien à faire devant les yeux
        pendant qu'on travaille — c'est la contrepartie d'ADR-101 : la file ne
        contient que des reprises crédibles, encore faut-il ne pas l'imposer.
      */}
      <OngletsSeancesOuvertes
        seances={seances}
        tentatives={tentatives}
        projets={projets}
        jourAffiche=""
        onNaviguer={onChangerJour}
      />

      <RechercheCahier recherche={recherche} />

      {enRecherche ? (
        <CahierSeances
          seances={seances}
          donnees={donnees}
          recherche={recherche}
          projets={projets}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-serif text-2xl font-medium capitalize tracking-tight">
                {libelleMois(mois)}
              </h2>
              <p className="mt-0.5 text-xs text-texte-discret">{resumeDuMois(resumes)}</p>
            </div>
            <div className="flex items-center gap-1">
              <BoutonMois
                libelle="Mois précédent"
                onClick={() => onChangerMois(moisDecale(mois, -1))}
              >
                <IconeChevronGauche className="size-4" />
              </BoutonMois>
              <BoutonMois
                libelle="Mois suivant"
                onClick={() => onChangerMois(moisDecale(mois, 1))}
              >
                <IconeChevronDroit className="size-4" />
              </BoutonMois>
            </div>
          </div>

          {resumes.length === 0 ? (
            <Carte>
              <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                <IconeFeuille className="size-5 text-texte-discret" />
                <p className="text-sm font-medium">Rien n’a été écrit ce mois-là.</p>
                <p className="max-w-sm text-xs text-texte-attenue">
                  Les flèches changent de mois. Un jour n’apparaît ici que si quelque
                  chose y a été écrit — le cahier ne fabrique pas de pages vides.
                </p>
              </div>
            </Carte>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {resumes.map((resume) => (
                <VignetteJour
                  key={resume.jour}
                  resume={resume}
                  onOuvrir={() => onChangerJour(resume.jour)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Un jour, réduit à ce qui tient sur une vignette.
 *
 * Les résultats sont écrits, jamais portés par la seule couleur : les
 * étiquettes disent « 2 réussis », pas un carré vert. C'est la règle posée en
 * tête de `tokens.css`, et elle vaut ici comme ailleurs.
 */
function VignetteJour({ resume, onOuvrir }: { resume: ResumeJour; onOuvrir: () => void }) {
  const details = [
    resume.seances > 0 ? `${resume.seances} séance${resume.seances > 1 ? "s" : ""}` : null,
    resume.traces > 0 ? `${resume.traces} hors séance` : null,
    resume.projets > 0 ? `${resume.projets} projet${resume.projets > 1 ? "s" : ""}` : null,
    resume.notes > 0 ? `${resume.notes} note${resume.notes > 1 ? "s" : ""}` : null,
    resume.dureeMin !== undefined ? formatDuree(resume.dureeMin) : null,
  ].filter(Boolean);

  return (
    <button
      type="button"
      onClick={onOuvrir}
      className="group cursor-pointer rounded-carte border border-bordure bg-surface p-4 text-left shadow-[var(--ombre-posee)] transition-all hover:border-primaire/40 hover:shadow-levee"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-serif text-base font-medium capitalize tracking-tight">
          {libelleJour(resume.jour)}
        </h3>
        {resume.ouverte && <Etiquette ton="primaire">Ouverte</Etiquette>}
      </div>

      {resume.titre && (
        <p className="mt-1 line-clamp-2 text-xs text-texte-attenue">{resume.titre}</p>
      )}

      {(resume.reussis > 0 || resume.partiels > 0 || resume.nonAboutis > 0) && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {resume.reussis > 0 && <Etiquette ton="succes">{resume.reussis} réussi{resume.reussis > 1 ? "s" : ""}</Etiquette>}
          {resume.partiels > 0 && <Etiquette ton="alerte">{resume.partiels} partiel{resume.partiels > 1 ? "s" : ""}</Etiquette>}
          {resume.nonAboutis > 0 && <Etiquette ton="danger">{resume.nonAboutis} non abouti{resume.nonAboutis > 1 ? "s" : ""}</Etiquette>}
        </div>
      )}

      {details.length > 0 && (
        <p className="mt-2.5 text-xs text-texte-discret">{details.join(" · ")}</p>
      )}
    </button>
  );
}

function BoutonMois({
  libelle,
  onClick,
  children,
}: {
  libelle: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={libelle}
      title={libelle}
      className={cx(
        "flex size-8 cursor-pointer items-center justify-center rounded-md border border-bordure-controle",
        "text-texte-attenue transition-colors hover:border-primaire hover:text-primaire",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Le compte du mois.
 *
 * ⚠️ `dureeMin` n'est sommée que sur les jours qui en portent une. Un mois
 * dont aucune séance n'a noté sa durée n'affiche pas « 0 min » : l'absence de
 * mesure n'est pas une durée nulle (invariant 3).
 */
function resumeDuMois(resumes: ResumeJour[]): string {
  if (resumes.length === 0) return "Aucun jour écrit.";

  const seances = resumes.reduce((total, jour) => total + jour.seances, 0);
  const exercices = resumes.reduce(
    (total, jour) => total + jour.reussis + jour.partiels + jour.nonAboutis,
    0,
  );
  const minutes = resumes.reduce((total, jour) => total + (jour.dureeMin ?? 0), 0);

  return [
    `${resumes.length} jour${resumes.length > 1 ? "s" : ""} écrit${resumes.length > 1 ? "s" : ""}`,
    seances > 0 ? `${seances} séance${seances > 1 ? "s" : ""}` : null,
    exercices > 0 ? `${exercices} exercice${exercices > 1 ? "s" : ""}` : null,
    minutes > 0 ? formatDuree(minutes) : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function libelleMois(mois: string): string {
  return new Date(`${mois}-01T12:00:00`).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });
}

function libelleJour(jour: string): string {
  return new Date(`${jour}T12:00:00`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}
