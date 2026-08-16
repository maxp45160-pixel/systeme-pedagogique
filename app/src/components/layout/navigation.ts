import type { ComponentType } from "react";
import {
  IconeAmpoule,
  IconeCompetences,
  IconeDocuments,
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
  /**
   * Groupe détaché, poussé au bas du rail.
   *
   * Sert à séparer ce qui n'est pas un pôle de travail du reste des
   * destinations, sans inventer une seconde liste que les deux barres
   * devraient tenir synchronisée.
   */
  aPart?: boolean;
}

/**
 * Trois groupes, desktop et mobile identiques, par ordre de priorité
 * d'usage :
 *
 *  - **Tableau de bord** — le point d'entrée de l'app (Piloter).
 *  - **Atelier**, dominant — explorer le corpus, le référentiel et sa progression (Visualiser).
 *  - **Cahier** — composer, planifier, dérouler et relire (Travailler).
 *  - **Aide** — le mode d'emploi, détaché en bas de rail (`aPart`).
 *
 * La séparation tient au besoin (ADR-053) : le tableau de bord *pilote* (sa
 * prochaine action), Atelier *visualise* (le workspace documentaire), Cahier
 * *travaille* (le hub et le workspace, ADR-061),
 * Les fiches de l'Atelier portent aussi le suivi et la gestion du référentiel.
 * Les anciennes surfaces parallèles ont été
 * retirées : le rail ne décrit que les destinations actives (ADR-063, étendu
 * par l'Atelier documentaire).
 */
export const NAVIGATION: GroupeNav[] = [
  {
    titre: "Piloter",
    entrees: [
      { href: "/", libelle: "Tableau de bord", court: "Bord", icone: IconeTableauBord },
      /*
       * La progression est une destination, pas un bloc du tableau de bord.
       *
       * Elle y vivait sous « Vue d'ensemble » : activité sur un an, état global,
       * dernières preuves, glossaire. Quatre lectures qu'on traversait pour
       * atteindre l'action du jour, alors qu'on ne les ouvre pas dans le même
       * geste. Elle reste sous « Piloter » — c'est la même question, « où j'en
       * suis », posée sur un autre horizon.
       */
      { href: "/progression", libelle: "Progression", court: "Progrès", icone: IconeCompetences },
    ],
  },
  {
    titre: "Visualiser",
    primaire: true,
    entrees: [
      { href: "/atelier", libelle: "Atelier", court: "Atelier", icone: IconeDocuments },
    ],
  },
  {
    titre: "Travailler",
    entrees: [
      /*
       * Pas d'entrée « Projets ».
       *
       * Un projet n'est pas une destination à parcourir : il se crée depuis le
       * tableau de bord et se pilote depuis sa fiche dans l'Atelier. Lui donner
       * un pôle ajouterait une quatrième destination pour un objet qui vit déjà
       * dans deux surfaces existantes.
       */
      { href: "/seances", libelle: "Cahier", court: "Cahier", icone: IconeExercices },
    ],
  },
  /*
   * Aide, seule, tout en bas.
   *
   * Elle était la seconde entrée de « Travailler », sous le Cahier — donc
   * rangée parmi les pôles de travail, alors qu'elle n'en est pas un. On
   * n'ouvre pas l'aide dans le geste où l'on compose une séance : on l'ouvre
   * quand une autre destination n'a pas suffi. Un groupe à elle, détaché du
   * reste, dit cette différence de nature sans avoir à l'expliquer.
   */
  {
    titre: "Comprendre",
    aPart: true,
    entrees: [
      { href: "/aide", libelle: "Aide", court: "Aide", icone: IconeAmpoule },
    ],
  },
];

/**
 * Barre inférieure mobile : les mêmes destinations que le rail, dans le même
 * ordre de priorité — le travail d'abord, l'aide en dernier.
 *
 * Dérivée de `NAVIGATION`, pas recopiée : une recopie littérale (l'ancien
 * état de ce fichier) a fini par diverger silencieusement du JSDoc qui la
 * décrivait — « les cinq destinations » alors qu'il n'y en avait que trois.
 * Une seule liste éditable ferme ce risque.
 */
export const NAV_MOBILE: Entree[] = NAVIGATION.flatMap((groupe) => groupe.entrees);

/**
 * Une destination est « active » si l'URL courante l'égale ou en descend —
 * `/competences/domaine/x` active l'entrée `/competences`, mais une autre route
 * n'active pas `/`. Partagée entre le rail (desktop) et la barre basse
 * (mobile) : les deux doivent s'accorder sur la même page courante, pas
 * chacune sa propre règle.
 */
export function estActif(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
