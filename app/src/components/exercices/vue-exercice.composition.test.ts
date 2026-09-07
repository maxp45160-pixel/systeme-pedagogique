import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./vue-exercice.tsx", import.meta.url), "utf8");

describe("relecture d'un exercice de séance", () => {
  it("affiche la réponse écrite en lecture seule", () => {
    expect(source).toContain('props.lectureSeule && !enCours && derniereCloturee?.statut === "terminee" && derniereCloturee.reponse.trim()');
    expect(source).toContain('EnTeteCarte titre="Votre réponse"');
    expect(source).toContain('<RetourSansCorrection exercice={exercice} tentative={derniereCloturee}');
  });
});
