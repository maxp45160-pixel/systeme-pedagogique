import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./formulaire-bilan.tsx", import.meta.url), "utf8");

describe("faits déclarés du bilan", () => {
  it("n'invente pas l'absence d'aide extérieure", () => {
    expect(source).toContain("useState<AideExterne | null>(null)");
    expect(source).toContain("if (aide === null) {");
    expect(source).toContain("aide === null || enCours");
    expect(source).toContain("aucune valeur ne sera supposée à votre place");
  });

  it("expose l'état des choix aux technologies d'assistance", () => {
    expect(source).toContain("aria-pressed={resultat === r.valeur}");
    expect(source).toContain("aria-pressed={criteres[i] === a.valeur}");
    expect(source).toContain("aria-pressed={aide === a.valeur}");
  });
});
