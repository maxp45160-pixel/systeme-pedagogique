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
import { cleParCompte } from "@/lib/ui/stockage-session";

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

function cleCompte(cle: string, compteId: string): string {
  return cleParCompte(cle, compteId);
}

function lireDrapeau(cle: string, compteId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(cleCompte(cle, compteId)) === "1";
  } catch {
    return false;
  }
}

function poserDrapeau(cle: string, compteId: string, valeur: boolean): void {
  if (typeof window === "undefined") return;
  try {
    const cleIsolee = cleCompte(cle, compteId);
    if (valeur) window.localStorage.setItem(cleIsolee, "1");
    else window.localStorage.removeItem(cleIsolee);
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
export function profilageClientActif(compteId: string): boolean {
  if (typeof window === "undefined") return false;
  // La variable d'environnement active le profilage au démarrage.
  if (process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_PROFILAGE === "1") {
    return true;
  }
  // Sinon, on lit le drapeau runtime persisté.
  return lireDrapeau(CLE_DRAPEAU_CLIENT, compteId);
}

/** L'enregistrement client est-il en cours ? */
export function enregistrementActif(compteId: string): boolean {
  return profilageClientActif(compteId) && lireDrapeau(CLE_ENREGISTREMENT, compteId);
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
export function definirEnregistrement(compteId: string, actif: boolean): void {
  if (actif) {
    poserDrapeau(CLE_DRAPEAU_CLIENT, compteId, true);
    viderMesuresClient(compteId);
  }
  poserDrapeau(CLE_ENREGISTREMENT, compteId, actif);

  if (typeof document !== "undefined") {
    document.cookie = `profilage_enregistrement=${actif ? "1" : "0"}; path=/; max-age=${
      actif ? 86400 : 0
    }; SameSite=Lax`;
  }
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
  const handleStorage = (e: StorageEvent) => {
    if (e.key?.includes("profilage")) ecouteur();
  };
  window.addEventListener("storage", handleStorage);
  return () => {
    w.__profilageEcouteurs?.delete(ecouteur);
    window.removeEventListener("storage", handleStorage);
  };
}

const CLE_RENDUS = "profilage-rendus";
const CLE_INTERACTIONS = "profilage-interactions";

const MAX_RENDUS = 500;
const MAX_INTERACTIONS = 200;

function lire<T>(cle: string, compteId: string, defaut: T): T {
  if (!profilageClientActif(compteId)) return defaut;
  try {
    const brut = localStorage.getItem(cleCompte(cle, compteId));
    return brut ? (JSON.parse(brut) as T) : defaut;
  } catch {
    return defaut;
  }
}

let notificationEnAttente = false;
function notifierEcouteurs(): void {
  if (notificationEnAttente || typeof window === "undefined") return;
  notificationEnAttente = true;
  requestAnimationFrame(() => {
    notificationEnAttente = false;
    const ecouteurs = (
      window as unknown as { __profilageEcouteurs?: Set<() => void> }
    ).__profilageEcouteurs;
    ecouteurs?.forEach((fn) => {
      try {
        fn();
      } catch {
        // ignore
      }
    });
  });
}

function ecrire<T>(cle: string, compteId: string, valeur: T): void {
  if (!profilageClientActif(compteId)) return;
  try {
    localStorage.setItem(cleCompte(cle, compteId), JSON.stringify(valeur));
  } catch {
    // localStorage plein ou indisponible : on ignore.
  }
  notifierEcouteurs();
}

/** Callback React Profiler — enregistre chaque rendu. */
export const onRenderProfil = (compteId: string): ProfilerOnRenderCallback => (
  id,
  _phase,
  actualDuration,
  _baseDuration,
  startTime,
  commitTime,
) => {
  if (!enregistrementActif(compteId)) return;

  const rendus = lire<MesureRendu[]>(CLE_RENDUS, compteId, []);
  rendus.push({
    composant: id,
    dureeMs: actualDuration,
    renduMs: actualDuration,
    commitMs: commitTime - startTime,
    rendus: 1,
    horodatage: Date.now(),
  });
  // On ne garde que les 500 dernières mesures.
  ecrire(CLE_RENDUS, compteId, rendus.slice(-MAX_RENDUS));
};

/** Enregistre une interaction utilisateur. */
export function enregistrerInteraction(
  compteId: string,
  type: MesureInteraction["type"],
  libelle: string,
  dureeMs: number,
): void {
  if (!enregistrementActif(compteId)) return;

  const interactions = lire<MesureInteraction[]>(CLE_INTERACTIONS, compteId, []);
  interactions.push({ type, libelle, dureeMs, horodatage: Date.now() });
  ecrire(CLE_INTERACTIONS, compteId, interactions.slice(-MAX_INTERACTIONS));
}

/** Renvoie le nombre total de mesures enregistrées côté client. */
export function totalMesuresClient(compteId: string): number {
  const r = lire<MesureRendu[]>(CLE_RENDUS, compteId, []);
  const i = lire<MesureInteraction[]>(CLE_INTERACTIONS, compteId, []);
  return r.length + i.length;
}

/** Renvoie les mesures de rendu, agrégées par composant. */
export function rendusActuels(compteId: string): {
  parComposant: { composant: string; appels: number; totalMs: number; maxMs: number; moyenneMs: number }[];
  total: number;
} {
  const rendus = lire<MesureRendu[]>(CLE_RENDUS, compteId, []);
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
export function interactionsActuelles(compteId: string): MesureInteraction[] {
  return lire<MesureInteraction[]>(CLE_INTERACTIONS, compteId, []).sort(
    (a, b) => b.horodatage - a.horodatage,
  );
}

/** Vide toutes les mesures client. */
export function viderMesuresClient(compteId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(cleCompte(CLE_RENDUS, compteId));
    localStorage.removeItem(cleCompte(CLE_INTERACTIONS, compteId));
  } catch {
    // ignore
  }
}
