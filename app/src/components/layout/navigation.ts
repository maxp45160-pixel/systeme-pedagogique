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
 * Trois pôles, desktop et mobile identiques (ADR-053), par ordre de priorité
 * d'usage :
 *
 *  - **Tableau de bord** — le point d'entrée de l'app (Piloter).
 *  - **Cahier**, dominant — composer, planifier, dérouler et relire (Travailler).
 *  - **Compétences**, en retrait — consulter et gérer au même endroit (Suivre).
 *
 * La séparation tient au besoin (ADR-053) : le tableau de bord *pilote* (sa
 * prochaine action), Cahier *travaille* (le hub et le workspace, ADR-061),
 * Compétences *suit* (l'état). Les routes `/exercices`, `/progression` et
 * `/journal` ne subsistent que comme redirections (ADR-061).
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
      { href: "/seances", libelle: "Cahier", court: "Cahier", icone: IconeExercices },
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
