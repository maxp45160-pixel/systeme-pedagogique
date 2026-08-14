import type { Autonomie, Dimension, QualitePreuve } from "./types";

export const ACTIVITY_FAMILIES = ["explorer", "entrainer", "produire"] as const;
export type ActivityFamily = (typeof ACTIVITY_FAMILIES)[number];

export const MENTAL_CAPACITIES = ["faible", "standard", "elevee"] as const;
export type MentalCapacity = (typeof MENTAL_CAPACITIES)[number];

export const WORKSPACES = [
  "exploration-guidee",
  "exercice-trois-actes",
  "mini-projet",
] as const;
export type ActivityWorkspace = (typeof WORKSPACES)[number];

export const WORKSPACE_TOOLS = [
  "annotations",
  "ressources",
  "indices",
  "tuteur",
  "editeur-markdown",
  "fichiers",
  "liens",
  "calculatrice",
] as const;
export type WorkspaceTool = (typeof WORKSPACE_TOOLS)[number];

export interface ActivityTarget {
  skillCodes: string[];
  themeIds: string[];
  goalIds: string[];
  /** Libelle explicite pour un sujet qui n'a pas encore de lien confirme. */
  label?: string;
}

export type ActionTarget =
  | { kind: "skill"; ref: string }
  | { kind: "theme"; ref: string }
  | { kind: "goal"; ref: string }
  | { kind: "activity"; ref: string }
  | { kind: "run"; ref: string };

export interface GoalSuccessCriterion {
  id: string;
  label: string;
  /** Declaration de la personne, pas resultat calcule. */
  declaredMet: boolean;
}

export interface LearningGoal {
  id: string;
  accountId: string;
  title: string;
  description: string;
  /** Entier de 1 a 5 ; 5 est la priorite declaree la plus haute. */
  declaredPriority: number;
  horizon?: "court-terme" | "moyen-terme" | "long-terme";
  targetDate?: string;
  successCriteria: GoalSuccessCriterion[];
  declaredState: "brouillon" | "actif" | "en-pause" | "atteint" | "abandonne";
  confirmedSkillCodes: string[];
  confirmedThemeIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface GoalLinkDiff {
  goalId: string;
  proposedSkillCodes: string[];
  proposedThemeIds: string[];
  removedSkillCodes: string[];
  removedThemeIds: string[];
  origin: "tuteur";
}

export interface ActionContext {
  accountId: string;
  availableTimeMinutes: number;
  mentalCapacity: MentalCapacity;
  intent: "systeme" | "reprendre" | "explorer" | "pratiquer" | "produire";
  target?: ActionTarget;
  /** Conserve mot pour mot et n'entre dans aucun calcul. */
  verbatimNote?: string;
  declaredAt: string;
}

export interface WorkModeSettings {
  focus: "epure" | "equilibre" | "riche";
  guidance: "guide" | "equilibre" | "autonome";
  toolPower: "essentiels" | "standards" | "avances";
}

export interface ActivityTemplate {
  id: string;
  accountId: string;
  title: string;
  description: string;
  workspace: ActivityWorkspace;
  families: ActivityFamily[];
  defaultMode: WorkModeSettings;
  enabledTools: WorkspaceTool[];
  version: number;
  origin: "application" | "compte";
  status: "active" | "archivee";
  createdAt: string;
  updatedAt: string;
}

export interface AuthorizedResource {
  id: string;
  kind: "document-interne" | "lien-externe" | "fichier" | "tuteur" | "documentation";
  label: string;
  ref?: string;
  /** Une ressource normale ne diminue pas l'autonomie au regard du contrat. */
  usage: "normale" | "aide";
}

export interface EvaluationCriterion {
  id: string;
  label: string;
  dimension?: Dimension;
  required: boolean;
}

export interface EvaluationContract {
  scope: "aucune" | "soumission-finale" | "jalons-et-soumission";
  criteria: EvaluationCriterion[];
  /** Seuls ces jalons peuvent produire une evaluation, jamais les autres. */
  assessableMilestoneIds: string[];
}

export interface ActivityMilestoneContent {
  id: string;
  title: string;
  instruction: string;
  expectedResult: string;
}

export type ActivityWorkspaceContent =
  | {
      family: "explorer";
      brief: string;
      introduction: string;
      path: { title: string; content: string; annotationPrompt: string }[];
      optionalSynthesis: string;
      milestones: ActivityMilestoneContent[];
    }
  | {
      family: "produire";
      brief: string;
      start: string;
      artifactSections: { section: string; instruction: string }[];
      advice: string[];
      submissionInstruction: string;
      milestones: ActivityMilestoneContent[];
    };

export interface LearningActivity {
  id: string;
  accountId: string;
  templateId?: string;
  title: string;
  description: string;
  family: ActivityFamily;
  target: ActivityTarget;
  estimatedDurationMinutes: number;
  cognitiveDemand: MentalCapacity;
  proofMode: "support-seul" | "soumission-finale" | "jalons-contractuels";
  workspace: ActivityWorkspace;
  requiredTools: WorkspaceTool[];
  authorizedResources: AuthorizedResource[];
  evaluationContract: EvaluationContract;
  /** Contenu éditorial fermé, rempli par le tuteur puis accepté humainement. */
  workspaceContent?: ActivityWorkspaceContent;
  /** Un travail durable peut proposer un segment honnete plus court. */
  minimumSegmentMinutes?: number;
  version: number;
  origin: "application" | "tuteur" | "utilisateur" | "legacy-adapter";
  status: "active" | "archivee";
  archivedAt?: string;
  archivedReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ArtifactReference {
  kind: "markdown" | "structure" | "fichier" | "lien-externe" | "commit";
  ref: string;
  revision?: string;
  snapshotId?: string;
  frozenAt?: string;
  /** Vrai uniquement si le contenu vise ne peut plus changer. */
  immutable: boolean;
}

export interface ActivityRun {
  id: string;
  accountId: string;
  activityId: string;
  /** Version exacte ouverte : une modification ulterieure ne reecrit pas le travail. */
  activityVersion: number;
  status: "planifiee" | "en-cours" | "en-pause" | "terminee" | "abandonnee";
  currentArtifact?: ArtifactReference;
  sessionIds: string[];
  activeMilestoneId?: string;
  createdAt: string;
  startedAt?: string;
  pausedAt?: string;
  completedAt?: string;
  abandonedAt?: string;
}

interface ActivityEventBase {
  id: string;
  accountId: string;
  runId: string;
  sessionId?: string;
  /** Cle d'idempotence de la commande ayant produit l'evenement. */
  requestId: string;
  createdAt: string;
}

export type ActivityEvent = ActivityEventBase & (
  | { type: "demarrage"; mode: WorkModeSettings }
  | { type: "pause"; reason?: string }
  | { type: "reprise" }
  | { type: "jalon"; milestoneId: string; state: "atteint" | "soumis" }
  | {
      type: "aide";
      helpKind: "indice" | "tuteur" | "ressource" | "correction" | "autre";
      resourceId?: string;
      allowedByContract: boolean;
      detail?: string;
    }
  | { type: "changement-mode"; previous: WorkModeSettings; next: WorkModeSettings }
  | { type: "cloture"; assessmentId?: string; artifactSnapshotId?: string }
  | { type: "abandon"; reason?: string }
);

export interface CriterionAssessment {
  criterionId: string;
  demonstration: "non-observee" | "insuffisante" | "partielle" | "pleine";
  note?: string;
}

interface ActivityAssessmentBase {
  id: string;
  accountId: string;
  runId: string;
  activityId: string;
  activityVersion: number;
  scope: { kind: "soumission-finale" } | { kind: "jalon"; milestoneId: string };
  criteria: CriterionAssessment[];
  artifactSnapshotId?: string;
  requestId: string;
  createdAt: string;
}

export type ActivityAssessment = ActivityAssessmentBase & (
  | {
      kind: "proposition-tuteur";
      /** Une proposition n'attribue ni résultat global, ni autonomie. */
      proposedAssessmentId?: never;
    }
  | {
      kind: "validation-humaine";
      /** Facultatif : un bilan manuel reste possible si le tuteur echoue. */
      proposedAssessmentId?: string;
      result: "reussi" | "partiel" | "echec";
      autonomy: Autonomie;
    }
);

export interface ActivityGenerationRequest {
  id: string;
  accountId: string;
  family: ActivityFamily;
  target: ActivityTarget;
  title: string;
  constraints: string[];
  estimatedDurationMinutes: number;
  minimumSegmentMinutes?: number;
  cognitiveDemand: MentalCapacity;
  proofMode: LearningActivity["proofMode"];
  workspace: ActivityWorkspace;
  requiredTools: WorkspaceTool[];
  authorizedResources: AuthorizedResource[];
  evaluationContract: EvaluationContract;
}

interface LearningPreferenceBase {
  id: string;
  accountId: string;
  /** Le moteur ignore explicitement toute preference seulement inferee. */
  status: "declaree" | "inferee";
  observedAt: string;
}

export type LearningPreference = LearningPreferenceBase & (
  | { kind: "famille"; value: ActivityFamily }
  | { kind: "workspace"; value: ActivityWorkspace }
  | { kind: "mode"; value: WorkModeSettings }
);

export interface SequencingSignal {
  id: string;
  accountId: string;
  kind:
    | "difficulte-comprehension"
    | "revision-due"
    | "consolidation-application"
    | "transfert-integration"
    | "nouveau-contexte";
  target: ActivityTarget;
  observedAt: string;
  sourceRef: string;
}

export interface RecommendationFactor {
  kind:
    | "cible-explicite"
    | "objectif"
    | "classement-competence"
    | "sequencement"
    | "exploration-recente"
    | "temps"
    | "capacite"
    | "preference-declaree"
    | "reprise";
  label: string;
  sourceRef?: string;
}

export interface RecommendedLearningAction {
  candidateId: string;
  source: "activite" | "reprise" | "generation";
  activityId?: string;
  activityVersion?: number;
  runId?: string;
  generationRequestId?: string;
  title: string;
  family: ActivityFamily;
  target: ActivityTarget;
  durationMinutes: number;
  segmented: boolean;
  workspace: ActivityWorkspace;
  proposedMode: WorkModeSettings;
  factors: RecommendationFactor[];
  constraints: string[];
  reservations: string[];
}

/** Resultat derive : il ne doit jamais etre persiste comme profil ou score. */
export interface ActionRecommendation {
  primary: RecommendedLearningAction;
  alternatives: RecommendedLearningAction[];
  factors: RecommendationFactor[];
  constraints: string[];
  reservations: string[];
  policyVersion: string;
}

export interface EvidenceStatusEvent {
  id: string;
  accountId: string;
  evidenceId: string;
  action: "invalider" | "restaurer" | "remplacer";
  replacementEvidenceId?: string;
  reason: string;
  requestId: string;
  createdAt: string;
}

export interface EffectiveEvidenceStatus {
  evidenceId: string;
  active: boolean;
  replacementEvidenceId?: string;
  lastEventId?: string;
}

export interface ProjectProofDecision {
  eligible: boolean;
  quality: QualitePreuve | null;
  reason: string;
}

export class AdaptiveLearningValidationError extends Error {
  constructor(public readonly path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = "AdaptiveLearningValidationError";
  }
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new AdaptiveLearningValidationError(path, "objet attendu");
  }
  return value as Record<string, unknown>;
}

function string(value: unknown, path: string, allowEmpty = false): string {
  if (typeof value !== "string" || (!allowEmpty && value.trim().length === 0)) {
    throw new AdaptiveLearningValidationError(path, "texte non vide attendu");
  }
  return value;
}

function optionalString(value: unknown, path: string): string | undefined {
  return value === undefined ? undefined : string(value, path);
}

function iso(value: unknown, path: string): string {
  const result = string(value, path);
  if (!Number.isFinite(Date.parse(result))) {
    throw new AdaptiveLearningValidationError(path, "date ISO invalide");
  }
  return result;
}

function optionalIso(value: unknown, path: string): string | undefined {
  return value === undefined ? undefined : iso(value, path);
}

function integer(value: unknown, path: string, minimum = 1, maximum?: number): number {
  if (!Number.isInteger(value) || (value as number) < minimum || (maximum !== undefined && (value as number) > maximum)) {
    throw new AdaptiveLearningValidationError(path, `entier entre ${minimum} et ${maximum ?? "l'infini"} attendu`);
  }
  return value as number;
}

function boolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") {
    throw new AdaptiveLearningValidationError(path, "booleen attendu");
  }
  return value;
}

function enumeration<T extends string>(value: unknown, path: string, values: readonly T[]): T {
  if (typeof value !== "string" || !values.includes(value as T)) {
    throw new AdaptiveLearningValidationError(path, `valeur attendue: ${values.join(", ")}`);
  }
  return value as T;
}

function array<T>(value: unknown, path: string, parse: (entry: unknown, entryPath: string) => T): T[] {
  if (!Array.isArray(value)) {
    throw new AdaptiveLearningValidationError(path, "liste attendue");
  }
  return value.map((entry, index) => parse(entry, `${path}[${index}]`));
}

function strings(value: unknown, path: string): string[] {
  return array(value, path, string);
}

function unique(values: string[], path: string): string[] {
  if (new Set(values).size !== values.length) {
    throw new AdaptiveLearningValidationError(path, "doublons interdits");
  }
  return values;
}

function parseTarget(value: unknown, path: string): ActivityTarget {
  const source = record(value, path);
  const target = {
    skillCodes: unique(strings(source.skillCodes, `${path}.skillCodes`), `${path}.skillCodes`),
    themeIds: unique(strings(source.themeIds, `${path}.themeIds`), `${path}.themeIds`),
    goalIds: unique(strings(source.goalIds, `${path}.goalIds`), `${path}.goalIds`),
    label: optionalString(source.label, `${path}.label`),
  };
  if (target.skillCodes.length + target.themeIds.length + target.goalIds.length === 0 && !target.label) {
    throw new AdaptiveLearningValidationError(path, "au moins une cible ou un libelle est requis");
  }
  return target;
}

function parseActionTarget(value: unknown, path: string): ActionTarget {
  const source = record(value, path);
  return {
    kind: enumeration(source.kind, `${path}.kind`, ["skill", "theme", "goal", "activity", "run"] as const),
    ref: string(source.ref, `${path}.ref`),
  };
}

function parseMode(value: unknown, path: string): WorkModeSettings {
  const source = record(value, path);
  return {
    focus: enumeration(source.focus, `${path}.focus`, ["epure", "equilibre", "riche"] as const),
    guidance: enumeration(source.guidance, `${path}.guidance`, ["guide", "equilibre", "autonome"] as const),
    toolPower: enumeration(source.toolPower, `${path}.toolPower`, ["essentiels", "standards", "avances"] as const),
  };
}

export function parseWorkModeSettings(value: unknown): WorkModeSettings {
  return parseMode(value, "WorkModeSettings");
}

function parseResource(value: unknown, path: string): AuthorizedResource {
  const source = record(value, path);
  return {
    id: string(source.id, `${path}.id`),
    kind: enumeration(source.kind, `${path}.kind`, ["document-interne", "lien-externe", "fichier", "tuteur", "documentation"] as const),
    label: string(source.label, `${path}.label`),
    ref: optionalString(source.ref, `${path}.ref`),
    usage: enumeration(source.usage, `${path}.usage`, ["normale", "aide"] as const),
  };
}

function parseEvaluationContract(value: unknown, path: string): EvaluationContract {
  const source = record(value, path);
  const scope = enumeration(source.scope, `${path}.scope`, ["aucune", "soumission-finale", "jalons-et-soumission"] as const);
  const criteria = array(source.criteria, `${path}.criteria`, (entry, entryPath) => {
    const criterion = record(entry, entryPath);
    return {
      id: string(criterion.id, `${entryPath}.id`),
      label: string(criterion.label, `${entryPath}.label`),
      dimension: criterion.dimension === undefined
        ? undefined
        : enumeration(criterion.dimension, `${entryPath}.dimension`, ["comprehension", "application", "transfert", "integration", "justification"] as const),
      required: boolean(criterion.required, `${entryPath}.required`),
    };
  });
  const assessableMilestoneIds = unique(strings(source.assessableMilestoneIds, `${path}.assessableMilestoneIds`), `${path}.assessableMilestoneIds`);
  if (new Set(criteria.map((criterion) => criterion.id)).size !== criteria.length) {
    throw new AdaptiveLearningValidationError(`${path}.criteria`, "identifiants de criteres dupliques");
  }
  if (scope === "aucune" && (criteria.length > 0 || assessableMilestoneIds.length > 0)) {
    throw new AdaptiveLearningValidationError(path, "un contrat sans evaluation ne porte ni critere ni jalon");
  }
  if (scope === "soumission-finale" && assessableMilestoneIds.length > 0) {
    throw new AdaptiveLearningValidationError(path, "les jalons evaluables exigent le scope jalons-et-soumission");
  }
  if (scope !== "aucune" && criteria.length === 0) {
    throw new AdaptiveLearningValidationError(path, "au moins un critere est requis");
  }
  return { scope, criteria, assessableMilestoneIds };
}

function parseMilestoneContent(value: unknown, path: string): ActivityMilestoneContent {
  const source = record(value, path);
  return {
    id: string(source.id, `${path}.id`),
    title: string(source.title, `${path}.title`),
    instruction: string(source.instruction, `${path}.instruction`),
    expectedResult: string(source.expectedResult, `${path}.expectedResult`),
  };
}

function parseWorkspaceContent(value: unknown, path: string): ActivityWorkspaceContent {
  const source = record(value, path);
  const family = enumeration(source.family, `${path}.family`, ["explorer", "produire"] as const);
  const milestones = array(source.milestones, `${path}.milestones`, parseMilestoneContent);
  if (family === "explorer") {
    return {
      family,
      brief: string(source.brief, `${path}.brief`),
      introduction: string(source.introduction, `${path}.introduction`),
      path: array(source.path, `${path}.path`, (entry, itemPath) => {
        const item = record(entry, itemPath);
        return {
          title: string(item.title, `${itemPath}.title`),
          content: string(item.content, `${itemPath}.content`),
          annotationPrompt: string(item.annotationPrompt, `${itemPath}.annotationPrompt`),
        };
      }),
      optionalSynthesis: string(source.optionalSynthesis, `${path}.optionalSynthesis`, true),
      milestones,
    };
  }
  return {
    family,
    brief: string(source.brief, `${path}.brief`),
    start: string(source.start, `${path}.start`),
    artifactSections: array(source.artifactSections, `${path}.artifactSections`, (entry, itemPath) => {
      const item = record(entry, itemPath);
      return {
        section: string(item.section, `${itemPath}.section`),
        instruction: string(item.instruction, `${itemPath}.instruction`),
      };
    }),
    advice: strings(source.advice, `${path}.advice`),
    submissionInstruction: string(source.submissionInstruction, `${path}.submissionInstruction`),
    milestones,
  };
}

export function parseLearningGoal(value: unknown): LearningGoal {
  const source = record(value, "LearningGoal");
  const targetDate = optionalIso(source.targetDate, "LearningGoal.targetDate");
  return {
    id: string(source.id, "LearningGoal.id"),
    accountId: string(source.accountId, "LearningGoal.accountId"),
    title: string(source.title, "LearningGoal.title"),
    description: string(source.description, "LearningGoal.description", true),
    declaredPriority: integer(source.declaredPriority, "LearningGoal.declaredPriority", 1, 5),
    horizon: source.horizon === undefined ? undefined : enumeration(source.horizon, "LearningGoal.horizon", ["court-terme", "moyen-terme", "long-terme"] as const),
    targetDate,
    successCriteria: array(source.successCriteria, "LearningGoal.successCriteria", (entry, path) => {
      const criterion = record(entry, path);
      return { id: string(criterion.id, `${path}.id`), label: string(criterion.label, `${path}.label`), declaredMet: boolean(criterion.declaredMet, `${path}.declaredMet`) };
    }),
    declaredState: enumeration(source.declaredState, "LearningGoal.declaredState", ["brouillon", "actif", "en-pause", "atteint", "abandonne"] as const),
    confirmedSkillCodes: unique(strings(source.confirmedSkillCodes, "LearningGoal.confirmedSkillCodes"), "LearningGoal.confirmedSkillCodes"),
    confirmedThemeIds: unique(strings(source.confirmedThemeIds, "LearningGoal.confirmedThemeIds"), "LearningGoal.confirmedThemeIds"),
    createdAt: iso(source.createdAt, "LearningGoal.createdAt"),
    updatedAt: iso(source.updatedAt, "LearningGoal.updatedAt"),
  };
}

export function parseGoalLinkDiff(value: unknown): GoalLinkDiff {
  const source = record(value, "GoalLinkDiff");
  return {
    goalId: string(source.goalId, "GoalLinkDiff.goalId"),
    proposedSkillCodes: unique(strings(source.proposedSkillCodes, "GoalLinkDiff.proposedSkillCodes"), "GoalLinkDiff.proposedSkillCodes"),
    proposedThemeIds: unique(strings(source.proposedThemeIds, "GoalLinkDiff.proposedThemeIds"), "GoalLinkDiff.proposedThemeIds"),
    removedSkillCodes: unique(strings(source.removedSkillCodes, "GoalLinkDiff.removedSkillCodes"), "GoalLinkDiff.removedSkillCodes"),
    removedThemeIds: unique(strings(source.removedThemeIds, "GoalLinkDiff.removedThemeIds"), "GoalLinkDiff.removedThemeIds"),
    origin: enumeration(source.origin, "GoalLinkDiff.origin", ["tuteur"] as const),
  };
}

export function parseActionContext(value: unknown): ActionContext {
  const source = record(value, "ActionContext");
  return {
    accountId: string(source.accountId, "ActionContext.accountId"),
    availableTimeMinutes: integer(source.availableTimeMinutes, "ActionContext.availableTimeMinutes", 1, 480),
    mentalCapacity: enumeration(source.mentalCapacity, "ActionContext.mentalCapacity", MENTAL_CAPACITIES),
    intent: enumeration(source.intent, "ActionContext.intent", ["systeme", "reprendre", "explorer", "pratiquer", "produire"] as const),
    target: source.target === undefined ? undefined : parseActionTarget(source.target, "ActionContext.target"),
    verbatimNote: optionalString(source.verbatimNote, "ActionContext.verbatimNote"),
    declaredAt: iso(source.declaredAt, "ActionContext.declaredAt"),
  };
}

export function parseActivityTemplate(value: unknown): ActivityTemplate {
  const source = record(value, "ActivityTemplate");
  return {
    id: string(source.id, "ActivityTemplate.id"),
    accountId: string(source.accountId, "ActivityTemplate.accountId"),
    title: string(source.title, "ActivityTemplate.title"),
    description: string(source.description, "ActivityTemplate.description", true),
    workspace: enumeration(source.workspace, "ActivityTemplate.workspace", WORKSPACES),
    families: array(source.families, "ActivityTemplate.families", (entry, path) => enumeration(entry, path, ACTIVITY_FAMILIES)),
    defaultMode: parseMode(source.defaultMode, "ActivityTemplate.defaultMode"),
    enabledTools: array(source.enabledTools, "ActivityTemplate.enabledTools", (entry, path) => enumeration(entry, path, WORKSPACE_TOOLS)),
    version: integer(source.version, "ActivityTemplate.version"),
    origin: enumeration(source.origin, "ActivityTemplate.origin", ["application", "compte"] as const),
    status: enumeration(source.status, "ActivityTemplate.status", ["active", "archivee"] as const),
    createdAt: iso(source.createdAt, "ActivityTemplate.createdAt"),
    updatedAt: iso(source.updatedAt, "ActivityTemplate.updatedAt"),
  };
}

export function parseLearningActivity(value: unknown): LearningActivity {
  const source = record(value, "LearningActivity");
  const activity: LearningActivity = {
    id: string(source.id, "LearningActivity.id"),
    accountId: string(source.accountId, "LearningActivity.accountId"),
    templateId: optionalString(source.templateId, "LearningActivity.templateId"),
    title: string(source.title, "LearningActivity.title"),
    description: string(source.description, "LearningActivity.description", true),
    family: enumeration(source.family, "LearningActivity.family", ACTIVITY_FAMILIES),
    target: parseTarget(source.target, "LearningActivity.target"),
    estimatedDurationMinutes: integer(source.estimatedDurationMinutes, "LearningActivity.estimatedDurationMinutes", 1, 480),
    cognitiveDemand: enumeration(source.cognitiveDemand, "LearningActivity.cognitiveDemand", MENTAL_CAPACITIES),
    proofMode: enumeration(source.proofMode, "LearningActivity.proofMode", ["support-seul", "soumission-finale", "jalons-contractuels"] as const),
    workspace: enumeration(source.workspace, "LearningActivity.workspace", WORKSPACES),
    requiredTools: array(source.requiredTools, "LearningActivity.requiredTools", (entry, path) => enumeration(entry, path, WORKSPACE_TOOLS)),
    authorizedResources: array(source.authorizedResources, "LearningActivity.authorizedResources", parseResource),
    evaluationContract: parseEvaluationContract(source.evaluationContract, "LearningActivity.evaluationContract"),
    workspaceContent: source.workspaceContent === undefined
      ? undefined
      : parseWorkspaceContent(source.workspaceContent, "LearningActivity.workspaceContent"),
    minimumSegmentMinutes: source.minimumSegmentMinutes === undefined ? undefined : integer(source.minimumSegmentMinutes, "LearningActivity.minimumSegmentMinutes", 1, 480),
    version: integer(source.version, "LearningActivity.version"),
    origin: enumeration(source.origin, "LearningActivity.origin", ["application", "tuteur", "utilisateur", "legacy-adapter"] as const),
    status: enumeration(source.status, "LearningActivity.status", ["active", "archivee"] as const),
    archivedAt: optionalIso(source.archivedAt, "LearningActivity.archivedAt"),
    archivedReason: optionalString(source.archivedReason, "LearningActivity.archivedReason"),
    createdAt: iso(source.createdAt, "LearningActivity.createdAt"),
    updatedAt: iso(source.updatedAt, "LearningActivity.updatedAt"),
  };
  if (activity.family === "explorer" && activity.proofMode !== "support-seul") {
    throw new AdaptiveLearningValidationError("LearningActivity.proofMode", "une exploration reste un support sans preuve");
  }
  if ((activity.proofMode === "support-seul") !== (activity.evaluationContract.scope === "aucune")) {
    throw new AdaptiveLearningValidationError("LearningActivity.evaluationContract", "le mode de preuve et le contrat sont incoherents");
  }
  if (activity.proofMode === "soumission-finale" && activity.evaluationContract.scope !== "soumission-finale") {
    throw new AdaptiveLearningValidationError("LearningActivity.evaluationContract", "une preuve finale exige un contrat de soumission finale");
  }
  if (activity.proofMode === "jalons-contractuels" && (activity.evaluationContract.scope !== "jalons-et-soumission" || activity.evaluationContract.assessableMilestoneIds.length === 0)) {
    throw new AdaptiveLearningValidationError("LearningActivity.evaluationContract", "les jalons probants doivent etre enumeres dans leur contrat");
  }
  if (activity.minimumSegmentMinutes !== undefined && activity.minimumSegmentMinutes > activity.estimatedDurationMinutes) {
    throw new AdaptiveLearningValidationError("LearningActivity.minimumSegmentMinutes", "un segment ne peut depasser la duree totale");
  }
  if (activity.status === "archivee" && !activity.archivedAt) {
    throw new AdaptiveLearningValidationError("LearningActivity.archivedAt", "date requise pour une activite archivee");
  }
  if (activity.workspaceContent && activity.workspaceContent.family !== activity.family) {
    throw new AdaptiveLearningValidationError("LearningActivity.workspaceContent", "la famille du contenu doit correspondre à l'activité");
  }
  return activity;
}

function parseArtifact(value: unknown, path: string): ArtifactReference {
  const source = record(value, path);
  const artifact: ArtifactReference = {
    kind: enumeration(source.kind, `${path}.kind`, ["markdown", "structure", "fichier", "lien-externe", "commit"] as const),
    ref: string(source.ref, `${path}.ref`),
    revision: optionalString(source.revision, `${path}.revision`),
    snapshotId: optionalString(source.snapshotId, `${path}.snapshotId`),
    frozenAt: optionalIso(source.frozenAt, `${path}.frozenAt`),
    immutable: boolean(source.immutable, `${path}.immutable`),
  };
  if ((artifact.snapshotId === undefined) !== (artifact.frozenAt === undefined)) {
    throw new AdaptiveLearningValidationError(path, "snapshotId et frozenAt vont ensemble");
  }
  if (artifact.immutable && !artifact.snapshotId && artifact.kind !== "commit") {
    throw new AdaptiveLearningValidationError(path, "un artefact immutable doit etre fige ou etre un commit");
  }
  return artifact;
}

export function parseArtifactReference(value: unknown): ArtifactReference {
  return parseArtifact(value, "ArtifactReference");
}

export function parseActivityRun(value: unknown): ActivityRun {
  const source = record(value, "ActivityRun");
  const run: ActivityRun = {
    id: string(source.id, "ActivityRun.id"),
    accountId: string(source.accountId, "ActivityRun.accountId"),
    activityId: string(source.activityId, "ActivityRun.activityId"),
    activityVersion: integer(source.activityVersion, "ActivityRun.activityVersion"),
    status: enumeration(source.status, "ActivityRun.status", ["planifiee", "en-cours", "en-pause", "terminee", "abandonnee"] as const),
    currentArtifact: source.currentArtifact === undefined ? undefined : parseArtifact(source.currentArtifact, "ActivityRun.currentArtifact"),
    sessionIds: unique(strings(source.sessionIds, "ActivityRun.sessionIds"), "ActivityRun.sessionIds"),
    activeMilestoneId: optionalString(source.activeMilestoneId, "ActivityRun.activeMilestoneId"),
    createdAt: iso(source.createdAt, "ActivityRun.createdAt"),
    startedAt: optionalIso(source.startedAt, "ActivityRun.startedAt"),
    pausedAt: optionalIso(source.pausedAt, "ActivityRun.pausedAt"),
    completedAt: optionalIso(source.completedAt, "ActivityRun.completedAt"),
    abandonedAt: optionalIso(source.abandonedAt, "ActivityRun.abandonedAt"),
  };
  if ((run.status === "en-cours" || run.status === "en-pause" || run.status === "terminee") && !run.startedAt) {
    throw new AdaptiveLearningValidationError("ActivityRun.startedAt", "date requise apres le demarrage");
  }
  if (run.status === "en-pause" && !run.pausedAt) {
    throw new AdaptiveLearningValidationError("ActivityRun.pausedAt", "date requise pour une execution en pause");
  }
  if (run.status === "terminee" && !run.completedAt) {
    throw new AdaptiveLearningValidationError("ActivityRun.completedAt", "date requise pour une execution terminee");
  }
  if (run.status === "abandonnee" && !run.abandonedAt) {
    throw new AdaptiveLearningValidationError("ActivityRun.abandonedAt", "date requise pour une execution abandonnee");
  }
  return run;
}

export function parseActivityEvent(value: unknown): ActivityEvent {
  const source = record(value, "ActivityEvent");
  const base: ActivityEventBase = {
    id: string(source.id, "ActivityEvent.id"),
    accountId: string(source.accountId, "ActivityEvent.accountId"),
    runId: string(source.runId, "ActivityEvent.runId"),
    sessionId: optionalString(source.sessionId, "ActivityEvent.sessionId"),
    requestId: string(source.requestId, "ActivityEvent.requestId"),
    createdAt: iso(source.createdAt, "ActivityEvent.createdAt"),
  };
  const type = enumeration(source.type, "ActivityEvent.type", ["demarrage", "pause", "reprise", "jalon", "aide", "changement-mode", "cloture", "abandon"] as const);
  if (type === "demarrage") return { ...base, type, mode: parseMode(source.mode, "ActivityEvent.mode") };
  if (type === "pause") return { ...base, type, reason: optionalString(source.reason, "ActivityEvent.reason") };
  if (type === "reprise") return { ...base, type };
  if (type === "jalon") return { ...base, type, milestoneId: string(source.milestoneId, "ActivityEvent.milestoneId"), state: enumeration(source.state, "ActivityEvent.state", ["atteint", "soumis"] as const) };
  if (type === "aide") return {
    ...base,
    type,
    helpKind: enumeration(source.helpKind, "ActivityEvent.helpKind", ["indice", "tuteur", "ressource", "correction", "autre"] as const),
    resourceId: optionalString(source.resourceId, "ActivityEvent.resourceId"),
    allowedByContract: boolean(source.allowedByContract, "ActivityEvent.allowedByContract"),
    detail: optionalString(source.detail, "ActivityEvent.detail"),
  };
  if (type === "changement-mode") return { ...base, type, previous: parseMode(source.previous, "ActivityEvent.previous"), next: parseMode(source.next, "ActivityEvent.next") };
  if (type === "cloture") return { ...base, type, assessmentId: optionalString(source.assessmentId, "ActivityEvent.assessmentId"), artifactSnapshotId: optionalString(source.artifactSnapshotId, "ActivityEvent.artifactSnapshotId") };
  return { ...base, type, reason: optionalString(source.reason, "ActivityEvent.reason") };
}

export function parseActivityAssessment(value: unknown): ActivityAssessment {
  const source = record(value, "ActivityAssessment");
  const scopeSource = record(source.scope, "ActivityAssessment.scope");
  const scopeKind = enumeration(scopeSource.kind, "ActivityAssessment.scope.kind", ["soumission-finale", "jalon"] as const);
  const kind = enumeration(source.kind, "ActivityAssessment.kind", ["proposition-tuteur", "validation-humaine"] as const);
  const base: ActivityAssessmentBase = {
    id: string(source.id, "ActivityAssessment.id"),
    accountId: string(source.accountId, "ActivityAssessment.accountId"),
    runId: string(source.runId, "ActivityAssessment.runId"),
    activityId: string(source.activityId, "ActivityAssessment.activityId"),
    activityVersion: integer(source.activityVersion, "ActivityAssessment.activityVersion"),
    scope: scopeKind === "jalon"
      ? { kind: scopeKind, milestoneId: string(scopeSource.milestoneId, "ActivityAssessment.scope.milestoneId") }
      : { kind: scopeKind },
    criteria: array(source.criteria, "ActivityAssessment.criteria", (entry, path) => {
      const criterion = record(entry, path);
      return {
        criterionId: string(criterion.criterionId, `${path}.criterionId`),
        demonstration: enumeration(criterion.demonstration, `${path}.demonstration`, ["non-observee", "insuffisante", "partielle", "pleine"] as const),
        note: optionalString(criterion.note, `${path}.note`),
      };
    }),
    artifactSnapshotId: optionalString(source.artifactSnapshotId, "ActivityAssessment.artifactSnapshotId"),
    requestId: string(source.requestId, "ActivityAssessment.requestId"),
    createdAt: iso(source.createdAt, "ActivityAssessment.createdAt"),
  };
  if (new Set(base.criteria.map((criterion) => criterion.criterionId)).size !== base.criteria.length) {
    throw new AdaptiveLearningValidationError("ActivityAssessment.criteria", "un critere ne peut etre valide deux fois");
  }
  if (kind === "proposition-tuteur") {
    if (source.proposedAssessmentId !== undefined || source.result !== undefined || source.autonomy !== undefined) {
      throw new AdaptiveLearningValidationError("ActivityAssessment", "une proposition du tuteur ne porte ni résultat, ni autonomie, ni proposition source");
    }
    return { ...base, kind };
  }
  return {
    ...base,
    kind,
    proposedAssessmentId: optionalString(source.proposedAssessmentId, "ActivityAssessment.proposedAssessmentId"),
    result: enumeration(source.result, "ActivityAssessment.result", ["reussi", "partiel", "echec"] as const),
    autonomy: enumeration(source.autonomy, "ActivityAssessment.autonomy", ["A0", "A1", "A2", "A3", "A4"] as const),
  };
}

export function parseActivityGenerationRequest(value: unknown): ActivityGenerationRequest {
  const source = record(value, "ActivityGenerationRequest");
  const request: ActivityGenerationRequest = {
    id: string(source.id, "ActivityGenerationRequest.id"),
    accountId: string(source.accountId, "ActivityGenerationRequest.accountId"),
    family: enumeration(source.family, "ActivityGenerationRequest.family", ACTIVITY_FAMILIES),
    target: parseTarget(source.target, "ActivityGenerationRequest.target"),
    title: string(source.title, "ActivityGenerationRequest.title"),
    constraints: strings(source.constraints, "ActivityGenerationRequest.constraints"),
    estimatedDurationMinutes: integer(source.estimatedDurationMinutes, "ActivityGenerationRequest.estimatedDurationMinutes", 1, 480),
    minimumSegmentMinutes: source.minimumSegmentMinutes === undefined ? undefined : integer(source.minimumSegmentMinutes, "ActivityGenerationRequest.minimumSegmentMinutes", 1, 480),
    cognitiveDemand: enumeration(source.cognitiveDemand, "ActivityGenerationRequest.cognitiveDemand", MENTAL_CAPACITIES),
    proofMode: enumeration(source.proofMode, "ActivityGenerationRequest.proofMode", ["support-seul", "soumission-finale", "jalons-contractuels"] as const),
    workspace: enumeration(source.workspace, "ActivityGenerationRequest.workspace", WORKSPACES),
    requiredTools: array(source.requiredTools, "ActivityGenerationRequest.requiredTools", (entry, path) => enumeration(entry, path, WORKSPACE_TOOLS)),
    authorizedResources: array(source.authorizedResources, "ActivityGenerationRequest.authorizedResources", parseResource),
    evaluationContract: parseEvaluationContract(source.evaluationContract, "ActivityGenerationRequest.evaluationContract"),
  };
  if (request.family === "explorer" && request.proofMode !== "support-seul") {
    throw new AdaptiveLearningValidationError("ActivityGenerationRequest.proofMode", "une exploration reste un support sans preuve");
  }
  if ((request.proofMode === "support-seul") !== (request.evaluationContract.scope === "aucune")) {
    throw new AdaptiveLearningValidationError("ActivityGenerationRequest.evaluationContract", "le mode de preuve et le contrat sont incoherents");
  }
  if (request.proofMode === "soumission-finale" && request.evaluationContract.scope !== "soumission-finale") {
    throw new AdaptiveLearningValidationError("ActivityGenerationRequest.evaluationContract", "une preuve finale exige un contrat de soumission finale");
  }
  if (request.proofMode === "jalons-contractuels" && (request.evaluationContract.scope !== "jalons-et-soumission" || request.evaluationContract.assessableMilestoneIds.length === 0)) {
    throw new AdaptiveLearningValidationError("ActivityGenerationRequest.evaluationContract", "les jalons probants doivent etre enumeres dans leur contrat");
  }
  if (request.minimumSegmentMinutes !== undefined && request.minimumSegmentMinutes > request.estimatedDurationMinutes) {
    throw new AdaptiveLearningValidationError("ActivityGenerationRequest.minimumSegmentMinutes", "un segment ne peut depasser la duree totale");
  }
  return request;
}

export function parseLearningPreference(value: unknown): LearningPreference {
  const source = record(value, "LearningPreference");
  const base: LearningPreferenceBase = {
    id: string(source.id, "LearningPreference.id"),
    accountId: string(source.accountId, "LearningPreference.accountId"),
    status: enumeration(source.status, "LearningPreference.status", ["declaree", "inferee"] as const),
    observedAt: iso(source.observedAt, "LearningPreference.observedAt"),
  };
  const kind = enumeration(source.kind, "LearningPreference.kind", ["famille", "workspace", "mode"] as const);
  if (kind === "famille") return { ...base, kind, value: enumeration(source.value, "LearningPreference.value", ACTIVITY_FAMILIES) };
  if (kind === "workspace") return { ...base, kind, value: enumeration(source.value, "LearningPreference.value", WORKSPACES) };
  return { ...base, kind, value: parseMode(source.value, "LearningPreference.value") };
}

export function parseSequencingSignal(value: unknown): SequencingSignal {
  const source = record(value, "SequencingSignal");
  return {
    id: string(source.id, "SequencingSignal.id"),
    accountId: string(source.accountId, "SequencingSignal.accountId"),
    kind: enumeration(source.kind, "SequencingSignal.kind", ["difficulte-comprehension", "revision-due", "consolidation-application", "transfert-integration", "nouveau-contexte"] as const),
    target: parseTarget(source.target, "SequencingSignal.target"),
    observedAt: iso(source.observedAt, "SequencingSignal.observedAt"),
    sourceRef: string(source.sourceRef, "SequencingSignal.sourceRef"),
  };
}

export function parseEvidenceStatusEvent(value: unknown): EvidenceStatusEvent {
  const source = record(value, "EvidenceStatusEvent");
  const event: EvidenceStatusEvent = {
    id: string(source.id, "EvidenceStatusEvent.id"),
    accountId: string(source.accountId, "EvidenceStatusEvent.accountId"),
    evidenceId: string(source.evidenceId, "EvidenceStatusEvent.evidenceId"),
    action: enumeration(source.action, "EvidenceStatusEvent.action", ["invalider", "restaurer", "remplacer"] as const),
    replacementEvidenceId: optionalString(source.replacementEvidenceId, "EvidenceStatusEvent.replacementEvidenceId"),
    reason: string(source.reason, "EvidenceStatusEvent.reason"),
    requestId: string(source.requestId, "EvidenceStatusEvent.requestId"),
    createdAt: iso(source.createdAt, "EvidenceStatusEvent.createdAt"),
  };
  if ((event.action === "remplacer") !== (event.replacementEvidenceId !== undefined)) {
    throw new AdaptiveLearningValidationError("EvidenceStatusEvent.replacementEvidenceId", "requis uniquement pour un remplacement");
  }
  if (event.replacementEvidenceId === event.evidenceId) {
    throw new AdaptiveLearningValidationError("EvidenceStatusEvent.replacementEvidenceId", "une preuve ne peut pas se remplacer elle-meme");
  }
  return event;
}

export function resolveEvidenceStatus(
  evidenceId: string,
  events: readonly EvidenceStatusEvent[],
): EffectiveEvidenceStatus {
  const ordered = events
    .filter((event) => event.evidenceId === evidenceId)
    .slice()
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
  let status: EffectiveEvidenceStatus = { evidenceId, active: true };
  for (const event of ordered) {
    if (event.action === "restaurer") status = { evidenceId, active: true, lastEventId: event.id };
    if (event.action === "invalider") status = { evidenceId, active: false, lastEventId: event.id };
    if (event.action === "remplacer") status = { evidenceId, active: false, replacementEvidenceId: event.replacementEvidenceId, lastEventId: event.id };
  }
  return status;
}

/**
 * Regime de preuve d'un mini-projet. Le moteur ne produit pas la preuve : il
 * decide seulement si une validation humaine et son snapshot la rendent
 * admissible, puis en derive la qualite prevue par le contrat.
 */
export function decideProjectProofQuality(
  activity: LearningActivity,
  assessment: ActivityAssessment,
  artifact: ArtifactReference | undefined,
): ProjectProofDecision {
  if (activity.family !== "produire") return { eligible: false, quality: null, reason: "L'activite n'est pas une production." };
  if (activity.proofMode === "support-seul") return { eligible: false, quality: null, reason: "Le contrat classe ce travail comme support." };
  if (assessment.kind !== "validation-humaine") return { eligible: false, quality: null, reason: "La proposition du tuteur n'est pas une mesure." };
  if (assessment.accountId !== activity.accountId) return { eligible: false, quality: null, reason: "L'evaluation appartient a un autre compte." };
  if (assessment.activityId !== activity.id || assessment.activityVersion !== activity.version) return { eligible: false, quality: null, reason: "L'evaluation ne vise pas la version exacte de l'activite." };
  if (assessment.scope.kind === "jalon" && (activity.evaluationContract.scope !== "jalons-et-soumission" || !activity.evaluationContract.assessableMilestoneIds.includes(assessment.scope.milestoneId))) {
    return { eligible: false, quality: null, reason: "Ce jalon n'a pas de contrat d'evaluation propre." };
  }
  if (!artifact?.snapshotId || !artifact.frozenAt || !artifact.immutable || assessment.artifactSnapshotId !== artifact.snapshotId) {
    return { eligible: false, quality: null, reason: "L'artefact n'est pas fige dans un snapshot verifiable." };
  }
  const assessedIds = new Set(assessment.criteria.map((criterion) => criterion.criterionId));
  const contractIds = new Set(activity.evaluationContract.criteria.map((criterion) => criterion.id));
  if (assessment.criteria.some((criterion) => !contractIds.has(criterion.criterionId))) {
    return { eligible: false, quality: null, reason: "L'evaluation contient un critere absent du contrat." };
  }
  if (activity.evaluationContract.criteria.some((criterion) => criterion.required && !assessedIds.has(criterion.id))) {
    return { eligible: false, quality: null, reason: "Un critere requis n'a pas ete valide." };
  }
  if (assessment.criteria.every((criterion) => criterion.demonstration === "non-observee")) {
    return { eligible: false, quality: null, reason: "Aucun critere n'a ete observe." };
  }
  if (assessment.autonomy === "A0" || assessment.autonomy === "A1") {
    return { eligible: true, quality: "faible", reason: "Le travail est probant, avec une autonomie A0/A1." };
  }
  const criterionById = new Map(activity.evaluationContract.criteria.map((criterion) => [criterion.id, criterion]));
  const transferFullyDemonstrated = assessment.criteria.some((result) => {
    const criterion = criterionById.get(result.criterionId);
    return result.demonstration === "pleine" && (criterion?.dimension === "transfert" || criterion?.dimension === "integration");
  });
  if (assessment.result === "reussi" && transferFullyDemonstrated && (assessment.autonomy === "A3" || assessment.autonomy === "A4")) {
    return { eligible: true, quality: "forte", reason: "Snapshot, reussite, transfert/integration et autonomie forte sont reunis." };
  }
  return { eligible: true, quality: "moyenne", reason: "Le travail est probant sans reunir toutes les conditions d'une preuve forte." };
}
