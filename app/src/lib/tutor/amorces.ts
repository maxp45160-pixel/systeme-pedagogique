/**
 * Amorces de conversation — le premier message, écrit par l'interface.
 *
 * Module pur : ces fonctions ne font que composer une phrase à partir de ce que
 * le moteur a déjà dérivé. Elles ne donnent aucun pouvoir au tuteur qu'il n'ait
 * déjà (P5) ; elles évitent seulement à l'utilisateur de recopier à la main la
 * difficulté conseillée et la dimension faible que l'écran affiche à côté.
 *
 * Pourquoi ça compte : au 02/08/2026, 40 des 54 compétences actives n'avaient
 * aucun exercice, et les obtenir demandait une conversation par compétence.
 * L'amorce de lot est ce qui transforme quarante conversations en quelques-unes.
 */

import { LIBELLES_DIMENSIONS, type Dimension } from "@/lib/domain/types";

/** Ce que la calibration sait déjà et qu'il serait absurde de faire retaper. */
export interface CalibrageAmorce {
  difficulteConseillee?: number | null;
  dimensionFaible?: Dimension | null;
}

function precisions(calibrage: CalibrageAmorce): string {
  const bouts: string[] = [];
  if (calibrage.difficulteConseillee != null) {
    bouts.push(`en difficulté ${calibrage.difficulteConseillee}/5`);
  }
  if (calibrage.dimensionFaible) {
    bouts.push(
      `en faisant travailler surtout la dimension « ${LIBELLES_DIMENSIONS[calibrage.dimensionFaible]} »`,
    );
  }
  return bouts.length > 0 ? `, ${bouts.join(" et ")}` : "";
}

/** Un exercice, sur une compétence précise, calibré par ce qui a été mesuré. */
export function amorceExercice(code: string, calibrage: CalibrageAmorce = {}): string {
  return `Propose-moi un exercice sur ${code}${precisions(calibrage)}.`;
}
