import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./bilan-assiste.tsx", import.meta.url), "utf8");
const fiche = readFileSync(new URL("./vue-exercice.tsx", import.meta.url), "utf8");
const formulaire = readFileSync(new URL("./formulaire-bilan.tsx", import.meta.url), "utf8");

describe("parcours de correction", () => {
  it("montre la réponse attendue avec le verdict avant l'acceptation du bilan", () => {
    expect(source).not.toContain("<ReponseAttendue");
    expect(source).toContain("<FormulaireBilan");
    expect(formulaire).toContain("<ReponseAttendue");
    expect(formulaire).toContain("legende=\"Comparez votre réponse au corrigé après le retour du tuteur.\"");
    expect(formulaire).toContain("{assiste && (");
    expect(formulaire.indexOf("<ReponseAttendue")).toBeGreaterThan(
      formulaire.indexOf("{bilanRedige &&"),
    );
  });

  it("réutilise le même panneau après la clôture", () => {
    expect(fiche).toContain("<ReponseAttendue");
    expect(fiche).not.toContain("<Markdown contenu={exercice.correction} />");
  });
});
