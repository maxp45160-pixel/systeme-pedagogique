/**
 * Dérivation des qualificatifs d'une preuve, à partir de ce qui a été observé.
 *
 * Ces trois règles étaient dans `lib/store/actions.ts`, donc derrière
 * `"use server"` — intestables, alors qu'elles sont le point d'entrée de
 * *toute* preuve écrite par l'interface. Elles sont pures et sans I/O : leur
 * place est ici, avec le reste du moteur, chacune citant le paragraphe du
 * protocole qui l'impose.
 */

import type { Autonomie, QualitePreuve, SkillEvidence } from "@/lib/domain/types";

/**
 * Autonomie déduite du nombre d'indices réellement consultés.
 *
 * L'utilisateur ne la choisit pas : elle est observée, pas déclarée. C'est le
 * seul signal non déclaratif dont dispose le système (protocole d'évaluation §5).
 */
export function autonomieDepuisIndices(indices: number, total: number): Autonomie {
  if (total > 0 && indices >= total) return "A1";
  if (indices >= 1) return "A2";
  return "A3";
}

/**
 * Qualité d'une preuve issue d'un exercice — §6, via la difficulté affichée.
 */
export function qualiteDepuisDifficulte(
  difficulte: number,
  autonomie: Autonomie,
): QualitePreuve {
  if (autonomie === "A0" || autonomie === "A1") return "faible";
  if (difficulte >= 4 && (autonomie === "A3" || autonomie === "A4")) return "forte";
  if (difficulte <= 1) return "faible";
  return "moyenne";
}

/**
 * Qualité d'une preuve hors exercice — §6, via la nature du travail.
 *
 * Le protocole définit la qualité par ce qu'était le travail, pas par une
 * appréciation portée après coup : « faible — réponse isolée, exercice très
 * guidé » ; « forte — problème nouveau, transfert, projet » ; « moyenne » pour
 * le reste. L'utilisateur ne la déclare donc plus.
 */
export function qualiteDepuisNature(
  type: SkillEvidence["type"],
  autonomie: Autonomie,
): QualitePreuve {
  if (autonomie === "A0" || autonomie === "A1") return "faible";
  if (type === "transfert" || type === "projet") return "forte";
  return "moyenne";
}
