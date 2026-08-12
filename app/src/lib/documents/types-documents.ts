/**
 * Registre des types documentaires.
 *
 * Un type décrit du contenu déclaré. Il ne porte jamais de niveau, de score
 * ou de mesure : ces éléments restent dans le domaine des preuves observées.
 */

import type { FrontMatter, LienMarkdown } from "./markdown";

export type CategorieDocument = "connaissance" | "action" | "preuve";

export interface DefinitionTypeDocument {
  type: string;
  libelle: string;
  categorie: CategorieDocument;
  dossierParDefaut: string;
  champsObligatoires: string[];
  champsFacultatifs: string[];
  sections: string[];
  relationsRecommandees: string[];
}

/** Ligne canonique stockée par la dorsale documentaire. */
export interface LigneDocument {
  id: string;
  contenuMd: string;
  titre?: string;
  type?: string;
  tags?: string[];
  schemaVersion?: string;
  frontmatter?: FrontMatter;
  createdAt?: string;
  updatedAt?: string;
}

/** Métadonnées matérialisées pour afficher un corpus sans charger les corps. */
export interface ApercuDocument {
  id: string;
  titre: string;
  type: string;
  tags: string[];
  schema: string | null;
  schemaCompatible: boolean;
  frontMatter: FrontMatter;
  liens: LienMarkdown[];
  createdAt?: string;
  updatedAt?: string;
}

/** Snapshot immuable utilisé lorsqu'un document est gelé comme preuve. */
export interface SnapshotDocument {
  id: string;
  documentId: string;
  version: number;
  contenuMd: string;
  captureReason: string;
  capturedAt: string;
  createdAt?: string;
}

/** Métadonnées d'une ressource PDF attachée à une fiche support. */
export interface PieceJointeDocument {
  id: string;
  nom: string;
  mimeType: "application/pdf";
  tailleOctets: number;
  creeLe: string;
  url?: string;
}

/** Métadonnées suffisantes pour afficher l'historique sans charger les corps. */
export interface ResumeSnapshotDocument {
  id: string;
  documentId: string;
  version: number;
  captureReason: string;
  capturedAt: string;
}

export type NatureSnapshot = "preuve" | "revision";

/** Le motif de capture distingue une preuve observée d'une révision éditoriale. */
export function natureSnapshot(captureReason: string): NatureSnapshot {
  return captureReason.toLocaleLowerCase("fr").startsWith("preuve") ? "preuve" : "revision";
}

const definition = (
  type: string,
  libelle: string,
  categorie: CategorieDocument,
  dossierParDefaut: string,
  sections: string[],
  relationsRecommandees: string[] = [],
): DefinitionTypeDocument => ({
  type,
  libelle,
  categorie,
  dossierParDefaut,
  champsObligatoires: ["type", "id", "created_at"],
  champsFacultatifs: ["tags", "updated_at", "competencies", "references", "project"],
  sections,
  relationsRecommandees,
});

/** Registre extensible : ajouter un type ne demande pas de modifier le moteur. */
export const TYPES_DOCUMENTS: Readonly<Record<string, DefinitionTypeDocument>> = {
  domaine: definition("domaine", "Domaine", "connaissance", "Domaines", ["Description", "Sous-domaines"]),
  theme: definition("theme", "Thème", "connaissance", "Thèmes", ["Question directrice", "Concepts", "Ressources"]),
  competence: definition("competence", "Compétence", "action", "Compétences", ["Description", "Critères de réussite"]),
  note: definition("note", "Note", "connaissance", "Connaissances/Notes", ["Contexte", "Idées", "À retenir"]),
  reference: definition("reference", "Référence", "connaissance", "Références", ["Résumé", "Passages utiles", "Bibliographie"]),
  article: definition("article", "Article", "connaissance", "Références/Articles", ["Résumé", "Points importants"], ["reference"]),
  cours: definition("cours", "Cours", "connaissance", "Références/Cours", ["Objectifs", "Contenu", "À retenir"], ["competence"]),
  livre: definition("livre", "Livre", "connaissance", "Références/Livres", ["Résumé", "Chapitres utiles"], ["reference"]),
  formule: definition("formule", "Formule", "connaissance", "Connaissances/Formules", ["Définition", "Variables", "Exemple"]),
  reflexion: definition("reflexion", "Réflexion", "connaissance", "Connaissances/Réflexions", ["Question", "Analyse", "Conclusion"]),
  exercice: definition("exercice", "Exercice", "action", "Exercices", ["Énoncé", "Travail", "Retour"], ["competence"]),
  projet: definition("projet", "Projet", "action", "Preuves/Projets", ["Contexte", "Travail réalisé", "Résultats"], ["competence", "reference"]),
  "etude-de-cas": definition("etude-de-cas", "Étude de cas", "action", "Preuves/Études de cas", ["Contexte", "Analyse", "Décision", "Bilan"], ["competence", "reference"]),
  redaction: definition("redaction", "Rédaction", "action", "Productions/Rédactions", ["Sujet", "Rédaction", "Relecture"], ["competence", "reference"]),
  schema: definition("schema", "Schéma", "action", "Productions/Schémas", ["Intention", "Schéma", "Explication"], ["competence"]),
  experimentation: definition("experimentation", "Expérimentation", "action", "Productions/Expérimentations", ["Hypothèse", "Protocole", "Résultats", "Conclusion"], ["competence"]),
  preuve: definition("preuve", "Preuve", "preuve", "Preuves", ["Contexte", "Production", "Compétences mobilisées", "Résultats"], ["competence"]),
};

export type TypeDocument = keyof typeof TYPES_DOCUMENTS;

export function definitionTypeDocument(type: string): DefinitionTypeDocument | null {
  return TYPES_DOCUMENTS[type] ?? null;
}

export function estTypeDocument(type: string): type is TypeDocument {
  return type in TYPES_DOCUMENTS;
}
