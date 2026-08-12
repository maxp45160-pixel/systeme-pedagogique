import { describe, expect, it } from "vitest";
import {
  nomFichierMarkdown,
  validerDocumentMarkdown,
  validerLotDocumentsMarkdown,
} from "./archive";

const DOCUMENT = `---
type: preuve
id: preuve-transport
created_at: 2026-08-12
---

# Optimisation du transport

Production.
`;

describe("contrat d'archive Markdown", () => {
  it("valide un fichier et conserve son contenu exact", () => {
    expect(nomFichierMarkdown("preuve-transport")).toBe("preuve-transport.md");
    expect(validerDocumentMarkdown("preuve-transport.md", DOCUMENT)).toEqual({
      id: "preuve-transport",
      titre: "Optimisation du transport",
      type: "preuve",
      contenuMd: DOCUMENT,
    });
  });

  it("refuse une extension, une identité ou une date invalides", () => {
    expect(() => validerDocumentMarkdown("preuve-transport.txt", DOCUMENT)).toThrow(".md");
    expect(() =>
      validerDocumentMarkdown("autre-id.md", DOCUMENT),
    ).toThrow("ne correspond pas");
    expect(() =>
      validerDocumentMarkdown(
        "preuve-transport.md",
        DOCUMENT.replace("created_at: 2026-08-12", "created_at: demain"),
      ),
    ).toThrow("created_at");
  });

  it("accepte un type futur sans contourner le contrat d'identité", () => {
    const contenu = DOCUMENT.replace("type: preuve", "type: nouveau-type");
    expect(validerDocumentMarkdown("preuve-transport.md", contenu).type).toBe("nouveau-type");
  });

  it("refuse une version Markdown explicitement inconnue", () => {
    const contenu = DOCUMENT.replace("type: preuve", "schema: pedagogie/v2\ntype: preuve");
    expect(() => validerDocumentMarkdown("preuve-transport.md", contenu)).toThrow("pedagogie/v2");
  });

  it("refuse le lot avant toute écriture si un identifiant est déjà présent", () => {
    expect(() =>
      validerLotDocumentsMarkdown(
        [{ nomFichier: "preuve-transport.md", contenuMd: DOCUMENT }],
        ["preuve-transport"],
      ),
    ).toThrow("existe déjà");
  });

  it("refuse une fiche vide", () => {
    expect(() => validerDocumentMarkdown("preuve-transport.md", "   ")).toThrow("vide");
  });
});
