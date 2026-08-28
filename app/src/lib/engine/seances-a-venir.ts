/**
 * Projection de la lecture « À venir » des séances.
 *
 * Cette projection appartient à Décide : elle ne lit ni Supabase, ni
 * l'horloge, et ne persiste rien. Les séances terminées (y compris les
 * historiques sans `statut`) restent au Cahier. Une séance ancienne n'est
 * retenue ici que si son statut déclaré est encore `planifiee` ou `en-cours`.
 */

import { lireInterventionsSeance } from "@/lib/domain/legacy-session-intervention-adapter";
import { statutSeance } from "@/lib/domain/seance";
import type {
  InterventionEffect,
  InterventionType,
  LearningSession,
  StatutSeance,
} from "@/lib/domain/types";

export interface SeanceAVenir {
  sessionId: string;
  /** Clé civile `AAAA-MM-JJ`; null signifie une date absente ou invalide. */
  jour: string | null;
  jourLabel: string;
  plannedFor: string | null;
  heure: string | null;
  dureeMinutes?: number;
  intervention: InterventionType | null;
  libelleIntervention: string;
  effetAttendu: InterventionEffect | null;
  domaines: string[];
  statut: "planifiee" | "en-cours";
  statutLabel: string;
  reservations: string[];
  href: string;
}

export interface GroupeSeancesAVenir {
  jour: string | null;
  libelle: string;
  seances: SeanceAVenir[];
}

export interface VueSeancesAVenir {
  seances: SeanceAVenir[];
  groupes: GroupeSeancesAVenir[];
  reservations: string[];
}

function instant(valeur: string | undefined): number | null {
  if (typeof valeur !== "string") return null;
  const resultat = Date.parse(valeur);
  return Number.isFinite(resultat) ? resultat : null;
}

function cleJour(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function libelleJour(jour: string): string {
  return new Date(`${jour}T12:00:00`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function dureePositive(valeur: unknown): valeur is number {
  return typeof valeur === "number" && Number.isInteger(valeur) && valeur > 0;
}

function dureeSession(
  session: LearningSession,
  interventions: ReturnType<typeof lireInterventionsSeance>["interventions"],
): number | undefined {
  if (dureePositive(session.dureePlanifieeMin)) return session.dureePlanifieeMin;

  const durees = interventions.map((intervention) => intervention.estimatedDurationMinutes);
  if (durees.length > 0 && durees.every(dureePositive)) {
    const total = durees.reduce((somme, duree) => somme + duree, 0);
    if (total > 0) return total;
  }

  if (dureePositive(session.blueprint?.dureeCibleMin)) return session.blueprint.dureeCibleMin;
  // Repli de lecture pour une séance acceptée antérieure au champ de durée de
  // créneau. Ce champ reste une durée observée ; l'absence n'est pas changée
  // en zéro.
  if (dureePositive(session.dureeMin)) return session.dureeMin;
  return undefined;
}

function titreHistorique(session: LearningSession): string | undefined {
  const intention = session.besoinDeclare?.intention?.trim();
  if (intention) return intention;
  const activite = session.activites.find((candidate) => candidate.libelle.trim().length > 0);
  return activite?.libelle;
}

function projectionSeance(session: LearningSession): SeanceAVenir | null {
  const statut: StatutSeance = statutSeance(session);
  if (statut !== "planifiee" && statut !== "en-cours") return null;

  const valeurDate = session.planifieePour ?? session.date;
  const timestamp = instant(valeurDate);
  const plannedFor = timestamp === null ? null : new Date(timestamp).toISOString();
  const jour = timestamp === null ? null : cleJour(timestamp);
  const lecture = lireInterventionsSeance(session);
  const principale = lecture.interventions[0];
  const reservations = lecture.reserves.map((reserve) => reserve.reason);
  const duree = dureeSession(session, lecture.interventions);

  if (timestamp === null) {
    reservations.push("date de séance absente ou invalide : elle ne peut pas être ordonnée");
  }
  if (!principale) {
    reservations.push("intervention principale absente : détail à préciser");
  }

  const domaines = [...new Set(session.domaines.filter((domaine) => domaine.trim().length > 0))];
  if (domaines.length === 0) reservations.push("domaine absent sur cette séance historique");

  return {
    sessionId: session.id,
    jour,
    jourLabel: jour ? libelleJour(jour) : "Date à préciser",
    plannedFor,
    heure: timestamp === null
      ? null
      : new Date(timestamp).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
    ...(duree !== undefined
      ? { dureeMinutes: duree }
      : {}),
    intervention: principale?.type ?? null,
    libelleIntervention: principale?.label ?? titreHistorique(session) ?? "Intervention à préciser",
    effetAttendu: principale?.expectedEffect ?? null,
    domaines,
    statut,
    statutLabel: statut === "en-cours" ? "En cours" : "Planifiée",
    reservations: [...new Set(reservations)],
    href: `/seances?session=${encodeURIComponent(session.id)}`,
  };
}

function comparer(a: SeanceAVenir, b: SeanceAVenir): number {
  if (a.plannedFor === null && b.plannedFor !== null) return 1;
  if (a.plannedFor !== null && b.plannedFor === null) return -1;
  if (a.plannedFor !== null && b.plannedFor !== null) {
    const date = a.plannedFor.localeCompare(b.plannedFor);
    if (date !== 0) return date;
  }
  if (a.statut !== b.statut) return a.statut === "en-cours" ? -1 : 1;
  return a.sessionId.localeCompare(b.sessionId);
}

/** Construit la chronologie opérationnelle sans créer de donnée. */
export function construireVueSeancesAVenir(
  sessions: readonly LearningSession[],
): VueSeancesAVenir {
  const seances = sessions
    .map(projectionSeance)
    .filter((seance): seance is SeanceAVenir => seance !== null)
    .sort(comparer);

  const groupes = new Map<string, GroupeSeancesAVenir>();
  for (const seance of seances) {
    const cle = seance.jour ?? "__date-a-preciser__";
    const groupe = groupes.get(cle);
    if (groupe) {
      groupe.seances.push(seance);
    } else {
      groupes.set(cle, {
        jour: seance.jour,
        libelle: seance.jourLabel,
        seances: [seance],
      });
    }
  }

  return {
    seances,
    groupes: [...groupes.values()],
    reservations: [...new Set(seances.flatMap((seance) => seance.reservations))],
  };
}

export type SeancesAVenir = VueSeancesAVenir;
