import { describe, expect, it } from "vitest";
import type { SkillObservation } from "@/lib/domain/types";
import { construireContexteDocumentaire } from "./document-context";

function observation(
  id: string,
  options: {
    skillCode?: string;
    date?: string;
    contexte?: string;
    sourceKind?: SkillObservation["source"]["kind"];
    type?: SkillObservation["type"];
    document?: boolean;
  } = {},
): SkillObservation {
  return {
    id,
    skillCode: options.skillCode ?? "DEV-01",
    date: options.date ?? "2026-08-10",
    type: options.type ?? "exercice",
    niveauObservation: "A",
    autonomie: "A3",
    qualite: "forte",
    resultat: "reussi",
    contexte: options.contexte ?? "Contexte A",
    dimensions: { comprehension: 0.9, application: 0.9 },
    source: {
      kind: options.sourceKind ?? "exercice",
      ref: id,
      ...(options.document === false
        ? {}
        : { document: { documentId: `doc-${id}`, snapshotId: `snapshot-${id}` } }),
    },
  };
}

describe("construireContexteDocumentaire", () => {
  it("agrège les productions documentaires par compétence", () => {
    const contexte = construireContexteDocumentaire([
      observation("obs-1", { date: "2026-08-01", contexte: "Transport" }),
      observation("obs-2", {
        date: "2026-08-10",
        contexte: "Atelier",
        sourceKind: "projet",
        type: "projet",
      }),
      observation("obs-3", { skillCode: "STAT-01", contexte: "Analyse" }),
    ]);

    expect(contexte.get("DEV-01")).toEqual({
      nombre: 2,
      reussites: 2,
      derniereDate: "2026-08-10",
      dernierResultat: "reussi",
      contextes: ["Transport", "Atelier"],
      typesObservation: ["exercice", "projet"],
      typesSource: ["exercice", "projet"],
    });
    expect(contexte.get("STAT-01")?.nombre).toBe(1);
  });

  it("ignore une provenance absente ou une date illisible", () => {
    const contexte = construireContexteDocumentaire([
      observation("obs-sans-document", { document: false }),
      observation("obs-date-invalide", { date: "pas-une-date" }),
    ]);

    expect(contexte.size).toBe(0);
  });
});
