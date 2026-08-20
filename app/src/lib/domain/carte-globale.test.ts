import { describe, expect, it } from "vitest";
import { motifRefusProvenanceGlobale } from "./carte-globale";

describe("carte globale minimale", () => {
  it("exige une provenance explicite avant toute publication", () => {
    expect(motifRefusProvenanceGlobale({ type: "", reference: "ouvrage" })).toMatch(/type/);
    expect(motifRefusProvenanceGlobale({ type: "ouvrage", reference: "" })).toMatch(/référence/);
    expect(motifRefusProvenanceGlobale({ type: "ouvrage", reference: "ISBN 1" })).toBeNull();
  });

  it("refuse une note vide plutôt que de fabriquer une justification", () => {
    expect(
      motifRefusProvenanceGlobale({ type: "validation humaine", reference: "revue", note: "  " }),
    ).toMatch(/note/);
  });
});
