import { describe, expect, it } from "vitest";
import type { ApercuDocument } from "../documents/types-documents";
import { adaptNoteDocumentaire, adaptNoteOperationnelle } from "./note-activity-adapter";

const options = {
  codesActifs: new Set(["DEV-01"]),
  documentsFiges: new Set<string>(),
};

function apercu(overrides: Partial<ApercuDocument> = {}): ApercuDocument {
  return {
    id: "doc-1",
    titre: "Travail sur le sujet",
    type: "projet",
    tags: [],
    schema: "pedagogie/v1",
    schemaCompatible: true,
    frontMatter: { role: "operationnel" },
    liens: [],
    ...overrides,
  };
}

describe("adaptation des fiches en actions", () => {
  it("écarte une fiche d'action explicitement archivée", () => {
    expect(
      adaptNoteOperationnelle(
        "compte-1",
        apercu({ frontMatter: { role: "operationnel", archive: true } }),
        options,
      ),
    ).toBeNull();
  });

  it("écarte une fiche dont toutes les compétences sont archivées", () => {
    expect(
      adaptNoteOperationnelle(
        "compte-1",
        apercu({ liens: [{ cible: "ARCH-01" }] }),
        options,
      ),
    ).toBeNull();
  });

  it("conserve une fiche sans cible déclarée", () => {
    expect(adaptNoteOperationnelle("compte-1", apercu(), options)).not.toBeNull();
  });

  it("applique la même règle aux ressources", () => {
    expect(
      adaptNoteDocumentaire(
        "compte-1",
        apercu({
          type: "cours",
          frontMatter: { role: "support" },
          liens: [{ cible: "ARCH-01" }],
        }),
        options,
      ),
    ).toBeNull();
  });
});
