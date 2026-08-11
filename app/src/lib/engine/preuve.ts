/**
 * Dérivation des qualificatifs d'une preuve, à partir de ce qui a été observé.
 *
 * Ces trois règles étaient dans `lib/store/actions.ts`, donc derrière
 * `"use server"` — intestables, alors qu'elles sont le point d'entrée de
 * *toute* preuve écrite par l'interface. Elles sont pures et sans I/O : leur
 * place est ici, avec le reste du moteur, chacune citant le paragraphe du
 * protocole qui l'impose.
 */

import type { Autonomie, QualitePreuve } from "@/lib/domain/types";

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
 * Aide extérieure au système, déclarée par l'utilisateur (ADR-033).
 *
 * `indicesUtilises` ne compte que les indices INTERNES. Une documentation
 * consultée, un assistant IA sollicité, une correction lue restaient invisibles
 * au moteur, qui écrivait « A3 — résolution autonome » sur un travail où
 * l'utilisateur avait lui-même noté en commentaire « j'ai eu besoin de l'aide
 * de Claude » (ADR-008). Le champ commentaire n'est pas lu par le moteur : la
 * personne était honnête, l'instrument sourd.
 */
export type AideExterne = "aucune" | "documentation" | "assistant-ia" | "correction";

/**
 * Plafond d'autonomie qu'une aide extérieure autorise — protocole
 * d'évaluation §5, lu à la lettre.
 *
 * - `documentation` → **A2**, « quelques indices nécessaires » : une référence
 *   consultée est un indice, simplement externe au système.
 * - `assistant-ia` → **A1**, « solution fortement guidée ».
 * - `correction` → **A0**, « solution fournie ». C'est la définition même.
 *
 * ⚠️ Ce barème déplace des niveaux mesurés. Il est délibérément sévère sur
 * `documentation` : un travail mené documentation ouverte en permanence n'est
 * pas une résolution autonome au sens du protocole, même si c'est une pratique
 * professionnelle parfaitement normale. La distinction que le système mesure
 * est « sait faire seul », pas « sait faire bien ».
 */
/**
 * Formulations montrées à l'utilisateur et consignées dans le commentaire.
 *
 * Une seule source : le libellé du bouton cliqué et celui du commentaire
 * enregistré doivent être le même texte, sans quoi relire une preuve ancienne
 * demanderait de deviner à quelle option elle correspondait.
 */
export const LIBELLE_AIDE: Record<AideExterne, string> = {
  aucune: "aucune",
  documentation: "documentation, cours, manuel",
  "assistant-ia": "assistant IA",
  correction: "correction obtenue",
};

const PLAFOND_AIDE: Record<AideExterne, Autonomie> = {
  aucune: "A4",
  documentation: "A2",
  "assistant-ia": "A1",
  correction: "A0",
};

const ORDRE_AUTONOMIE: Autonomie[] = ["A0", "A1", "A2", "A3", "A4"];

/**
 * Autonomie retenue : le **minimum** entre ce que disent les indices internes
 * et ce que le plafond de l'aide extérieure autorise.
 *
 * Un minimum, et non un remplacement : les deux signaux mesurent la même chose
 * par deux voies, et celle qui constate le plus d'aide l'emporte. Quelqu'un qui
 * a épuisé les indices internes ET consulté une documentation reste en A1 — le
 * plafond A2 de la documentation ne doit pas *relever* une autonomie que les
 * indices avaient déjà rabaissée.
 */
export function autonomieObservee(
  indices: number,
  total: number,
  aide: AideExterne,
): Autonomie {
  const parIndices = autonomieDepuisIndices(indices, total);
  const plafond = PLAFOND_AIDE[aide];
  return ORDRE_AUTONOMIE.indexOf(parIndices) <= ORDRE_AUTONOMIE.indexOf(plafond)
    ? parIndices
    : plafond;
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
