import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const actions = readFileSync(new URL("./actions-creation-atelier.tsx", import.meta.url), "utf8");
const liste = readFileSync(new URL("./vues/liste-domaines.tsx", import.meta.url), "utf8");
const modale = readFileSync(new URL("../referentiel/modale-competence.tsx", import.meta.url), "utf8");
const dashboard = readFileSync(new URL("../../app/(app)/app/page.tsx", import.meta.url), "utf8");

describe("création contextuelle des domaines dans Mes cours", () => {
  it("propose les deux cadres métier depuis l'en-tête Domaines", () => {
    expect(actions).toContain('if (vue === "domaines") return ["module", "continu"]');
    expect(actions).toContain("Un module de cours");
    expect(actions).toContain("Un domaine à long terme");
    expect(actions).toContain('ouvrir({ usageDomaine: action })');
    expect(actions).toContain('vue === "domaines" ? "Ajouter" : "Créer"');
  });

  it("rend les deux choix visibles dans l'état vide sans repasser par un besoin", () => {
    expect(liste).toContain("Ajoutez votre premier domaine");
    expect(liste).toContain('ouvrir({ usageDomaine: "module" })');
    expect(liste).toContain('ouvrir({ usageDomaine: "continu" })');
    expect(liste).not.toContain("RappelNouveauBesoin");
    expect(liste).not.toContain("CarteCreationPointillee");
  });

  it("ouvre la saisie directe sans déclencher le tuteur", () => {
    expect(modale).toContain('return usageInitial && !suggestionAutomatique ? "manuel" : "ia"');
  });

  it("garde le tableau de bord sans nouvelle entrée de création", () => {
    expect(dashboard).not.toContain("BoutonIntentionDashboard");
    expect(dashboard).not.toContain("ActionsCreationAtelier");
  });
});
