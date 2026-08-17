import { describe, expect, it } from "vitest";
import { FORMATS_PAR_ROLE, formatAutorise } from "./roles-note";
import { definitionTypeDocument } from "./types-documents";

describe("formats de note par rôle", () => {
  it("range la séance d'exercices côté opérationnel", () => {
    expect(formatAutorise("operationnel", "seance")).toBe(true);
    expect(formatAutorise("support", "seance")).toBe(false);
  });

  it("garde les deux rôles disjoints", () => {
    const support = new Set(FORMATS_PAR_ROLE.support.map(({ valeur }) => valeur));
    for (const { valeur } of FORMATS_PAR_ROLE.operationnel) {
      expect(support, `« ${valeur} » ne peut pas relever des deux rôles`).not.toContain(valeur);
    }
  });

  it("n'expose que des formats déclarés dans le registre documentaire", () => {
    for (const role of ["support", "operationnel"] as const) {
      for (const { valeur } of FORMATS_PAR_ROLE[role]) {
        expect(definitionTypeDocument(valeur), `format « ${valeur} »`).not.toBeNull();
      }
    }
  });

  it("refuse un format inconnu quel que soit le rôle", () => {
    expect(formatAutorise("operationnel", "preuve")).toBe(false);
    expect(formatAutorise("support", "preuve")).toBe(false);
    expect(formatAutorise("operationnel", "inexistant")).toBe(false);
  });
});

describe("une note opérationnelle prépare une production", () => {
  /*
   * Le rôle est une intention déclarée, jamais une mesure (ADR-064). Ce test
   * protège la cohérence entre les deux déclarations : un format opérationnel
   * qui ne serait pas de catégorie « action » signalerait qu'on a rangé une
   * fiche de connaissance parmi les productions.
   */
  it("classe tous les formats opérationnels en catégorie action", () => {
    for (const { valeur } of FORMATS_PAR_ROLE.operationnel) {
      expect(definitionTypeDocument(valeur)?.categorie, `format « ${valeur} »`).toBe("action");
    }
  });

  it("classe tous les formats de support en catégorie connaissance", () => {
    for (const { valeur } of FORMATS_PAR_ROLE.support) {
      expect(definitionTypeDocument(valeur)?.categorie, `format « ${valeur} »`).toBe("connaissance");
    }
  });

  it("donne à chaque format opérationnel des sections où décrire le travail", () => {
    for (const { valeur } of FORMATS_PAR_ROLE.operationnel) {
      expect(definitionTypeDocument(valeur)?.sections.length, `format « ${valeur} »`).toBeGreaterThan(0);
    }
  });
});
