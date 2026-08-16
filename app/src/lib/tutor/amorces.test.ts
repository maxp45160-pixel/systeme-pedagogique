import { describe, expect, it } from "vitest";
import {
  amorceConsigne,
  amorceExercice,
  amorceIndice,
  amorceMethode,
  amorceVerification,
} from "./amorces";

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

describe("amorces d'aide contextuelle pour la résolution", () => {
  it("génère une amorce d'indice sans révélation de solution", () => {
    const a = amorceIndice("DEV-01");
    expect(a).toContain("DEV-01");
    expect(a).toContain("sans me donner la solution");

    const aSansCode = amorceIndice();
    expect(aSansCode).toContain("sans me donner la solution");
  });

  it("génère une amorce d'explication de consigne", () => {
    const a = amorceConsigne("MATH-03");
    expect(a).toContain("MATH-03");
    expect(a).toContain("avec d'autres mots");
  });

  it("génère une amorce de rappel méthodologique", () => {
    const a = amorceMethode("SYS-02");
    expect(a).toContain("SYS-02");
    expect(a).toContain("démarche type");
  });

  it("génère une amorce de vérification de démarche", () => {
    const a = amorceVerification("DEV-05");
    expect(a).toContain("DEV-05");
    expect(a).toContain("bonne voie");
  });
});

