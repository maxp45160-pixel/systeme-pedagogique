/**
 * Faits de contexte déclarés pour l'orchestration temporelle.
 *
 * Ce module ne planifie rien : il valide et projette uniquement les faits que
 * la personne a confirmés. Une disponibilité n'est jamais une capacité
 * inférée ; sa source reste explicite jusque dans le moteur temporel.
 */

import type { DisponibiliteDeclaree } from "./types";

export const SOURCE_DISPONIBILITE_PROFIL = "declaree:profil";

export interface EntreeDisponibiliteDeclaree {
  startsAt: string;
  endsAt: string;
  sourceRef?: string;
}

function texteNonVide(valeur: unknown): valeur is string {
  return typeof valeur === "string" && valeur.trim().length > 0;
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
  for (let premier = 0; premier < valeur.length; premier += 1) {
    const gauche = valeur[premier] as EntreeDisponibiliteDeclaree;
    for (let second = premier + 1; second < valeur.length; second += 1) {
      const droite = valeur[second] as EntreeDisponibiliteDeclaree;
      if (
        Date.parse(gauche.startsAt) < Date.parse(droite.endsAt) &&
        Date.parse(droite.startsAt) < Date.parse(gauche.endsAt)
      ) {
        return `disponibilites[${premier}] et disponibilites[${second}] se chevauchent`;
      }
    }
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

export function ajouterDisponibiliteDeclaree(
  existantes: readonly DisponibiliteDeclaree[],
  entree: EntreeDisponibiliteDeclaree,
): DisponibiliteDeclaree[] {
  return normaliserDisponibilitesDeclarees([...existantes, entree]);
}

export function modifierDisponibiliteDeclaree(
  existantes: readonly DisponibiliteDeclaree[],
  index: number,
  entree: EntreeDisponibiliteDeclaree,
): DisponibiliteDeclaree[] {
  if (!Number.isInteger(index) || index < 0 || index >= existantes.length) {
    throw new Error("Le créneau à modifier est introuvable.");
  }
  return normaliserDisponibilitesDeclarees(
    existantes.map((creneau, position) => (position === index ? entree : creneau)),
  );
}

export function supprimerDisponibiliteDeclaree(
  existantes: readonly DisponibiliteDeclaree[],
  index: number,
): DisponibiliteDeclaree[] {
  if (!Number.isInteger(index) || index < 0 || index >= existantes.length) {
    throw new Error("Le créneau à supprimer est introuvable.");
  }
  return normaliserDisponibilitesDeclarees(
    existantes.filter((_, position) => position !== index),
  );
}
