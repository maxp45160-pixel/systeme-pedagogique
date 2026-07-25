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
  /** Groupe prioritaire : rendu dominant (l'action qu'on veut déclencher). */
  primaire?: boolean;
}

/**
 * Le tableau de bord n'est plus un groupe : c'est le point d'entrée, fusionné
 * avec le logo en haut de la barre. On ouvre l'app pour *travailler*, pas pour
 * piloter — la hiérarchie de la navigation le dit maintenant explicitement.
 */
export const ACCUEIL: Entree = {
  href: "/",
  libelle: "Tableau de bord",
  court: "Bord",
  icone: IconeTableauBord,
};

/**
 * Deux groupes, par ordre de priorité d'usage :
 *  - « Travailler » d'abord, dominant : c'est l'action à prendre maintenant.
 *  - « Suivre » ensuite, en retrait : consultation de l'effet du travail.
 */
export const NAVIGATION: GroupeNav[] = [
  {
    titre: "Travailler",
    primaire: true,
    entrees: [
      { href: "/exercices", libelle: "Exercices", court: "Exos", icone: IconeExercices },
      { href: "/tuteur", libelle: "IA Tutor", court: "Tuteur", icone: IconeTuteur },
    ],
  },
  {
    titre: "Suivre",
    entrees: [
      { href: "/progression", libelle: "Progression", court: "Progrès", icone: IconeProgression },
      { href: "/competences", libelle: "Compétences", court: "Compét.", icone: IconeCompetences },
      { href: "/erreurs", libelle: "Erreurs", court: "Erreurs", icone: IconeErreurs },
      { href: "/journal", libelle: "Journal de bord", court: "Journal", icone: IconeJournal },
    ],
  },
];

/**
 * Fonctionnalités non encore construites : reléguées dans une section « Bientôt »
 * nettement séparée et discrète, pour ne plus concurrencer les entrées actives.
 */
export const A_VENIR: Entree[] = [
  { href: "/projets", libelle: "Projets", court: "Projets", icone: IconeProjets, aVenir: true },
  { href: "/lectures", libelle: "Lectures", court: "Lectures", icone: IconeLectures, aVenir: true },
  {
    href: "/connaissances",
    libelle: "Connaissances",
    court: "Savoirs",
    icone: IconeConnaissances,
    aVenir: true,
  },
];

/**
 * Barre inférieure mobile : les cinq destinations réelles, dans le même ordre
 * de priorité que le desktop — le travail d'abord.
 */
export const NAV_MOBILE: Entree[] = [
  ACCUEIL,
  { href: "/exercices", libelle: "Exercices", court: "Exos", icone: IconeExercices },
  { href: "/tuteur", libelle: "IA Tutor", court: "Tuteur", icone: IconeTuteur },
  { href: "/competences", libelle: "Compétences", court: "Compét.", icone: IconeCompetences },
  { href: "/progression", libelle: "Progression", court: "Progrès", icone: IconeProgression },
];

export const TOUTES_ENTREES: Entree[] = [
  ACCUEIL,
  ...NAVIGATION.flatMap((g) => g.entrees),
  ...A_VENIR,
];
