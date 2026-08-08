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
 * Trois pôles, desktop et mobile identiques (lot 4), par ordre de priorité
 * d'usage :
 *
 *  - **Tableau de bord** — le point d'entrée de l'app.
 *  - **Exercices**, dominant — l'action à prendre maintenant.
 *  - **Compétences & Suivi**, en retrait — consulter et gérer au même endroit.
 *
 * Le tuteur n'est plus dans la navigation : il devient un tiroir (lot 3),
 * ouvert là où poser une question a un sens. La route `/tuteur` reste
 * atteignable depuis le tiroir (« ouvrir en pleine page »).
 *
 * `/progression` et `/journal` sont des panneaux du pôle Suivi, pas des routes
 * séparées dans la navigation : les deux routes ne subsistent que comme
 * redirections vers la vue correspondante.
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
 * Barre inférieure mobile : les trois pôles, dans le même ordre de priorité
 * que le desktop — le travail d'abord.
 *
 * Dérivée de `NAVIGATION`, pas recopiée : une recopie littérale (l'ancien
 * état de ce fichier) a fini par diverger silencieusement du JSDoc qui la
 * décrivait — « les cinq destinations » alors qu'il n'y en avait que trois.
 * Une seule liste éditable ferme ce risque.
 */
export const NAV_MOBILE: Entree[] = NAVIGATION.flatMap((groupe) => groupe.entrees);

/**
 * Une destination est « active » si l'URL courante l'égale ou en descend —
 * `/competences/domaine/x` active l'entrée `/competences`, mais `/exercices`
 * n'active pas `/`. Partagée entre le rail (desktop) et la barre basse
 * (mobile) : les deux doivent s'accorder sur la même page courante, pas
 * chacune sa propre règle.
 */
export function estActif(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}