/**
 * Profilage client — mesure des rendus React et des interactions.
 *
 * Utilise le `Profiler` de React pour capturer les durées de rendu par
 * composant, et `performance.now()` pour les interactions utilisateur.
 *
 * Les mesures sont stockées en mémoire (sessionStorage) et exposées sur
 * `/dev/profil`. Le profilage est actif uniquement en développement.
 */

"use client";

import type { ProfilerOnRenderCallback } from "react";

export interface MesureRendu {
  composant: string;
  dureeMs: number;
  /** Durée réelle de rendu (hors commit). */
  renduMs: number;
  /** Durée du commit (mise à jour du DOM). */
  commitMs: number;
  /** Nombre de rendus. */
  rendus: number;
  horodatage: number;
}

export interface MesureInteraction {
  type: "navigation" | "clic" | "saisie" | "autre";
  libelle: string;
  dureeMs: number;
  horodatage: number;
}

const ACTIF =
  typeof window !== "undefined" &&
  (process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_PROFILAGE === "1");

const CLE_RENDUS = "profilage-rendus";
const CLE_INTERACTIONS = "profilage-interactions";

const MAX_RENDUS = 200;
const MAX_INTERACTIONS = 100;

function lire<T>(cle: string, defaut: T): T {
  if (!ACTIF) return defaut;
  try {
    const brut = sessionStorage.getItem(cle);
    return brut ? (JSON.parse(brut) as T) : defaut;
  } catch {
    return defaut;
  }
}

function ecrire<T>(cle: string, valeur: T): void {
  if (!ACTIF) return;
  try {
    sessionStorage.setItem(cle, JSON.stringify(valeur));
  } catch {
    // sessionStorage plein ou indisponible : on ignore.
  }
}

/** Callback React Profiler — enregistre chaque rendu. */
export const onRenderProfil: ProfilerOnRenderCallback = (
  id,
  phase,
  actualDuration,
  baseDuration,
  startTime,
  commitTime,
) => {
  if (!ACTIF) return;

  const rendus = lire<MesureRendu[]>(CLE_RENDUS, []);
  rendus.push({
    composant: id,
    dureeMs: actualDuration,
    renduMs: actualDuration,
    commitMs: commitTime - startTime,
    rendus: 1,
    horodatage: Date.now(),
  });
  // On ne garde que les 200 dernières mesures.
  ecrire(CLE_RENDUS, rendus.slice(-MAX_RENDUS));
};

/** Enregistre une interaction utilisateur. */
export function enregistrerInteraction(
  type: MesureInteraction["type"],
  libelle: string,
  dureeMs: number,
): void {
  if (!ACTIF) return;

  const interactions = lire<MesureInteraction[]>(CLE_INTERACTIONS, []);
  interactions.push({ type, libelle, dureeMs, horodatage: Date.now() });
  ecrire(CLE_INTERACTIONS, interactions.slice(-MAX_INTERACTIONS));
}

/**
 * Mesure la durée d'une fonction et l'enregistre comme interaction.
 *
 * Accepte aussi bien une fonction synchrone qu'asynchrone : si la fonction
 * renvoie une promesse, la durée mesurée couvre sa résolution complète.
 */
export function mesurerInteraction<T>(
  type: MesureInteraction["type"],
  libelle: string,
  fn: () => T | PromiseLike<T>,
): T | PromiseLike<T> {
  if (!ACTIF) return fn();

  const debut = performance.now();
  try {
    const resultat = fn();
    if (resultat && typeof (resultat as PromiseLike<T>).then === "function") {
      return (resultat as PromiseLike<T>).then((valeur) => {
        enregistrerInteraction(type, libelle, performance.now() - debut);
        return valeur;
      });
    }
    enregistrerInteraction(type, libelle, performance.now() - debut);
    return resultat;
  } catch (e) {
    enregistrerInteraction(type, libelle, performance.now() - debut);
    throw e;
  }
}

/** Renvoie les mesures de rendu, agrégées par composant. */
export function rendusActuels(): {
  parComposant: { composant: string; appels: number; totalMs: number; maxMs: number; moyenneMs: number }[];
  total: number;
} {
  const rendus = lire<MesureRendu[]>(CLE_RENDUS, []);
  const parComposant = new Map<
    string,
    { composant: string; appels: number; totalMs: number; maxMs: number; moyenneMs: number }
  >();

  for (const r of rendus) {
    const e = parComposant.get(r.composant) ?? {
      composant: r.composant,
      appels: 0,
      totalMs: 0,
      maxMs: 0,
      moyenneMs: 0,
    };
    e.appels += 1;
    e.totalMs += r.dureeMs;
    e.maxMs = Math.max(e.maxMs, r.dureeMs);
    e.moyenneMs = e.totalMs / e.appels;
    parComposant.set(r.composant, e);
  }

  return {
    parComposant: [...parComposant.values()].sort((a, b) => b.totalMs - a.totalMs),
    total: rendus.length,
  };
}

/** Renvoie les interactions enregistrées. */
export function interactionsActuelles(): MesureInteraction[] {
  return lire<MesureInteraction[]>(CLE_INTERACTIONS, []).sort(
    (a, b) => b.horodatage - a.horodatage,
  );
}

/** Vide toutes les mesures client. */
export function viderMesuresClient(): void {
  if (!ACTIF) return;
  try {
    sessionStorage.removeItem(CLE_RENDUS);
    sessionStorage.removeItem(CLE_INTERACTIONS);
  } catch {
    // ignore
  }
}

/** Le profilage client est-il actif ? */
export function profilageClientActif(): boolean {
  return ACTIF;
}