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
 * Facteur de récence dans [0,1] : 1 pour une observation du jour, décroissance
 * douce, plancher à 0,3 pour ne jamais annuler une observation ancienne.
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

/** Date et heure, pour un événement daté précisément (une tentative, un passage). */
export function formatDateHeure(date: string): string {
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
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

/**
 * Le jour civil `AAAA-MM-JJ` d'un instant, coupé dans le fuseau demandé.
 *
 * `cleJour` coupe dans le fuseau du processus : côté serveur en production,
 * c'est UTC — et autour de minuit européen, `/seances` ouvrait la veille
 * (friction du 25/08/2026). Cette variante explicite sert à nommer le
 * problème et à le tester ; la correction effective laisse le jour civil au
 * navigateur (`CahierInteractif`), qui n'a pas de fuseau à deviner.
 *
 * `en-CA` produit nativement le format ISO court — aucune manipulation de
 * chaîne, donc aucune dérive de locale.
 */
export function cleJourFuseau(d: Date | string, fuseau: string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: fuseau,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/* ------------------------------------------------------------------ */
/* Formats affichés                                                    */
/*                                                                     */
/* Chaque format rendu à l'écran a un seul point de définition : une   */
/* locale recopiée à la main dérive en silence d'un écran à l'autre.   */
/* ------------------------------------------------------------------ */

/**
 * Jour de la semaine + date complète, pour un en-tête de journée.
 * Accepte une clé de jour `YYYY-MM-DD` ; le midi factice évite le décalage
 * horaire des dates ISO sans heure.
 */
export function formatDateSemaine(jour: string): string {
  return new Date(`${jour}T12:00:00`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** « janvier 2026 », depuis une clé de mois `YYYY-MM` — l'en-tête d'un calendrier. */
export function formatMoisAnnee(mois: string): string {
  return new Date(`${mois}-01T12:00:00`).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });
}

/** « 12 janvier 2026 » — un fait daté, sans heure ni jour de semaine. */
export function formatDateComplete(date: string): string {
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** « lundi 12 janvier » — l'en-tête du tableau de bord, qui n'a pas besoin de l'année. */
export function formatDateAujourdhui(now: Date = new Date()): string {
  return now.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** Le format numérique court de la locale — listes et tableaux denses. */
export function formatDateNumerique(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("fr-FR");
}
