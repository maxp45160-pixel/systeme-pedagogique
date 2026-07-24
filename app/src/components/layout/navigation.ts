import type { ComponentType } from "react";
import {
  IconeCompetences,
  IconeConnaissances,
  IconeErreurs,
  IconeExercices,
  IconeJournal,
  IconeLectures,
  IconeProgression,
  IconeProjets,
  IconeTableauBord,
  IconeTuteur,
} from "@/components/ui/icones";

export interface Entree {
  href: string;
  libelle: string;
  court: string;
  icone: ComponentType<{ className?: string }>;
  /** Marqué comme non encore construit : la page le dit franchement. */
  aVenir?: boolean;
}

export interface GroupeNav {
  titre: string;
  entrees: Entree[];
}

/**
 * Trois groupes : piloter, travailler, suivre.
 * L'ordre suit la boucle d'usage — on ouvre le tableau de bord, on travaille,
 * puis on consulte l'effet du travail sur le référentiel.
 */
export const NAVIGATION: GroupeNav[] = [
  {
    titre: "Pilotage",
    entrees: [
      { href: "/", libelle: "Tableau de bord", court: "Bord", icone: IconeTableauBord },
      { href: "/progression", libelle: "Progression", court: "Progrès", icone: IconeProgression },
      { href: "/journal", libelle: "Journal de bord", court: "Journal", icone: IconeJournal },
    ],
  },
  {
    titre: "Travail",
    entrees: [
      { href: "/exercices", libelle: "Exercices", court: "Exos", icone: IconeExercices },
      { href: "/tuteur", libelle: "IA Tutor", court: "Tuteur", icone: IconeTuteur },
      { href: "/projets", libelle: "Projets", court: "Projets", icone: IconeProjets, aVenir: true },
    ],
  },
  {
    titre: "Suivi",
    entrees: [
      { href: "/competences", libelle: "Compétences", court: "Compét.", icone: IconeCompetences },
      { href: "/erreurs", libelle: "Erreurs", court: "Erreurs", icone: IconeErreurs },
      { href: "/lectures", libelle: "Lectures", court: "Lectures", icone: IconeLectures, aVenir: true },
      {
        href: "/connaissances",
        libelle: "Connaissances",
        court: "Savoirs",
        icone: IconeConnaissances,
        aVenir: true,
      },
    ],
  },
];

/** Entrées de la barre inférieure mobile : les cinq destinations réelles. */
export const NAV_MOBILE: Entree[] = [
  { href: "/", libelle: "Tableau de bord", court: "Bord", icone: IconeTableauBord },
  { href: "/competences", libelle: "Compétences", court: "Compét.", icone: IconeCompetences },
  { href: "/exercices", libelle: "Exercices", court: "Exos", icone: IconeExercices },
  { href: "/progression", libelle: "Progression", court: "Progrès", icone: IconeProgression },
  { href: "/tuteur", libelle: "IA Tutor", court: "Tuteur", icone: IconeTuteur },
];

export const TOUTES_ENTREES: Entree[] = NAVIGATION.flatMap((g) => g.entrees);
