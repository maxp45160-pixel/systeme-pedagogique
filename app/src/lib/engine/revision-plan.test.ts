import { describe, expect, it } from "vitest";
import type { ActionCandidate } from "./action-candidate";
import type { LearningSession } from "@/lib/domain/types";
import type { PlanPropose } from "./planification-temporelle";
import { calculerDiffPlan } from "./revision-plan";

const DISPONIBILITE = { startsAt: "2026-08-28T08:00:00.000Z", endsAt: "2026-08-28T18:00:00.000Z", sourceRef: "agenda:test" };

function candidate(id: string, durationMinutes = 30): ActionCandidate {
  return {
    candidateId: id,
    source: "declared-need",
    target: { skillCodes: ["DEV-01"] },
    intervention: "resolve",
    expectedEffect: "measurement",
    title: id,
    durationMinutes,
    reasons: [`raison ${id}`],
    constraints: [],
    reservations: [],
  };
}

function plan(...items: Array<{ id: string; at: string; duration?: number }>): PlanPropose {
  return {
    slots: items.map(({ id, at, duration = 30 }) => ({
      candidate: candidate(id, duration),
      plannedFor: at,
      endsAt: new Date(Date.parse(at) + duration * 60_000).toISOString(),
      durationMinutes: duration,
      intervention: "resolve",
      expectedEffect: "measurement",
      reasons: [`raison ${id}`],
      constraints: [],
      reservations: [],
    })),
    availability: [DISPONIBILITE],
    readiness: [],
    constraints: [],
    reservations: [],
  };
}

function session(id: string, candidateId: string, at: string, duration = 30, statut: LearningSession["statut"] = "planifiee"): LearningSession {
  return {
    id,
    date: at,
    planifieePour: at,
    dureeMin: duration,
    domaines: ["developpement"],
    skillCodes: ["DEV-01"],
    activites: [],
    interventions: [{
      id: `intervention:${id}`,
      type: "resolve",
      label: candidateId,
      estimatedDurationMinutes: duration,
      source: { kind: "session", ref: id },
      expectedEffect: "measurement",
    }],
    origineProposition: { propositionRef: "p0", candidateId, source: "declared-need" },
    genereAutomatiquement: false,
    statut,
  };
}

describe("diff pur du plan recalculé", () => {
  it("est déterministe pour une même entrée", () => {
    const input = { acceptedSessions: [session("s1", "c1", "2026-08-28T09:00:00.000Z")], recalculatedPlan: plan({ id: "c1", at: "2026-08-28T09:00:00.000Z" }), acceptedCandidateIds: ["c1"] };
    expect(calculerDiffPlan(input)).toEqual(calculerDiffPlan(input));
  });

  it("conserve une séance acceptée inchangée", () => {
    const diff = calculerDiffPlan({ acceptedSessions: [session("s1", "c1", "2026-08-28T09:00:00.000Z")], recalculatedPlan: plan({ id: "c1", at: "2026-08-28T09:00:00.000Z" }) });
    expect(diff.changes).toContainEqual(expect.objectContaining({ kind: "conserver", sessionId: "s1", candidateId: "c1" }));
    expect(diff.silentCandidateIds).toEqual([]);
  });

  it("déplace une séance après une nouvelle disponibilité", () => {
    const diff = calculerDiffPlan({ acceptedSessions: [session("s1", "c1", "2026-08-28T09:00:00.000Z")], recalculatedPlan: plan({ id: "c1", at: "2026-08-28T11:00:00.000Z" }) });
    expect(diff.changes).toContainEqual(expect.objectContaining({ kind: "deplacer", sessionId: "s1" }));
  });

  it("recalcule une séance absente des slots sans remplacer son geste", () => {
    const recalcul = plan({ id: "c-new", at: "2026-08-28T11:00:00.000Z" });
    recalcul.availability = [{
      startsAt: "2026-08-28T11:00:00.000Z",
      endsAt: "2026-08-28T18:00:00.000Z",
      sourceRef: "agenda:nouveau-creneau",
    }];
    const diff = calculerDiffPlan({
      acceptedSessions: [session("s1", "c1", "2026-08-28T09:00:00.000Z")],
      recalculatedPlan: recalcul,
    });
    expect(diff.changes).toContainEqual(expect.objectContaining({
      kind: "deplacer",
      sessionId: "s1",
      before: expect.objectContaining({ plannedFor: "2026-08-28T09:00:00.000Z" }),
      after: expect.objectContaining({ plannedFor: "2026-08-28T11:00:00.000Z", label: "c1" }),
    }));
  });

  it("signale un raccourcissement sans produire une observation", () => {
    const diff = calculerDiffPlan({ acceptedSessions: [session("s1", "c1", "2026-08-28T09:00:00.000Z", 30)], recalculatedPlan: plan({ id: "c1", at: "2026-08-28T09:00:00.000Z", duration: 15 }) });
    expect(diff.changes).toContainEqual(expect.objectContaining({ kind: "raccourcir", before: expect.objectContaining({ durationMinutes: 30 }), after: expect.objectContaining({ durationMinutes: 15 }) }));
    expect(JSON.stringify(diff)).not.toContain("observation");
  });

  it("annule seulement après disparition du recalcul", () => {
    const diff = calculerDiffPlan({ acceptedSessions: [session("s1", "c1", "2026-08-28T09:00:00.000Z")], recalculatedPlan: plan() });
    expect(diff.changes).toContainEqual(expect.objectContaining({ kind: "annuler", sessionId: "s1" }));
  });

  it("ajoute une candidate explicitement acceptée et tait les autres", () => {
    const diff = calculerDiffPlan({ acceptedSessions: [], recalculatedPlan: plan({ id: "c1", at: "2026-08-28T09:00:00.000Z" }, { id: "c2", at: "2026-08-28T10:00:00.000Z" }), acceptedCandidateIds: ["c1"] });
    expect(diff.changes).toContainEqual(expect.objectContaining({ kind: "ajouter", candidateId: "c1" }));
    expect(diff.changes.find((change) => change.candidateId === "c2")).toBeUndefined();
    expect(diff.silentCandidateIds).toEqual(["c2"]);
  });

  it("décrit une proposition apparue sans la traiter comme une séance acceptée", () => {
    const diff = calculerDiffPlan({
      acceptedSessions: [session("s1", "c1", "2026-08-28T09:00:00.000Z")],
      recalculatedPlan: plan({ id: "c1", at: "2026-08-28T09:00:00.000Z" }, { id: "c2", at: "2026-08-28T10:00:00.000Z" }),
    });
    expect(diff.appears).toHaveLength(1);
    expect(diff.appears?.[0]).toMatchObject({ candidateId: "c2", kind: "ajouter" });
    expect(diff.changes.find((change) => change.candidateId === "c2")).toBeUndefined();
  });

  it("protège une séance en cours et signale un conflit impossible", () => {
    const diff = calculerDiffPlan({ acceptedSessions: [session("s-running", "c-running", "2026-08-28T09:00:00.000Z", 30, "en-cours")], recalculatedPlan: plan({ id: "c1", at: "2026-08-28T09:15:00.000Z" }), acceptedCandidateIds: ["c1"] });
    expect(diff.changes.find((change) => change.sessionId === "s-running")).toBeUndefined();
    expect(diff.conflicts[0].reason).toMatch(/séance protégée/);
  });

  it("refuse implicitement une extension comme conflit explicite", () => {
    const diff = calculerDiffPlan({ acceptedSessions: [session("s1", "c1", "2026-08-28T09:00:00.000Z", 30)], recalculatedPlan: plan({ id: "c1", at: "2026-08-28T09:00:00.000Z", duration: 45 }) });
    expect(diff.changes).toContainEqual(expect.objectContaining({ kind: "conflit-impossible" }));
    expect(diff.conflicts[0].reason).toMatch(/durée plus longue/);
  });

  it("ne remplace pas silencieusement le geste d'une séance acceptée", () => {
    const recalcul = plan({ id: "c1", at: "2026-08-28T09:00:00.000Z" });
    recalcul.slots[0].candidate = { ...recalcul.slots[0].candidate, title: "Autre geste", intervention: "explain" };
    recalcul.slots[0].intervention = "explain";
    const diff = calculerDiffPlan({ acceptedSessions: [session("s1", "c1", "2026-08-28T09:00:00.000Z")], recalculatedPlan: recalcul });
    expect(diff.changes).toContainEqual(expect.objectContaining({ kind: "conflit-impossible", sessionId: "s1" }));
  });
});
