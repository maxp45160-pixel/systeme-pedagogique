import { describe, expect, it } from "vitest";

import {
  AdaptiveLearningValidationError,
  decideProjectProofQuality,
  parseActionContext,
  parseActivityAssessment,
  parseEvidenceStatusEvent,
  parseLearningActivity,
  resolveEvidenceStatus,
  type ActivityAssessment,
  type ArtifactReference,
  type EvidenceStatusEvent,
  type LearningActivity,
} from "./adaptive-learning";

const NOW = "2026-08-13T10:00:00.000Z";

function project(overrides: Partial<LearningActivity> = {}): LearningActivity {
  return {
    id: "activity-project",
    accountId: "account-a",
    title: "Etude de cas",
    description: "Produire une solution dans un contexte nouveau.",
    family: "produire",
    target: { skillCodes: ["DEV-01"], themeIds: [], goalIds: [] },
    estimatedDurationMinutes: 90,
    cognitiveDemand: "elevee",
    proofMode: "soumission-finale",
    workspace: "mini-projet",
    requiredTools: ["editeur-markdown"],
    authorizedResources: [{ id: "documentation", kind: "documentation", label: "Documentation officielle", usage: "normale" }],
    evaluationContract: {
      scope: "soumission-finale",
      criteria: [
        { id: "application", label: "Solution fonctionnelle", dimension: "application", required: true },
        { id: "transfer", label: "Transfert au nouveau contexte", dimension: "transfert", required: true },
      ],
      assessableMilestoneIds: [],
    },
    minimumSegmentMinutes: 20,
    version: 1,
    origin: "tuteur",
    status: "active",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

type HumanAssessment = Extract<ActivityAssessment, { kind: "validation-humaine" }>;

function assessment(overrides: Partial<HumanAssessment> = {}): HumanAssessment {
  return {
    id: "assessment-final",
    accountId: "account-a",
    runId: "run-1",
    activityId: "activity-project",
    activityVersion: 1,
    kind: "validation-humaine",
    scope: { kind: "soumission-finale" },
    criteria: [
      { criterionId: "application", demonstration: "pleine" },
      { criterionId: "transfer", demonstration: "pleine" },
    ],
    result: "reussi",
    autonomy: "A3",
    artifactSnapshotId: "snapshot-1",
    requestId: "request-1",
    createdAt: NOW,
    ...overrides,
  };
}

const frozenArtifact: ArtifactReference = {
  kind: "markdown",
  ref: "document-1",
  snapshotId: "snapshot-1",
  frozenAt: NOW,
  immutable: true,
};

describe("validation runtime des contrats adaptatifs", () => {
  it("refuse une capacite inconnue sans fabriquer de valeur de repli", () => {
    expect(() => parseActionContext({
      accountId: "account-a",
      availableTimeMinutes: 30,
      mentalCapacity: "moyenne",
      intent: "systeme",
      declaredAt: NOW,
    })).toThrow(AdaptiveLearningValidationError);
  });

  it("conserve la note verbatim sans l'interpreter", () => {
    const context = parseActionContext({
      accountId: "account-a",
      availableTimeMinutes: 30,
      mentalCapacity: "standard",
      intent: "systeme",
      verbatimNote: "Je veux reprendre doucement, peut-etre avec un projet.",
      declaredAt: NOW,
    });
    expect(context.verbatimNote).toBe("Je veux reprendre doucement, peut-etre avec un projet.");
  });

  it("interdit a une exploration de promettre une preuve", () => {
    expect(() => parseLearningActivity({
      ...project({ family: "explorer", workspace: "exploration-guidee" }),
      proofMode: "soumission-finale",
    })).toThrow("exploration reste un support");
  });

  it("valide une exploration support sans critere", () => {
    const activity = parseLearningActivity({
      ...project({ family: "explorer", workspace: "exploration-guidee" }),
      proofMode: "support-seul",
      evaluationContract: { scope: "aucune", criteria: [], assessableMilestoneIds: [] },
    });
    expect(activity.proofMode).toBe("support-seul");
  });
});

describe("regime de preuve d'un mini-projet", () => {
  it("refuse la proposition du tuteur comme mesure", () => {
    const proposal: ActivityAssessment = {
      id: "assessment-proposal",
      accountId: "account-a",
      runId: "run-1",
      activityId: "activity-project",
      activityVersion: 1,
      kind: "proposition-tuteur",
      scope: { kind: "soumission-finale" },
      criteria: [{ criterionId: "transfer", demonstration: "pleine" }],
      artifactSnapshotId: "snapshot-1",
      requestId: "request-proposal",
      createdAt: NOW,
    };
    const decision = decideProjectProofQuality(
      project(),
      proposal,
      frozenArtifact,
    );
    expect(decision).toMatchObject({ eligible: false, quality: null });
  });

  it("refuse qu'une proposition du tuteur attribue un résultat ou une autonomie", () => {
    expect(() => parseActivityAssessment({
      id: "assessment-proposal",
      accountId: "account-a",
      runId: "run-1",
      activityId: "activity-project",
      activityVersion: 1,
      kind: "proposition-tuteur",
      scope: { kind: "soumission-finale" },
      criteria: [{ criterionId: "transfer", demonstration: "pleine" }],
      result: "reussi",
      autonomy: "A4",
      requestId: "request-proposal",
      createdAt: NOW,
    })).toThrow("ne porte ni résultat, ni autonomie");
  });

  it("refuse un simple lien externe modifiable", () => {
    const decision = decideProjectProofQuality(project(), assessment(), {
      kind: "lien-externe",
      ref: "https://example.test/work",
      immutable: false,
    });
    expect(decision).toMatchObject({ eligible: false, quality: null });
  });

  it("classe A0/A1 en preuve faible meme si le travail reussit", () => {
    expect(decideProjectProofQuality(project(), assessment({ autonomy: "A1" }), frozenArtifact))
      .toMatchObject({ eligible: true, quality: "faible" });
  });

  it("n'accorde une preuve forte qu'avec reussite, transfert plein, A3/A4 et snapshot", () => {
    expect(decideProjectProofQuality(project(), assessment(), frozenArtifact))
      .toMatchObject({ eligible: true, quality: "forte" });
    expect(decideProjectProofQuality(
      project(),
      assessment({ criteria: [
        { criterionId: "application", demonstration: "pleine" },
        { criterionId: "transfer", demonstration: "partielle" },
      ] }),
      frozenArtifact,
    )).toMatchObject({ eligible: true, quality: "moyenne" });
  });

  it("traite un jalon comme observation sans contrat explicite", () => {
    const decision = decideProjectProofQuality(
      project(),
      assessment({ scope: { kind: "jalon", milestoneId: "draft" } }),
      frozenArtifact,
    );
    expect(decision).toMatchObject({ eligible: false, quality: null });
  });
});

describe("rectification append-only d'une preuve", () => {
  const event = (
    id: string,
    action: EvidenceStatusEvent["action"],
    createdAt: string,
    replacementEvidenceId?: string,
  ): EvidenceStatusEvent => ({
    id,
    accountId: "account-a",
    evidenceId: "evidence-1",
    action,
    replacementEvidenceId,
    reason: "Rectification verifiee",
    requestId: `request-${id}`,
    createdAt,
  });

  it("derive le statut depuis les evenements sans modifier l'original", () => {
    const events = [
      event("2", "restaurer", "2026-08-13T11:00:00.000Z"),
      event("1", "invalider", "2026-08-13T10:00:00.000Z"),
      event("3", "remplacer", "2026-08-13T12:00:00.000Z", "evidence-2"),
    ];
    expect(resolveEvidenceStatus("evidence-1", events)).toEqual({
      evidenceId: "evidence-1",
      active: false,
      replacementEvidenceId: "evidence-2",
      lastEventId: "3",
    });
    expect(events).toHaveLength(3);
  });

  it("refuse un remplacement sans preuve de remplacement", () => {
    expect(() => parseEvidenceStatusEvent(event("1", "remplacer", NOW)))
      .toThrow("requis uniquement pour un remplacement");
  });
});
