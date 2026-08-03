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
 * Trois pôles, desktop et mobile identiques (lot 4) :
 *
 *  - 🎯 **Tableau de bord** — point d'entrée de l'app.
 *  - 📝 **Exercices** — l'action à prendre maintenant.
 *  - 🧠 **Compétences & Suivi** — consulter et gérer au même endroit.
 *
 * Le tuteur n'est plus dans la navigation : il devient un tiroir (lot 3),
 * ouvert là où poser une question a un sens. La route `/tuteur` reste
 * atteignable depuis le tiroir (« ouvrir en pleine page »).
 *
 * `/progression` et `/journal` sont des panneaux du pôle Suivi, pas des routes
 * séparées dans la navigation.
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
      { href: "/competences", libelle: "Compétences", court: "Compét.", icone: IconeCompetences },
    ],
  },
];

/**
 * Barre inférieure mobile : les trois destinations, dans le même ordre de
 * priorité que le desktop — le travail d'abord.
 */
export const NAV_MOBILE: Entree[] = [
  { href: "/", libelle: "Tableau de bord", court: "Bord", icone: IconeTableauBord },
  { href: "/exercices", libelle: "Exercices", court: "Exos", icone: IconeExercices },
  { href: "/competences", libelle: "Compétences", court: "Compét.", icone: IconeCompetences },
];