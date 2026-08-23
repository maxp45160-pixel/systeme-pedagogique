/**
 * Préférences d'outils de séance — stockage navigateur isolé par compte.
 *
 * Le réglage « calculatrice affichée dans les outils de séance » est une
 * préférence d'appareil sans contenu pédagogique : elle vit en `localStorage`
 * via `cleParCompte` (ADR-029), jamais en base — aucune migration ni surface
 * RLS pour un confort d'interface.
 */

import { cleParCompte, ecrireLocal, lireLocal } from "./stockage-local";

const CLE_PREFERENCES = "preferences-outils";

/** Événement diffusé à chaque écriture, pour mise à jour sans rechargement. */
export const EVENEMENT_PREFERENCES_OUTILS = "systeme-pedagogique:preferences-outils";

export interface PreferencesOutils {
  /** La calculatrice scientifique apparaît dans les outils de séance. */
  calculatrice?: boolean;
}

const DEFAUT: Required<Pick<PreferencesOutils, "calculatrice">> = { calculatrice: true };

export function lirePreferencesOutils(compteId: string): PreferencesOutils {
  if (!compteId) return { ...DEFAUT };
  return { ...DEFAUT, ...lireLocal<PreferencesOutils>(cleParCompte(CLE_PREFERENCES, compteId)) };
}

/**
 * La calculatrice est-elle affichée ? Vrai par défaut.
 *
 * Le repli sur `DEFAUT` n'est pas une formalité de typage. `lireLocal` rend le
 * JSON du navigateur **sans le valider**, et l'étalement écrase alors le défaut
 * par ce qu'il trouve : un `{"calculatrice": null}` — écrit à la main, ou
 * laissé par une version antérieure de cette forme — rendrait `null`, donc une
 * calculatrice masquée sans que rien ne puisse l'expliquer. Une donnée illisible
 * ne fabrique pas une valeur : elle retombe sur le défaut déclaré.
 */
export function calculatriceActive(compteId: string): boolean {
  return lirePreferencesOutils(compteId).calculatrice ?? DEFAUT.calculatrice;
}

export function ecrirePreferencesOutils(compteId: string, preferences: PreferencesOutils): void {
  if (!compteId) return;
  ecrireLocal(cleParCompte(CLE_PREFERENCES, compteId), { ...lirePreferencesOutils(compteId), ...preferences });
  window.dispatchEvent(new CustomEvent(EVENEMENT_PREFERENCES_OUTILS));
}

/** Abonnement pour `useSyncExternalStore` — la préférence est un store externe. */
export function sAbonnerPreferencesOutils(callback: () => void): () => void {
  window.addEventListener(EVENEMENT_PREFERENCES_OUTILS, callback);
  return () => window.removeEventListener(EVENEMENT_PREFERENCES_OUTILS, callback);
}
