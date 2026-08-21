/**
 * Ce que la modale de génération reçoit du contexte serveur.
 *
 * Trois écrans montent `BoutonGenerer` — la carte « Prochaine action », l'en-tête
 * de la bibliothèque, la fiche compétence. Ils dérivaient chacun leurs props à
 * la main, et la duplication portait un défaut :
 *
 * > La modale recevait **une** calibration, celle de la compétence initiale,
 * > alors que son sélecteur en propose autant qu'il y a de compétences actives.
 * > Changer de compétence laissait donc affichées la difficulté et la dimension
 * > faible d'une **autre** compétence.
 *
 * Le serveur, lui, recalculait correctement : l'exercice produit était bon,
 * mais l'écran annonçait autre chose que ce qu'il allait faire. C'est P3 rompu
 * — un nombre affiché sans sa vraie source — et c'est le motif de l'incident du
 * 02/08/2026, où une difficulté 5 était conseillée sur la foi d'un partiel
 * obtenu à difficulté 1.
 *
 * `chargerContexte` calibre **toutes** les compétences (`calibrerToutes`) : il
 * n'y a rien à recalculer, seulement à tout transmettre.
 *
 * Module pur, sans `"use client"` : il est appelé depuis des composants
 * serveur, et ne rend rien.
 */

import type { Calibration } from "@/lib/engine/calibration";
import type { Skill } from "@/lib/domain/types";

export interface CompetenceModale {
  code: string;
  intitule: string;
  domaine: string;
}

export interface CalibrageModale {
  difficulteConseillee: Calibration["difficulteConseillee"];
  dimensionFaible: Calibration["dimensionFaible"];
  /** Ce qui fonde le conseil — chaque valeur citée telle qu'observée (P3). */
  facteurs: { libelle: string; valeur: string }[];
  reserves: string[];
}

export function competencesPourModale(actifs: Skill[]): CompetenceModale[] {
  return actifs.map((s) => ({
    code: s.code,
    intitule: s.intitule,
    domaine: s.domaine,
  }));
}

/**
 * Les calibrages de toutes les compétences actives, indexés par code.
 *
 * Un objet simple et non une `Map` : il franchit la frontière serveur → client,
 * où seules les structures sérialisables passent.
 *
 * Une compétence sans calibration n'entre pas dans le dictionnaire. L'absence y
 * est donc lisible, et la modale peut dire « aucune tentative exploitable »
 * plutôt que d'afficher un zéro (P2).
 */
export function calibragesPourModale(
  actifs: Skill[],
  calibrations: Map<string, Calibration>,
): Record<string, CalibrageModale> {
  const parCode: Record<string, CalibrageModale> = {};
  for (const s of actifs) {
    const c = calibrations.get(s.code);
    if (!c) continue;
    parCode[s.code] = {
      difficulteConseillee: c.difficulteConseillee,
      dimensionFaible: c.dimensionFaible,
      facteurs: c.explication.facteurs.map((f) => ({
        libelle: f.libelle,
        valeur: String(f.valeur),
      })),
      reserves: c.explication.reserves,
    };
  }
  return parCode;
}
