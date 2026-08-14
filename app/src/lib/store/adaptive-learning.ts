import "server-only";

import { cache } from "react";
import type { Contexte } from "./context";
import { dorsaleCompte } from "./db";
import { versChamp, verifier } from "./supabase-backend";
import {
  parseActivityEvent,
  parseActivityRun,
  parseLearningActivity,
  parseLearningGoal,
  parseEvidenceStatusEvent,
  resolveEvidenceStatus,
  type ActionContext,
  type ActivityEvent,
  type ActivityGenerationRequest,
  type ActivityRun,
  type LearningActivity,
  type LearningGoal,
  type LearningPreference,
  type EvidenceStatusEvent,
} from "@/lib/domain/adaptive-learning";
import type { SkillEvidence } from "@/lib/domain/types";
import {
  choisirActionUnifiee,
  type ActionUnifiee,
  type ContexteInstant,
} from "@/lib/engine/action-unifiee";

const OUTILS_DISPONIBLES = [
  "annotations", "ressources", "indices", "tuteur", "editeur-markdown",
  "fichiers", "liens", "calculatrice",
] as const;

interface AdaptiveRows {
  goals: LearningGoal[];
  activities: LearningActivity[];
  runs: ActivityRun[];
  events: ActivityEvent[];
}

const CONFIRMED_FAMILY_PREFERENCES = {
  "adaptive:family:explorer": "explorer",
  "adaptive:family:entrainer": "entrainer",
  "adaptive:family:produire": "produire",
} as const;

function confirmedPreferences(ctx: Contexte, observedAt: string): LearningPreference[] {
  return (ctx.donnees.user.preferencesPedagogiques ?? []).flatMap((entry, index) => {
    const value = CONFIRMED_FAMILY_PREFERENCES[entry as keyof typeof CONFIRMED_FAMILY_PREFERENCES];
    return value ? [{
      id: `declared-family:${index}:${value}`,
      accountId: ctx.donnees.user.id,
      status: "declaree" as const,
      observedAt,
      kind: "famille" as const,
      value,
    }] : [];
  });
}

export interface AdaptiveWorkspaceState {
  activity: LearningActivity;
  run: ActivityRun;
  artifact: { content: Record<string, unknown>; version: number } | null;
  events: ActivityEvent[];
}

export interface AdaptiveOpenRun {
  run: ActivityRun;
  activity: LearningActivity;
}

function adaptiveEntity(
  row: Record<string, unknown>,
  accountId: string,
): Record<string, unknown> {
  const result: Record<string, unknown> = { accountId };
  for (const [column, value] of Object.entries(row)) {
    if (column === "user_id" || value === null) continue;
    result[versChamp(column)] = value;
  }
  return result;
}

const loadAdaptiveRows = cache(async (accountId: string): Promise<AdaptiveRows> => {
  const { supabase, userId } = await dorsaleCompte();
  if (userId !== accountId) throw new Error("Compte adaptatif incohérent.");
  const [goals, activitiesResult, runsResult, linksResult, eventsResult] =
    await Promise.all([
      loadAdaptiveGoals(accountId),
      supabase.from("learning_activities").select("*").eq("user_id", userId),
      supabase.from("activity_runs").select("*").eq("user_id", userId),
      supabase.from("activity_run_sessions").select("run_id,session_id").eq("user_id", userId),
      supabase.from("activity_events").select("*").eq("user_id", userId).order("created_at", { ascending: true }),
    ]);
  verifier("lecture des activités adaptatives", activitiesResult.error);
  verifier("lecture des exécutions adaptatives", runsResult.error);
  verifier("lecture des séances d'activité", linksResult.error);
  verifier("lecture des événements d'activité", eventsResult.error);

  const sessionsByRun = new Map<string, string[]>();
  for (const row of (linksResult.data ?? []) as Record<string, unknown>[]) {
    const runId = String(row.run_id);
    sessionsByRun.set(runId, [...(sessionsByRun.get(runId) ?? []), String(row.session_id)]);
  }

  const activities = ((activitiesResult.data ?? []) as Record<string, unknown>[]).map((row) =>
    parseLearningActivity(adaptiveEntity(row, userId)),
  );
  const runs = ((runsResult.data ?? []) as Record<string, unknown>[]).map((row) =>
    parseActivityRun({
      ...adaptiveEntity(row, userId),
      sessionIds: sessionsByRun.get(String(row.id)) ?? [],
    }),
  );
  const events = ((eventsResult.data ?? []) as Record<string, unknown>[]).map((row) => {
    const entity = adaptiveEntity(row, userId);
    const payload = row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
      ? row.payload as Record<string, unknown>
      : {};
    return parseActivityEvent({ ...entity, ...payload });
  });
  return { goals, activities, runs, events };
});

export const loadAdaptiveGoals = cache(async (accountId: string): Promise<LearningGoal[]> => {
  const { supabase, userId } = await dorsaleCompte();
  if (userId !== accountId) throw new Error("Compte adaptatif incohérent.");
  const [goalsResult, targetsResult] = await Promise.all([
    supabase.from("learning_goals").select("*").eq("user_id", userId),
    supabase.from("learning_goal_targets").select("goal_id,target_kind,target_ref").eq("user_id", userId),
  ]);
  verifier("lecture des objectifs adaptatifs", goalsResult.error);
  verifier("lecture des cibles d'objectifs", targetsResult.error);
  const targetsByGoal = new Map<string, { skills: string[]; themes: string[] }>();
  for (const row of (targetsResult.data ?? []) as Record<string, unknown>[]) {
    const goalId = String(row.goal_id);
    const current = targetsByGoal.get(goalId) ?? { skills: [], themes: [] };
    if (row.target_kind === "skill") current.skills.push(String(row.target_ref));
    if (row.target_kind === "theme") current.themes.push(String(row.target_ref));
    targetsByGoal.set(goalId, current);
  }
  return ((goalsResult.data ?? []) as Record<string, unknown>[]).map((row) => {
    const targets = targetsByGoal.get(String(row.id)) ?? { skills: [], themes: [] };
    return parseLearningGoal({
      ...adaptiveEntity(row, userId),
      confirmedSkillCodes: targets.skills,
      confirmedThemeIds: targets.themes,
    });
  });
});

export const loadAdaptiveOpenRuns = cache(async (accountId: string): Promise<AdaptiveOpenRun[]> => {
  const rows = await loadAdaptiveRows(accountId);
  const activities = new Map(rows.activities.map((activity) => [`${activity.id}:${activity.version}`, activity]));
  return rows.runs
    .filter((run) => run.status === "planifiee" || run.status === "en-cours" || run.status === "en-pause")
    .flatMap((run) => {
      const activity = activities.get(`${run.activityId}:${run.activityVersion}`);
      return activity ? [{ run, activity }] : [];
    });
});

function rankedStates(ctx: Contexte) {
  const byCode = new Map(ctx.etats.map((state) => [state.skill.code, state]));
  const ordered = ctx.recommandations.flatMap((recommendation) => {
    const code = recommendation.etat.skill.code;
    const state = byCode.get(code);
    if (!state) return [];
    byCode.delete(code);
    return [state];
  });
  return [...ordered, ...byCode.values()];
}

function generationRequests(
  ctx: Contexte,
  context: ActionContext,
  goals: readonly LearningGoal[],
): ActivityGenerationRequest[] {
  const explicitSkill = context.target?.kind === "skill" ? context.target.ref : undefined;
  const activeGoal = goals
    .filter((goal) => goal.declaredState === "actif")
    .sort((left, right) => {
      const priority = right.declaredPriority - left.declaredPriority;
      if (priority !== 0) return priority;
      if (left.targetDate && right.targetDate) return left.targetDate.localeCompare(right.targetDate);
      if (left.targetDate) return -1;
      if (right.targetDate) return 1;
      return left.id.localeCompare(right.id);
    })[0];
  const skillCode = explicitSkill
    ?? activeGoal?.confirmedSkillCodes[0]
    ?? rankedStates(ctx)[0]?.skill.code;
  if (!skillCode) return [];
  const target = {
    skillCodes: [skillCode],
    themeIds: activeGoal?.confirmedThemeIds ?? [],
    goalIds: activeGoal ? [activeGoal.id] : [],
  };
  return [
    {
      id: `generate:explorer:${skillCode}`,
      accountId: context.accountId,
      family: "explorer",
      target,
      title: `Explorer ${skillCode}`,
      constraints: ["Parcours guidé, contenu fermé avant acceptation."],
      estimatedDurationMinutes: Math.min(context.availableTimeMinutes, 20),
      cognitiveDemand: "faible",
      proofMode: "support-seul",
      workspace: "exploration-guidee",
      requiredTools: ["annotations", "ressources"],
      authorizedResources: [],
      evaluationContract: { scope: "aucune", criteria: [], assessableMilestoneIds: [] },
    },
    {
      id: `generate:produire:${skillCode}`,
      accountId: context.accountId,
      family: "produire",
      target,
      title: `Produire avec ${skillCode}`,
      constraints: ["Mini-projet reprenable avec critères visibles avant le travail."],
      estimatedDurationMinutes: Math.max(30, context.availableTimeMinutes),
      minimumSegmentMinutes: Math.min(context.availableTimeMinutes, 20),
      cognitiveDemand: "standard",
      proofMode: "soumission-finale",
      workspace: "mini-projet",
      requiredTools: ["editeur-markdown", "ressources"],
      authorizedResources: [],
      evaluationContract: {
        scope: "soumission-finale",
        criteria: [{ id: "transfert", label: "Transférer la compétence dans un contexte nouveau", dimension: "transfert", required: true }],
        assessableMilestoneIds: [],
      },
    },
  ];
}

/**
 * Les contrats de génération ouverts pour cet instant.
 *
 * Reconstruits, jamais stockés : leur identifiant est déterministe
 * (`generate:<famille>:<code>`), seules la durée et la taille de segment
 * dépendent du temps déclaré. C'est ce qui permet de les résoudre à nouveau
 * quand l'écran de relecture s'ouvre, sans avoir persisté quoi que ce soit.
 */
export async function chargerDemandesGeneration(
  ctx: Contexte,
  instant: ContexteInstant,
): Promise<ActivityGenerationRequest[]> {
  if (ctx.donnees.user.learningLoopMode !== "adaptive-v1") return [];
  const goals = await loadAdaptiveGoals(ctx.donnees.user.id);
  return generationRequests(ctx, {
    accountId: ctx.donnees.user.id,
    availableTimeMinutes: instant.tempsMin,
    mentalCapacity: instant.capacite,
    intent: "systeme",
    declaredAt: ctx.now.toISOString(),
  }, goals);
}

/**
 * L'action à proposer maintenant, pour la carte du tableau de bord.
 *
 * En mode `legacy` — c'est-à-dire en production aujourd'hui — **aucune table
 * adaptative n'est interrogée** : l'arbitrage porte sur les exercices et les
 * tentatives existants, exposés par `adaptLegacyActivities`. Le contexte
 * d'instant vient de l'URL, n'est pas persisté, et ne devient jamais un trait
 * de profil.
 */
export async function chargerActionProposee(
  ctx: Contexte,
  instant: ContexteInstant,
): Promise<ActionUnifiee | null> {
  const declaredAt = ctx.now.toISOString();
  // Un exercice écarté (R1) ne doit pas réapparaître par la porte de
  // l'arbitrage : le moteur d'action voit tout le corpus, là où le classement
  // ne voit que la file déjà filtrée.
  const activitesLegacy = ctx.adaptiveLegacy.activities.filter((activity) =>
    !ctx.refus.exercices.has(activity.id.replace(/^legacy-exercise:/, ""))
    && !activity.target.skillCodes.some((code) => ctx.refus.codes.has(code)),
  );
  const commun = {
    accountId: ctx.donnees.user.id,
    instant,
    declaredAt,
    recommandations: ctx.recommandations,
    rankedSkillStates: rankedStates(ctx),
    availableTools: OUTILS_DISPONIBLES,
  };

  if (ctx.donnees.user.learningLoopMode !== "adaptive-v1") {
    return choisirActionUnifiee({
      ...commun,
      activities: activitesLegacy,
      openRuns: ctx.adaptiveLegacy.openRuns,
      preferences: confirmedPreferences(ctx, declaredAt),
    });
  }

  const stored = await loadAdaptiveRows(ctx.donnees.user.id);
  const context: ActionContext = {
    accountId: ctx.donnees.user.id,
    availableTimeMinutes: instant.tempsMin,
    mentalCapacity: instant.capacite,
    intent: "systeme",
    declaredAt,
  };
  return choisirActionUnifiee({
    ...commun,
    activities: [...activitesLegacy, ...stored.activities],
    openRuns: [
      ...ctx.adaptiveLegacy.openRuns,
      ...stored.runs.filter((run) => run.status === "en-cours" || run.status === "en-pause"),
    ],
    historicalRuns: stored.runs.filter((run) => run.status === "terminee" || run.status === "abandonnee"),
    generationRequests: generationRequests(ctx, context, stored.goals),
    goals: stored.goals,
    events: stored.events,
    preferences: confirmedPreferences(ctx, declaredAt),
  });
}

export const loadAdaptiveWorkspace = cache(async (
  runId: string,
): Promise<AdaptiveWorkspaceState | null> => {
  const { supabase, userId } = await dorsaleCompte();
  const [runResult, linksResult, artifactResult, eventsResult] = await Promise.all([
    supabase.from("activity_runs").select("*").eq("user_id", userId).eq("id", runId).maybeSingle(),
    supabase.from("activity_run_sessions").select("session_id").eq("user_id", userId).eq("run_id", runId),
    supabase.from("activity_artifacts").select("content,version").eq("user_id", userId).eq("run_id", runId).maybeSingle(),
    supabase.from("activity_events").select("*").eq("user_id", userId).eq("run_id", runId).order("created_at", { ascending: true }),
  ]);
  verifier("lecture de l'exécution adaptative", runResult.error);
  verifier("lecture des séances de l'exécution", linksResult.error);
  verifier("lecture de l'artefact courant", artifactResult.error);
  verifier("lecture des événements de l'exécution", eventsResult.error);
  if (!runResult.data) return null;
  const run = parseActivityRun({
    ...adaptiveEntity(runResult.data as Record<string, unknown>, userId),
    sessionIds: ((linksResult.data ?? []) as Array<{ session_id: string }>).map((row) => row.session_id),
  });
  const { data: activityData, error: activityError } = await supabase
    .from("learning_activities")
    .select("*")
    .eq("user_id", userId)
    .eq("id", run.activityId)
    .eq("version", run.activityVersion)
    .maybeSingle();
  verifier("lecture de la version d'activité", activityError);
  if (!activityData) throw new Error("Version d'activité introuvable.");
  const activity = parseLearningActivity(adaptiveEntity(activityData as Record<string, unknown>, userId));
  const rawArtifact = artifactResult.data as { content?: unknown; version?: unknown } | null;
  const content = rawArtifact?.content;
  const artifact = content && typeof content === "object" && !Array.isArray(content)
    && Number.isInteger(rawArtifact?.version)
    ? { content: content as Record<string, unknown>, version: Number(rawArtifact?.version) }
    : null;
  const events = ((eventsResult.data ?? []) as Record<string, unknown>[]).map((row) => {
    const payload = row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
      ? row.payload as Record<string, unknown>
      : {};
    return parseActivityEvent({ ...adaptiveEntity(row, userId), ...payload });
  });
  return { activity, run, artifact, events };
});

export async function loadEffectiveEvidence(
  evidence: readonly SkillEvidence[],
): Promise<{ effective: SkillEvidence[]; statusEvents: EvidenceStatusEvent[] }> {
  const { supabase, userId } = await dorsaleCompte();
  const { data, error } = await supabase
    .from("evidence_status_events")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  verifier("lecture des rectifications de preuve", error);
  const statusEvents = ((data ?? []) as Record<string, unknown>[]).map((row) =>
    parseEvidenceStatusEvent(adaptiveEntity(row, userId)),
  );
  return {
    effective: evidence.filter((item) => resolveEvidenceStatus(item.id, statusEvents).active),
    statusEvents,
  };
}
