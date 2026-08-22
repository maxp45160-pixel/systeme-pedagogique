import { describe, expect, it } from "vitest";
import { construireProgressionsDomaines } from "./progression-domaine";
import { computeAllSkillStates } from "@/lib/engine/skill-state";
import {
  referentielDe,
  skillDeTest,
  DOMAINES_TEST,
} from "@/lib/domain/referentiel.fixture";
import type { Exercise, ExerciseAttempt, SkillObservation } from "@/lib/domain/types";

/*
 * Ce que ces tests protègent : la vue « Progression » d'un domaine porte
 * exactement ce que `/progression?domaine=` calculait — mêmes fonctions pures,
 * même périmètre — et reste traversable par la frontière RSC : tout champ est
 * sérialisable, sans Date, Map ni fonction cachée.
 */

const MAINTENANT = new Date("2026-08-15T10:00:00.000Z");

/** Une rattachée (ADR-081) : portée par `developpement`, sert `statistiques`. */
const REFERENTIEL = referentielDe(
  [
    skillDeTest("DEV-01", "developpement", "fondamentaux", 1, 0),
    skillDeTest("DEV-02", "developpement", "fondamentaux", 1, 1),
    skillDeTest("DEV-03", "developpement", "intermediaire", 0.9, 2),
  ],
  DOMAINES_TEST,
  [{ code: "DEV-03", domaine: "statistiques" }],
);

let compteur = 0;

function observation(skillCode: string, date: string): SkillObservation {
  return {
    id: `obs-${++compteur}`,
    skillCode,
    date,
    type: "exercice",
    niveauObservation: "A",
    autonomie: "A3",
    qualite: "moyenne",
    resultat: "reussi",
    contexte: `Contexte ${compteur}`,
    dimensions: { comprehension: 0.9 },
    source: { kind: "exercice", ref: "ex-1" },
  };
}

function exercice(id: string, competences: string[]): Exercise {
  return {
    id,
    titre: id,
    domaine: competences[0]?.split("-")[0].toLowerCase() ?? "developpement",
    type: "application",
    difficulte: 2,
    competences,
    dureeEstimeeMin: 15,
    enonce: "",
    indices: [],
    correction: "",
    criteres: [],
    origine: "seed",
  };
}

function tentative(id: string, exerciseId: string): ExerciseAttempt {
  return {
    id,
    exerciseId,
    debut: "2026-08-14T09:00:00.000Z",
    fin: "2026-08-14T09:20:00.000Z",
    indicesUtilises: 0,
    reponse: "",
    evaluation: {},
    resultat: "reussi",
    statut: "terminee",
  };
}

function construire(observations: SkillObservation[], exercices: Exercise[] = [], tentatives: ExerciseAttempt[] = []) {
  return construireProgressionsDomaines({
    referentiel: REFERENTIEL,
    etats: computeAllSkillStates(REFERENTIEL.skills, observations, MAINTENANT),
    observations,
    exercices,
    tentatives,
    dureesEstimees: new Map(exercices.map((ex) => [ex.id, ex.dureeEstimeeMin])),
    now: MAINTENANT,
  });
}

describe("construireProgressionsDomaines — une entrée par domaine du référentiel", () => {
  it("couvre chaque domaine déclaré, archivé ou non", () => {
    const progressions = construire([]);
    expect(Object.keys(progressions).sort()).toEqual(["developpement", "statistiques"]);
    expect(progressions["developpement"].domaine.nom).toBe("Développement logiciel");
  });
});

describe("construireProgressionsDomaines — périmètre et mesures", () => {
  it("sur un domaine sans observation : rien de fabriqué", () => {
    const progression = construire([])["statistiques"];

    expect(progression.score).toBeNull();
    expect(progression.competencesMesurees).toBe(0);
    expect(progression.observationsTotal).toBe(0);
    expect(progression.derniereObservation).toBeNull();
    expect(progression.global.nombreObservations).toBe(0);
    // L'absence de preuve n'est pas un zéro (P2) : le bilan se sait vide.
    expect(progression.croissance.vide).toBe(true);
  });

  it("restreint états, observations et tentatives au périmètre du domaine", () => {
    const exercises = [
      exercice("ex-dev", ["DEV-01"]),
      exercice("ex-stat", ["STAT-01"]),
      exercice("ex-mixte", ["DEV-02", "STAT-01"]),
    ];
    const attempts = [
      tentative("t1", "ex-dev"),
      tentative("t2", "ex-stat"),
      tentative("t3", "ex-mixte"),
    ];
    const observations = [
      observation("DEV-01", "2026-08-01T09:00:00.000Z"),
      observation("STAT-01", "2026-08-02T09:00:00.000Z"),
    ];
    const progressions = construire(observations, exercises, attempts);

    expect(progressions["developpement"].etats.map((etat) => etat.skill.code)).toEqual([
      "DEV-01",
      "DEV-02",
      "DEV-03",
    ]);
    expect(progressions["developpement"].observationsTotal).toBe(1);
    expect(progressions["developpement"].derniereObservation).toEqual({
      date: "2026-08-01T09:00:00.000Z",
      origine: "exercice",
    });
    // Un exercice mixte reste attribué dès qu'il touche UNE compétence du domaine.
    expect(progressions["developpement"].carriere.exercicesMenes).toBe(2);
    // STAT-01 n'existe pas dans ce référentiel réduit : l'observation flotte,
    // elle n'entre dans aucun domaine — rien n'est fabriqué pour la rattraper.
    expect(progressions["statistiques"].observationsTotal).toBe(0);
  });

  it("garde les rattachées dans le périmètre de leur domaine de service (ADR-081)", () => {
    const progression = construire([observation("DEV-03", "2026-08-05T09:00:00.000Z")])[
      "statistiques"
    ];

    expect(progression.competencesMesurees).toBe(1);
    expect(progression.score).not.toBeNull();
  });

  it("porte les intitulés qui nomment les compétences citées par le bilan", () => {
    const progression = construire([])["developpement"];
    expect(progression.intitules["DEV-01"]).toBe("Intitulé de DEV-01");
  });
});

describe("construireProgressionsDomaines — contrat de sérialisation RSC", () => {
  it("traverse un aller-retour JSON sans perte ni transformation", () => {
    const progressions = construire(
      [
        observation("DEV-01", "2026-08-01T09:00:00.000Z"),
        observation("DEV-01", "2026-08-14T09:00:00.000Z"),
      ],
      [exercice("ex-dev", ["DEV-01"])],
      [tentative("t1", "ex-dev")],
    );

    const repasse = JSON.parse(JSON.stringify(progressions)) as typeof progressions;
    expect(repasse).toEqual(progressions);
  });
});
