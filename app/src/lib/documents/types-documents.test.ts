import { describe, expect, it } from "vitest";
import { TYPES_DOCUMENTS, definitionTypeDocument, type NomIcone } from "./types-documents";

const NOMS_ICONES: readonly NomIcone[] = [
  "document",
  "dossier",
  "domaine",
  "theme",
  "competence",
  "note",
  "reference",
  "article",
  "cours",
  "livre",
  "formule",
  "reflexion",
  "exercice",
  "projet",
  "etude-de-cas",
  "redaction",
  "schema",
  "experimentation",
  "preuve",
];

describe("registre des types documentaires", () => {
  it("associe à chaque type un nom d'icône connu", () => {
    for (const [type, definition] of Object.entries(TYPES_DOCUMENTS)) {
      expect(NOMS_ICONES, `type « ${type} »`).toContain(definition.icone);
    }
  });

  it("garde la clé du registre et le champ type alignés", () => {
    for (const [cle, definition] of Object.entries(TYPES_DOCUMENTS)) {
      expect(definition.type).toBe(cle);
    }
  });

  it("retombe sur null pour un type absent du registre", () => {
    expect(definitionTypeDocument("type-inexistant")).toBeNull();
  });

  /*
   * Une section de journal reste une section. Déclarer un journal absent de
   * `sections` le rendrait invisible : l'espace de travail parcourt `sections`,
   * il n'afficherait jamais ce que le système y inscrit.
   */
  it("ne déclare comme journal que des sections existantes", () => {
    for (const [type, definition] of Object.entries(TYPES_DOCUMENTS)) {
      for (const journal of definition.sectionsJournal) {
        expect(definition.sections, `type « ${type} »`).toContain(journal);
      }
    }
  });

  it("laisse au moins une section à saisir quand un journal existe", () => {
    for (const [type, definition] of Object.entries(TYPES_DOCUMENTS)) {
      if (definition.sectionsJournal.length === 0) continue;
      const saisies = definition.sections.filter(
        (section) => !definition.sectionsJournal.includes(section),
      );
      expect(saisies.length, `type « ${type} »`).toBeGreaterThan(0);
    }
  });
});
