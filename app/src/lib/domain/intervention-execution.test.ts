import { describe, expect, it } from "vitest";
import type { ExerciseAttempt, LearningSession } from "./types";
import {
  interventionCourante,
  interventionsTerminees,
  lireExecutionInterventions,
  nombreInterventionsTraitees,
} from "./intervention-execution";

const base = (overrides: Partial<LearningSession> = {}): LearningSession => ({
  id: "session-1",
  date: "2026-08-28T09:00:00.000Z",
  domaines: ["domaine-1"],
  skillCodes: ["SK-1"],
  activites: [],
  genereAutomatiquement: true,
  ...overrides,
});

const intervention = (type: string, extra: Record<string, unknown> = {}) => ({
  id: `i-${type}`,
  type,
  label: `Geste ${type}`,
  source: { kind: "session", ref: "source-1" },
  expectedEffect: "preparation",
  ...extra,
});

describe("projection d'exécution multi-interventions", () => {
  it("respecte les statuts explicites et ne fabrique aucune preuve", () => {
    const lecture = lireExecutionInterventions(base({
      interventions: [
        intervention("read", { statut: "completed" }),
        intervention("ask-for-help", { expectedEffect: "support" }),
      ] as never,
    }), []);
    expect(lecture.executions.map((item) => item.statut)).toEqual(["terminee", "a-faire"]);
    expect(lecture.executions[0].intervention.proofContract).toBeUndefined();
    expect(interventionsTerminees(lecture.executions)).toBe(false);
    expect(nombreInterventionsTraitees(lecture.executions)).toBe(1);
  });

  it("dérive un exercice en cours ou terminé depuis ses tentatives", () => {
    const seance = base({
      interventions: [intervention("resolve", {
        source: { kind: "exercise", ref: "ex-1" },
        expectedEffect: "measurement",
      })] as never,
    });
    const tentatives: ExerciseAttempt[] = [{
      id: "att-1",
      exerciseId: "ex-1",
      debut: seance.date,
      statut: "terminee",
      indicesUtilises: 0,
      reponse: "réponse",
      evaluation: {},
      resultat: "reussi",
    }];
    const lecture = lireExecutionInterventions(seance, tentatives);
    expect(lecture.executions[0]).toMatchObject({ statut: "terminee", exerciceId: "ex-1" });
    expect(interventionCourante(lecture.executions)).toBeUndefined();
  });

  it("adapte une séance historique sans statut persistant", () => {
    const lecture = lireExecutionInterventions(base({
      activites: [{ type: "exercice", ref: "ex-legacy", libelle: "Ancien exercice" }],
    }), []);
    expect(lecture.origine).toBe("legacy");
    expect(lecture.executions[0]).toMatchObject({
      statut: "a-faire",
      exerciceId: "ex-legacy",
      intervention: { type: "resolve" },
    });
  });

  it("compose deux interventions distinctes dans la même semaine sans créer un nouvel épisode", () => {
    const seances = [
      base({
        id: "session-explain",
        date: "2026-08-24T09:00:00.000Z",
        statut: "planifiee",
        planifieePour: "2026-08-24T09:00:00.000Z",
        interventions: [intervention("explain", {
          source: { kind: "course", ref: "cours-1" },
        })] as never,
      }),
      base({
        id: "session-read",
        date: "2026-08-27T17:00:00.000Z",
        statut: "planifiee",
        planifieePour: "2026-08-27T17:00:00.000Z",
        interventions: [intervention("read", {
          source: { kind: "document", ref: "document-1" },
        })] as never,
      }),
    ];

    const parcours = seances.flatMap((seance) =>
      lireExecutionInterventions(seance, []).executions.map((execution) => ({
        sessionId: seance.id,
        type: execution.intervention.type,
        source: execution.intervention.source,
        statut: execution.statut,
      })),
    );

    expect(parcours).toEqual([
      {
        sessionId: "session-explain",
        type: "explain",
        source: { kind: "course", ref: "cours-1" },
        statut: "a-faire",
      },
      {
        sessionId: "session-read",
        type: "read",
        source: { kind: "document", ref: "document-1" },
        statut: "a-faire",
      },
    ]);
    expect(new Set(parcours.map((item) => item.sessionId))).toHaveLength(2);
  });
});
