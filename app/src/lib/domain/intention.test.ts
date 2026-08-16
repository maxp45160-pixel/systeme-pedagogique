import { describe, expect, it } from "vitest";
import {
  besoinValide,
  urlComposition,
  urlCompositionTheme,
  validerActionIntention,
  validerTraductionIntention,
} from "./intention";

const CODES = new Set(["LOG-01", "LOG-02", "FIN-01"]);

function action(surcharge: Record<string, unknown> = {}) {
  return {
    genre: "travail",
    titre: "Trois exercices sur le calcul de coût",
    pourquoi: "Deux compétences sans preuve récente répondent au besoin exprimé.",
    codes: ["LOG-01"],
    sujet: "",
    ...surcharge,
  };
}

describe("besoinValide", () => {
  it("refuse le vide et le presque vide", () => {
    expect(besoinValide("")).toBe(false);
    expect(besoinValide("  ")).toBe(false);
    expect(besoinValide("ok")).toBe(false);
  });

  it("refuse un texte collé trop long", () => {
    expect(besoinValide("a".repeat(401))).toBe(false);
  });

  it("accepte une phrase", () => {
    expect(besoinValide("j'ai un contrôle sur les stocks vendredi")).toBe(true);
  });
});

describe("validerActionIntention", () => {
  it("accepte une action complète", () => {
    const valide = validerActionIntention(action(), CODES);
    expect(valide).not.toBeNull();
    expect(valide?.genre).toBe("travail");
    expect(valide?.codes).toEqual(["LOG-01"]);
  });

  it("refuse un genre inconnu", () => {
    expect(validerActionIntention(action({ genre: "projet" }), CODES)).toBeNull();
  });

  it("refuse une action sans justification", () => {
    expect(validerActionIntention(action({ pourquoi: "  " }), CODES)).toBeNull();
  });

  it("écarte un code inventé sans faire tomber l'action", () => {
    const valide = validerActionIntention(
      action({ codes: ["LOG-01", "XXX-99"] }),
      CODES,
    );
    expect(valide?.codes).toEqual(["LOG-01"]);
  });

  it("normalise la casse et déduplique les codes", () => {
    const valide = validerActionIntention(
      action({ codes: ["log-01", "LOG-01", "LOG-02"] }),
      CODES,
    );
    expect(valide?.codes).toEqual(["LOG-01", "LOG-02"]);
  });

  it("refuse un travail dont l'écrémage a vidé les codes", () => {
    expect(validerActionIntention(action({ codes: ["XXX-99"] }), CODES)).toBeNull();
  });

  it("plafonne les codes au lot d'exercices", () => {
    const beaucoup = new Set(
      Array.from({ length: 12 }, (_, i) => `LOG-${String(i).padStart(2, "0")}`),
    );
    const valide = validerActionIntention(
      action({ codes: [...beaucoup] }),
      beaucoup,
    );
    expect(valide?.codes).toHaveLength(6);
  });

  it("exige un sujet pour une extension de référentiel", () => {
    expect(
      validerActionIntention(action({ genre: "referentiel", codes: [], sujet: "" }), CODES),
    ).toBeNull();
    expect(
      validerActionIntention(
        action({ genre: "referentiel", codes: [], sujet: "thermodynamique" }),
        CODES,
      ),
    ).not.toBeNull();
  });

  it("exige un sujet pour un projet — son parcours part d'une phrase", () => {
    expect(
      validerActionIntention(action({ genre: "projet", codes: [], sujet: "" }), CODES),
    ).toBeNull();
    expect(
      validerActionIntention(
        action({ genre: "projet", codes: [], sujet: "un dossier d'optimisation d'entrepôt" }),
        CODES,
      ),
    ).not.toBeNull();
  });

  it("accepte une note sans code ni sujet", () => {
    const valide = validerActionIntention(
      action({ genre: "note", codes: [], sujet: "" }),
      CODES,
    );
    expect(valide?.genre).toBe("note");
  });

  it("refuse autre chose qu'un objet", () => {
    expect(validerActionIntention(null, CODES)).toBeNull();
    expect(validerActionIntention([action()], CODES)).toBeNull();
    expect(validerActionIntention("travail", CODES)).toBeNull();
  });
});

describe("validerTraductionIntention", () => {
  it("tombe si l'action principale est invalide", () => {
    expect(
      validerTraductionIntention({ action: action({ genre: "x" }), alternatives: [] }, CODES),
    ).toBeNull();
  });

  it("écarte une alternative mal formée sans tout perdre", () => {
    const traduction = validerTraductionIntention(
      {
        action: action(),
        alternatives: [{ genre: "note" }, action({ genre: "note", titre: "Déposer le sujet", codes: [] })],
      },
      CODES,
    );
    expect(traduction?.alternatives).toHaveLength(1);
    expect(traduction?.alternatives[0].genre).toBe("note");
  });

  it("retire une alternative qui redit l'action principale", () => {
    const traduction = validerTraductionIntention(
      { action: action(), alternatives: [action()] },
      CODES,
    );
    expect(traduction?.alternatives).toHaveLength(0);
  });

  it("plafonne les alternatives à trois", () => {
    const traduction = validerTraductionIntention(
      {
        action: action(),
        alternatives: [1, 2, 3, 4].map((n) =>
          action({ genre: "note", titre: `Ressource ${n}`, codes: [] }),
        ),
      },
      CODES,
    );
    expect(traduction?.alternatives).toHaveLength(3);
  });
});

describe("urlComposition", () => {
  it("reprend la destination du compositeur de séance", () => {
    expect(urlComposition(["LOG-01", "LOG-02"], "calcul de coût")).toBe(
      "/seances?composer=1&code=LOG-01&code=LOG-02&intention=calcul+de+co%C3%BBt",
    );
  });

  it("omet l'intention quand elle est vide", () => {
    expect(urlComposition(["LOG-01"], "   ")).toBe("/seances?composer=1&code=LOG-01");
  });
});

describe("urlCompositionTheme", () => {
  it("passe l'identifiant du thème, jamais ses codes", () => {
    expect(urlCompositionTheme("philosophie", "Philosophie")).toBe(
      "/seances?composer=1&theme=philosophie&intention=Philosophie",
    );
  });

  it("omet l'intention quand elle est vide", () => {
    expect(urlCompositionTheme("philosophie", "  ")).toBe(
      "/seances?composer=1&theme=philosophie",
    );
  });
});
