import type { ComponentType } from "react";
import {
  IconeCompetences,
  IconeExercices,
  IconeJournal,
  IconeProgression,
  IconeTableauBord,
  IconeTuteur,
} from "@/components/ui/icones";

export interface Entree {
  href: string;
  libelle: string;
  court: string;
  icone: ComponentType<{ className?: string }>;
}

export interface GroupeNav {
  titre: string;
  entrees: Entree[];
  /** Groupe prioritaire : rendu dominant (l'action qu'on veut déclencher). */
  primaire?: boolean;
}

/**
 * Trois groupes, par ordre de priorité d'usage :
 *  - « Piloter » d'abord : le tableau de bord, point d'entrée de l'app.
 *  - « Travailler » ensuite, dominant : l'action à prendre maintenant.
 *  - « Suivre » en retrait : consultation de l'effet du travail.
 */
export const NAVIGATION: GroupeNav[] = [
  {
    titre: "Piloter",
    entrees: [
      { href: "/", libelle: "Tableau de bord", court: "Bord", icone: IconeTableauBord },
    ],
  },
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
      { href: "/journal", libelle: "Journal de bord", court: "Journal", icone: IconeJournal },
    ],
  },
];

/**
 * Barre inférieure mobile : les cinq destinations réelles, dans le même ordre
 * de priorité que le desktop — le travail d'abord.
 */
export const NAV_MOBILE: Entree[] = [
  { href: "/", libelle: "Tableau de bord", court: "Bord", icone: IconeTableauBord },
  { href: "/exercices", libelle: "Exercices", court: "Exos", icone: IconeExercices },
  { href: "/tuteur", libelle: "IA Tutor", court: "Tuteur", icone: IconeTuteur },
  { href: "/competences", libelle: "Compétences", court: "Compét.", icone: IconeCompetences },
  { href: "/progression", libelle: "Progression", court: "Progrès", icone: IconeProgression },
];

