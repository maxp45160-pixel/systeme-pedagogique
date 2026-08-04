import type { ComponentType } from "react";
import {
  IconeCompetences,
  IconeExercices,
  IconeTableauBord,
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
 * Trois pôles, par ordre de priorité d'usage :
 *  - « Tableau de bord » d'abord : le point d'entrée de l'app.
 *  - « Exercices » ensuite, dominant : l'action à prendre maintenant.
 *  - « Compétences & Suivi » en retrait : consultation de l'effet du travail.
 *
 * Le tuteur n'est plus dans la navigation : il est devenu un tiroir, ouvert
 * là où poser une question a un sens (lot 3). La route `/tuteur` reste
 * atteignable depuis le tiroir (« ouvrir en pleine page »).
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
    ],
  },
  {
    titre: "Suivre",
    entrees: [
      { href: "/competences", libelle: "Compétences & Suivi", court: "Compét.", icone: IconeCompetences },
    ],
  },
];

/**
 * Barre inférieure mobile : les trois pôles, dans le même ordre que le
 * desktop — le travail d'abord.
 */
export const NAV_MOBILE: Entree[] = [
  { href: "/", libelle: "Tableau de bord", court: "Bord", icone: IconeTableauBord },
  { href: "/exercices", libelle: "Exercices", court: "Exos", icone: IconeExercices },
  { href: "/competences", libelle: "Compétences & Suivi", court: "Compét.", icone: IconeCompetences },
];