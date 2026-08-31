import { describe, expect, it } from "vitest";

import type { VuePedagogiqueAtelier } from "@/lib/documents/vue-atelier";
import { panneauPedagogiqueUtile } from "./fiche-pedagogique";

describe("panneauPedagogiqueUtile", () => {
  it("ne duplique pas une fiche domaine dans le volet de contexte", () => {
    expect(panneauPedagogiqueUtile({ kind: "domaine" } as VuePedagogiqueAtelier)).toBe(false);
  });

  it("conserve le volet quand il apporte le contexte distinct d'un exercice", () => {
    expect(panneauPedagogiqueUtile({ kind: "exercice" } as VuePedagogiqueAtelier)).toBe(true);
  });
});
