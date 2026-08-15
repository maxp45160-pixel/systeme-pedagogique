/**
 * Registre des types documentaires.
 *
 * Un type décrit du contenu déclaré. Il ne porte jamais de niveau, de score
 * ou de mesure : ces éléments restent dans le domaine des preuves observées.
 */

import type { FrontMatter, LienMarkdown } from "./markdown";

export type CategorieDocument = "connaissance" | "action" | "preuve";

/**
 * Nom d'icône, pas composant : `lib/` reste sans JSX.
 *
 * Le nom est distinct du type pour qu'un nouveau type puisse réutiliser une
 * icône existante sans qu'il faille en dessiner une.
 */
export type NomIcone =
  | "document"
  | "dossier"
  | "domaine"
  | "theme"
  | "competence"
  | "note"
  | "reference"
  | "article"
  | "cours"
  | "livre"
  | "formule"
  | "reflexion"
  | "exercice"
  | "projet"
  | "etude-de-cas"
  | "redaction"
  | "schema"
  | "experimentation"
  | "preuve";

export interface DefinitionTypeDocument {
  type: string;
  libelle: string;
  categorie: CategorieDocument;
  icone: NomIcone;
  dossierParDefaut: string;
  champsObligatoires: string[];
  champsFacultatifs: string[];
  sections: string[];
  /**
   * Sections écrites par le système, pas saisies.
   *
   * Elles se remplissent au fil du travail — les exercices retenus d'une
   * séance, par exemple. L'espace de travail les affiche en lecture, avec leurs
   * liens actifs : présenter un journal automatique sous forme de champ à
   * remplir demanderait de saisir ce qui est déjà écrit.
   *
   * Sous-ensemble de `sections` : une section de journal reste une section.
   */
  sectionsJournal: string[];
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
  icone: NomIcone,
  dossierParDefaut: string,
  sections: string[],
  relationsRecommandees: string[] = [],
  sectionsJournal: string[] = [],
): DefinitionTypeDocument => ({
  type,
  libelle,
  categorie,
  icone,
  sectionsJournal,
  dossierParDefaut,
  champsObligatoires: ["type", "id", "created_at"],
  champsFacultatifs: ["tags", "updated_at", "competencies", "references", "project"],
  sections,
  relationsRecommandees,
});

/** Registre extensible : ajouter un type ne demande pas de modifier le moteur. */
export const TYPES_DOCUMENTS: Readonly<Record<string, DefinitionTypeDocument>> = {
  domaine: definition("domaine", "Domaine", "connaissance", "domaine", "Domaines", ["Description", "Sous-domaines"]),
  theme: definition("theme", "Thème", "connaissance", "theme", "Thèmes", ["Question directrice", "Concepts", "Ressources"]),
  competence: definition("competence", "Compétence", "action", "competence", "Compétences", ["Description", "Critères de réussite"]),
  note: definition("note", "Note", "connaissance", "note", "Connaissances/Notes", ["Contexte", "Idées", "À retenir"]),
  reference: definition("reference", "Référence", "connaissance", "reference", "Références", ["Résumé", "Passages utiles", "Bibliographie"]),
  article: definition("article", "Article", "connaissance", "article", "Références/Articles", ["Résumé", "Points importants"], ["reference"]),
  cours: definition("cours", "Cours", "connaissance", "cours", "Références/Cours", ["Objectifs", "Contenu", "À retenir"], ["competence"]),
  livre: definition("livre", "Livre", "connaissance", "livre", "Références/Livres", ["Résumé", "Chapitres utiles"], ["reference"]),
  formule: definition("formule", "Formule", "connaissance", "formule", "Connaissances/Formules", ["Définition", "Variables", "Exemple"]),
  reflexion: definition("reflexion", "Réflexion", "connaissance", "reflexion", "Connaissances/Réflexions", ["Question", "Analyse", "Conclusion"]),
  exercice: definition("exercice", "Exercice", "action", "exercice", "Exercices", ["Énoncé", "Travail", "Retour"], ["competence"]),
  /*
   * Une séance n'est pas un exercice.
   *
   * `exercice` désigne déjà une fiche d'exercice unique — c'est ce type que
   * portent les 31 exercices projetés dans l'arbre. Une séance en assemble
   * plusieurs : lui donner le même type ferait porter deux sens au même mot, et
   * l'arbre mélangerait les deux. Elle a donc son type et ses sections.
   *
   * La séance reste une `LearningSession` : ce type documente la note qui la
   * cadre, il ne remplace pas l'entité (ADR-048).
   */
  seance: definition("seance", "Séance d'exercices", "action", "exercice", "Séances", ["Intention", "Déroulé", "Bilan"], ["competence"], ["Déroulé"]),
  /*
   * Un projet porte son énoncé.
   *
   * Les sections précédentes — Contexte, Travail réalisé, Résultats — donnaient
   * trois zones vides à remplir soi-même : la fiche ne disait pas ce qu'il y
   * avait à faire. Or un projet généré arrive avec un sujet, des étapes et des
   * critères connus d'avance ; ne pas les afficher revenait à jeter le contrat.
   *
   * Les trois premières sections sont écrites par le système et lues, pas
   * saisies. Les deux dernières restent au travail de la personne.
   */
  projet: definition(
    "projet",
    "Projet",
    "action",
    "projet",
    "Projets",
    ["Énoncé", "Étapes", "Critères d'évaluation", "Travail réalisé", "Résultats"],
    ["competence", "reference"],
    ["Énoncé", "Étapes", "Critères d'évaluation"],
  ),
  "etude-de-cas": definition("etude-de-cas", "Étude de cas", "action", "etude-de-cas", "Preuves/Études de cas", ["Contexte", "Analyse", "Décision", "Bilan"], ["competence", "reference"]),
  redaction: definition("redaction", "Rédaction", "action", "redaction", "Productions/Rédactions", ["Sujet", "Rédaction", "Relecture"], ["competence", "reference"]),
  schema: definition("schema", "Schéma", "action", "schema", "Productions/Schémas", ["Intention", "Schéma", "Explication"], ["competence"]),
  experimentation: definition("experimentation", "Expérimentation", "action", "experimentation", "Productions/Expérimentations", ["Hypothèse", "Protocole", "Résultats", "Conclusion"], ["competence"]),
  preuve: definition("preuve", "Preuve", "preuve", "preuve", "Preuves", ["Contexte", "Production", "Compétences mobilisées", "Résultats"], ["competence"]),
};

export type TypeDocument = keyof typeof TYPES_DOCUMENTS;

export function definitionTypeDocument(type: string): DefinitionTypeDocument | null {
  return TYPES_DOCUMENTS[type] ?? null;
}

export function estTypeDocument(type: string): type is TypeDocument {
  return type in TYPES_DOCUMENTS;
}
