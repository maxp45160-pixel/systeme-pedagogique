/**
 * Profilage client — mesure des rendus React et des interactions.
 *
 * Utilise le `Profiler` de React pour capturer les durées de rendu par
 * composant, et `performance.now()` pour les interactions utilisateur.
 *
 * Deux notions distinctes, symétriques de celles du profilage serveur :
 *
 *   * **disponible** (`profilageClientActif`) — l'outillage peut mesurer.
 *     Vrai en `NODE_ENV=development`, avec `NEXT_PUBLIC_PROFILAGE=1`, ou dès
 *     qu'un « Démarrer » a levé le drapeau runtime : plus besoin de relancer
 *     le serveur avec une variable d'environnement ;
 *   * **en cours d'enregistrement** (`enregistrementActif`) — on collecte
 *     *maintenant*. À l'arrêt par défaut.
 *
 * Sans cette séparation, en développement, la collecte ne s'arrête jamais :
 * toute navigation depuis le montage de l'application noie la mesure que l'on
 * cherche à isoler.
 *
 * Les mesures vont dans `sessionStorage` ; les deux drapeaux dans
 * `localStorage`, pour survivre à un rechargement de page — sinon il faudrait
 * redémarrer l'enregistrement à chaque navigation dure, ce qui contredirait
 * l'usage auquel il sert (profiler pendant qu'on utilise l'application).
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

const CLE_DRAPEAU_CLIENT = "profilage-client-actif";
const CLE_ENREGISTREMENT = "profilage-client-enregistre";

function lireDrapeau(cle: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(cle) === "1";
  } catch {
    return false;
  }
}

function poserDrapeau(cle: string, valeur: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (valeur) window.localStorage.setItem(cle, "1");
    else window.localStorage.removeItem(cle);
  } catch {
    // localStorage indisponible : on ignore.
  }
  // Notifier les abonnés (useSyncExternalStore) pour un rafraîchissement immédiat.
  const ecouteurs = (
    window as unknown as { __profilageEcouteurs?: Set<() => void> }
  ).__profilageEcouteurs;
  ecouteurs?.forEach((fn) => fn());
}

/**
 * Le profilage client est-il disponible ?
 *
 * Lecture à chaque appel : le drapeau peut changer au runtime, et les
 * fonctions ci-dessous (`onRenderProfil`, `enregistrerInteraction`) le lisent
 * à chaud.
 */
export function profilageClientActif(): boolean {
  if (typeof window === "undefined") return false;
  // La variable d'environnement active le profilage au démarrage.
  if (process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_PROFILAGE === "1") {
    return true;
  }
  // Sinon, on lit le drapeau runtime persisté.
  return lireDrapeau(CLE_DRAPEAU_CLIENT);
}

/** L'enregistrement client est-il en cours ? */
export function enregistrementActif(): boolean {
  return profilageClientActif() && lireDrapeau(CLE_ENREGISTREMENT);
}

/**
 * Démarre ou arrête l'enregistrement client.
 *
 * Démarrer lève aussi le drapeau de disponibilité — c'est ce qui permet de
 * profiler un build où aucune variable d'environnement ne l'a demandé — et
 * vide les mesures précédentes : une session commence sur une table nette.
 *
 * Arrêter conserve les mesures : on arrête pour lire ce que l'on vient de
 * mesurer. Le bouton « Vider » est là pour les effacer, sur demande.
 */
export function definirEnregistrement(actif: boolean): void {
  if (actif) {
    poserDrapeau(CLE_DRAPEAU_CLIENT, true);
    viderMesuresClient();
  }
  poserDrapeau(CLE_ENREGISTREMENT, actif);
}

/**
 * Abonnement au changement d'état du profilage client.
 *
 * `useSyncExternalStore` appelle cette fonction pour s'abonner ; quand un
 * drapeau change (via `poserDrapeau`), l'écouteur est notifié et le composant
 * se re-rend avec la nouvelle valeur.
 */
export function abonnerProfilageClient(ecouteur: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const w = window as unknown as { __profilageEcouteurs?: Set<() => void> };
  if (!w.__profilageEcouteurs) w.__profilageEcouteurs = new Set();
  w.__profilageEcouteurs.add(ecouteur);
  return () => {
    w.__profilageEcouteurs?.delete(ecouteur);
  };
}

const CLE_RENDUS = "profilage-rendus";
const CLE_INTERACTIONS = "profilage-interactions";

const MAX_RENDUS = 200;
const MAX_INTERACTIONS = 100;

function lire<T>(cle: string, defaut: T): T {
  if (!profilageClientActif()) return defaut;
  try {
    const brut = sessionStorage.getItem(cle);
    return brut ? (JSON.parse(brut) as T) : defaut;
  } catch {
    return defaut;
  }
}

function ecrire<T>(cle: string, valeur: T): void {
  if (!profilageClientActif()) return;
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
  if (!enregistrementActif()) return;

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
  if (!enregistrementActif()) return;

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
  if (!enregistrementActif()) return fn();

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
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(CLE_RENDUS);
    sessionStorage.removeItem(CLE_INTERACTIONS);
  } catch {
    // ignore
  }
}
