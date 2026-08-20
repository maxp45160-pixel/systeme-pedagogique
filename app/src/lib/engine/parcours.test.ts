import { describe, expect, it } from "vitest";
import { competencesConnexes, parcoursCompetence } from "./parcours";
import { REFERENTIEL_TEST } from "@/lib/domain/referentiel.fixture";
import type { Difficulte, Exercise, SkillObservation } from "@/lib/domain/types";

/*
 * Ce que ces tests protègent : le parcours est rejoué, pas raconté, et une
 * co-mobilisation est un fait observé — jamais une arête inventée (ADR-056).
 */

const MAINTENANT = new Date("2026-08-15T12:00:00.000Z");
const JOUR = 86_400_000;
const SKILLS = REFERENTIEL_TEST.parCode;
const DEV01 = SKILLS.get("DEV-01")!;

function ilYa(jours: number): string {
  return new Date(MAINTENANT.getTime() - jours * JOUR).toISOString();
}

let compteur = 0;

function observation(options: {
  skill: string;
  jours: number;
  contexte?: string;
  resultat?: SkillObservation["resultat"];
  combinees?: string[];
}): SkillObservation {
  return {
    id: `obs-${++compteur}`,
    skillCode: options.skill,
    date: ilYa(options.jours),
    type: "exercice",
    niveauObservation: "A",
    autonomie: "A3",
    qualite: "moyenne",
    resultat: options.resultat ?? "reussi",
    contexte: options.contexte ?? `Contexte ${compteur}`,
    dimensions: { comprehension: 0.9, application: 0.85 },
    competencesCombinees: options.combinees,
    source: { kind: "exercice", ref: "ex-1" },
  };
}

function exercice(id: string, competences: string[], archive = false): Exercise {
  return {
    id,
    titre: id,
    domaine: "developpement",
    type: "application",
    difficulte: 2 as Difficulte,
    competences,
    dureeEstimeeMin: 20,
    enonce: "…",
    indices: [],
    correction: "…",
    criteres: [],
    origine: "seed",
    archive,
  };
}

/* ------------------------------------------------------------------ */

describe("parcoursCompetence — le niveau avant chaque observation", () => {
  it("rend le parcours du plus récent au plus ancien", () => {
    const parcours = parcoursCompetence(
      DEV01,
      [
        observation({ skill: "DEV-01", jours: 30 }),
        observation({ skill: "DEV-01", jours: 10 }),
        observation({ skill: "DEV-01", jours: 1 }),
      ],
      MAINTENANT,
    );

    expect(parcours).toHaveLength(3);
    expect(parcours[0].date > parcours[1].date).toBe(true);
    expect(parcours[1].date > parcours[2].date).toBe(true);
  });

  it("marque la toute première observation comme première mesure, pas comme progression", () => {
    const parcours = parcoursCompetence(DEV01, [observation({ skill: "DEV-01", jours: 1 })], MAINTENANT);

    expect(parcours[0].niveauAvant).toBeNull();
    expect(parcours[0].premiereMesure).toBe(true);
    expect(parcours[0].progression).toBe(false);
    expect(parcours[0].recul).toBe(false);
  });

  it("chaîne les niveaux : l'après d'une étape est l'avant de la suivante", () => {
    const parcours = parcoursCompetence(
      DEV01,
      [
        observation({ skill: "DEV-01", jours: 30, contexte: "A" }),
        observation({ skill: "DEV-01", jours: 10, contexte: "B" }),
      ],
      MAINTENANT,
    );

    // parcours[0] est la plus récente, parcours[1] la plus ancienne.
    expect(parcours[0].niveauAvant).toBe(parcours[1].niveauApres);
  });

  it("signale un contexte inédit, qui est ce qui atteste un transfert", () => {
    const parcours = parcoursCompetence(
      DEV01,
      [
        observation({ skill: "DEV-01", jours: 30, contexte: "Contexte A" }),
        observation({ skill: "DEV-01", jours: 10, contexte: "Contexte A" }),
        observation({ skill: "DEV-01", jours: 1, contexte: "Contexte B" }),
      ],
      MAINTENANT,
    );

    expect(parcours[0].nouveauContexte).toBe(true);  // Contexte B
    expect(parcours[1].nouveauContexte).toBe(false); // Contexte A, déjà vu
    expect(parcours[2].nouveauContexte).toBe(true);  // la première de toutes
  });

  it("ignore les observations des autres compétences", () => {
    const parcours = parcoursCompetence(
      DEV01,
      [observation({ skill: "DEV-02", jours: 5 }), observation({ skill: "DEV-01", jours: 1 })],
      MAINTENANT,
    );

    expect(parcours).toHaveLength(1);
  });

  it("borne le nombre d'étapes rejouées", () => {
    const observations = Array.from({ length: 20 }, (_, i) => observation({ skill: "DEV-01", jours: 20 - i }));
    const parcours = parcoursCompetence(DEV01, observations, MAINTENANT, 5);

    expect(parcours).toHaveLength(5);
    // Ce sont les cinq DERNIÈRES qui sont rendues.
    expect(parcours[0].date).toBe(observations[19].date);
  });

  it("ne rend rien sans observation, plutôt qu'une étape à zéro", () => {
    expect(parcoursCompetence(DEV01, [], MAINTENANT)).toEqual([]);
  });
});

describe("competencesConnexes — déclaré d'abord, observé ensuite", () => {
  const commun = {
    actifs: REFERENTIEL_TEST.actifs,
    skillsParCode: SKILLS,
  };

  it("rend les prérequis déclarés et les compétences qui en dépendent", () => {
    // DEV-04 a deux prérequis (DEV-01, DEV-03) et une suivante (DEV-05).
    const cible = SKILLS.get("DEV-04")!;
    const connexes = competencesConnexes({
      ...commun,
      skill: cible,
      exercices: [],
      observations: [],
    });

    for (const code of cible.prerequis) {
      expect(connexes.find((item) => item.code === code)?.relation).toBe("prerequis");
    }
    const suivantes = REFERENTIEL_TEST.actifs
      .filter((skill) => skill.prerequis.includes(cible.code))
      .map((skill) => skill.code);
    for (const code of suivantes) {
      expect(connexes.find((item) => item.code === code)?.relation).toBe("suivante");
    }
  });

  it("compte les compétences visées par les mêmes exercices", () => {
    /*
      DEV-02 et DEV-03 ne sont ni prérequis ni suivantes de DEV-01 : leur seul
      lien possible est celui que le travail crée. DEV-04 et DEV-06, eux,
      déclarent DEV-01 en prérequis — les prendre ici testerait l'exclusion,
      pas le comptage.
    */
    const connexes = competencesConnexes({
      ...commun,
      skill: DEV01,
      exercices: [
        exercice("ex-1", ["DEV-01", "DEV-02"]),
        exercice("ex-2", ["DEV-01", "DEV-02"]),
        exercice("ex-3", ["DEV-01", "DEV-03"]),
      ],
      observations: [],
    });

    const co = connexes.filter((item) => item.relation === "co-mobilisee");
    // Le plus souvent travaillé ensemble arrive en tête.
    expect(co[0].code).toBe("DEV-02");
    expect(co[0].occurrences).toBe(2);
    expect(co.find((item) => item.code === "DEV-03")?.occurrences).toBe(1);
  });

  it("compte aussi les compétences nommées sur une même observation", () => {
    const connexes = competencesConnexes({
      ...commun,
      skill: DEV01,
      exercices: [],
      observations: [observation({ skill: "DEV-01", jours: 1, combinees: ["DEV-02"] })],
    });

    expect(connexes.find((item) => item.code === "DEV-02")?.occurrences).toBe(1);
  });

  it("ignore un exercice archivé : il ne relie plus rien", () => {
    const connexes = competencesConnexes({
      ...commun,
      skill: DEV01,
      exercices: [exercice("ex-1", ["DEV-01", "DEV-02"], true)],
      observations: [],
    });

    expect(connexes.filter((item) => item.relation === "co-mobilisee")).toEqual([]);
  });

  it("ne répète pas en co-mobilisée une compétence déjà déclarée prérequis", () => {
    const cible = SKILLS.get("DEV-04")!;
    const prerequis = cible.prerequis[0];
    expect(prerequis).toBeDefined();
    const connexes = competencesConnexes({
      ...commun,
      skill: cible,
      exercices: [exercice("ex-1", [cible.code, prerequis])],
      observations: [],
    });

    const occurrences = connexes.filter((item) => item.code === prerequis);
    expect(occurrences).toHaveLength(1);
    expect(occurrences[0].relation).toBe("prerequis");
  });

  it("exclut une suivante déclarée des co-mobilisées, même travaillée ensemble", () => {
    // DEV-04 déclare DEV-01 en prérequis : la relation déclarée est plus
    // précise que l'observation, et deux entrées feraient croire à deux liens.
    const connexes = competencesConnexes({
      ...commun,
      skill: DEV01,
      exercices: [exercice("ex-1", ["DEV-01", "DEV-04"])],
      observations: [],
    });

    const dev04 = connexes.filter((item) => item.code === "DEV-04");
    expect(dev04).toHaveLength(1);
    expect(dev04[0].relation).toBe("suivante");
  });

  it("ne se compte jamais elle-même", () => {
    const connexes = competencesConnexes({
      ...commun,
      skill: DEV01,
      exercices: [exercice("ex-1", ["DEV-01"])],
      observations: [],
    });

    expect(connexes.find((item) => item.code === "DEV-01")).toBeUndefined();
  });

  it("dit lesquelles sont déjà mesurées — « ce que tu connais déjà »", () => {
    const connexes = competencesConnexes({
      ...commun,
      skill: DEV01,
      exercices: [exercice("ex-1", ["DEV-01", "DEV-02", "DEV-03"])],
      observations: [observation({ skill: "DEV-02", jours: 3 })],
    });

    expect(connexes.find((item) => item.code === "DEV-02")?.dejaMesuree).toBe(true);
    expect(connexes.find((item) => item.code === "DEV-03")?.dejaMesuree).toBe(false);
  });
});
