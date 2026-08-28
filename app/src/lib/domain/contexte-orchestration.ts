/**
 * Faits de contexte déclarés pour l'orchestration progressive.
 *
 * Ce module ne planifie rien : il valide et projette uniquement les faits que
 * la personne a confirmés. Une disponibilité n'est jamais une capacité
 * inférée ; sa source reste explicite jusque dans le moteur temporel.
 */

import type { DisponibiliteDeclaree } from "./types";

export const SOURCE_DISPONIBILITE_PROFIL = "declaree:profil";

export const ETAPES_CONTEXTE = [
  "periode",
  "modules",
  "disponibilites",
  "echeances",
] as const;

export type EtapeContexte = (typeof ETAPES_CONTEXTE)[number];

export interface EntreeDisponibiliteDeclaree {
  startsAt: string;
  endsAt: string;
  sourceRef?: string;
}

export interface LectureProgressionContexte {
  prochaineEtape: EtapeContexte | null;
  termine: boolean;
  confirmees: Record<EtapeContexte, boolean>;
}

function texteNonVide(valeur: unknown): valeur is string {
  return typeof valeur === "string" && valeur.trim().length > 0;
}

export function motifRefusPeriodeDeclaree(valeur: unknown): string | null {
  if (!texteNonVide(valeur)) return "une période déclarée non vide est attendue";
  if (valeur.trim().length > 120) return "la période déclarée est trop longue";
  return null;
}

export function motifRefusDisponibiliteDeclaree(
  valeur: unknown,
  chemin = "disponibilite",
): string | null {
  if (!valeur || typeof valeur !== "object" || Array.isArray(valeur)) {
    return `${chemin} doit être un objet`;
  }
  const entree = valeur as Record<string, unknown>;
  if (!texteNonVide(entree.startsAt) || !Number.isFinite(Date.parse(entree.startsAt))) {
    return `${chemin}.startsAt doit être une date ISO`;
  }
  if (!texteNonVide(entree.endsAt) || !Number.isFinite(Date.parse(entree.endsAt))) {
    return `${chemin}.endsAt doit être une date ISO`;
  }
  if (Date.parse(entree.endsAt) <= Date.parse(entree.startsAt)) {
    return `${chemin} doit se terminer après son début`;
  }
  if (entree.sourceRef !== undefined && !texteNonVide(entree.sourceRef)) {
    return `${chemin}.sourceRef doit être explicite`;
  }
  return null;
}

export function motifRefusDisponibilitesDeclarees(valeur: unknown): string | null {
  if (!Array.isArray(valeur)) return "un tableau de disponibilités est attendu";
  for (const [index, disponibilite] of valeur.entries()) {
    const motif = motifRefusDisponibiliteDeclaree(disponibilite, `disponibilites[${index}]`);
    if (motif) return motif;
  }
  return null;
}

export function normaliserDisponibilitesDeclarees(
  valeur: readonly EntreeDisponibiliteDeclaree[],
): DisponibiliteDeclaree[] {
  const motif = motifRefusDisponibilitesDeclarees(valeur);
  if (motif) throw new Error(`Disponibilités refusées : ${motif}.`);
  return valeur.map((disponibilite) => ({
    startsAt: disponibilite.startsAt,
    endsAt: disponibilite.endsAt,
    sourceRef: disponibilite.sourceRef?.trim() || SOURCE_DISPONIBILITE_PROFIL,
  }));
}

export function normaliserPeriodeDeclaree(valeur: string): string {
  const periode = valeur.trim();
  const motif = motifRefusPeriodeDeclaree(periode);
  if (motif) throw new Error(`Période refusée : ${motif}.`);
  return periode;
}

export function progressionContexte({
  periodeDeclaree,
  disponibilitesDeclarees,
  nombreEcheancesOuvertes,
  etapesIgnorees = [],
}: {
  periodeDeclaree?: string;
  disponibilitesDeclarees?: readonly DisponibiliteDeclaree[];
  nombreEcheancesOuvertes: number;
  etapesIgnorees?: readonly EtapeContexte[];
}): LectureProgressionContexte {
  const ignorees = new Set(etapesIgnorees);
  const confirmees: Record<EtapeContexte, boolean> = {
    periode: Boolean(periodeDeclaree?.trim()) || ignorees.has("periode"),
    // Les modules vivants sont déjà des domaines déclarés du référentiel. La
    // carte les relit mais ne redemande pas une confirmation administrative.
    modules: true,
    disponibilites: Boolean(disponibilitesDeclarees && disponibilitesDeclarees.length > 0) || ignorees.has("disponibilites"),
    echeances: nombreEcheancesOuvertes > 0 || ignorees.has("echeances"),
  };
  const prochaineEtape = ETAPES_CONTEXTE.find((etape) => !confirmees[etape]) ?? null;
  return {
    prochaineEtape,
    termine: prochaineEtape === null,
    confirmees,
  };
}
