import type { Dimension } from "./types";

export const ACTIVITY_FAMILIES = ["explorer", "entrainer", "produire"] as const;
export type ActivityFamily = (typeof ACTIVITY_FAMILIES)[number];

/**
 * Préfixe d'identifiant d'une note opérationnelle exposée comme activité.
 *
 * Il vit dans le contrat partagé, et non dans l'adaptateur, parce que les deux
 * bouts en ont besoin : l'adaptateur pour le poser, le moteur d'arbitrage pour
 * reconnaître la nature du candidat qu'il a retenu. Or ce module ne dépend de
 * rien d'autre que des types du domaine — le moteur peut donc le lire sans
 * tirer derrière lui la couche documentaire, à laquelle il n'a rien à savoir.
 */
export const PREFIXE_ACTIVITE_NOTE = "note:";
export const PREFIXE_ACTIVITE_RESSOURCE = "ressource:";
export const PREFIXE_ACTIVITE_EXERCICE = "legacy-exercise:";

export function idActiviteNote(documentId: string): string {
  return `${PREFIXE_ACTIVITE_NOTE}${documentId}`;
}

export function idActiviteRessource(documentId: string): string {
  return `${PREFIXE_ACTIVITE_RESSOURCE}${documentId}`;
}

export function idActiviteExercice(exerciceId: string): string {
  return `${PREFIXE_ACTIVITE_EXERCICE}${exerciceId}`;
}

export function estActiviteExercice(activityId: string): boolean {
  return activityId.startsWith(PREFIXE_ACTIVITE_EXERCICE);
}

/** Rend l'identifiant d'exercice nu, ou `null` si l'activité n'est pas un exercice. */
export function idExerciceDepuisActivite(activityId: string): string | null {
  return activityId.startsWith(PREFIXE_ACTIVITE_EXERCICE)
    ? activityId.slice(PREFIXE_ACTIVITE_EXERCICE.length)
    : null;
}

/** Rend l'identifiant de la fiche, ou `null` si le candidat n'est pas documentaire. */
export function idDocumentDepuisActivite(activityId: string): string | null {
  if (activityId.startsWith(PREFIXE_ACTIVITE_NOTE)) {
    return activityId.slice(PREFIXE_ACTIVITE_NOTE.length);
  }
  if (activityId.startsWith(PREFIXE_ACTIVITE_RESSOURCE)) {
    return activityId.slice(PREFIXE_ACTIVITE_RESSOURCE.length);
  }
  return null;
}

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
  goalIds: string[];
  /** Libelle explicite pour un sujet qui n'a pas encore de lien confirme. */
  label?: string;
}

export type ActionTarget =
  | { kind: "skill"; ref: string }
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
  createdAt: string;
  updatedAt: string;
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
  /**
   * Compétence que ce critère démontre, prise dans la cible de l'activité.
   *
   * C'est ce lien qui rend une observation attribuable. Un projet mobilisant cinq
   * compétences ne les démontre pas toutes du seul fait d'avoir été rendu :
   * sans critère porteur, une compétence ne reçoit rien. Le champ reste
   * facultatif car un contrat peut porter des critères de qualité générale,
   * qui n'appartiennent à aucune compétence en particulier.
   */
  skillCode?: string;
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
  /*
   * Aucune séance ici.
   *
   * Un projet n'est pas une séance : il se travaille par reprises, sur
   * plusieurs jours, sans conteneur d'épisode. Son déroulé est la suite de ses
   * `ActivityEvent` — démarrage, pause, reprise — et sa durée s'en dérive.
   * Rattacher une exécution à une séance ferait porter au projet le rythme
   * d'un autre geste de travail.
   */
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
    | "ressource-documentaire"
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
