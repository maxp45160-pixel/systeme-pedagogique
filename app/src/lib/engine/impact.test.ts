import { describe, expect, it } from "vitest";
import { impactCumule, impactTentative } from "./impact";
import { REFERENTIEL_TEST } from "@/lib/domain/referentiel.fixture";
import type {
  Autonomie,
  Difficulte,
  Dimension,
  Exercise,
  ExerciseAttempt,
  SkillObservation,
} from "@/lib/domain/types";

/*
 * Ce que ces tests protègent : l'impact est **dérivé**, jamais fabriqué.
 *
 * Trois garanties, chacune héritée d'un principe déjà défendu ailleurs dans le
 * moteur — une tentative sans observation ne dit rien (P2), une observation qui ne
 * déplace pas le niveau reste affichée (elle confirme), et aucune phrase ne
 * sort sans une valeur du moteur derrière elle (P3).
 */

const MAINTENANT = new Date("2026-08-15T12:00:00.000Z");
const JOUR = 86_400_000;
const SKILLS = REFERENTIEL_TEST.parCode;

function ilYa(jours: number): string {
  return new Date(MAINTENANT.getTime() - jours * JOUR).toISOString();
}

let compteur = 0;

function observation(options: {
  skill: string;
  date: string;
  autonomie?: Autonomie;
  resultat?: SkillObservation["resultat"];
  contexte?: string;
  dims?: Partial<Record<Dimension, number>>;
  niveauObservation?: "A" | "B";
  refExercice?: string;
}): SkillObservation {
  return {
    id: `obs-${++compteur}`,
    skillCode: options.skill,
    date: options.date,
    type: "exercice",
    niveauObservation: options.niveauObservation ?? "A",
    autonomie: options.autonomie ?? "A3",
    qualite: "moyenne",
    resultat: options.resultat ?? "reussi",
    contexte: options.contexte ?? "Contexte A",
    dimensions: options.dims ?? { comprehension: 0.9, application: 0.85 },
    source: { kind: "exercice", ref: options.refExercice ?? "ex-1" },
  };
}

function exercice(options: { competences: string[]; difficulte?: Difficulte } ): Exercise {
  return {
    id: "ex-1",
    titre: "Tri d'une liste",
    domaine: "developpement",
    type: "application",
    difficulte: options.difficulte ?? 2,
    competences: options.competences,
    dureeEstimeeMin: 20,
    enonce: "…",
    indices: ["a", "b"],
    correction: "…",
    criteres: [],
    origine: "seed",
  };
}

function tentative(options: {
  fin: string;
  statut?: ExerciseAttempt["statut"];
  indices?: number;
  dureeMin?: number;
  verdict?: ExerciseAttempt["verdictTuteur"];
}): ExerciseAttempt {
  return {
    id: "att-1",
    exerciseId: "ex-1",
    debut: options.fin,
    fin: options.fin,
    dureeMin: options.dureeMin ?? 18,
    indicesUtilises: options.indices ?? 0,
    reponse: "…",
    evaluation: { comprehension: 0.9 },
    resultat: "reussi",
    statut: options.statut ?? "terminee",
    verdictTuteur: options.verdict,
  };
}

/* ------------------------------------------------------------------ */

describe("impactTentative — ce qui n'a rien mesuré ne rend rien", () => {
  it("rend null sur une tentative abandonnée (P2 : absence de mesure n'est pas un zéro)", () => {
    const fin = ilYa(0);
    const resultat = impactTentative({
      exercice: exercice({ competences: ["DEV-01"] }),
      tentative: tentative({ fin, statut: "abandonnee" }),
      observations: [],
      skillsParCode: SKILLS,
      now: MAINTENANT,
    });
    expect(resultat).toBeNull();
  });

  it("rend null quand aucune observation ne porte l'horodatage de la tentative", () => {
    const resultat = impactTentative({
      exercice: exercice({ competences: ["DEV-01"] }),
      tentative: tentative({ fin: ilYa(0) }),
      // Observation du même exercice, mais d'une tentative antérieure.
      observations: [observation({ skill: "DEV-01", date: ilYa(9) })],
      skillsParCode: SKILLS,
      now: MAINTENANT,
    });
    expect(resultat).toBeNull();
  });
});

describe("impactTentative — le niveau avant et après", () => {
  it("annonce une première mesure comme telle, jamais comme une progression", () => {
    const fin = ilYa(0);
    const produite = observation({ skill: "DEV-01", date: fin });
    const resultat = impactTentative({
      exercice: exercice({ competences: ["DEV-01"] }),
      tentative: tentative({ fin }),
      observations: [produite],
      skillsParCode: SKILLS,
      now: MAINTENANT,
    })!;

    expect(resultat.renforcees).toHaveLength(1);
    expect(resultat.renforcees[0].niveauAvant).toBeNull();
    expect(resultat.renforcees[0].niveauApres).not.toBeNull();
    expect(resultat.consequences.join(" ")).toContain("mesurée pour la première fois");
  });

  it("dit qu'un niveau inchangé est confirmé, au lieu de taire l'observation", () => {
    const fin = ilYa(0);
    const anterieures = [
      observation({ skill: "DEV-01", date: ilYa(30) }),
      observation({ skill: "DEV-01", date: ilYa(20) }),
    ];
    const produite = observation({ skill: "DEV-01", date: fin });
    const resultat = impactTentative({
      exercice: exercice({ competences: ["DEV-01"] }),
      tentative: tentative({ fin }),
      observations: [...anterieures, produite],
      skillsParCode: SKILLS,
      now: MAINTENANT,
    })!;

    const item = resultat.renforcees[0];
    if (!item.franchissement) {
      expect(resultat.consequences.join(" ")).toContain("sans le déplacer");
    }
    // Quoi qu'il arrive au niveau, l'observation est comptée.
    expect(item.nombreObservations).toBe(3);
  });

  it("compte le franchissement à partir du journal, pas d'un champ stocké", () => {
    const fin = ilYa(0);
    const produite = observation({ skill: "DEV-01", date: fin, contexte: "Contexte B" });
    const resultat = impactTentative({
      exercice: exercice({ competences: ["DEV-01"] }),
      tentative: tentative({ fin }),
      observations: [observation({ skill: "DEV-01", date: ilYa(30) }), produite],
      skillsParCode: SKILLS,
      now: MAINTENANT,
    })!;

    const item = resultat.renforcees[0];
    expect(item.franchissement).toBe(item.niveauAvant !== item.niveauApres);
  });
});

describe("impactTentative — les compétences secondaires", () => {
  it("garde la cible principale en tête et distingue observation directe et indirecte", () => {
    const fin = ilYa(0);
    const resultat = impactTentative({
      exercice: exercice({ competences: ["DEV-02", "DEV-01"] }),
      tentative: tentative({ fin }),
      observations: [
        observation({ skill: "DEV-01", date: fin, niveauObservation: "B" }),
        observation({ skill: "DEV-02", date: fin, niveauObservation: "A" }),
      ],
      skillsParCode: SKILLS,
      now: MAINTENANT,
    })!;

    expect(resultat.renforcees.map((item) => item.code)).toEqual(["DEV-02", "DEV-01"]);
    expect(resultat.renforcees[0].niveauObservation).toBe("A");
    expect(resultat.renforcees[1].niveauObservation).toBe("B");
  });

  it("ignore une observation dont la compétence est absente du référentiel fourni", () => {
    const fin = ilYa(0);
    const resultat = impactTentative({
      exercice: exercice({ competences: ["DEV-01"] }),
      tentative: tentative({ fin }),
      observations: [
        observation({ skill: "DEV-01", date: fin }),
        observation({ skill: "INCONNU-99", date: fin }),
      ],
      skillsParCode: SKILLS,
      now: MAINTENANT,
    })!;

    expect(resultat.renforcees.map((item) => item.code)).toEqual(["DEV-01"]);
  });
});

describe("impactTentative — les observations citent leur source", () => {
  it("dérive l'autonomie de l'observation et le nombre d'indices de la tentative", () => {
    const fin = ilYa(0);
    const resultat = impactTentative({
      exercice: exercice({ competences: ["DEV-01"] }),
      tentative: tentative({ fin, indices: 2 }),
      observations: [observation({ skill: "DEV-01", date: fin, autonomie: "A2" })],
      skillsParCode: SKILLS,
      now: MAINTENANT,
    })!;

    const texte = resultat.observations.join(" ");
    expect(texte).toContain("A2");
    expect(texte).toContain("2 indices consultés");
  });

  it("signale un contexte nouveau, qui est ce qui atteste un transfert", () => {
    const fin = ilYa(0);
    const resultat = impactTentative({
      exercice: exercice({ competences: ["DEV-01"] }),
      tentative: tentative({ fin }),
      observations: [
        observation({ skill: "DEV-01", date: ilYa(20), contexte: "Contexte A" }),
        observation({ skill: "DEV-01", date: fin, contexte: "Contexte B" }),
      ],
      skillsParCode: SKILLS,
      now: MAINTENANT,
    })!;

    expect(resultat.observations.join(" ")).toContain("Contexte nouveau");
  });

  it("reprend le verdict du tuteur sans le transformer en mesure", () => {
    const fin = ilYa(0);
    const resultat = impactTentative({
      exercice: exercice({ competences: ["DEV-01"] }),
      tentative: tentative({
        fin,
        verdict: {
          resultat: "reussi",
          appreciations: {},
          justifications: {},
          bilan: {
            pointsForts: "Méthode bien choisie.",
            pointsBloquants: "Les transformations algébriques dérapent.",
            aRetravailler: ["Factorisation", ""],
          },
          date: fin,
        },
      }),
      observations: [observation({ skill: "DEV-01", date: fin })],
      skillsParCode: SKILLS,
      now: MAINTENANT,
    })!;

    expect(resultat.observations).toContain("Les transformations algébriques dérapent.");
    // Les lignes vides du tuteur ne remontent pas.
    expect(resultat.aRetravailler).toEqual(["Factorisation"]);
  });

  it("nuance une dimension faible observée une seule fois", () => {
    const fin = ilYa(0);
    const calibrations = new Map([
      ["DEV-01", {
        skillCode: "DEV-01",
        difficulteConseillee: 3 as Difficulte,
        signal: null,
        dimensionFaible: { dimension: "transfert" as Dimension, moyenne: 0.3, observations: 1 },
        verdicts: [],
        explication: { resume: "", facteurs: [], nombreObservations: 1, reserves: [] },
      }],
    ]);
    const resultat = impactTentative({
      exercice: exercice({ competences: ["DEV-01"] }),
      tentative: tentative({ fin }),
      observations: [observation({ skill: "DEV-01", date: fin })],
      skillsParCode: SKILLS,
      calibrations,
      now: MAINTENANT,
    })!;

    const texte = resultat.observations.join(" ");
    expect(texte).toContain("Transfert");
    expect(texte).toContain("une seule observation");
  });
});

describe("impactCumule — une séance", () => {
  it("fusionne une compétence travaillée deux fois en un seul écart", () => {
    const premier = ilYa(1);
    const second = ilYa(0);
    const observations = [
      observation({ skill: "DEV-01", date: premier }),
      observation({ skill: "DEV-01", date: second, contexte: "Contexte B" }),
    ];
    const commun = { skillsParCode: SKILLS, observations, now: MAINTENANT };

    const a = impactTentative({
      ...commun,
      exercice: exercice({ competences: ["DEV-01"] }),
      tentative: tentative({ fin: premier }),
    })!;
    const b = impactTentative({
      ...commun,
      exercice: exercice({ competences: ["DEV-01"] }),
      tentative: tentative({ fin: second }),
    })!;

    const cumule = impactCumule([a, b]);
    expect(cumule.renforcees).toHaveLength(1);
    expect(cumule.renforcees[0].niveauAvant).toBe(a.renforcees[0].niveauAvant);
    expect(cumule.renforcees[0].niveauApres).toBe(b.renforcees[0].niveauApres);
    expect(cumule.dureeMin).toBe(36);
  });

  it("ne rend rien à partir d'aucun impact", () => {
    const cumule = impactCumule([]);
    expect(cumule.renforcees).toEqual([]);
    expect(cumule.consequences).toEqual([]);
    expect(cumule.dureeMin).toBe(0);
  });
});
