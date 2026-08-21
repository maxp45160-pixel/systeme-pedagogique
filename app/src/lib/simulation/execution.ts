/**
 * Exécution d'un jeu de données — le point d'entrée unique de l'outil.
 *
 * `simulateur.ts` sait dérouler un scénario ; `jeu-donnees.ts` sait lire un
 * fichier. Ce module relie les deux, et rien d'autre : c'est ce que l'interface
 * appelle, qu'il s'agisse d'un jeu livré ou d'un jeu collé par l'administrateur.
 */

import { creerApprenant } from "./apprenant";
import { deroulerParcoursPilote, deroulerScenario } from "./simulateur";
import { scenarioDuJeu, type JeuDonnees } from "./jeu-donnees";
import type { ResultatSimulation } from "./types";

export function executerJeu(jeu: JeuDonnees): ResultatSimulation {
  const scenario = scenarioDuJeu(jeu);

  if (jeu.deroule.mode === "evenements") {
    return deroulerScenario(scenario);
  }

  const apprenant = creerApprenant(jeu.deroule.profil, jeu.deroule.graine);
  const resultat = deroulerParcoursPilote(scenario, {
    pas: jeu.deroule.pas,
    joursEntrePas: jeu.deroule.joursEntrePas,
    jouer: apprenant.jouer,
  });

  // La vérité terrain n'existe que pour un pilote : elle vient du modèle
  // d'apprenant, qui est la seule chose que la simulation « sait » et que le
  // moteur ignore. Sur une liste d'événements écrite à la main, personne ne
  // connaît l'aptitude réelle — et en inventer une serait le défaut que cet
  // outil traque.
  return { ...resultat, veriteTerrain: apprenant.aptitudes() };
}
