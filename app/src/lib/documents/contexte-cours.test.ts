import { describe, expect, it } from "vitest";
import { documentsAssociesAuCours } from "./contexte-cours";
import type { ApercuDocument } from "./types-documents";

function document(
  id: string,
  overrides: Partial<ApercuDocument> = {},
): ApercuDocument {
  return {
    id,
    titre: id,
    type: "note",
    tags: [],
    schema: null,
    schemaCompatible: true,
    frontMatter: { role: "support", domaine: "maths" },
    liens: [],
    ...overrides,
  };
}

describe("contexte documentaire d'un cours", () => {
  it("retient le même domaine ou une compétence commune, sans les preuves", () => {
    const cours = document("cours", { type: "cours", liens: [{ cible: "MAT-01" }] });
    const associes = documentsAssociesAuCours(cours, [
      cours,
      document("fiche", { titre: "Fiche du cours" }),
      document("td", { titre: "TD", frontMatter: { role: "support", domaine: "physique" }, liens: [{ cible: "MAT-01" }] }),
      document("autre", { frontMatter: { role: "support", domaine: "histoire" } }),
      document("preuve", { type: "preuve", frontMatter: { role: "support", domaine: "maths" } }),
    ]);

    expect(associes).toEqual([
      { id: "fiche", titre: "Fiche du cours", type: "note", raison: "même domaine" },
      { id: "td", titre: "TD", type: "note", raison: "compétence commune" },
    ]);
  });

  it("est déterministe et n'inclut pas les archives", () => {
    const cours = document("cours", { type: "cours" });
    const documents = [
      cours,
      document("z", { titre: "Z" }),
      document("a", { titre: "A" }),
      document("archive", { frontMatter: { role: "support", domaine: "maths", archive: true } }),
    ];
    expect(documentsAssociesAuCours(cours, documents)).toEqual([
      { id: "a", titre: "A", type: "note", raison: "même domaine" },
      { id: "z", titre: "Z", type: "note", raison: "même domaine" },
    ]);
  });
});
