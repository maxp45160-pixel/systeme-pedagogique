import { describe, expect, it } from "vitest";
import { activiteDocumentaire, filRessourcesDomaine, type DocumentCorpus } from "./fils-corpus";
import type { SkillObservation } from "@/lib/domain/types";

/*
 * Ce que ces tests protègent : le fil des ressources ne devine rien — le
 * rattachement vient des liens déclarés, l'ordre du journal seul, et une
 * ressource jamais mobilisée reste sans date plutôt que d'en recevoir une
 * inventée.
 */

let compteur = 0;

function observation(documentId: string | null, date: string): SkillObservation {
  return {
    id: `obs-${++compteur}`,
    skillCode: "DEV-01",
    date,
    type: "exercice",
    niveauObservation: "A",
    autonomie: "A3",
    qualite: "moyenne",
    resultat: "reussi",
    contexte: `Contexte ${compteur}`,
    dimensions: { comprehension: 0.9 },
    source: {
      kind: "exercice",
      ref: "ex-1",
      ...(documentId ? { document: { documentId, snapshotId: "snap" } } : {}),
    },
  };
}

const document = (
  id: string,
  competencesCitees: string[],
  extra: Partial<DocumentCorpus> = {},
): DocumentCorpus => ({ id, titre: id, type: "support", competencesCitees, ...extra });

describe("activiteDocumentaire — l'ordre vient du journal", () => {
  it("rend la dernière date par document cité comme preuve", () => {
    const activite = activiteDocumentaire([
      observation("doc-a", "2026-08-01T09:00:00.000Z"),
      observation("doc-a", "2026-08-10T09:00:00.000Z"),
      observation("doc-b", "2026-08-05T09:00:00.000Z"),
      // Sans document : n'avance aucune ressource.
      observation(null, "2026-08-14T09:00:00.000Z"),
    ]);

    expect(activite.get("doc-a")).toBe("2026-08-10T09:00:00.000Z");
    expect(activite.get("doc-b")).toBe("2026-08-05T09:00:00.000Z");
    expect(activite.size).toBe(2);
  });

  it("ne fabrique aucune entrée sur un journal vide", () => {
    expect(activiteDocumentaire([]).size).toBe(0);
  });
});

describe("filRessourcesDomaine — rattachement déclaré, ordre dérivé", () => {
  const codes = new Set(["DEV-01", "DEV-02"]);

  it("garde les ressources qui citent une compétence du domaine, pas les autres", () => {
    const fil = filRessourcesDomaine({
      domaineId: "developpement",
      codesCompetences: codes,
      documents: [
        document("doc-dev", ["DEV-01"]),
        document("doc-autre", ["STAT-01"]),
        document("doc-mixte", ["DEV-02", "STAT-01"]),
      ],
      observations: [],
    });

    expect(fil.map((r) => r.documentId)).toEqual(["doc-dev", "doc-mixte"]);
  });

  it("garde la fiche déclarée pour ce domaine, pas celle d'un autre domaine", () => {
    const fil = filRessourcesDomaine({
      domaineId: "developpement",
      codesCompetences: codes,
      documents: [
        document("fiche-dev", [], { domaineConnu: "developpement", role: undefined }),
        document("fiche-stat", [], { domaineConnu: "statistiques" }),
        document("support-dev", ["DEV-01"], { role: "support" }),
      ],
      observations: [],
    });

    expect(fil.map((r) => r.documentId)).toEqual(["fiche-dev", "support-dev"]);
  });

  it("ordonne du plus récemment travaillé au plus ancien, et laisse les jamais mobilisées en queue SANS date", () => {
    const fil = filRessourcesDomaine({
      domaineId: "developpement",
      codesCompetences: codes,
      documents: [
        document("jamais-touchee", ["DEV-01"]),
        document("ancienne", ["DEV-01"]),
        document("recente", ["DEV-02"]),
      ],
      observations: [
        observation("ancienne", "2026-07-01T09:00:00.000Z"),
        observation("recente", "2026-08-14T09:00:00.000Z"),
      ],
    });

    expect(fil.map((r) => r.documentId)).toEqual(["recente", "ancienne", "jamais-touchee"]);
    expect(fil[2].derniereActivite).toBeNull();
  });
});
