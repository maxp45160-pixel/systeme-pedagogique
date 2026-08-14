"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dorsaleCompte, nouvelId } from "./db";
import { verifier } from "./supabase-backend";
import {
  decideProjectProofQuality,
  parseActivityAssessment,
  parseLearningGoal,
  parseWorkModeSettings,
} from "@/lib/domain/adaptive-learning";
import { chargerContexte } from "./context";
import { chargerDemandesGeneration, loadAdaptiveWorkspace } from "./adaptive-learning";
import { lireContexteInstant } from "@/lib/engine/action-unifiee";
import { parsePropositionContenuActivite, parsePropositionEvaluationProjet } from "@/lib/tutor/outils";
import type { Dimension, SkillEvidence } from "@/lib/domain/types";

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function loadCommandReceipt(
  requestId: string,
  expectedCommand: string,
): Promise<Record<string, unknown> | null> {
  const { supabase, userId } = await dorsaleCompte();
  const { data, error } = await supabase
    .from("learning_command_receipts")
    .select("command,result")
    .eq("user_id", userId)
    .eq("request_id", requestId)
    .maybeSingle();
  verifier("lecture du reçu de commande", error);
  if (!data) return null;
  if (data.command !== expectedCommand) {
    throw new Error("Ce request_id a déjà été utilisé pour une autre commande.");
  }
  if (!data.result || typeof data.result !== "object" || Array.isArray(data.result)) {
    throw new Error("Le reçu de commande est invalide.");
  }
  return data.result as Record<string, unknown>;
}

function workModeQuery(rawValue: string): string {
  if (!rawValue) return "";
  let parsedMode: unknown;
  try {
    parsedMode = JSON.parse(rawValue);
  } catch {
    throw new Error("Mode de travail initial illisible.");
  }
  const mode = parseWorkModeSettings(parsedMode);
  return `&focus=${mode.focus}&guidance=${mode.guidance}&tools=${mode.toolPower}`;
}

export async function saveLearningGoal(requestId: string, formData: FormData): Promise<void> {
  if (await loadCommandReceipt(requestId, "enregistrer_objectif_apprentissage")) {
    revalidatePath("/profil");
    revalidatePath("/");
    return;
  }
  const { supabase, userId } = await dorsaleCompte();
  const now = new Date().toISOString();
  const id = text(formData, "goalId") || nouvelId("goal");
  const criteria = text(formData, "successCriteria")
    .split(/\r?\n/)
    .map((label) => label.trim())
    .filter(Boolean)
    .map((label, index) => ({ id: `criterion-${index + 1}`, label, declaredMet: false }));
  const skillCodes = [...new Set(formData.getAll("skillCodes").filter((value): value is string => typeof value === "string" && value.length > 0))];
  const goal = parseLearningGoal({
    id,
    accountId: userId,
    title: text(formData, "title"),
    description: text(formData, "description"),
    declaredPriority: Number(text(formData, "declaredPriority")),
    horizon: text(formData, "horizon") || undefined,
    targetDate: text(formData, "targetDate") || undefined,
    successCriteria: criteria,
    declaredState: text(formData, "declaredState") || "actif",
    confirmedSkillCodes: skillCodes,
    confirmedThemeIds: [],
    createdAt: now,
    updatedAt: now,
  });
  const { error } = await supabase.rpc("enregistrer_objectif_apprentissage", {
    p_request_id: requestId,
    p_payload: {
      id: goal.id,
      title: goal.title,
      description: goal.description,
      declaredPriority: goal.declaredPriority,
      horizon: goal.horizon,
      targetDate: goal.targetDate,
      successCriteria: goal.successCriteria,
      declaredState: goal.declaredState,
      confirmedSkillCodes: goal.confirmedSkillCodes,
      confirmedThemeIds: goal.confirmedThemeIds,
    },
  });
  verifier("enregistrement transactionnel de l'objectif", error);
  revalidatePath("/profil");
  revalidatePath("/");
}

export async function acceptGeneratedActivity(formData: FormData): Promise<void> {
  const generationRequestId = text(formData, "generationRequestId");
  const requestId = text(formData, "requestId");
  const initialMode = text(formData, "initialMode");
  if (!generationRequestId || !requestId) {
    throw new Error("Acceptation incomplète.");
  }
  const receipt = await loadCommandReceipt(requestId, "accepter_activite_generee");
  if (receipt) {
    const storedRunId = typeof receipt.runId === "string" ? receipt.runId : "";
    if (!storedRunId) throw new Error("Le reçu d'acceptation est incomplet.");
    redirect(`/seances?run=${encodeURIComponent(storedRunId)}${workModeQuery(initialMode)}`);
  }
  const { supabase, userId } = await dorsaleCompte();
  const ctx = await chargerContexte();
  if (ctx.donnees.user.id !== userId || ctx.donnees.user.learningLoopMode !== "adaptive-v1") {
    throw new Error("La bêta adaptative n'est pas active pour ce compte.");
  }
  const demandes = await chargerDemandesGeneration(ctx, lireContexteInstant({
    temps: text(formData, "temps"),
    capacite: text(formData, "capacite"),
  }));
  const generation = demandes.find((item) => item.id === generationRequestId);
  if (!generation || (generation.family !== "explorer" && generation.family !== "produire")) {
    throw new Error("Contrat de génération introuvable.");
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text(formData, "proposal"));
  } catch {
    throw new Error("Proposition illisible.");
  }
  const proposal = parsePropositionContenuActivite(raw, generation.family);
  if (!proposal) throw new Error("La proposition ne respecte plus le schéma fermé.");

  const activityId = nouvelId("activity");
  const runId = nouvelId("run");
  const workspaceContent = proposal.famille === "explorer"
    ? {
      family: "explorer" as const,
      brief: proposal.brief,
      introduction: proposal.workspace.introduction,
      path: proposal.workspace.parcours.map((step) => ({
        title: step.titre,
        content: step.contenu,
        annotationPrompt: step.inviteAnnotation,
      })),
      optionalSynthesis: proposal.workspace.syntheseFacultative,
      milestones: proposal.jalons.map((milestone, index) => ({
        id: `milestone-${index + 1}`,
        title: milestone.titre,
        instruction: milestone.consigne,
        expectedResult: milestone.resultatAttendu,
      })),
    }
    : {
      family: "produire" as const,
      brief: proposal.brief,
      start: proposal.workspace.demarrage,
      artifactSections: proposal.workspace.canevasArtefact.map((section) => ({
        section: section.section,
        instruction: section.consigne,
      })),
      advice: proposal.workspace.conseilsRealisation,
      submissionInstruction: proposal.workspace.consigneSoumission,
      milestones: proposal.jalons.map((milestone, index) => ({
        id: `milestone-${index + 1}`,
        title: milestone.titre,
        instruction: milestone.consigne,
        expectedResult: milestone.resultatAttendu,
      })),
    };
  const { data, error } = await supabase.rpc("accepter_activite_generee", {
    p_request_id: requestId,
    p_payload: {
      activity: {
        id: activityId,
        version: 1,
        title: proposal.titre,
        description: proposal.description,
        family: generation.family,
        target: generation.target,
        estimatedDurationMinutes: generation.estimatedDurationMinutes,
        minimumSegmentMinutes: generation.minimumSegmentMinutes,
        cognitiveDemand: generation.cognitiveDemand,
        proofMode: generation.proofMode,
        workspace: generation.workspace,
        requiredTools: generation.requiredTools,
        authorizedResources: generation.authorizedResources,
        evaluationContract: generation.evaluationContract,
        workspaceContent,
      },
      run: { id: runId, status: "planifiee" },
      /*
        Aucun `checkinId` : le contexte d'instant n'est plus une ligne en base.
        La colonne est nullable — l'interaction reste rattachée au candidat
        accepté, ce qui suffit à ce qu'elle sert (la trace de l'acceptation).
      */
      interaction: {
        id: nouvelId("interaction"),
        candidateId: generationRequestId,
      },
    },
  });
  verifier("acceptation transactionnelle de l'activité", error);
  const result = data && typeof data === "object" && !Array.isArray(data)
    ? data as Record<string, unknown>
    : null;
  const storedRunId = typeof result?.runId === "string" ? result.runId : runId;
  revalidatePath("/seances");
  redirect(`/seances?run=${encodeURIComponent(storedRunId)}${workModeQuery(initialMode)}`);
}

async function activeSessionForRun(runId: string): Promise<string | null> {
  const { supabase, userId } = await dorsaleCompte();
  const { data, error } = await supabase
    .from("activity_run_sessions")
    .select("session_id,sessions!inner(statut)")
    .eq("user_id", userId)
    .eq("run_id", runId)
    .eq("sessions.statut", "en-cours")
    .limit(1)
    .maybeSingle();
  verifier("lecture de la séance active de l'activité", error);
  return data && typeof data.session_id === "string" ? data.session_id : null;
}

export async function startOrResumeActivity(
  runId: string,
  requestId: string,
  initialModeValue: unknown,
): Promise<void> {
  const initialMode = parseWorkModeSettings(initialModeValue);
  const modeQuery = `&focus=${initialMode.focus}&guidance=${initialMode.guidance}&tools=${initialMode.toolPower}`;
  if (await loadCommandReceipt(requestId, "enregistrer_evenement_activite")) {
    redirect(`/seances?run=${encodeURIComponent(runId)}${modeQuery}`);
  }
  const state = await loadAdaptiveWorkspace(runId);
  if (!state) throw new Error("Exécution introuvable.");
  if (state.run.status !== "planifiee" && state.run.status !== "en-pause") {
    throw new Error("Cette activité ne peut pas être démarrée dans son état actuel.");
  }
  const ctx = await chargerContexte();
  const domainIds = [...new Set(state.activity.target.skillCodes.flatMap((code) => {
    const skill = ctx.referentiel.parCode.get(code);
    return skill ? [skill.domaine] : [];
  }))];
  const existingSession = ctx.donnees.sessions.find((session) => session.statut === "en-cours");
  const sessionId = existingSession?.id ?? nouvelId("ses");
  const occurredAt = new Date().toISOString();
  const { error } = await (await dorsaleCompte()).supabase.rpc("enregistrer_evenement_activite", {
    p_request_id: requestId,
    p_run_id: runId,
    p_payload: {
      type: state.run.status === "planifiee" ? "demarrage" : "reprise",
      eventId: nouvelId("event"),
      occurredAt,
      event: state.run.status === "planifiee" ? { mode: initialMode } : {},
      sessionActivity: { type: state.activity.family, ref: runId, libelle: state.activity.title },
      sessionDomainIds: domainIds,
      sessionSkillCodes: state.activity.target.skillCodes,
      ...(existingSession
        ? { sessionId }
        : {
          session: {
            id: sessionId,
            date: occurredAt,
            domainIds,
            skillCodes: state.activity.target.skillCodes,
            activities: [{ type: state.activity.family, ref: runId, libelle: state.activity.title }],
          },
        }),
    },
  });
  verifier("démarrage transactionnel de l'activité", error);
  revalidatePath("/seances");
  redirect(`/seances?run=${encodeURIComponent(runId)}${modeQuery}`);
}

export async function planActivity(
  activityId: string,
  activityVersion: number,
  requestId: string,
  initialModeValue: unknown,
): Promise<void> {
  const initialMode = parseWorkModeSettings(initialModeValue);
  const modeQuery = `&focus=${initialMode.focus}&guidance=${initialMode.guidance}&tools=${initialMode.toolPower}`;
  const receipt = await loadCommandReceipt(requestId, "planifier_execution_activite");
  if (receipt) {
    const storedRunId = typeof receipt.runId === "string" ? receipt.runId : "";
    if (!storedRunId) throw new Error("Le reçu de planification est incomplet.");
    redirect(`/seances?run=${encodeURIComponent(storedRunId)}${modeQuery}`);
  }
  if (!Number.isInteger(activityVersion) || activityVersion < 1) {
    throw new Error("Version d'activité invalide.");
  }
  const runId = nouvelId("run");
  const { data, error } = await (await dorsaleCompte()).supabase.rpc("planifier_execution_activite", {
    p_request_id: requestId,
    p_activity_id: activityId,
    p_activity_version: activityVersion,
    p_run_id: runId,
  });
  verifier("planification transactionnelle de l'activité", error);
  const result = data && typeof data === "object" && !Array.isArray(data)
    ? data as Record<string, unknown>
    : null;
  const storedRunId = typeof result?.runId === "string" ? result.runId : runId;
  revalidatePath("/seances");
  redirect(`/seances?run=${encodeURIComponent(storedRunId)}${modeQuery}`);
}

export async function saveActivityArtifact(
  runId: string,
  requestId: string,
  formData: FormData,
): Promise<void> {
  if (await loadCommandReceipt(requestId, "enregistrer_artefact_activite")) {
    revalidatePath("/seances");
    return;
  }
  const state = await loadAdaptiveWorkspace(runId);
  if (!state || state.run.status !== "en-cours") throw new Error("Activité non modifiable.");
  const expectedVersion = Number(text(formData, "artifactVersion"));
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0) {
    throw new Error("Version d'artefact invalide.");
  }
  const artifactKind = text(formData, "artifactKind") || "structure";
  if (artifactKind !== "structure" && artifactKind !== "lien-externe") {
    throw new Error("Type d'artefact non pris en charge.");
  }
  const externalUrl = text(formData, "externalArtifactUrl");
  if (artifactKind === "lien-externe") {
    let parsed: URL;
    try {
      parsed = new URL(externalUrl);
    } catch {
      throw new Error("Le lien externe est invalide.");
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error("Le lien externe doit utiliser HTTP ou HTTPS.");
    }
  }
  const content = artifactKind === "structure"
    ? { body: text(formData, "artifactBody") }
    : { body: "", externalUrl, supportOnly: true };
  const { error } = await (await dorsaleCompte()).supabase.rpc("enregistrer_artefact_activite", {
    p_request_id: requestId,
    p_run_id: runId,
    p_expected_version: expectedVersion,
    p_content: content,
    p_current_artifact: artifactKind === "structure"
      ? { kind: "structure", ref: `activity-artifact:${runId}`, immutable: false }
      : { kind: "lien-externe", ref: externalUrl, immutable: false },
  });
  verifier("sauvegarde transactionnelle de l'artefact", error);
  revalidatePath("/seances");
}

export async function pauseActivity(runId: string, requestId: string): Promise<void> {
  if (await loadCommandReceipt(requestId, "enregistrer_evenement_activite")) {
    revalidatePath("/seances");
    redirect("/seances");
  }
  const sessionId = await activeSessionForRun(runId);
  if (!sessionId) throw new Error("Aucune séance active pour cette activité.");
  const { error } = await (await dorsaleCompte()).supabase.rpc("enregistrer_evenement_activite", {
    p_request_id: requestId,
    p_run_id: runId,
    p_payload: {
      type: "pause",
      eventId: nouvelId("event"),
      occurredAt: new Date().toISOString(),
      sessionId,
      event: { reason: "Pause demandée dans le workspace." },
    },
  });
  verifier("pause transactionnelle de l'activité", error);
  revalidatePath("/seances");
  redirect("/seances");
}

export async function changeWorkMode(
  runId: string,
  requestId: string,
  previousValue: unknown,
  nextValue: unknown,
): Promise<void> {
  if (await loadCommandReceipt(requestId, "enregistrer_evenement_activite")) return;
  const previous = parseWorkModeSettings(previousValue);
  const next = parseWorkModeSettings(nextValue);
  const sessionId = await activeSessionForRun(runId);
  if (!sessionId) throw new Error("Aucune séance active pour ce changement de mode.");
  const { error } = await (await dorsaleCompte()).supabase.rpc("enregistrer_evenement_activite", {
    p_request_id: requestId,
    p_run_id: runId,
    p_payload: {
      type: "changement-mode",
      eventId: nouvelId("event"),
      occurredAt: new Date().toISOString(),
      sessionId,
      event: { previous, next },
    },
  });
  verifier("journalisation du changement de mode", error);
}

export async function recordMilestone(
  runId: string,
  milestoneId: string,
  requestId: string,
): Promise<void> {
  if (await loadCommandReceipt(requestId, "enregistrer_evenement_activite")) return;
  if (!milestoneId.trim()) throw new Error("Jalon invalide.");
  const state = await loadAdaptiveWorkspace(runId);
  if (!state || !state.activity.workspaceContent?.milestones.some((item) => item.id === milestoneId)) {
    throw new Error("Ce jalon n'appartient pas au contrat de l'activité.");
  }
  const sessionId = await activeSessionForRun(runId);
  if (!sessionId) throw new Error("Aucune séance active pour ce jalon.");
  const { error } = await (await dorsaleCompte()).supabase.rpc("enregistrer_evenement_activite", {
    p_request_id: requestId,
    p_run_id: runId,
    p_payload: {
      type: "jalon",
      eventId: nouvelId("event"),
      occurredAt: new Date().toISOString(),
      sessionId,
      event: { milestoneId, state: "atteint" },
    },
  });
  verifier("journalisation du jalon", error);
  revalidatePath("/seances");
}

export async function completeExploration(runId: string, requestId: string): Promise<void> {
  if (await loadCommandReceipt(requestId, "cloturer_execution_activite")) {
    revalidatePath("/", "layout");
    redirect(`/?feedbackRun=${encodeURIComponent(runId)}&feedbackFamily=explorer`);
  }
  const state = await loadAdaptiveWorkspace(runId);
  if (!state || state.activity.family !== "explorer") throw new Error("Exploration introuvable.");
  const sessionId = await activeSessionForRun(runId);
  if (!sessionId) throw new Error("Aucune séance active.");
  const { error } = await (await dorsaleCompte()).supabase.rpc("cloturer_execution_activite", {
    p_request_id: requestId,
    p_run_id: runId,
    p_payload: {
      eventId: nouvelId("event"),
      sessionId,
      completedAt: new Date().toISOString(),
      artifact: state.run.currentArtifact,
      evidence: [],
      session: { result: "Exploration terminée — aucune preuve de niveau produite." },
    },
  });
  verifier("clôture de l'exploration", error);
  revalidatePath("/", "layout");
  redirect(`/?feedbackRun=${encodeURIComponent(runId)}&feedbackFamily=explorer`);
}

export async function abandonActivity(runId: string, requestId: string, formData: FormData): Promise<void> {
  if (await loadCommandReceipt(requestId, "abandonner_execution_activite")) {
    revalidatePath("/", "layout");
    redirect("/");
  }
  const sessionId = await activeSessionForRun(runId);
  const { error } = await (await dorsaleCompte()).supabase.rpc("abandonner_execution_activite", {
    p_request_id: requestId,
    p_run_id: runId,
    p_payload: {
      eventId: nouvelId("event"),
      sessionId,
      abandonedAt: new Date().toISOString(),
      reason: text(formData, "reason") || undefined,
    },
  });
  verifier("abandon de l'activité", error);
  revalidatePath("/", "layout");
  redirect("/");
}

const DEMONSTRATION_SCORE = {
  "non-observee": 0,
  insuffisante: 0.25,
  partielle: 0.5,
  pleine: 1,
} as const;

export async function submitProject(runId: string, requestId: string, formData: FormData): Promise<void> {
  if (await loadCommandReceipt(requestId, "cloturer_execution_activite")) {
    revalidatePath("/", "layout");
    redirect(`/?feedbackRun=${encodeURIComponent(runId)}&feedbackFamily=produire`);
  }
  const state = await loadAdaptiveWorkspace(runId);
  if (!state || state.activity.family !== "produire") throw new Error("Projet introuvable.");
  if (state.run.currentArtifact?.kind === "lien-externe" && !state.run.currentArtifact.immutable) {
    throw new Error("Un lien modifiable reste un support : copie, importe, exporte ou référence un commit immuable avant d'en faire une preuve.");
  }
  if (!state.artifact || typeof state.artifact.content.body !== "string" || !state.artifact.content.body.trim()) {
    throw new Error("Un artefact enregistré est requis avant la soumission.");
  }
  const sessionId = await activeSessionForRun(runId);
  if (!sessionId) throw new Error("Aucune séance active.");
  const now = new Date().toISOString();
  const snapshotId = nouvelId("artifact-snapshot");
  const rawProposedEvaluation = text(formData, "proposedEvaluation");
  let proposedEvaluation: ReturnType<typeof parsePropositionEvaluationProjet> = null;
  if (rawProposedEvaluation) {
    let raw: unknown;
    try {
      raw = JSON.parse(rawProposedEvaluation);
    } catch {
      throw new Error("Proposition du tuteur illisible.");
    }
    proposedEvaluation = parsePropositionEvaluationProjet(
      raw,
      state.activity.evaluationContract.criteria.map((criterion) => criterion.id),
    );
    if (!proposedEvaluation) throw new Error("La proposition du tuteur ne respecte plus le contrat.");
    const proposedArtifactVersion = Number(text(formData, "proposedArtifactVersion"));
    if (!Number.isInteger(proposedArtifactVersion) || proposedArtifactVersion !== state.artifact.version) {
      throw new Error("L'artefact a changé depuis la proposition du tuteur. Demande une nouvelle relecture ou valide sans elle.");
    }
  }
  const proposedAssessment = proposedEvaluation ? parseActivityAssessment({
    id: nouvelId("assessment-proposal"),
    accountId: state.activity.accountId,
    runId,
    activityId: state.activity.id,
    activityVersion: state.activity.version,
    kind: "proposition-tuteur",
    scope: { kind: "soumission-finale" },
    criteria: proposedEvaluation.criteres.map((criterion) => ({
      criterionId: criterion.critereId,
      demonstration: criterion.appreciation === "demontre"
        ? "pleine"
        : criterion.appreciation === "partiellement-demontre"
          ? "partielle"
          : "non-observee",
      note: [criterion.justification, ...criterion.elementsObserves].join(" · "),
    })),
    artifactSnapshotId: snapshotId,
    requestId: `${requestId}:proposal`,
    createdAt: now,
  }) : null;
  const criteria = state.activity.evaluationContract.criteria.map((criterion) => ({
    criterionId: criterion.id,
    demonstration: text(formData, `criterion:${criterion.id}`),
    note: text(formData, `note:${criterion.id}`) || undefined,
  }));
  const assessment = parseActivityAssessment({
    id: nouvelId("assessment"),
    accountId: state.activity.accountId,
    runId,
    activityId: state.activity.id,
    activityVersion: state.activity.version,
    kind: "validation-humaine",
    proposedAssessmentId: proposedAssessment?.id,
    scope: { kind: "soumission-finale" },
    criteria,
    result: text(formData, "result"),
    autonomy: text(formData, "autonomy"),
    artifactSnapshotId: snapshotId,
    requestId: `${requestId}:assessment`,
    createdAt: now,
  });
  if (assessment.kind !== "validation-humaine") {
    throw new Error("La soumission finale doit être une validation humaine.");
  }
  const artifact = {
    kind: "structure" as const,
    ref: `activity-artifact:${runId}`,
    snapshotId,
    frozenAt: now,
    immutable: true,
  };
  const proof = decideProjectProofQuality(state.activity, assessment, artifact);
  const dimensions = assessment.criteria.reduce<Partial<Record<Dimension, number>>>((result, criterion) => {
    const contract = state.activity.evaluationContract.criteria.find((item) => item.id === criterion.criterionId);
    if (contract?.dimension) result[contract.dimension] = DEMONSTRATION_SCORE[criterion.demonstration];
    return result;
  }, {});
  const evidence: SkillEvidence[] = proof.eligible && proof.quality
    ? state.activity.target.skillCodes.map((skillCode, index) => ({
      id: nouvelId("ev"),
      skillCode,
      date: now,
      type: "projet",
      niveauPreuve: index === 0 ? "A" : "B",
      autonomie: assessment.autonomy,
      qualite: proof.quality!,
      resultat: assessment.result,
      contexte: state.activity.title,
      dimensions,
      competencesCombinees: state.activity.target.skillCodes.filter((code) => code !== skillCode),
      source: { kind: "projet", ref: runId },
      commentaire: proof.reason,
    }))
    : [];
  const { error } = await (await dorsaleCompte()).supabase.rpc("cloturer_execution_activite", {
    p_request_id: requestId,
    p_run_id: runId,
    p_payload: {
      eventId: nouvelId("event"),
      sessionId,
      completedAt: now,
      artifact: { ...artifact, immutable: false, snapshotId: undefined, frozenAt: undefined },
      snapshot: { id: snapshotId, kind: "structure", capturedAt: now, metadata: { artifactVersion: state.artifact.version } },
      ...(proposedAssessment ? { proposedAssessment } : {}),
      assessment,
      evidence,
      session: { result: `Projet ${assessment.result}.`, mainLearning: text(formData, "mainLearning") || undefined },
    },
  });
  verifier("soumission transactionnelle du projet", error);
  revalidatePath("/", "layout");
  redirect(`/?feedbackRun=${encodeURIComponent(runId)}&feedbackFamily=produire`);
}

export async function rectifyEvidence(requestId: string, formData: FormData): Promise<void> {
  if (await loadCommandReceipt(requestId, "rectifier_preuve")) {
    revalidatePath("/atelier");
    revalidatePath("/", "layout");
    return;
  }
  const { supabase, userId } = await dorsaleCompte();
  const evidenceId = text(formData, "evidenceId");
  const action = text(formData, "action");
  const reason = text(formData, "reason");
  const replacementEvidenceId = text(formData, "replacementEvidenceId");
  if (!evidenceId || !reason || !["invalider", "restaurer", "remplacer"].includes(action)) {
    throw new Error("Rectification incomplète.");
  }
  if (action === "remplacer" && (!replacementEvidenceId || replacementEvidenceId === evidenceId)) {
    throw new Error("Une preuve de remplacement distincte est requise.");
  }
  const evidenceIds = [evidenceId, ...(replacementEvidenceId ? [replacementEvidenceId] : [])];
  const { data: owned, error: ownedError } = await supabase
    .from("evidence")
    .select("id")
    .eq("user_id", userId)
    .in("id", evidenceIds);
  verifier("validation des preuves à rectifier", ownedError);
  if ((owned ?? []).length !== evidenceIds.length) {
    throw new Error("Une preuve visée n'appartient pas à ce compte.");
  }
  const { error } = await supabase.rpc("rectifier_preuve", {
    p_request_id: requestId,
    p_event_id: nouvelId("evidence-status"),
    p_evidence_id: evidenceId,
    p_action: action,
    p_reason: reason,
    p_replacement_evidence_id: replacementEvidenceId || null,
  });
  verifier("rectification de la preuve", error);
  revalidatePath("/atelier");
  revalidatePath("/", "layout");
}
