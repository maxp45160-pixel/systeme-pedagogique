import type { Exercise, ExerciseAttempt } from "@/lib/domain/types";
import { ajouterDansSection } from "./sections-markdown";

/**
 * La fiche d'un exercice travaillé.
 *
 * ## Pourquoi elle existe
 *
 * Un exercice mené doit laisser une trace consultable là où on la cherchera :
 * dans son domaine, à côté des compétences qu'il mobilise. Jusqu'ici l'Atelier
 * n'en montrait qu'une **projection** en lecture seule — impossible d'y ajouter
 * la moindre remarque, et rien n'en sortait à l'export Markdown.
 *
 * ## Ce qu'elle n'est pas
 *
 * Ce n'est pas une preuve. La preuve reste `preuve-<tentative>` : un document
 * figé par snapshot, une tentative à la fois, cité par `SkillObservation`. La
 * fiche, elle, est éditoriale et vivante — une par exercice, enrichie à chaque
 * passage.
 *
 * Ce n'est pas non plus une seconde source pour le moteur. L'exercice reste
 * dans sa table ; le front-matter porte `exercice: <id>` pour dire d'où vient
 * le contenu. La fiche recopie l'énoncé et la correction pour qu'un `.md`
 * exporté se suffise à lui-même — c'est le prix assumé de l'export, pas une
 * autorité concurrente.
 *
 * ## Ce qui n'est jamais recopié
 *
 * Aucune mesure : ni niveau, ni score, ni dimension, ni autonomie. Le résultat
 * d'un passage est mentionné parce qu'il est observé et daté, mais il n'est ni
 * agrégé ni interprété ici.
 */

export interface FicheExercice {
  id: string;
  contenuMd: string;
  exerciseId: string;
}

export const SECTION_PASSAGES = "Passages";

/** Titre de section replié par défaut à l'affichage. */
export const SECTION_CORRECTION = "Correction";

export function idFicheExercice(exerciseId: string): string {
  return `exercice-${exerciseId}`;
}

function listeMarkdown(valeurs: readonly string[]): string[] {
  return valeurs.map((valeur) => `- [[${valeur}]]`);
}

/**
 * Une ligne de passage : ce qui a été observé, daté, et où le retrouver.
 *
 * Le résultat est nommé tel quel — « réussi », « partiel », « échoué » — sans
 * être traduit en valeur. Le lien mène à la preuve figée, qui porte la
 * production d'origine ; l'Observation structurée reste dans le journal.
 */
export function lignePassage(tentative: ExerciseAttempt): string {
  const jour = (tentative.fin ?? tentative.debut).slice(0, 10);
  const duree = tentative.dureeMin ? ` · ${tentative.dureeMin} min` : "";
  return `- ${jour} — ${tentative.resultat}${duree} · [[preuve-${tentative.id}]]`;
}

/**
 * Construit la fiche d'un exercice à son premier passage mené.
 *
 * Appelée une seule fois par exercice : les passages suivants sont **ajoutés**
 * par `ajouterPassageFiche`, qui ne touche à rien d'autre. Régénérer la fiche
 * effacerait ce que la personne y a écrit.
 */
export function construireFicheExercice(
  exercice: Exercise,
  tentative: ExerciseAttempt,
  creeeLe: string,
): FicheExercice {
  const id = idFicheExercice(exercice.id);
  const corps = [
    "## Énoncé",
    "",
    exercice.enonce,
    "",
    `## ${SECTION_CORRECTION}`,
    "",
    exercice.correction,
    "",
    "## Compétences mobilisées",
    "",
    ...listeMarkdown(exercice.competences),
    "",
    `## ${SECTION_PASSAGES}`,
    "",
    lignePassage(tentative),
    "",
    "## Remarques",
    "",
  ];

  return {
    id,
    exerciseId: exercice.id,
    contenuMd: [
      "---",
      "type: exercice",
      `id: ${id}`,
      `created_at: ${creeeLe}`,
      `exercice: ${exercice.id}`,
      `domaine: ${exercice.domaine}`,
      "competencies:",
      ...exercice.competences.map((code) => `  - ${code}`),
      "---",
      "",
      `# ${exercice.titre}`,
      "",
      ...corps,
    ].join("\n"),
  };
}

/** Inscrit un passage de plus, sans rien réécrire d'autre. */
export function ajouterPassageFiche(contenuMd: string, tentative: ExerciseAttempt): string {
  return ajouterDansSection(contenuMd, SECTION_PASSAGES, [lignePassage(tentative)]);
}
