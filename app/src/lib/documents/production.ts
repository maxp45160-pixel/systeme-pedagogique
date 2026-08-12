import type { Exercise, ExerciseAttempt } from "@/lib/domain/types";

export interface DocumentProductionPreuve {
  id: string;
  contenuMd: string;
  attemptId: string;
  exerciseId: string;
}

function listeMarkdown(valeurs: string[]): string {
  return valeurs.map((valeur) => `- [[${valeur}]]`).join("\n");
}

/**
 * Conserve la production et son contexte dans un document durable.
 *
 * Le bilan, les dimensions et l'autonomie ne sont volontairement pas copiés
 * dans le Markdown : ce sont des mesures de `SkillEvidence`, pas du contenu
 * déclaré. Le document garde uniquement ce qui a été produit et le support
 * exact qui a conduit à la production.
 */
export function construireDocumentProductionPreuve(
  exercice: Exercise,
  tentative: ExerciseAttempt,
  produiteLe: string,
): DocumentProductionPreuve {
  const id = `preuve-${tentative.id}`;
  const production = tentative.reponse;
  const notes = tentative.notes?.trim();

  const sections = [
    "## Compétences mobilisées",
    "",
    listeMarkdown(exercice.competences),
    "",
    "## Support",
    "",
    `- [[exercice:${exercice.id}]]`,
    "",
    "## Énoncé au moment de la production",
    "",
    exercice.enonce,
    "",
    "## Production",
    "",
    production,
  ];

  if (notes) {
    sections.push("", "## Notes de la personne", "", notes);
  }

  return {
    id,
    attemptId: tentative.id,
    exerciseId: exercice.id,
    contenuMd: [
      "---",
      "type: preuve",
      `id: ${id}`,
      `created_at: ${produiteLe}`,
      `produced_at: ${produiteLe}`,
      `source_attempt: ${tentative.id}`,
      `source_exercise: ${exercice.id}`,
      "competencies:",
      ...exercice.competences.map((code) => `  - ${code}`),
      "---",
      "",
      `# ${exercice.titre}`,
      "",
      ...sections,
      "",
    ].join("\n"),
  };
}

