import type { SkillState } from "@/lib/domain/types";
import { PREFIXE_ACTIVITE_RESSOURCE } from "@/lib/domain/adaptive-learning";
import type {
  ActionContext,
  ActionRecommendation,
  ActivityEvent,
  ActivityFamily,
  ActivityGenerationRequest,
  ActivityRun,
  ActivityTarget,
  LearningActivity,
  LearningGoal,
  LearningPreference,
  MentalCapacity,
  RecommendationFactor,
  RecommendedLearningAction,
  SequencingSignal,
  WorkspaceTool,
  WorkModeSettings,
} from "@/lib/domain/adaptive-learning";

export const ADAPTIVE_POLICY_VERSION = "adaptive-v1.0.0";

export interface ActionRecommendationInput {
  context: ActionContext;
  activities: readonly LearningActivity[];
  openRuns: readonly ActivityRun[];
  /** Executions terminees utiles au sequencement, jamais candidates a la reprise. */
  historicalRuns?: readonly ActivityRun[];
  generationRequests: readonly ActivityGenerationRequest[];
  goals: readonly LearningGoal[];
  /** Classement deja calcule par le moteur historique, du premier au dernier. */
  rankedSkillStates: readonly SkillState[];
  events: readonly ActivityEvent[];
  sequencingSignals: readonly SequencingSignal[];
  preferences: readonly LearningPreference[];
  availableTools: readonly WorkspaceTool[];
  policyVersion?: string;
}

interface Candidate {
  id: string;
  source: RecommendedLearningAction["source"];
  activity?: LearningActivity;
  run?: ActivityRun;
  generation?: ActivityGenerationRequest;
  title: string;
  family: ActivityFamily;
  target: ActivityTarget;
  durationMinutes: number;
  segmented: boolean;
  workspace: RecommendedLearningAction["workspace"];
  requiredTools: readonly WorkspaceTool[];
  constraints: string[];
  proofMode: LearningActivity["proofMode"];
}

interface RankedCandidate {
  candidate: Candidate;
  vector: number[];
  action: RecommendedLearningAction;
}

const CAPACITY_ORDER: Record<MentalCapacity, number> = {
  faible: 0,
  standard: 1,
  elevee: 2,
};

function targetIntersects(left: ActivityTarget, right: ActivityTarget): boolean {
  const intersects = (first: readonly string[], second: readonly string[]) =>
    first.some((value) => second.includes(value));
  return intersects(left.skillCodes, right.skillCodes)
    || intersects(left.themeIds, right.themeIds)
    || intersects(left.goalIds, right.goalIds)
    || (left.label !== undefined && right.label !== undefined && left.label === right.label);
}

function targetMatchesReference(
  candidate: Candidate,
  target: NonNullable<ActionContext["target"]>,
): boolean {
  if (target.kind === "activity") return candidate.activity?.id === target.ref;
  if (target.kind === "run") return candidate.run?.id === target.ref;
  if (target.kind === "skill") return candidate.target.skillCodes.includes(target.ref);
  if (target.kind === "theme") return candidate.target.themeIds.includes(target.ref);
  return candidate.target.goalIds.includes(target.ref);
}

function activeGoal(goals: readonly LearningGoal[], accountId: string): LearningGoal | null {
  return goals
    .filter((goal) => goal.accountId === accountId && goal.declaredState === "actif")
    .slice()
    .sort((left, right) => {
      if (left.declaredPriority !== right.declaredPriority) {
        return right.declaredPriority - left.declaredPriority;
      }
      const leftDate = left.targetDate ?? "9999-12-31";
      const rightDate = right.targetDate ?? "9999-12-31";
      return leftDate.localeCompare(rightDate) || left.id.localeCompare(right.id);
    })[0] ?? null;
}

function goalTarget(goal: LearningGoal): ActivityTarget {
  return {
    skillCodes: goal.confirmedSkillCodes,
    themeIds: goal.confirmedThemeIds,
    goalIds: [goal.id],
  };
}

function candidateMatchesGoal(candidate: Candidate, goal: LearningGoal | null): boolean {
  return goal !== null && targetIntersects(candidate.target, goalTarget(goal));
}

function segmentDuration(
  family: ActivityFamily,
  total: number,
  minimumSegment: number | undefined,
  available: number,
): { duration: number; segmented: boolean } | null {
  if (total <= available) return { duration: total, segmented: false };
  if (family !== "produire" || minimumSegment === undefined || minimumSegment > available) return null;
  return { duration: Math.min(total, available), segmented: true };
}

function toolsAvailable(required: readonly WorkspaceTool[], available: ReadonlySet<WorkspaceTool>): boolean {
  return required.every((tool) => available.has(tool));
}

function candidatesFromInput(input: ActionRecommendationInput): Candidate[] {
  const accountId = input.context.accountId;
  const availableTools = new Set(input.availableTools);
  const openRuns = input.openRuns.filter((run) =>
    run.accountId === accountId
    && (run.status === "planifiee" || run.status === "en-cours" || run.status === "en-pause"),
  );
  const runsByActivity = new Map<string, ActivityRun[]>();
  for (const run of openRuns.slice().sort((left, right) => left.id.localeCompare(right.id))) {
    const key = `${run.activityId}@${run.activityVersion}`;
    runsByActivity.set(key, [...(runsByActivity.get(key) ?? []), run]);
  }
  const candidates: Candidate[] = [];

  for (const activity of input.activities) {
    if (activity.accountId !== accountId || activity.status !== "active") continue;
    if (!toolsAvailable(activity.requiredTools, availableTools)) continue;
    const duration = segmentDuration(
      activity.family,
      activity.estimatedDurationMinutes,
      activity.minimumSegmentMinutes,
      input.context.availableTimeMinutes,
    );
    if (!duration) continue;
    const runs = runsByActivity.get(`${activity.id}@${activity.version}`) ?? [];
    for (const run of runs.length > 0 ? runs : [undefined]) {
      candidates.push({
        id: run ? `run:${run.id}` : `activity:${activity.id}@${activity.version}`,
        source: run ? "reprise" : "activite",
        activity,
        run,
        title: activity.title,
        family: activity.family,
        target: activity.target,
        durationMinutes: duration.duration,
        segmented: duration.segmented,
        workspace: activity.workspace,
        requiredTools: activity.requiredTools,
        constraints: [],
        proofMode: activity.proofMode,
      });
    }
  }

  for (const request of input.generationRequests) {
    if (request.accountId !== accountId || !toolsAvailable(request.requiredTools, availableTools)) continue;
    const duration = segmentDuration(
      request.family,
      request.estimatedDurationMinutes,
      request.minimumSegmentMinutes,
      input.context.availableTimeMinutes,
    );
    if (!duration) continue;
    const concreteCandidateExists = candidates.some((candidate) =>
      candidate.source !== "generation"
      && candidate.family === request.family
      && targetIntersects(candidate.target, request.target),
    );
    if (concreteCandidateExists) continue;
    candidates.push({
      id: `generation:${request.id}`,
      source: "generation",
      generation: request,
      title: request.title,
      family: request.family,
      target: request.target,
      durationMinutes: duration.duration,
      segmented: duration.segmented,
      workspace: request.workspace,
      requiredTools: request.requiredTools,
      constraints: request.constraints.slice(),
      proofMode: request.proofMode,
    });
  }

  return candidates;
}

function signalFamily(kind: SequencingSignal["kind"]): ActivityFamily {
  if (kind === "difficulte-comprehension") return "explorer";
  if (kind === "revision-due" || kind === "consolidation-application") return "entrainer";
  return "produire";
}

function intendedFamily(intent: ActionContext["intent"]): ActivityFamily | null {
  if (intent === "explorer") return "explorer";
  if (intent === "pratiquer") return "entrainer";
  if (intent === "produire") return "produire";
  return null;
}

function latestRelevantSignal(
  signals: readonly SequencingSignal[],
  accountId: string,
  scope: ActivityTarget | null,
): SequencingSignal | null {
  return signals
    .filter((signal) => signal.accountId === accountId && (scope === null || targetIntersects(signal.target, scope)))
    .slice()
    .sort((left, right) => right.observedAt.localeCompare(left.observedAt) || left.id.localeCompare(right.id))[0] ?? null;
}

function latestExplorationDate(
  target: ActivityTarget,
  activities: readonly LearningActivity[],
  runs: readonly ActivityRun[],
  events: readonly ActivityEvent[],
): string | null {
  const activityByKey = new Map(activities.map((activity) => [`${activity.id}@${activity.version}`, activity]));
  const runIds = new Set(
    runs
      .filter((run) => {
        const activity = activityByKey.get(`${run.activityId}@${run.activityVersion}`);
        return activity?.family === "explorer" && targetIntersects(activity.target, target);
      })
      .map((run) => run.id),
  );
  return events
    .filter((event) => event.type === "cloture" && runIds.has(event.runId))
    .map((event) => event.createdAt)
    .sort((left, right) => right.localeCompare(left))[0] ?? null;
}

function latestProofDate(target: ActivityTarget, states: readonly SkillState[]): string | null {
  const dates = states
    .filter((state) => target.skillCodes.length === 0 || target.skillCodes.includes(state.skill.code))
    .map((state) => state.derniereObservation)
    .filter((date): date is string => date !== null)
    .sort((left, right) => right.localeCompare(left));
  return dates[0] ?? null;
}

function followsRecentExploration(candidate: Candidate, input: ActionRecommendationInput): boolean {
  if (candidate.family === "explorer") return false;
  const exploration = latestExplorationDate(
    candidate.target,
    input.activities,
    [...input.openRuns, ...(input.historicalRuns ?? [])],
    input.events,
  );
  if (!exploration) return false;
  const proof = latestProofDate(candidate.target, input.rankedSkillStates);
  return proof === null || exploration > proof;
}

function skillRank(candidate: Candidate, states: readonly SkillState[]): { value: number; code?: string } {
  const index = states.findIndex((state) => candidate.target.skillCodes.includes(state.skill.code));
  return index === -1 ? { value: 0 } : { value: states.length - index, code: states[index].skill.code };
}

function preferenceMatch(candidate: Candidate, preferences: readonly LearningPreference[], accountId: string): boolean {
  return preferences.some((preference) => {
    if (preference.accountId !== accountId || preference.status !== "declaree") return false;
    if (preference.kind === "famille") return preference.value === candidate.family;
    if (preference.kind === "workspace") return preference.value === candidate.workspace;
    return false;
  });
}

function isDocumentResource(candidate: Candidate): boolean {
  return candidate.activity?.id.startsWith(PREFIXE_ACTIVITE_RESSOURCE) ?? false;
}

function preferredMode(
  family: ActivityFamily,
  capacity: MentalCapacity,
  preferences: readonly LearningPreference[],
  accountId: string,
): WorkModeSettings {
  const declared = preferences
    .filter((preference) => preference.accountId === accountId && preference.status === "declaree" && preference.kind === "mode")
    .slice()
    .sort((left, right) => right.observedAt.localeCompare(left.observedAt) || left.id.localeCompare(right.id))[0];
  if (declared?.kind === "mode") return { ...declared.value };
  if (family === "explorer") {
    return { focus: "equilibre", guidance: capacity === "faible" ? "guide" : "equilibre", toolPower: "standards" };
  }
  if (family === "entrainer") {
    return { focus: "epure", guidance: capacity === "elevee" ? "equilibre" : "guide", toolPower: "essentiels" };
  }
  return { focus: "riche", guidance: capacity === "faible" ? "guide" : "autonome", toolPower: "avances" };
}

function compareVectors(left: RankedCandidate, right: RankedCandidate): number {
  const length = Math.max(left.vector.length, right.vector.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (right.vector[index] ?? 0) - (left.vector[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return left.candidate.id.localeCompare(right.candidate.id);
}

function rankCandidate(
  candidate: Candidate,
  input: ActionRecommendationInput,
  goal: LearningGoal | null,
  signal: SequencingSignal | null,
): RankedCandidate {
  const explicitFamily = intendedFamily(input.context.intent);
  const desiredFamily = explicitFamily ?? (signal ? signalFamily(signal.kind) : "entrainer");
  const explicitTarget = input.context.target !== undefined && targetMatchesReference(candidate, input.context.target);
  const goalMatch = candidateMatchesGoal(candidate, goal);
  const explicitFamilyMatch = explicitFamily !== null && candidate.family === explicitFamily;
  const sequenceMatch = explicitFamily === null && candidate.family === desiredFamily;
  const explorationFollowUp = followsRecentExploration(candidate, input);
  const resumeMatch = input.context.intent === "reprendre" && candidate.source === "reprise";
  const capacityDifference = CAPACITY_ORDER[input.context.mentalCapacity]
    - CAPACITY_ORDER[candidate.activity?.cognitiveDemand ?? candidate.generation?.cognitiveDemand ?? "standard"];
  const capacityFit = capacityDifference >= 0 ? 2 : capacityDifference === -1 ? 1 : 0;
  const preferred = preferenceMatch(candidate, input.preferences, input.context.accountId);
  const documentResource = isDocumentResource(candidate);
  const rank = skillRank(candidate, input.rankedSkillStates);
  const timeFit = -Math.abs(input.context.availableTimeMinutes - candidate.durationMinutes);
  const factors: RecommendationFactor[] = [];

  if (explicitTarget) factors.push({ kind: "cible-explicite", label: "Correspond a la cible choisie.", sourceRef: input.context.target?.ref });
  if (goalMatch && goal) factors.push({ kind: "objectif", label: `Sert l'objectif actif « ${goal.title} ».`, sourceRef: goal.id });
  if (rank.code) factors.push({ kind: "classement-competence", label: `${rank.code} est prioritaire dans le classement actuel.`, sourceRef: rank.code });
  if (explicitFamilyMatch || sequenceMatch) factors.push({ kind: "sequencement", label: explicitFamilyMatch ? `L'intention explicite favorise ${candidate.family}.` : signal ? `La sequence appelle ${candidate.family} apres ${signal.kind}.` : `La sequence par defaut favorise ${candidate.family}.`, sourceRef: signal?.sourceRef });
  if (explorationFollowUp) factors.push({ kind: "exploration-recente", label: "Une exploration recente appelle maintenant une mise en pratique ou une production." });
  if (documentResource) factors.push({ kind: "ressource-documentaire", label: "Cette ressource dispose d'un travail documentaire dédié." });
  factors.push({ kind: "temps", label: candidate.segmented ? `Un segment de ${candidate.durationMinutes} min tient dans le temps disponible.` : `La duree de ${candidate.durationMinutes} min tient dans le temps disponible.` });
  factors.push({ kind: "capacite", label: capacityFit === 2 ? "La demande cognitive est compatible avec la capacite declaree." : "La demande cognitive depasse la capacite declaree ; reserve affichee." });
  if (preferred) factors.push({ kind: "preference-declaree", label: "Correspond a une preference confirmee." });
  if (candidate.source === "reprise") factors.push({ kind: "reprise", label: "Ce travail est deja ouvert et peut etre repris.", sourceRef: candidate.run?.id });

  const reservations: string[] = [];
  if (capacityFit < 2) reservations.push("La demande cognitive estimee depasse la capacite declaree.");
  if (candidate.proofMode === "support-seul") reservations.push("Cette action soutient l'apprentissage mais ne produit aucune observation de niveau.");
  if (candidate.source === "generation") reservations.push("Le contenu sera propose dans un schema ferme et ne sera enregistre qu'apres acceptation.");
  if (candidate.segmented) reservations.push("Seul un segment est propose ; le travail restera ouvert apres cette seance.");

  const action: RecommendedLearningAction = {
    candidateId: candidate.id,
    source: candidate.source,
    activityId: candidate.activity?.id,
    activityVersion: candidate.activity?.version,
    runId: candidate.run?.id,
    generationRequestId: candidate.generation?.id,
    title: candidate.title,
    family: candidate.family,
    target: candidate.target,
    durationMinutes: candidate.durationMinutes,
    segmented: candidate.segmented,
    workspace: candidate.workspace,
    proposedMode: preferredMode(candidate.family, input.context.mentalCapacity, input.preferences, input.context.accountId),
    factors,
    constraints: [
      `Temps disponible : ${input.context.availableTimeMinutes} min.`,
      ...candidate.constraints,
      ...(candidate.requiredTools.length > 0 ? [`Outils requis : ${candidate.requiredTools.join(", ")}.`] : []),
    ],
    reservations,
  };

  return {
    candidate,
    action,
    vector: [
      resumeMatch ? 1 : 0,
      explicitTarget ? 1 : 0,
      goalMatch ? 1 : 0,
      explicitFamilyMatch ? 1 : 0,
      documentResource ? 1 : 0,
      rank.value,
      explorationFollowUp ? 1 : 0,
      sequenceMatch ? 1 : 0,
      capacityFit,
      preferred ? 1 : 0,
      timeFit,
    ],
  };
}

/**
 * Retourne la meilleure action et des alternatives honnetes. Aucune activite
 * n'est generee ici : une generation n'existe que si le candidat explicite
 * correspondant a ete fourni.
 */
export function recommendLearningAction(
  input: ActionRecommendationInput,
): ActionRecommendation | null {
  let candidates = candidatesFromInput(input);
  const explicitlyTargetedGoal = input.context.target?.kind === "goal"
    ? input.goals.find((goal) => goal.id === input.context.target?.ref && goal.accountId === input.context.accountId) ?? null
    : null;
  if (input.context.target) {
    candidates = explicitlyTargetedGoal
      ? candidates.filter((candidate) => candidateMatchesGoal(candidate, explicitlyTargetedGoal))
      : candidates.filter((candidate) => targetMatchesReference(candidate, input.context.target!));
  }
  if (candidates.length === 0) return null;

  const goal = input.context.target?.kind === "goal"
    ? explicitlyTargetedGoal
    : activeGoal(input.goals, input.context.accountId);
  const scope = input.context.target
    ? candidates[0]?.target ?? null
    : goal ? goalTarget(goal) : null;
  const signal = latestRelevantSignal(input.sequencingSignals, input.context.accountId, scope);
  const ranked = candidates
    .map((candidate) => rankCandidate(candidate, input, goal, signal))
    .sort(compareVectors);
  const primary = ranked[0];
  const alternatives: RecommendedLearningAction[] = [];
  const selectedFamilies = new Set<ActivityFamily>([primary.candidate.family]);
  for (const entry of ranked.slice(1)) {
    if (selectedFamilies.has(entry.candidate.family)) continue;
    alternatives.push(entry.action);
    selectedFamilies.add(entry.candidate.family);
    if (alternatives.length === 2) break;
  }

  return {
    primary: primary.action,
    alternatives,
    factors: primary.action.factors,
    constraints: primary.action.constraints,
    reservations: primary.action.reservations,
    policyVersion: input.policyVersion ?? ADAPTIVE_POLICY_VERSION,
  };
}
