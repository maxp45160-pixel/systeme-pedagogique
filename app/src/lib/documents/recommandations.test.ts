import { describe, expect, it } from "vitest";
import type { ApercuDocument } from "./types-documents";
import { recommanderActionsDocumentaires } from "./recommandations";

function apercu(type: string, id = `doc-${type}`): ApercuDocument {
  return {
    id,
    titre: id,
    type,
    tags: [],
    schema: null,
    schemaCompatible: true,
    frontMatter: {},
    liens: [],
  };
}

describe("recommanderActionsDocumentaires", () => {
  it("propose des gestes documentaires distincts sur un corpus vide", () => {
    expect(recommanderActionsDocumentaires([]).map((action) => action.format)).toEqual([
      "article",
      "cours",
    ]);
    expect(recommanderActionsDocumentaires([])[0].intitule).toBe("Lire un papier de recherche");
  });

  it("fait remonter le format le moins représenté", () => {
    const recommandations = recommanderActionsDocumentaires([
      apercu("article", "article-1"),
      apercu("cours", "cours-1"),
      apercu("cours", "cours-2"),
    ]);

    expect(recommandations.map((action) => action.format)).toEqual([
      "formule",
      "reference",
    ]);
    expect(recommandations[0].raison).toContain("Aucun document");
  });

  it("ignore les projections et respecte la limite demandée", () => {
    const recommandations = recommanderActionsDocumentaires([
      apercu("competence"),
      apercu("exercice"),
    ], 1);

    expect(recommandations).toHaveLength(1);
    expect(recommandations[0].format).toBe("article");
  });
});
