import { describe, expect, it } from "vitest";

import {
  AdaptiveLearningValidationError,
  decideProjectProofs,
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
    target: { skillCodes: ["DEV-01", "DEV-02"], themeIds: [], goalIds: [] },
    estimatedDurationMinutes: 90,
    cognitiveDemand: "elevee",
    proofMode: "soumission-finale",
    workspace: "mini-projet",
    requiredTools: ["editeur-markdown"],
    authorizedResources: [{ id: "documentation", kind: "documentation", label: "Documentation officielle", usage: "normale" }],
    evaluationContract: {
      scope: "soumission-finale",
      criteria: [
        { id: "application", label: "Solution fonctionnelle", dimension: "application", skillCode: "DEV-01", required: true },
        { id: "transfer", label: "Transfert au nouveau contexte", dimension: "transfert", skillCode: "DEV-01", required: true },
        { id: "restitution", label: "Restitution écrite", dimension: "justification", skillCode: "DEV-02", required: false },
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

describe("regime de preuve d'un projet", () => {
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
    const decision = decideProjectProofs(
      project(),
      proposal,
      frozenArtifact,
    );
    expect(decision).toMatchObject({ eligible: false, proofs: [] });
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
    const decision = decideProjectProofs(project(), assessment(), {
      kind: "lien-externe",
      ref: "https://example.test/work",
      immutable: false,
    });
    expect(decision).toMatchObject({ eligible: false, proofs: [] });
  });

  it("classe A0/A1 en preuve faible meme si le travail reussit", () => {
    const decision = decideProjectProofs(project(), assessment({ autonomy: "A1" }), frozenArtifact);
    expect(decision.eligible).toBe(true);
    expect(decision.proofs).toEqual([
      expect.objectContaining({ skillCode: "DEV-01", quality: "faible" }),
    ]);
  });

  it("n'accorde une preuve forte qu'avec reussite, transfert plein, A3/A4 et snapshot", () => {
    expect(decideProjectProofs(project(), assessment(), frozenArtifact).proofs).toEqual([
      expect.objectContaining({ skillCode: "DEV-01", quality: "forte" }),
    ]);
    expect(decideProjectProofs(
      project(),
      assessment({ criteria: [
        { criterionId: "application", demonstration: "pleine" },
        { criterionId: "transfer", demonstration: "partielle" },
      ] }),
      frozenArtifact,
    ).proofs).toEqual([
      expect.objectContaining({ skillCode: "DEV-01", quality: "moyenne" }),
    ]);
  });

  it("ne prouve pas une competence qu'aucun critere demontre ne porte", () => {
    const decision = decideProjectProofs(project(), assessment(), frozenArtifact);
    expect(decision.proofs.map((proof) => proof.skillCode)).toEqual(["DEV-01"]);
    expect(decision.undemonstrated).toEqual(["DEV-02"]);
    expect(decision.reason).toContain("DEV-02");
  });

  it("prouve chaque competence au niveau que ses propres criteres justifient", () => {
    const decision = decideProjectProofs(
      project(),
      assessment({ criteria: [
        { criterionId: "application", demonstration: "pleine" },
        { criterionId: "transfer", demonstration: "pleine" },
        { criterionId: "restitution", demonstration: "partielle" },
      ] }),
      frozenArtifact,
    );
    // DEV-01 porte un transfert plein ; DEV-02 n'a qu'une restitution
    // partielle, sans dimension de transfert : la meme soumission ne leur vaut
    // pas la meme preuve.
    expect(decision.proofs).toEqual([
      expect.objectContaining({ skillCode: "DEV-01", quality: "forte" }),
      expect.objectContaining({ skillCode: "DEV-02", quality: "moyenne" }),
    ]);
    expect(decision.undemonstrated).toEqual([]);
  });

  it("refuse toute preuve quand aucun critere demontre ne porte de competence", () => {
    const decision = decideProjectProofs(
      project(),
      assessment({ criteria: [
        { criterionId: "application", demonstration: "insuffisante" },
        { criterionId: "transfer", demonstration: "insuffisante" },
      ] }),
      frozenArtifact,
    );
    expect(decision).toMatchObject({ eligible: false, proofs: [] });
    expect(decision.undemonstrated).toEqual(["DEV-01", "DEV-02"]);
  });

  it("refuse un critere visant une competence absente de la cible", () => {
    expect(() => parseLearningActivity(project({
      evaluationContract: {
        scope: "soumission-finale",
        criteria: [
          { id: "application", label: "Solution fonctionnelle", dimension: "application", skillCode: "DEV-99", required: true },
        ],
        assessableMilestoneIds: [],
      },
    }))).toThrow("absente de la cible");
  });

  it("traite un jalon comme observation sans contrat explicite", () => {
    const decision = decideProjectProofs(
      project(),
      assessment({ scope: { kind: "jalon", milestoneId: "draft" } }),
      frozenArtifact,
    );
    expect(decision).toMatchObject({ eligible: false, proofs: [] });
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
