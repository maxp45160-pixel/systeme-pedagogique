import { describe, expect, it } from "vitest";
import {
  validerElementGlobal,
  validerProvenanceGlobale,
  validerRelationGlobale,
  validerSelectionCarteGlobale,
} from "./validation-carte-globale";

const provenance = { type: "ouvrage", reference: "ISBN 1" };
const element = {
  id: "00000000-0000-0000-0000-000000000001",
  type: "domaine",
  nom: "Mathématiques",
  description: "Une région non exhaustive de la carte.",
  statut: "publie",
  provenance,
  version: 1,
  valideLe: "2026-08-20T12:00:00.000Z",
};

describe("validation Supabase de la carte globale", () => {
  it("valide les trois seules familles d'éléments du noyau", () => {
    expect(validerElementGlobal(element)).toEqual(element);
    expect(() => validerElementGlobal({ ...element, type: "document" })).toThrow(/type/);
  });

  it("refuse une provenance incomplète ou enrichie silencieusement", () => {
    expect(() => validerProvenanceGlobale({ type: "ouvrage", reference: "" })).toThrow(/reference/);
    expect(() => validerProvenanceGlobale({ ...provenance, score: 0.8 })).toThrow(/clés/);
  });

  it("ne confond pas relation déclarée et similarité calculée", () => {
    const relation = {
      id: "00000000-0000-0000-0000-000000000003",
      sourceId: "00000000-0000-0000-0000-000000000001",
      cibleId: "00000000-0000-0000-0000-000000000002",
      type: "PART_OF",
      statut: "publie",
      provenance,
      version: 1,
      valideLe: "2026-08-20T12:00:00.000Z",
    };
    expect(validerRelationGlobale(relation)).toEqual(relation);
    expect(() => validerRelationGlobale({ ...relation, type: "SIMILAR_TO" })).toThrow(/type/);
    expect(() => validerRelationGlobale({ ...relation, cibleId: relation.sourceId })).toThrow(/distinctes/);
  });

  it("valide une sélection privée comme une référence minimale", () => {
    expect(
      validerSelectionCarteGlobale({
        elementId: element.id,
        selectionneLe: "2026-08-20T12:00:00.000Z",
      }),
    ).toEqual({ elementId: element.id, selectionneLe: "2026-08-20T12:00:00.000Z" });
  });
});
