import { describe, expect, it } from "vitest";
import { amorceExercice, amorceLotExercices, lienTuteur } from "./amorces";

/*
 * L'amorce ne donne aucun pouvoir nouveau au tuteur : elle recopie ce que
 * l'écran affiche déjà. Ce qui se teste ici, c'est qu'elle ne recopie RIEN
 * qu'elle n'ait reçu — une difficulté absente ne doit pas devenir un nombre.
 */

describe("amorceExercice", () => {
  it("ne mentionne aucune difficulté quand la calibration n'en conseille pas", () => {
    const a = amorceExercice("DEV-01");
    expect(a).toBe("Propose-moi un exercice sur DEV-01.");
    expect(a).not.toMatch(/difficulté/i);
  });

  it("ne fabrique pas de difficulté à partir de null", () => {
    const a = amorceExercice("DEV-01", { difficulteConseillee: null, dimensionFaible: null });
    expect(a).not.toMatch(/difficulté/i);
    expect(a).not.toMatch(/null/);
  });

  it("reprend la difficulté et la dimension quand elles existent", () => {
    const a = amorceExercice("LOG-10", {
      difficulteConseillee: 2,
      dimensionFaible: "application",
    });
    expect(a).toContain("LOG-10");
    expect(a).toContain("difficulté 2/5");
    expect(a).toContain("Application");
  });
});

describe("amorceLotExercices", () => {
  it("nomme chaque code et demande autant d'appels d'outil", () => {
    const a = amorceLotExercices(["DEB-01", "DEB-02", "DEB-03"], "Débutants");
    expect(a).toContain("DEB-01, DEB-02, DEB-03");
    expect(a).toContain("(3 appels)");
    expect(a).toContain("Débutants");
  });

  it("fonctionne sans nom de domaine", () => {
    expect(amorceLotExercices(["RO-02"])).toContain("RO-02");
  });
});

describe("lienTuteur", () => {
  it("encode l'amorce — un énoncé contient des espaces et des accents", () => {
    const lien = lienTuteur("Propose-moi un exercice sur DEV-01.", "DEV-01");
    expect(lien.startsWith("/tuteur?")).toBe(true);
    expect(lien).toContain("competence=DEV-01");
    const params = new URLSearchParams(lien.slice("/tuteur?".length));
    expect(params.get("amorce")).toBe("Propose-moi un exercice sur DEV-01.");
  });

  it("omet la compétence quand il s'agit d'un lot multi-compétences", () => {
    expect(lienTuteur("…")).not.toContain("competence=");
  });
});
