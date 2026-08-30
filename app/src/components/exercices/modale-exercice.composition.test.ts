import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./modale-exercice.tsx", import.meta.url), "utf8");

describe("composition de la génération depuis le repli", () => {
  it("crée une séance ordinaire puis ouvre le focus après acceptation", () => {
    expect(source).toContain("ouvrirEnFocusApresAcceptation");
    expect(source).toContain("const seanceId = await creerSeanceFocusExercice(id);");
    expect(source).toContain("&focus=1");
  });

  it("ne relance pas le tuteur si la séance échoue après l'enregistrement", () => {
    expect(source).toContain("urlComposerAutonome(p.competences[0], undefined)");
    expect(source).toContain("on ne le génère surtout pas une");
  });
});
