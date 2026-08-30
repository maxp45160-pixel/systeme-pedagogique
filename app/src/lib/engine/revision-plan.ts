/**
 * Diff pur d'un plan recalculé contre les séances acceptées.
 *
 * Ce module appartient à Décide : il ne lit aucune donnée, ne prend pas
 * l'heure courante et ne persiste jamais le plan. Une séance acceptée est
 * identifiée par l'origine compacte écrite lors de son acceptation. Les
 * candidates non explicitement acceptées sont volontairement silencieuses.
 */

import type { LearningSession } from "@/lib/domain/types";
import type { PlanPropose, CreneauPropose } from "./planification-temporelle";

export type PlanChangeKind =
  | "conserver"
  | "deplacer"
  | "raccourcir"
  | "annuler"
  | "ajouter"
  | "conflit-impossible";

export interface PlanSnapshot {
  plannedFor: string;
  endsAt: string;
  durationMinutes: number;
  label: string;
  intervention: CreneauPropose["intervention"];
  expectedEffect: CreneauPropose["expectedEffect"];
}

export interface PlanChange {
  kind: PlanChangeKind;
  sessionId?: string;
  candidateId: string;
  before?: PlanSnapshot;
  after?: PlanSnapshot;
  reason: string;
  reservations: string[];
}

export interface PlanDiffConflict {
  candidateId: string;
  sessionId?: string;
  reason: string;
  reservations: string[];
}

export interface PlanDiff {
  changes: PlanChange[];
  /** Nouvelles propositions visibles, sans écriture tant qu'elles ne sont pas acceptées. */
  appears?: PlanChange[];
  /** Candidates du recalcul non acceptées : elles restent hors de la revue. */
  silentCandidateIds: string[];
  conflicts: PlanDiffConflict[];
  constraints: string[];
  reservations: string[];
}

/** Noms français courts pour les appelants qui décrivent l'écran de revue. */
export type DiffPlan = PlanDiff;
export type ChangementPlan = PlanChange;

export interface CalculerDiffPlanInput {
  acceptedSessions: readonly LearningSession[];
  recalculatedPlan: PlanPropose;
  /** Choix déjà explicite de la personne ; absent = aucune nouvelle candidate. */
  acceptedCandidateIds?: readonly string[];
}

function instant(valeur: string | undefined): number | null {
  if (typeof valeur !== "string") return null;
  const resultat = Date.parse(valeur);
  return Number.isFinite(resultat) ? resultat : null;
}

function dureeSession(session: LearningSession): number | null {
  if (Number.isInteger(session.dureePlanifieeMin) && (session.dureePlanifieeMin ?? 0) > 0) {
    return session.dureePlanifieeMin ?? null;
  }
  if (Number.isInteger(session.dureeMin) && (session.dureeMin ?? 0) > 0) {
    return session.dureeMin ?? null;
  }
  const durees = (session.interventions ?? []).map((intervention) => intervention.estimatedDurationMinutes);
  if (durees.length === 0 || durees.some((duree) => !Number.isInteger(duree) || (duree ?? 0) <= 0)) return null;
  let total = 0;
  for (const duree of durees) total += duree ?? 0;
  return total > 0 ? total : null;
}

function snapshotSession(session: LearningSession): PlanSnapshot | null {
  const debut = instant(session.planifieePour ?? session.date);
  const duree = dureeSession(session);
  if (debut === null || duree === null) return null;
  const intervention = session.interventions?.[0];
  if (!intervention) return null;
  return {
    plannedFor: new Date(debut).toISOString(),
    endsAt: new Date(debut + duree * 60_000).toISOString(),
    durationMinutes: duree,
    label: intervention.label,
    intervention: intervention.type,
    expectedEffect: intervention.expectedEffect,
  };
}

function snapshotCreneau(slot: CreneauPropose): PlanSnapshot {
  return {
    plannedFor: slot.plannedFor,
    endsAt: slot.endsAt,
    durationMinutes: slot.durationMinutes,
    label: slot.candidate.title,
    intervention: slot.intervention,
    expectedEffect: slot.expectedEffect,
  };
}

function identiteSession(session: LearningSession): string | null {
  const candidateId = session.origineProposition?.candidateId;
  return typeof candidateId === "string" && candidateId.trim() !== "" ? candidateId : null;
}

function raison(slot: CreneauPropose | undefined, repli: string): string {
  return slot?.reasons.find((item) => item.trim() !== "") ?? repli;
}

function chevauche(a: PlanSnapshot, b: PlanSnapshot): boolean {
  const debutA = instant(a.plannedFor);
  const finA = instant(a.endsAt);
  const debutB = instant(b.plannedFor);
  const finB = instant(b.endsAt);
  return debutA !== null && finA !== null && debutB !== null && finB !== null
    && debutA < finB && debutB < finA;
}

function creneauDansDisponibilite(
  snapshot: PlanSnapshot,
  availability: PlanPropose["availability"],
): boolean {
  const debut = instant(snapshot.plannedFor);
  const fin = instant(snapshot.endsAt);
  if (debut === null || fin === null || !availability || availability.length === 0) return false;
  return availability.some((window) => {
    const debutFenetre = instant(window.startsAt);
    const finFenetre = instant(window.endsAt);
    return debutFenetre !== null
      && finFenetre !== null
      && debutFenetre <= debut
      && fin <= finFenetre;
  });
}

/**
 * Recalcule uniquement la position d'une séance déjà acceptée.
 *
 * `planifierTemps` retire volontairement les séances acceptées de ses slots :
 * elles occupent le temps, mais ne sont pas de nouvelles candidates. La
 * revue doit néanmoins pouvoir constater qu'une disponibilité a invalidé
 * leur position. Cette petite projection reste pure et ne recompose pas le
 * contenu de la séance.
 */
function replanifierSession(
  before: PlanSnapshot,
  availability: PlanPropose["availability"],
  occupations: readonly PlanSnapshot[],
): PlanSnapshot | null {
  if (!availability || availability.length === 0) return null;
  const duree = before.durationMinutes * 60_000;
  const fenetres = availability
    .map((window) => ({ debut: instant(window.startsAt), fin: instant(window.endsAt) }))
    .filter((window): window is { debut: number; fin: number } =>
      window.debut !== null && window.fin !== null && window.fin > window.debut,
    )
    .sort((a, b) => a.debut - b.debut || a.fin - b.fin);

  if (creneauDansDisponibilite(before, availability) && !occupations.some((occupation) => chevauche(before, occupation))) {
    return before;
  }

  for (const fenetre of fenetres) {
    const fin = fenetre.debut + duree;
    const candidat: PlanSnapshot = {
      ...before,
      plannedFor: new Date(fenetre.debut).toISOString(),
      endsAt: new Date(fin).toISOString(),
    };
    if (fin <= fenetre.fin && !occupations.some((occupation) => chevauche(candidat, occupation))) {
      return candidat;
    }
  }
  return null;
}

/**
 * Compare les séances déjà acceptées au recalcul courant.
 *
 * Hypothèses v0 : une origine `candidateId` identifie une séance, une durée
 * réduite est la seule variation de durée applicable et une extension devient
 * un conflit explicite plutôt qu'une modification implicite. Une séance sans
 * origine ou sans durée reste protégée et ne peut pas être annulée par défaut.
 */
export function calculerDiffPlan({
  acceptedSessions,
  recalculatedPlan,
  acceptedCandidateIds = [],
}: CalculerDiffPlanInput): PlanDiff {
  const acceptedIds = new Set(acceptedCandidateIds);
  const slotsByCandidate = new Map<string, CreneauPropose>();
  const silentCandidateIds: string[] = [];
  const conflicts: PlanDiffConflict[] = [];
  const acceptedOriginIds = new Set(
    acceptedSessions.flatMap((session) => {
      const candidateId = identiteSession(session);
      return candidateId ? [candidateId] : [];
    }),
  );
  const reservations: string[] = [];

  for (const slot of recalculatedPlan.slots) {
    const candidateId = slot.candidate.candidateId;
    if (slotsByCandidate.has(candidateId)) {
      conflicts.push({
        candidateId,
        reason: "La proposition contient deux fois la même candidate.",
        reservations: ["Le recalcul doit fournir une identité unique par candidate."],
      });
      continue;
    }
    slotsByCandidate.set(candidateId, slot);
    if (!acceptedIds.has(candidateId) && !acceptedOriginIds.has(candidateId)) silentCandidateIds.push(candidateId);
  }

  const changes: PlanChange[] = [];
  const sessionsByCandidate = new Map<string, LearningSession>();
  const protectedSnapshots: PlanSnapshot[] = [];

  for (const session of acceptedSessions) {
    if ((session.statut ?? "terminee") !== "planifiee") {
      const protectedSnapshot = snapshotSession(session);
      if (protectedSnapshot) protectedSnapshots.push(protectedSnapshot);
      continue;
    }
    const candidateId = identiteSession(session);
    const before = snapshotSession(session);
    if (!candidateId || !before) {
      reservations.push(`Séance ${session.id} protégée : provenance ou durée absente.`);
      changes.push({
        kind: "conserver",
        sessionId: session.id,
        candidateId: candidateId ?? session.id,
        before: before ?? undefined,
        reason: "Cette séance acceptée ne peut pas être comparée sans fabriquer de fait.",
        reservations: ["Aucune annulation automatique n'est autorisée."],
      });
      if (before) protectedSnapshots.push(before);
      continue;
    }
    if (sessionsByCandidate.has(candidateId)) {
      conflicts.push({
        candidateId,
        sessionId: session.id,
        reason: "Deux séances acceptées portent la même origine.",
        reservations: ["L'identité de séance doit rester stable et unique."],
      });
      continue;
    }
    sessionsByCandidate.set(candidateId, session);
    const slot = slotsByCandidate.get(candidateId);
    const occupations = acceptedSessions
      .filter((candidate) => candidate.id !== session.id && (candidate.statut ?? "terminee") === "planifiee")
      .map(snapshotSession)
      .filter((snapshot): snapshot is PlanSnapshot => snapshot !== null);
    const after = slot
      ? snapshotCreneau(slot)
      : recalculatedPlan.slots.length > 0
        ? replanifierSession(before, recalculatedPlan.availability, occupations)
        : null;
    if (!after) {
      changes.push({
        kind: "annuler",
        sessionId: session.id,
        candidateId,
        before,
        reason: "Le recalcul ne propose plus ce créneau accepté.",
        reservations: ["L'annulation sera soumise à une action explicite."],
      });
      continue;
    }

    const dateAvant = instant(before.plannedFor);
    const dateApres = instant(after.plannedFor);
    const dateChange = dateAvant !== dateApres;
    const durationChange = before.durationMinutes !== after.durationMinutes;
    const contenuChange = before.intervention !== after.intervention
      || before.expectedEffect !== after.expectedEffect
      || before.label !== after.label;
    if (contenuChange) {
      const conflict = "Le recalcul change le geste d'une séance déjà acceptée.";
      conflicts.push({ candidateId, sessionId: session.id, reason: conflict, reservations: ["La v0 ne remplace pas silencieusement une intervention acceptée."] });
      changes.push({ kind: "conflit-impossible", sessionId: session.id, candidateId, before, after, reason: conflict, reservations: ["Relire la séance dans son contexte avant toute modification."] });
    } else if (!dateChange && !durationChange) {
      changes.push({ kind: "conserver", sessionId: session.id, candidateId, before, after, reason: raison(slot, "Le créneau accepté reste compatible avec le recalcul."), reservations: slot ? [...slot.reservations] : ["La séance acceptée reste inchangée."] });
    } else if (after.durationMinutes < before.durationMinutes) {
      changes.push({ kind: "raccourcir", sessionId: session.id, candidateId, before, after, reason: raison(slot, "La capacité déclarée conduit à un créneau plus court."), reservations: slot ? [...slot.reservations] : [] });
    } else if (after.durationMinutes > before.durationMinutes) {
      const conflict = "Le recalcul demande une durée plus longue, variation non supportée en v0.";
      conflicts.push({ candidateId, sessionId: session.id, reason: conflict, reservations: ["Choisir une durée explicitement dans la séance." ] });
      changes.push({ kind: "conflit-impossible", sessionId: session.id, candidateId, before, after, reason: conflict, reservations: ["Aucune extension implicite d'une séance acceptée." ] });
    } else {
      changes.push({ kind: "deplacer", sessionId: session.id, candidateId, before, after, reason: raison(slot, "Le créneau actuel ne correspond plus à vos disponibilités déclarées."), reservations: slot ? [...slot.reservations] : ["Le déplacement conserve le geste et l'origine de la séance."] });
    }
  }

  for (const slot of recalculatedPlan.slots) {
    const candidateId = slot.candidate.candidateId;
    if (!acceptedIds.has(candidateId) || sessionsByCandidate.has(candidateId)) continue;
    const after = snapshotCreneau(slot);
    changes.push({ kind: "ajouter", candidateId, after, reason: raison(slot, "Cette candidate a été acceptée dans le nouveau plan."), reservations: [...slot.reservations] });
  }

  const proposed = changes.filter((change) => change.after && change.kind !== "annuler").map((change) => ({ change, snapshot: change.after as PlanSnapshot }));
  for (let index = 0; index < proposed.length; index += 1) {
    for (let other = index + 1; other < proposed.length; other += 1) {
      if (!chevauche(proposed[index].snapshot, proposed[other].snapshot)) continue;
      const reasonConflit = `Les créneaux ${proposed[index].change.candidateId} et ${proposed[other].change.candidateId} se chevauchent.`;
      conflicts.push({ candidateId: proposed[other].change.candidateId, sessionId: proposed[other].change.sessionId, reason: reasonConflit, reservations: ["Aucun ajustement atomique ne sera appliqué tant que le conflit subsiste."] });
    }
  }

  for (const change of changes) {
    if (!change.after) continue;
    for (const protectedSnapshot of protectedSnapshots) {
      if (chevauche(change.after, protectedSnapshot)) {
        const reasonConflit = `Le créneau ${change.candidateId} empiète sur une séance protégée.`;
        conflicts.push({ candidateId: change.candidateId, sessionId: change.sessionId, reason: reasonConflit, reservations: ["La séance déjà en cours ou sans provenance reste intouchable."] });
      }
    }
  }

  const appears = recalculatedPlan.slots
    .filter((slot) => !acceptedIds.has(slot.candidate.candidateId) && !acceptedOriginIds.has(slot.candidate.candidateId))
    .map((slot) => ({
      kind: "ajouter" as const,
      candidateId: slot.candidate.candidateId,
      after: snapshotCreneau(slot),
      reason: "Une nouvelle proposition est disponible à partir de vos informations actuelles.",
      reservations: [...slot.reservations],
    }));

  return {
    changes: changes.sort((a, b) => (a.after?.plannedFor ?? a.before?.plannedFor ?? "").localeCompare(b.after?.plannedFor ?? b.before?.plannedFor ?? "")),
    appears,
    silentCandidateIds: [...new Set(silentCandidateIds)].sort(),
    conflicts,
    constraints: [...new Set(recalculatedPlan.constraints)],
    reservations: [...new Set([...reservations, ...recalculatedPlan.reservations])],
  };
}

/** Alias explicite conservé pour les appelants qui parlent de révision. */
export const diffPlan = calculerDiffPlan;
