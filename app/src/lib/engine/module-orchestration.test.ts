import { describe, expect, it } from "vitest";
import type { Engagement } from "@/lib/domain/engagement";
import type { LearningSession, SkillState } from "@/lib/domain/types";
import { construireLectureOrchestrationModule } from "./module-orchestration";

const NOW = new Date("2026-08-28T08:00:00.000Z");

function session(overrides: Partial<LearningSession> = {}): LearningSession {
  return {
    id: "session-1",
    date: "2026-08-28T09:00:00.000Z",
    planifieePour: "2026-08-28T09:00:00.000Z",
    dureePlanifieeMin: 25,
    domaines: ["maths"],
    skillCodes: ["MATH-01"],
    activites: [],
    interventions: [{
      id: "intervention-1",
      type: "explain",
      label: "Expliquer le théorème",
      source: { kind: "course", ref: "cours-maths" },
      expectedEffect: "measurement",
      targetSkillCodes: ["MATH-01"],
    }],
    genereAutomatiquement: false,
    statut: "planifiee",
    ...overrides,
  };
}

function engagement(overrides: Partial<Engagement> = {}): Engagement {
  return {
    id: "exam-maths",
    type: "examen",
    libelle: "Partiel",
    echeanceLe: "2026-09-04",
    codes: ["MATH-01"],
    moduleDomaineId: "maths",
    ...overrides,
  };
}

function state(): SkillState {
  return {
    skill: {
      code: "MATH-01",
      intitule: "Raisonner",
      domaine: "maths",
      palier: "fondamentaux",
      prerequis: [],
      importance: 1,
      ordre: 0,
      active: true,
      archive: false,
      origine: "utilisateur",
    },
    niveau: null,
    score: null,
    confiance: "nulle",
    robustesse: null,
    dimensions: {} as SkillState["dimensions"],
    observations: [],
    contextesTestes: [],
    derniereObservation: null,
    joursDepuisDerniereObservation: null,
    contradictions: [],
    prochaineEtape: "diagnostiquer",
    explication: { resume: "", facteurs: [], nombreObservations: 0, reserves: [] },
    statut: "non-evalue",
  };
}

describe("construireLectureOrchestrationModule", () => {
  it("ne lit que les séances acceptées du module et de la semaine", () => {
    const view = construireLectureOrchestrationModule({
      domainId: "maths",
      sessions: [
        session(),
        session({ id: "autre-domaine", domaines: ["physique"] }),
        session({ id: "terminee", statut: "terminee" }),
        session({ id: "semaine-suivante", planifieePour: "2026-09-07T09:00:00.000Z" }),
      ],
      engagements: [],
      skillStates: [state()],
      now: NOW,
    });

    expect(view.thisWeek.map((item) => item.sessionId)).toEqual(["session-1"]);
  });

  it("dérive une préparation non estimable sans écrire de score", () => {
    const view = construireLectureOrchestrationModule({
      domainId: "maths",
      sessions: [],
      engagements: [engagement(), engagement({ id: "autre", moduleDomaineId: "physique" })],
      skillStates: [state()],
      now: NOW,
    });

    expect(view.deadlines).toHaveLength(1);
    expect(view.deadlines[0]).toMatchObject({
      id: "exam-maths",
      preparation: "non-estimable",
      evidenceRefs: [],
    });
    expect(view.deadlines[0]).not.toHaveProperty("percentage");
  });

  it("garde visible une séance historique illisible sans fabriquer son intervention", () => {
    const view = construireLectureOrchestrationModule({
      domainId: "maths",
      sessions: [session({ interventions: undefined, activites: [{ type: "inconnu", ref: "x", libelle: "Historique" }] })],
      engagements: [],
      skillStates: [state()],
      now: NOW,
    });
    expect(view.thisWeek).toEqual([
      expect.objectContaining({
        sessionId: "session-1",
        interventionLabel: undefined,
        interventionType: undefined,
        expectedEffect: undefined,
        reservations: [expect.stringContaining("type historique")],
      }),
    ]);
  });
});
