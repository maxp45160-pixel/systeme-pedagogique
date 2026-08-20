import { describe, expect, it } from "vitest";
import {
  analyserDemandeReferentiel,
  besoinValide,
  demandeSeanceSansSujet,
  urlComposition,
  validerActionIntention,
  validerTraductionIntention,
} from "./intention";

const CODES = new Set(["LOG-01", "LOG-02", "FIN-01"]);

function action(surcharge: Record<string, unknown> = {}) {
  return {
    genre: "travail",
    titre: "Trois exercices sur le calcul de coût",
    pourquoi: "Deux compétences sans observation récente répondent au besoin exprimé.",
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

describe("analyserDemandeReferentiel", () => {
  it("préserve l’intitulé explicite d’une compétence", () => {
    expect(
      analyserDemandeReferentiel('Ajoute une compétence intitulée "Effectuer une addition".'),
    ).toEqual({
      type: "competence",
      explicite: true,
      intitules: ["Effectuer une addition"],
    });
  });

  it("conserve le nombre de domaines et la granularité demandés", () => {
    expect(analyserDemandeReferentiel("Crée 2 domaines avec une granularité fine.")).toEqual({
      type: "domaine",
      explicite: true,
      intitules: [],
      nombreDomaines: 2,
      granularite: "fine",
    });
  });

  it("reconnaît un objectif précis formulé avec apprendre à", () => {
    expect(analyserDemandeReferentiel("Je veux apprendre à faire des additions")).toEqual({
      type: "competence",
      explicite: true,
      intitules: ["Faire des additions"],
    });
  });

  it("reconnaît une demande de vue d'ensemble", () => {
    expect(analyserDemandeReferentiel("Je veux apprendre la physique")).toEqual({
      type: "domaine",
      explicite: true,
      intitules: [],
      portee: "large",
    });
  });

  it("conserve le niveau débutant pour cadrer la progression", () => {
    expect(analyserDemandeReferentiel("Je veux apprendre la physique, je suis un gros noob")).toMatchObject({
      type: "domaine",
      portee: "large",
      niveau: "debutant",
    });
  });
});

describe("validerActionIntention", () => {
  it("accepte une action complète", () => {
    const valide = validerActionIntention(action(), CODES);
    expect(valide).not.toBeNull();
    expect(valide?.genre).toBe("travail");
    expect(valide?.codes).toEqual(["LOG-01"]);
  });

  /*
   * « projet » servait de genre inconnu dans ce test : il l'a été, il ne l'est
   * plus depuis que le parcours de projet est branché. Le test restait vert
   * pour une autre raison — l'action tombait faute de sujet — donc il ne
   * vérifiait plus rien de ce que son nom annonce.
   */
  it("refuse un genre inconnu", () => {
    expect(validerActionIntention(action({ genre: "poème" }), CODES)).toBeNull();
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

  it("accepte une séance générale sans code quand le sujet est explicite", () => {
    const valide = validerActionIntention(
      action({ genre: "travail", codes: [], sujet: "Créer une séance" }),
      CODES,
    );
    expect(valide?.genre).toBe("travail");
    expect(valide?.codes).toEqual([]);
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

  it("garde le sujet écrit pour une extension de référentiel", () => {
    expect(
      validerActionIntention(
        action({ genre: "referentiel", codes: [], sujet: "thermodynamique" }),
        CODES,
      )?.sujet,
    ).toBe("thermodynamique");
  });

  /*
   * Le sujet manquant retombe sur le titre plutôt que de faire tomber
   * l'action : c'est déjà ce que fait le consommateur (`action.sujet ||
   * action.titre`), et l'exiger refusait des actions exécutables — « génère moi
   * un domaine mathématiques » revenait comme « proposition incomplète ».
   */
  it("retombe sur le titre quand le sujet manque, pour un référentiel comme pour un projet", () => {
    for (const genre of ["referentiel", "projet"]) {
      const valide = validerActionIntention(
        action({ genre, codes: [], sujet: "", titre: "Décrire le domaine mathématiques" }),
        CODES,
      );
      expect(valide?.sujet).toBe("Décrire le domaine mathématiques");
    }
  });

  it("ne fabrique aucun sujet pour un travail", () => {
    expect(validerActionIntention(action({ sujet: "" }), CODES)?.sujet).toBe("");
  });

  it("accepte une note sans code ni sujet", () => {
    const valide = validerActionIntention(
      action({ genre: "note", codes: [], sujet: "" }),
      CODES,
    );
    expect(valide?.genre).toBe("note");
  });

  it("accepte une clarification sans compétence désignée", () => {
    const valide = validerActionIntention(
      action({
        genre: "clarification",
        titre: "Préciser le format souhaité",
        pourquoi: "PDF à conserver ou contenu à transformer : le geste n'est pas le même.",
        codes: [],
        sujet: "Veux-tu conserver le PDF ou en extraire les compétences ?",
      }),
      CODES,
    );
    expect(valide?.genre).toBe("clarification");
    expect(valide?.sujet).toContain("PDF");
  });

  it("refuse une clarification qui désigne des compétences", () => {
    expect(
      validerActionIntention(
        action({ genre: "clarification", codes: ["LOG-01"], sujet: "Quel format ?" }),
        CODES,
      ),
    ).toBeNull();
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

  it("porte explicitement l'absence de sujet pour une séance générale", () => {
    expect(urlComposition([], "créer une séance", { sansTheme: true })).toBe(
      "/seances?composer=1&intention=cr%C3%A9er+une+s%C3%A9ance&sans-theme=1",
    );
  });
});

describe("demandeSeanceSansSujet", () => {
  it("reconnaît la création d'une séance sans choisir sa cible", () => {
    expect(demandeSeanceSansSujet("Créer une séance")).toBe(true);
    expect(demandeSeanceSansSujet("Composer une séance d'entraînement")).toBe(true);
  });

  it("conserve le sujet quand la séance est ciblée", () => {
    expect(demandeSeanceSansSujet("Créer une séance sur les stocks")).toBe(false);
  });
});
