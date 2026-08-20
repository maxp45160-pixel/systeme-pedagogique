import { describe, expect, it } from "vitest";

import type { SkillState } from "@/lib/domain/types";
import type {
  ActionContext,
  ActivityEvent,
  ActivityFamily,
  ActivityGenerationRequest,
  ActivityRun,
  ActivityWorkspace,
  LearningActivity,
  LearningGoal,
  LearningPreference,
  SequencingSignal,
} from "@/lib/domain/adaptive-learning";
import {
  ADAPTIVE_POLICY_VERSION,
  recommendLearningAction,
  type ActionRecommendationInput,
} from "./action-recommendation";

const NOW = "2026-08-13T10:00:00.000Z";
const TARGET = { skillCodes: ["DEV-01"], themeIds: [], goalIds: [] };

function activity(
  id: string,
  family: ActivityFamily,
  overrides: Partial<LearningActivity> = {},
): LearningActivity {
  const workspace: ActivityWorkspace = family === "explorer"
    ? "exploration-guidee"
    : family === "entrainer" ? "exercice-trois-actes" : "mini-projet";
  return {
    id,
    accountId: "account-a",
    title: `Activite ${id}`,
    description: "Description",
    family,
    target: TARGET,
    estimatedDurationMinutes: 25,
    cognitiveDemand: "standard",
    proofMode: family === "explorer" ? "support-seul" : "soumission-finale",
    workspace,
    requiredTools: [],
    authorizedResources: [],
    evaluationContract: family === "explorer"
      ? { scope: "aucune", criteria: [], assessableMilestoneIds: [] }
      : {
          scope: "soumission-finale",
          criteria: [{ id: "application", label: "Appliquer", dimension: "application", required: true }],
          assessableMilestoneIds: [],
        },
    version: 1,
    origin: "tuteur",
    status: "active",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function generation(id: string, family: ActivityFamily): ActivityGenerationRequest {
  const base = activity(`source-${id}`, family);
  return {
    id,
    accountId: "account-a",
    family,
    target: TARGET,
    title: `Generation ${id}`,
    constraints: ["Schema ferme"],
    estimatedDurationMinutes: 25,
    cognitiveDemand: "standard",
    proofMode: base.proofMode,
    workspace: base.workspace,
    requiredTools: [],
    authorizedResources: [],
    evaluationContract: base.evaluationContract,
  };
}

function context(overrides: Partial<ActionContext> = {}): ActionContext {
  return {
    accountId: "account-a",
    availableTimeMinutes: 30,
    mentalCapacity: "standard",
    intent: "systeme",
    declaredAt: NOW,
    ...overrides,
  };
}

function goal(overrides: Partial<LearningGoal> = {}): LearningGoal {
  return {
    id: "goal-main",
    accountId: "account-a",
    title: "Livrer le projet",
    description: "",
    declaredPriority: 5,
    targetDate: "2026-09-01T00:00:00.000Z",
    successCriteria: [],
    declaredState: "actif",
    confirmedSkillCodes: ["DEV-01"],
    confirmedThemeIds: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function state(code: string, lastObservation: string | null = null): SkillState {
  return {
    skill: {
      code,
      domaine: "dev",
      intitule: code,
      palier: "fondamentaux",
      prerequis: [],
      importance: 1,
      ordre: 0,
      active: true,
      archive: false,
      origine: "utilisateur",
    },
    niveau: lastObservation ? 2 : null,
    score: lastObservation ? 2 : null,
    confiance: lastObservation ? "faible" : "nulle",
    robustesse: lastObservation ? 0.5 : null,
    dimensions: { comprehension: 0.5, application: 0.5, transfert: 0, integration: 0, justification: 0 },
    observations: [],
    contextesTestes: [],
    derniereObservation: lastObservation,
    joursDepuisDerniereObservation: lastObservation ? 1 : null,
    contradictions: [],
    prochaineEtape: "Diagnostiquer",
    explication: { resume: "", facteurs: [], nombreObservations: 0, reserves: [] },
    statut: lastObservation ? "evalue" : "non-evalue",
  };
}

function input(overrides: Partial<ActionRecommendationInput> = {}): ActionRecommendationInput {
  return {
    context: context(),
    activities: [],
    openRuns: [],
    generationRequests: [],
    goals: [],
    rankedSkillStates: [state("DEV-01")],
    events: [],
    sequencingSignals: [],
    preferences: [],
    availableTools: [],
    ...overrides,
  };
}

describe("construction honnete des candidats", () => {
  it("ne fabrique aucune action quand aucun candidat explicite n'existe", () => {
    expect(recommendLearningAction(input())).toBeNull();
  });

  it("ecarte archive, autre compte, outil indisponible et duree incompatible", () => {
    const result = recommendLearningAction(input({
      activities: [
        activity("archive", "entrainer", { status: "archivee", archivedAt: NOW }),
        activity("foreign", "entrainer", { accountId: "account-b" }),
        activity("tool", "entrainer", { requiredTools: ["calculatrice"] }),
        activity("long", "entrainer", { estimatedDurationMinutes: 90 }),
      ],
    }));
    expect(result).toBeNull();
  });

  it("identifie explicitement une demande de generation sans la faire passer pour une activite", () => {
    const result = recommendLearningAction(input({ generationRequests: [generation("gen-1", "entrainer")] }));
    expect(result?.primary).toMatchObject({
      source: "generation",
      generationRequestId: "gen-1",
      activityId: undefined,
    });
    expect(result?.reservations.join(" ")).toContain("enregistre");
  });

  it("ne propose une generation qu'en absence d'activite concrete adaptee", () => {
    const existing = activity("existing-exploration", "explorer");
    const result = recommendLearningAction(input({
      activities: [existing],
      generationRequests: [generation("generated-exploration", "explorer")],
    }));

    expect(result?.primary).toMatchObject({
      source: "activite",
      activityId: existing.id,
    });
    expect([
      result?.primary,
      ...(result?.alternatives ?? []),
    ].some((candidate) => candidate?.source === "generation")).toBe(false);
  });

  it("adapte un exercice legacy sans le recopier", () => {
    const legacy = activity("legacy-exercise", "entrainer", { origin: "legacy-adapter" });
    const result = recommendLearningAction(input({ activities: [legacy] }));
    expect(result?.primary).toMatchObject({ activityId: legacy.id, activityVersion: legacy.version });
    expect(legacy.origin).toBe("legacy-adapter");
  });
});

describe("cible, objectif et classement", () => {
  it("applique la cible explicite avant tout autre facteur", () => {
    const result = recommendLearningAction(input({
      context: context({ target: { kind: "activity", ref: "chosen" } }),
      activities: [activity("other", "entrainer"), activity("chosen", "produire")],
    }));
    expect(result?.primary.activityId).toBe("chosen");
    expect(result?.alternatives).toHaveLength(0);
  });

  it("privilegie l'objectif actif de priorite la plus haute", () => {
    const urgent = goal({ id: "urgent", confirmedSkillCodes: ["DEV-02"], declaredPriority: 5 });
    const secondary = goal({ id: "secondary", confirmedSkillCodes: ["DEV-01"], declaredPriority: 3 });
    const result = recommendLearningAction(input({
      goals: [secondary, urgent],
      rankedSkillStates: [state("DEV-01"), state("DEV-02")],
      activities: [
        activity("secondary", "entrainer"),
        activity("urgent", "entrainer", { target: { skillCodes: ["DEV-02"], themeIds: [], goalIds: [] } }),
      ],
    }));
    expect(result?.primary.activityId).toBe("urgent");
    expect(result?.factors.some((factor) => factor.sourceRef === "urgent")).toBe(true);
  });

  it("reprend l'ordre des SkillState fourni sans recalibrer leurs seuils", () => {
    const result = recommendLearningAction(input({
      rankedSkillStates: [state("DEV-02"), state("DEV-01")],
      activities: [
        activity("dev-01", "entrainer"),
        activity("dev-02", "entrainer", { target: { skillCodes: ["DEV-02"], themeIds: [], goalIds: [] } }),
      ],
    }));
    expect(result?.primary.activityId).toBe("dev-02");
  });
});

describe("sequencement des familles", () => {
  const signal = (kind: SequencingSignal["kind"]): SequencingSignal => ({
    id: `signal-${kind}`,
    accountId: "account-a",
    kind,
    target: TARGET,
    observedAt: NOW,
    sourceRef: "observation-1",
  });

  it("propose Explorer apres une difficulte de comprehension", () => {
    const result = recommendLearningAction(input({
      activities: [activity("explore", "explorer"), activity("practice", "entrainer")],
      sequencingSignals: [signal("difficulte-comprehension")],
    }));
    expect(result?.primary.family).toBe("explorer");
    expect(result?.primary.reservations.join(" ")).toContain("aucune observation");
  });

  it("traduit l'intention pratiquer vers la famille entrainer", () => {
    const result = recommendLearningAction(input({
      context: context({ intent: "pratiquer" }),
      activities: [activity("explore", "explorer"), activity("practice", "entrainer")],
    }));
    expect(result?.primary.family).toBe("entrainer");
  });

  it("met une ressource documentaire ouverte devant un exercice sans cible liée", () => {
    const result = recommendLearningAction(input({
      activities: [
        activity("legacy-exercise", "entrainer"),
        activity("ressource:papier-recherche", "entrainer", {
          target: { skillCodes: [], themeIds: [], goalIds: [], label: "Papier de recherche" },
          title: "Lire et ficher le papier de recherche — Boucles de rétroaction",
          proofMode: "support-seul",
        }),
      ],
    }));

    expect(result?.primary.activityId).toBe("ressource:papier-recherche");
    expect(result?.factors.some((factor) => factor.kind === "ressource-documentaire")).toBe(true);
  });

  it("fait suivre une exploration plus recente que l'observation par pratique ou production", () => {
    const exploreRun: ActivityRun = {
      id: "run-explore",
      accountId: "account-a",
      activityId: "explore",
      activityVersion: 1,
      status: "terminee",
      createdAt: "2026-08-12T08:00:00.000Z",
      completedAt: "2026-08-12T09:00:00.000Z",
    };
    const closure: ActivityEvent = {
      id: "event-close",
      accountId: "account-a",
      runId: exploreRun.id,
      requestId: "request-close",
      type: "cloture",
      createdAt: "2026-08-12T09:00:00.000Z",
    };
    const result = recommendLearningAction(input({
      activities: [activity("explore", "explorer"), activity("practice", "entrainer")],
      historicalRuns: [exploreRun],
      events: [closure],
      rankedSkillStates: [state("DEV-01", "2026-08-10T09:00:00.000Z")],
      sequencingSignals: [signal("difficulte-comprehension")],
    }));
    expect(result?.primary.family).toBe("entrainer");
    expect(result?.primary.factors.some((factor) => factor.kind === "exploration-recente")).toBe(true);
  });

  it("segmente un projet reprenable pour respecter le temps disponible", () => {
    const run: ActivityRun = {
      id: "run-project",
      accountId: "account-a",
      activityId: "project",
      activityVersion: 1,
      status: "en-pause",
      createdAt: NOW,
    };
    const result = recommendLearningAction(input({
      context: context({ intent: "reprendre", availableTimeMinutes: 30 }),
      activities: [activity("project", "produire", { estimatedDurationMinutes: 120, minimumSegmentMinutes: 20 })],
      openRuns: [run],
    }));
    expect(result?.primary).toMatchObject({ source: "reprise", runId: "run-project", durationMinutes: 30, segmented: true });
  });
});

describe("alternatives, preferences et determinisme", () => {
  it("retourne au plus deux alternatives de familles toutes differentes", () => {
    const activities = [
      activity("practice-a", "entrainer"),
      activity("practice-b", "entrainer"),
      activity("explore", "explorer"),
      activity("produce", "produire"),
    ];
    const result = recommendLearningAction(input({ activities }));
    expect(result?.alternatives).toHaveLength(2);
    expect(new Set([result!.primary.family, ...result!.alternatives.map((entry) => entry.family)]).size).toBe(3);
  });

  it("en affiche moins s'il n'existe pas trois options honnetes", () => {
    const result = recommendLearningAction(input({
      activities: [activity("practice-a", "entrainer"), activity("practice-b", "entrainer")],
    }));
    expect(result?.alternatives).toHaveLength(0);
  });

  it("ignore une preference inferee mais utilise la meme preference confirmee", () => {
    const first = activity("a", "entrainer", { workspace: "exercice-trois-actes" });
    const second = activity("b", "entrainer", { workspace: "mini-projet" });
    const preference = (status: LearningPreference["status"]): LearningPreference => ({
      id: "preference-1",
      accountId: "account-a",
      kind: "workspace",
      value: "mini-projet",
      status,
      observedAt: NOW,
    });
    expect(recommendLearningAction(input({ activities: [second, first], preferences: [preference("inferee")] }))?.primary.activityId).toBe("a");
    expect(recommendLearningAction(input({ activities: [first, second], preferences: [preference("declaree")] }))?.primary.activityId).toBe("b");
  });

  it("reste deterministe quel que soit l'ordre d'entree", () => {
    const activities = [activity("z", "entrainer"), activity("a", "entrainer")];
    const forward = recommendLearningAction(input({ activities }));
    const reverse = recommendLearningAction(input({ activities: activities.slice().reverse() }));
    expect(forward?.primary.candidateId).toBe(reverse?.primary.candidateId);
    expect(forward?.policyVersion).toBe(ADAPTIVE_POLICY_VERSION);
  });
});
