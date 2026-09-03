import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const formulaire = readFileSync(new URL("./formulaire-amorcage.tsx", import.meta.url), "utf8");
const assistant = readFileSync(
  new URL("../profil/assistant-orientation-profil.tsx", import.meta.url),
  "utf8",
);

describe("brouillon de l'amorçage", () => {
  it("partage les mêmes réponses entre le diagnostic guidé et la saisie directe", () => {
    expect(formulaire).toContain("useState<ReponsesOrientation>");
    expect(formulaire).toContain("reponses={reponsesOrientation}");
    expect(formulaire).toContain("surReponsesChange={setReponsesOrientation}");
    expect(formulaire).toContain("etape={etapeGuide}");
    expect(formulaire).toContain("surEtapeChange={setEtapeGuide}");
    expect(assistant).not.toContain("useState(");
    expect(assistant).not.toContain("sujetInitial");
  });

  it("demande une intention déclarée et ne conserve aucun rythme inutilisé", () => {
    expect(assistant).toContain("intention.trim().length < 3");
    expect(assistant).toContain("Capacité visée");
    expect(assistant).not.toContain("rythmeHeures");
    expect(assistant).not.toContain("Rythme hebdomadaire souhaité");
  });
});
