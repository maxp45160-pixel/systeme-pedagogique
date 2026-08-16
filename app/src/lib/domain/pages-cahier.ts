/**
 * Le cahier a des pages, et une page est un jour.
 *
 * ## Pourquoi le jour, et pourquoi rien n'est stocké
 *
 * Un cahier se feuillette. Le hub le rendait comme une liste déroulante de tout
 * ce qui avait eu lieu : il n'y avait pas de « page », donc rien à tourner, et
 * rien à rouvrir là où on s'était arrêté.
 *
 * Le jour est le seul découpage qui **existe déjà dans les données** : une
 * séance a une date, une ligne de marge a le jour où elle a été écrite. Aucune
 * table de pages, aucun rangement à maintenir — une page est une lecture, pas
 * une entité (P1). Le corollaire tient aussi : une page ne se crée pas, elle
 * apparaît quand quelque chose y a été écrit.
 *
 * ## Ce que ce module ne fait pas
 *
 * Il ne calcule **aucune mesure**. Il range ce qui existe par jour et sait quel
 * jour vient avant ou après. Le tri des séances à l'intérieur d'une page relève
 * de l'affichage, pas d'un jugement sur leur importance.
 */

import { cleJour } from "@/lib/engine/dates";
import { statutSeance } from "./seance";
import type { LearningSession } from "./types";
import type { ApercuDocument, ResumeSnapshotDocument } from "@/lib/documents/types-documents";

/** Une ligne de marge, vue d'ici : seule sa date de rédaction compte. */
export interface NoteDatee {
  notee?: string;
}

/** Un travail ou projet opérationnel vu par le cahier. */
export interface DocumentOperationnelDate {
  id: string;
  titre: string;
  type: string;
  role?: string;
  contexte?: string;
  dureeMin?: number;
  segmentMin?: number;
  competences: string[];
  createdAt?: string;
  updatedAt?: string;
  fige?: boolean;
}

export function jourDuDocument(document: { createdAt?: string; updatedAt?: string }): string {
  const dateStr = document.createdAt ?? document.updatedAt;
  return cleJour(dateStr ? new Date(dateStr) : new Date());
}

/**
 * Extrait les documents opérationnels (projets, études de cas, etc.) pour le cahier.
 */
export function extraireDocumentsOperationnels(
  apercus: readonly ApercuDocument[],
  snapshots: readonly ResumeSnapshotDocument[] = [],
): DocumentOperationnelDate[] {
  const figes = new Set(snapshots.map((s) => s.documentId));
  return apercus
    .filter((doc) => doc.frontMatter.role === "operationnel")
    .map((doc) => {
      const dureeMin = typeof doc.frontMatter.projet_duree_min === "string"
        ? Number(doc.frontMatter.projet_duree_min) || undefined
        : undefined;
      const competences = typeof doc.frontMatter.projet_competences === "string"
        ? doc.frontMatter.projet_competences.split(",").map((s) => s.trim()).filter(Boolean)
        : doc.liens.map((l) => l.cible);
      const contexte = typeof doc.frontMatter.contexte === "string" ? doc.frontMatter.contexte : undefined;
      return {
        id: doc.id,
        titre: doc.titre,
        type: doc.type,
        role: "operationnel",
        contexte,
        dureeMin,
        competences: [...new Set(competences)],
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        fige: figes.has(doc.id),
      };
    });
}

export interface PageCahier<
  N extends NoteDatee = NoteDatee,
  P extends DocumentOperationnelDate = DocumentOperationnelDate,
> {
  /** Clé du jour, `AAAA-MM-JJ`. */
  jour: string;
  /** Séances composées à la main — les pages écrites du cahier. */
  seances: LearningSession[];
  /**
   * Exercices clos hors séance, écrits automatiquement par `terminerExercice`.
   *
   * Ce sont des traces, pas des séances : au 16/08/2026, 45 des 51 lignes de
   * `sessions` en sont. Les rendre comme des séances noyait les six vraies
   * sous quarante-cinq cartes identiques. La distinction est **lue**
   * (`genereAutomatiquement`), jamais fabriquée.
   */
  traces: LearningSession[];
  /** Lignes de marge écrites ce jour-là. */
  notes: N[];
  /** Projets et travaux opérationnels engagés ou mis à jour ce jour-là. */
  projets: P[];
}

/**
 * Le jour auquel une séance appartient.
 *
 * Une séance planifiée vit sur la page du jour **prévu** : c'est là qu'on ira
 * la chercher, et c'est ce qui donne au cahier des pages à venir. Toutes les
 * autres vivent sur leur date réelle.
 */
export function jourDeLaSeance(seance: LearningSession): string {
  return cleJour(
    statutSeance(seance) === "planifiee" ? seance.planifieePour ?? seance.date : seance.date,
  );
}

const FORMAT_JOUR = /^\d{4}-\d{2}-\d{2}$/;

/** Valide une clé de jour venant de l'URL, sans rien deviner. */
export function jourValide(brut: string | undefined): string | null {
  if (!brut || !FORMAT_JOUR.test(brut)) return null;
  const date = new Date(`${brut}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : brut;
}

/**
 * Les jours qui portent quelque chose, du plus ancien au plus récent.
 *
 * Le jour courant y figure toujours : c'est la page sur laquelle on écrit, et
 * un cahier qui n'ouvrirait pas sur une page vierge le jour où l'on n'a encore
 * rien fait serait un cahier fermé.
 */
export function joursDuCahier<
  N extends NoteDatee,
  P extends DocumentOperationnelDate = DocumentOperationnelDate,
>(entrees: {
  seances: readonly LearningSession[];
  notes: readonly N[];
  projets?: readonly P[];
  aujourdHui: Date;
}): string[] {
  const jours = new Set<string>([cleJour(entrees.aujourdHui)]);
  for (const seance of entrees.seances) jours.add(jourDeLaSeance(seance));
  for (const note of entrees.notes) if (note.notee) jours.add(note.notee);
  for (const projet of entrees.projets ?? []) {
    jours.add(jourDuDocument(projet));
  }
  return [...jours].sort();
}

/** Le contenu d'un jour, dans les différents registres. */
export function construirePage<
  N extends NoteDatee,
  P extends DocumentOperationnelDate = DocumentOperationnelDate,
>(
  jour: string,
  entrees: {
    seances: readonly LearningSession[];
    notes: readonly N[];
    projets?: readonly P[];
  },
): PageCahier<N, P> {
  const duJour = entrees.seances.filter((seance) => jourDeLaSeance(seance) === jour);
  const projetsDuJour = (entrees.projets ?? []).filter((projet) => jourDuDocument(projet) === jour);
  return {
    jour,
    seances: duJour
      .filter((seance) => !seance.genereAutomatiquement)
      .sort((a, b) => a.date.localeCompare(b.date)),
    traces: duJour
      .filter((seance) => seance.genereAutomatiquement)
      .sort((a, b) => a.date.localeCompare(b.date)),
    notes: entrees.notes.filter((note) => note.notee === jour),
    projets: projetsDuJour as P[],
  };
}

export function pageEstVide(page: PageCahier): boolean {
  return (
    page.seances.length === 0 &&
    page.traces.length === 0 &&
    page.notes.length === 0 &&
    (page.projets?.length ?? 0) === 0
  );
}

/**
 * La page précédente et la suivante, parmi celles qui existent.
 *
 * On tourne d'une page écrite à la page écrite d'à côté : sauter les jours
 * vides est ce qui distingue un cahier d'un calendrier. Un jour absent de la
 * liste — une URL forgée, une page vidée entre-temps — n'est pas une erreur :
 * on rend les voisins immédiats dans l'ordre des dates.
 */
export function voisinesDeLaPage(
  jour: string,
  jours: readonly string[],
): { precedente: string | null; suivante: string | null } {
  const precedents = jours.filter((candidat) => candidat < jour);
  const suivants = jours.filter((candidat) => candidat > jour);
  return {
    precedente: precedents.length > 0 ? precedents[precedents.length - 1] : null,
    suivante: suivants.length > 0 ? suivants[0] : null,
  };
}

/* ------------------------------------------------------------------ */
/* Calendrier — aller à une page sans la feuilleter                     */
/* ------------------------------------------------------------------ */

const FORMAT_MOIS = /^\d{4}-\d{2}$/;

export interface CaseCalendrier {
  jour: string;
  /** Faux pour les jours de remplissage en début et fin de grille. */
  dansLeMois: boolean;
  /** Une page existe pour ce jour : quelque chose y a été écrit. */
  aContenu: boolean;
  estAujourdHui: boolean;
}

export function moisDuJour(jour: string): string {
  return jour.slice(0, 7);
}

export function moisValide(brut: string | undefined): string | null {
  if (!brut || !FORMAT_MOIS.test(brut)) return null;
  const mois = Number(brut.slice(5, 7));
  return mois >= 1 && mois <= 12 ? brut : null;
}

/** Le mois voisin, en respectant le passage d'année. */
export function moisDecale(mois: string, pas: number): string {
  const annee = Number(mois.slice(0, 4));
  const index = Number(mois.slice(5, 7)) - 1 + pas;
  const anneeCible = annee + Math.floor(index / 12);
  const moisCible = ((index % 12) + 12) % 12;
  return `${anneeCible}-${String(moisCible + 1).padStart(2, "0")}`;
}

/**
 * La grille d'un mois, semaines commençant le lundi.
 *
 * ⚠️ Les dates sont construites à midi (`T12:00:00`), et ce n'est pas
 * cosmétique : à minuit, un décalage d'heure d'été suffit à faire basculer un
 * jour d'un cran, et la grille afficherait des cases décalées deux fois par an.
 *
 * Le calendrier complète ce que le feuilletage ne sait pas faire : `voisinesDeLaPage`
 * saute d'une page écrite à l'autre — juste pour relire de proche en proche,
 * inutile pour retrouver « le mardi où j'ai travaillé les flux ». Les deux
 * cohabitent donc, et le calendrier dit lesquels des jours portent une page
 * plutôt que de laisser chercher.
 */
export function grilleMois(
  mois: string,
  joursAvecContenu: readonly string[],
  aujourdHui: Date,
): CaseCalendrier[][] {
  const avecContenu = new Set(joursAvecContenu);
  const cleAujourdHui = cleJour(aujourdHui);
  const premier = new Date(`${mois}-01T12:00:00`);

  // `getDay()` rend 0 pour dimanche : on décale pour une semaine qui commence
  // le lundi, comme un agenda français.
  const decalage = (premier.getDay() + 6) % 7;
  const debut = new Date(premier);
  debut.setDate(premier.getDate() - decalage);

  const semaines: CaseCalendrier[][] = [];
  const curseur = new Date(debut);
  // Six semaines couvrent tous les mois possibles ; on s'arrête dès que le mois
  // est passé, pour ne pas afficher une ligne entière de vide.
  for (let semaine = 0; semaine < 6; semaine += 1) {
    const cases: CaseCalendrier[] = [];
    for (let jour = 0; jour < 7; jour += 1) {
      const cle = cleJour(curseur);
      cases.push({
        jour: cle,
        dansLeMois: moisDuJour(cle) === mois,
        aContenu: avecContenu.has(cle),
        estAujourdHui: cle === cleAujourdHui,
      });
      curseur.setDate(curseur.getDate() + 1);
    }
    semaines.push(cases);
    if (cases[6].dansLeMois === false && moisDuJour(cases[6].jour) > mois) break;
  }
  return semaines;
}

/**
 * Sur quelle page ouvrir le cahier.
 *
 * Le marque-page l'emporte — c'est la réponse à « reprendre là où je m'étais
 * arrêté » — mais seulement s'il désigne une page qui existe encore. Un
 * marque-page périmé (le jour d'une séance annulée depuis) ne doit pas ouvrir
 * une page vide ; on retombe alors sur le jour courant, qui existe toujours.
 */
export function pageDOuverture(
  marquePage: string | null | undefined,
  jours: readonly string[],
  aujourdHui: Date,
): string {
  if (marquePage && jours.includes(marquePage)) return marquePage;
  return cleJour(aujourdHui);
}
