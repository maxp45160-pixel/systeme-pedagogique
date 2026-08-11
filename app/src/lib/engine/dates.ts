/** Utilitaires de dates. Aucune dépendance externe. */

export const JOUR_MS = 24 * 60 * 60 * 1000;

export function joursEntre(a: string | Date, b: string | Date): number {
  const da = typeof a === "string" ? new Date(a) : a;
  const db = typeof b === "string" ? new Date(b) : b;
  return Math.floor((db.getTime() - da.getTime()) / JOUR_MS);
}

export function joursDepuis(date: string, now: Date = new Date()): number {
  return Math.max(0, joursEntre(date, now));
}

/**
 * Facteur de récence dans [0,1] : 1 pour une preuve du jour, décroissance
 * douce, plancher à 0,3 pour ne jamais annuler une preuve ancienne.
 *
 * Protocole d'évaluation §7 : l'ancienneté fait baisser la CONFIANCE.
 * Elle ne retire jamais le niveau acquis (§9).
 */
export function facteurRecence(date: string, now: Date = new Date(), demiVieJours = 120): number {
  const j = joursDepuis(date, now);
  return Math.max(0.3, Math.pow(0.5, j / demiVieJours));
}

export function formatDateCourte(date: string): string {
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateRelative(date: string, now: Date = new Date()): string {
  const j = joursDepuis(date, now);
  if (j === 0) return "aujourd'hui";
  if (j === 1) return "hier";
  if (j < 7) return `il y a ${j} jours`;
  if (j < 31) return `il y a ${Math.floor(j / 7)} semaine${Math.floor(j / 7) > 1 ? "s" : ""}`;
  if (j < 365) return `il y a ${Math.floor(j / 30)} mois`;
  return `il y a ${Math.floor(j / 365)} an${Math.floor(j / 365) > 1 ? "s" : ""}`;
}

export function formatDuree(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

export function cleJour(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}
