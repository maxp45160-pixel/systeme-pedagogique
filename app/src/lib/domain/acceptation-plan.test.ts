import { describe, expect, it } from "vitest";
import type { LearningSession } from "./types";
import {
  preparerCommandeAcceptationPlan,
  type ChoixPlan,
  type ContexteAcceptationPlan,
} from "./acceptation-plan";
import type { ActionCandidate } from "@/lib/engine/action-candidate";
import type { PlanPropose } from "@/lib/engine/planification-temporelle";

const SLOT_START = "2026-08-28T09:00:00.000Z";
const SLOT_END = "2026-08-28T09:30:00.000Z";

function candidate(id: string, overrides: Partial<ActionCandidate> = {}): ActionCandidate {
  return {
    candidateId: id,
    source: "existing-activity",
    target: { skillCodes: ["DEV-01"], engagementIds: [] },
    intervention: "resolve",
    expectedEffect: "measurement",
    title: id,
    durationMinutes: 30,
    reasons: [],
    constraints: [],
    reservations: [],
    ...overrides,
  };
}

function plan(candidates: ActionCandidate[] = [candidate("c-1"), candidate("c-2")]): PlanPropose {
  return {
    slots: candidates.map((item, index) => ({
      candidate: item,
      plannedFor: index === 0 ? SLOT_START : "2026-08-28T10:00:00.000Z",
      endsAt: index === 0 ? SLOT_END : "2026-08-28T10:30:00.000Z",
      durationMinutes: item.durationMinutes,
      intervention: item.intervention,
      expectedEffect: item.expectedEffect,
      reasons: [],
      constraints: [],
      reservations: [],
    })),
    availability: [{ startsAt: SLOT_START, endsAt: "2026-08-28T12:00:00.000Z", sourceRef: "agenda:test" }],
    readiness: [],
    constraints: [],
    reservations: [],
  };
}

const contexte: ContexteAcceptationPlan = {
  competences: new Map([["DEV-01", { code: "DEV-01", domaine: "developpement", active: true, archive: false }]]),
  domaines: new Map([["developpement", { id: "developpement", archive: false }]]),
  engagementsOuverts: new Set(),
  sessionsExistantes: [],
};

function choix(overrides: Partial<ChoixPlan> = {}): ChoixPlan {
  return {
    requestId: "req-1",
    propositionRef: "plan-2026-08-28",
    acceptedCandidateIds: ["c-1"],
    ignoredCandidateIds: ["c-2"],
    ...overrides,
  };
}

describe("préparation pure de l'acceptation d'un plan", () => {
  it("matérialise uniquement la candidate acceptée, sans durée mesurée ni observation", () => {
    const commande = preparerCommandeAcceptationPlan(plan(), choix(), contexte);
    expect(commande.accepted).toHaveLength(1);
    expect(commande.accepted[0]).toMatchObject({
      sessionId: "plan:plan-2026-08-28:c-1",
      planifieePour: SLOT_START,
      domaines: ["developpement"],
      skillCodes: ["DEV-01"],
      origineProposition: {
        propositionRef: "plan-2026-08-28",
        candidateId: "c-1",
        source: "existing-activity",
      },
    });
    expect(commande.accepted[0]).not.toHaveProperty("dureeMin");
    expect(commande.accepted[0]).not.toHaveProperty("observations");
    expect(commande).not.toHaveProperty("plan");
    expect(commande.ignoredCandidateIds).toEqual(["c-2"]);
  });

  it("reste déterministe pour le même choix", () => {
    expect(preparerCommandeAcceptationPlan(plan(), choix(), contexte))
      .toEqual(preparerCommandeAcceptationPlan(plan(), choix(), contexte));
  });

  it("refuse un choix qui ne tranche pas toutes les candidates affichées", () => {
    expect(() => preparerCommandeAcceptationPlan(
      plan(), choix({ ignoredCandidateIds: [] }), contexte,
    )).toThrow(/ne tranche pas/);
  });

  it("refuse une compétence inconnue ou un domaine archivé", () => {
    expect(() => preparerCommandeAcceptationPlan(
      plan([candidate("c-1", { target: { skillCodes: ["INCONNUE"] } })]),
      choix({ ignoredCandidateIds: [] }),
      contexte,
    )).toThrow(/compétence/);

    expect(() => preparerCommandeAcceptationPlan(
      plan(),
      choix(),
      { ...contexte, domaines: new Map([["developpement", { id: "developpement", archive: true }]]) },
    )).toThrow(/archivé/);
  });

  it("refuse une source de candidate inconnue", () => {
    const invalide = { ...candidate("c-1"), source: "unknown" } as unknown as ActionCandidate;
    expect(() => preparerCommandeAcceptationPlan(
      plan([invalide]),
      choix({ ignoredCandidateIds: [] }),
      contexte,
    )).toThrow(/source/);
  });

  it("protège les séances en cours et terminées lors d'un ajustement", () => {
    const session = {
      id: "ses-1",
      date: SLOT_START,
      domaines: ["developpement"],
      skillCodes: ["DEV-01"],
      activites: [],
      genereAutomatiquement: false,
      statut: "en-cours",
    } as LearningSession;
    expect(() => preparerCommandeAcceptationPlan(
      plan(),
      choix({ adjustments: [{ sessionId: "ses-1", action: "cancel" }] }),
      { ...contexte, sessionsExistantes: [session] },
    )).toThrow(/protégée/);
  });

  it("refuse de déplacer une séance planifiée hors de la disponibilité déclarée", () => {
    const session = {
      id: "ses-planifiee",
      date: SLOT_START,
      domaines: ["developpement"],
      skillCodes: ["DEV-01"],
      activites: [],
      interventions: [{
        id: "intervention:ses-planifiee",
        type: "resolve",
        label: "Résoudre",
        estimatedDurationMinutes: 30,
        source: { kind: "session", ref: "ses-planifiee" },
        expectedEffect: "measurement",
      }],
      genereAutomatiquement: false,
      statut: "planifiee",
    } as LearningSession;
    expect(() => preparerCommandeAcceptationPlan(
      plan(),
      choix({ adjustments: [{ sessionId: "ses-planifiee", action: "move", plannedFor: "2026-08-28T13:00:00.000Z" }] }),
      { ...contexte, sessionsExistantes: [session] },
    )).toThrow(/disponibilités/);
  });

  it("prépare un raccourcissement explicite sans toucher aux preuves", () => {
    const session = {
      id: "ses-short",
      date: SLOT_START,
      planifieePour: SLOT_START,
      dureeMin: 30,
      domaines: ["developpement"],
      skillCodes: ["DEV-01"],
      activites: [],
      genereAutomatiquement: false,
      statut: "planifiee",
    } as LearningSession;
    const commande = preparerCommandeAcceptationPlan(
      plan(),
      choix({ adjustments: [{ sessionId: "ses-short", action: "shorten", durationMinutes: 15 }] }),
      { ...contexte, sessionsExistantes: [session] },
    );
    expect(commande.adjustments).toEqual([{
      sessionId: "ses-short",
      action: "shorten",
      plannedFor: SLOT_START,
      durationMinutes: 15,
    }]);
  });

  it("refuse d'allonger une séance acceptée par un raccourcissement", () => {
    const session = {
      id: "ses-short",
      date: SLOT_START,
      planifieePour: SLOT_START,
      dureeMin: 30,
      domaines: ["developpement"],
      skillCodes: ["DEV-01"],
      activites: [],
      genereAutomatiquement: false,
      statut: "planifiee",
    } as LearningSession;
    expect(() => preparerCommandeAcceptationPlan(
      plan(),
      choix({ adjustments: [{ sessionId: "ses-short", action: "shorten", durationMinutes: 45 }] }),
      { ...contexte, sessionsExistantes: [session] },
    )).toThrow(/raccourcissement valide/);
  });

  it("tolère le même raccourcissement lors d'un rejeu idempotent", () => {
    const session = {
      id: "ses-short",
      date: SLOT_START,
      planifieePour: SLOT_START,
      dureePlanifieeMin: 15,
      domaines: ["developpement"],
      skillCodes: ["DEV-01"],
      activites: [],
      genereAutomatiquement: false,
      statut: "planifiee",
    } as LearningSession;
    expect(() => preparerCommandeAcceptationPlan(
      plan(),
      choix({ adjustments: [{ sessionId: "ses-short", action: "shorten", durationMinutes: 15 }] }),
      { ...contexte, sessionsExistantes: [session] },
    )).not.toThrow();
  });

  it("refuse les chevauchements des créneaux acceptés", () => {
    const second = candidate("c-2");
    const overlapping: PlanPropose = {
      ...plan([candidate("c-1"), second]),
      slots: [
        plan([candidate("c-1")]).slots[0],
        {
          ...plan([second]).slots[0],
          plannedFor: "2026-08-28T09:15:00.000Z",
          endsAt: "2026-08-28T09:45:00.000Z",
        },
      ],
    };
    expect(() => preparerCommandeAcceptationPlan(
      overlapping,
      choix({ acceptedCandidateIds: ["c-1", "c-2"], ignoredCandidateIds: [] }),
      contexte,
    )).toThrow(/chevauchent/);
  });

  it("refuse un créneau déplacé hors des disponibilités affichées", () => {
    const horsFenetre = {
      ...plan([candidate("c-1")]),
      slots: [{
        ...plan([candidate("c-1")]).slots[0],
        plannedFor: "2026-08-28T13:00:00.000Z",
        endsAt: "2026-08-28T13:30:00.000Z",
      }],
    } satisfies PlanPropose;
    expect(() => preparerCommandeAcceptationPlan(
      horsFenetre,
      choix({ ignoredCandidateIds: [] }),
      contexte,
    )).toThrow(/disponibilités/);
  });
});
