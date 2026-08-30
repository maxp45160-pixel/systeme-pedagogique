import { cleJour, formatDateRelative } from "@/lib/engine/dates";
import { couvertureCompetences, estOuvert, triParUrgence, type Engagement } from "@/lib/domain/engagement";
import { lireInterventionsSeance } from "@/lib/domain/legacy-session-intervention-adapter";
import { statutSeance } from "@/lib/domain/seance";
import type {
  InterventionEffect,
  InterventionType,
  LearningSession,
  SkillState,
} from "@/lib/domain/types";
import type { Recommandation } from "./recommend";
import {
  evaluerPreparationEcheances,
  type PreparationState,
} from "./planification-temporelle";

export interface DashboardDayEntry {
  id: string;
  sessionId?: string;
  plannedFor: string | null;
  timeLabel: string | null;
  label: string;
  type: InterventionType;
  durationMinutes?: number;
  effect: InterventionEffect;
  reason: string;
  href: string;
  state: "current" | "next" | "available";
  reservation?: string;
}

export interface DashboardProof {
  id: string;
  label: string;
  date: string;
  relativeDate: string;
  skillCode: string;
}

export interface DashboardDeadline {
  id: string;
  label: string;
  dueDate: string;
  dueLabel: string;
  state: PreparationState;
  evidenceCount: number;
  unknowns: string[];
  proofs: DashboardProof[];
}

export interface DashboardDayTab {
  key: string;
  weekday: string;
  dateLabel: string;
  isToday: boolean;
  href: string;
}

export interface DashboardOrchestrationView {
  today: string;
  entries: DashboardDayEntry[];
  acceptedWeekCount: number;
  weekEntries: DashboardDayEntry[];
  days: DashboardDayTab[];
  previousWeekHref: string;
  nextWeekHref: string;
  deadline: DashboardDeadline | null;
}

interface DashboardInput {
  now: Date;
  sessions: readonly LearningSession[];
  engagements: readonly Engagement[];
  skillStates: readonly SkillState[];
  recommendations: readonly Recommandation[];
}

const MINUTES_PAR_DEFAUT = 25;

function heure(date: string | null): string | null {
  if (!date) return null;
  const valeur = new Date(date);
  if (Number.isNaN(valeur.getTime())) return null;
  return valeur.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function titreSeance(session: LearningSession, interventions: ReturnType<typeof lireInterventionsSeance>): string {
  const intention = session.besoinDeclare?.intention?.trim();
  if (intention) return intention;
  const intervention = interventions.interventions[0];
  if (intervention) return intervention.label;
  const historique = session.activites.find((activite) => activite.libelle.trim().length > 0);
  if (historique) return historique.libelle;
  return "Séance planifiée";
}

function interventionDeSeance(
  session: LearningSession,
  index: number,
): DashboardDayEntry | null {
  const lecture = lireInterventionsSeance(session);
  const intervention = lecture.interventions[index];
  if (!intervention) return null;
  const plannedFor = session.planifieePour ?? session.date;
  const durationMinutes = lecture.interventions.length === 1 && session.dureePlanifieeMin !== undefined
    ? session.dureePlanifieeMin
    : intervention.estimatedDurationMinutes;
  return {
    id: `${session.id}:${intervention.id}`,
    sessionId: session.id,
    plannedFor,
    timeLabel: heure(plannedFor),
    label: intervention.label,
    type: intervention.type,
    durationMinutes,
    effect: intervention.expectedEffect,
    reason: intervention.proofContract
      ? "Contrat de preuve prévu pour cette intervention."
      : "Séance acceptée, sans preuve fabriquée à l'avance.",
    href: `/seances?session=${encodeURIComponent(session.id)}`,
    state: "next",
    reservation: lecture.reserves.length > 0 ? lecture.reserves[0].reason : undefined,
  };
}

function entriesForSession(session: LearningSession): DashboardDayEntry[] {
  const lecture = lireInterventionsSeance(session);
  const entries = lecture.interventions
    .map((_, index) => interventionDeSeance(session, index))
    .filter((entry): entry is DashboardDayEntry => entry !== null);
  if (entries.length > 0) return entries;
  return [{
    id: `${session.id}:reserved`,
    sessionId: session.id,
    plannedFor: session.planifieePour ?? session.date,
    timeLabel: heure(session.planifieePour ?? session.date),
    label: titreSeance(session, lecture),
    type: "read",
    durationMinutes: session.dureePlanifieeMin ?? session.dureeMin ?? session.blueprint?.dureeCibleMin,
    effect: "support",
    reason: "La séance acceptée reste lisible ; son intervention détaillée est à éclaircir.",
    href: `/seances?session=${encodeURIComponent(session.id)}`,
    state: "next",
    reservation: lecture.reserves[0]?.reason,
  }];
}

function invitationSeance(recommendations: readonly Recommandation[]): DashboardDayEntry {
  const recommendation = recommendations[0];
  const code = recommendation?.etat.skill.code;
  const durationMinutes = recommendation?.dureeEstimeeMin ?? MINUTES_PAR_DEFAUT;
  return {
    id: "available:today",
    plannedFor: null,
    timeLabel: null,
    label: "Préparer une séance",
    type: "diagnose",
    durationMinutes,
    effect: "measurement",
    reason: recommendation
      ? "Aucune séance acceptée aujourd'hui : une priorité est disponible à préparer."
      : "Aucune séance acceptée aujourd'hui : choisissez un sujet pour commencer.",
    href: code
      ? `/seances?composer=1&code=${encodeURIComponent(code)}&temps=${encodeURIComponent(String(durationMinutes))}`
      : "/seances?composer=1&sans-theme=1",
    state: "available",
  };
}

function lundiDeSemaine(now: Date): Date {
  const jour = new Date(now);
  const index = (jour.getDay() + 6) % 7;
  jour.setHours(12, 0, 0, 0);
  jour.setDate(jour.getDate() - index);
  return jour;
}

function joursDeLaSemaine(now: Date): DashboardDayTab[] {
  const lundi = lundiDeSemaine(now);
  const aujourdHui = cleJour(now);
  return Array.from({ length: 7 }, (_, index) => {
    const jour = new Date(lundi);
    jour.setDate(lundi.getDate() + index);
    const key = cleJour(jour);
    return {
      key,
      weekday: jour.toLocaleDateString("fr-FR", { weekday: "long" }),
      dateLabel: jour.toLocaleDateString("fr-FR", { day: "numeric", month: "long" }),
      isToday: key === aujourdHui,
      href: `/seances?jour=${encodeURIComponent(key)}`,
    };
  });
}

function decalerJour(jour: string, jours: number): string {
  const date = new Date(`${jour}T12:00:00`);
  date.setDate(date.getDate() + jours);
  return cleJour(date);
}

function echeanceDetaillee(
  engagements: readonly Engagement[],
  states: readonly SkillState[],
  now: Date,
): DashboardDeadline | null {
  const engagement = triParUrgence(engagements.filter(estOuvert))
    .find((item) => new Date(item.echeanceLe).getTime() >= now.getTime());
  if (!engagement) return null;
  const preparation = evaluerPreparationEcheances(engagements, states)
    .find((item) => item.engagementId === engagement.id);
  if (!preparation) return null;
  const etats = new Map(states.map((state) => [state.skill.code, state]));
  const couverture = couvertureCompetences(engagement.codes, etats);
  const proofs = couverture
    .flatMap((point) => etats.get(point.code)?.observations ?? [])
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, 3)
    .map((observation) => ({
      id: observation.id,
      label: observation.contexte,
      date: observation.date,
      relativeDate: formatDateRelative(observation.date, now),
      skillCode: observation.skillCode,
    }));
  const unknowns = couverture
    .filter((point) => !point.observe)
    .map((point) => states.find((state) => state.skill.code === point.code)?.skill.intitule ?? point.code);
  return {
    id: engagement.id,
    label: engagement.libelle,
    dueDate: engagement.echeanceLe,
    dueLabel: new Date(engagement.echeanceLe).toLocaleDateString("fr-FR", { day: "numeric", month: "long" }),
    state: preparation.state,
    evidenceCount: preparation.evidenceRefs.length,
    unknowns,
    proofs,
  };
}

export function construireVueTableauBordOrchestration(input: DashboardInput): DashboardOrchestrationView {
  const today = cleJour(input.now);
  const days = joursDeLaSemaine(input.now);
  const accepted = input.sessions
    .filter((session) => {
      const statut = statutSeance(session);
      return statut === "en-cours" || statut === "planifiee";
    })
    .slice()
    .sort((left, right) => {
      const activeDelta = Number(statutSeance(left) !== "en-cours") - Number(statutSeance(right) !== "en-cours");
      if (activeDelta !== 0) return activeDelta;
      return (left.planifieePour ?? left.date).localeCompare(right.planifieePour ?? right.date);
    });
  const allEntries = accepted.flatMap(entriesForSession);
  const todays = allEntries.filter((entry) => entry.plannedFor && cleJour(entry.plannedFor) === today);
  const entries = (todays.length > 0 ? todays : [invitationSeance(input.recommendations)]).map((entry, index) => ({
    ...entry,
    state: entry.sessionId
      ? index === 0 ? ("current" as const) : ("next" as const)
      : entry.state,
  }));
  const debutSemaine = days[0].key;
  const finSemaine = days[days.length - 1].key;
  const sessionsCetteSemaine = accepted.filter((session) => {
    const jour = cleJour(session.planifieePour ?? session.date);
    return jour >= debutSemaine && jour <= finSemaine;
  });
  const weekEntries = allEntries
    .filter((entry) => {
      if (!entry.plannedFor) return false;
      const jour = cleJour(entry.plannedFor);
      return jour >= debutSemaine && jour <= finSemaine && jour !== today;
    })
    .slice(0, 5);
  return {
    today,
    entries,
    acceptedWeekCount: sessionsCetteSemaine.length,
    weekEntries,
    days,
    previousWeekHref: `/seances?jour=${encodeURIComponent(decalerJour(days[0].key, -7))}`,
    nextWeekHref: `/seances?jour=${encodeURIComponent(decalerJour(days[6].key, 7))}`,
    deadline: echeanceDetaillee(input.engagements, input.skillStates, input.now),
  };
}
