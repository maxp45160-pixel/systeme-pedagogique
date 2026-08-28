/**
 * Préférences d'affichage qui survivent à la fermeture de l'onglet.
 *
 * ## Pourquoi un module à côté de `stockage-session.ts`
 *
 * Celui-là a choisi `sessionStorage` **délibérément** : il porte des
 * conversations avec le tuteur et des brouillons, c'est-à-dire des échanges
 * pédagogiques personnels, et les persister indéfiniment côté client
 * demanderait une décision de rétention qui n'a pas été prise.
 *
 * Ici vivent les préférences d'appareil sans contenu pédagogique — `theme`,
 * `rail` (décision du 21/08/2026) — et des marqueurs d'interface facultatifs
 * isolés par compte, comme les étapes ignorées de l'assistant de période. Ces
 * marqueurs ne contiennent aucun fait pédagogique et ne remplacent jamais
 * Supabase. Le cahier, lui, n'y stocke plus
 * rien : son marque-page rouvrait la lecture plusieurs jours en arrière,
 * une friction plutôt qu'un confort — il ouvre désormais toujours sur la
 * page du jour.
 *
 * ⚠️ Toute clé de données passe par `cleParCompte` (ADR-029) : deux comptes
 * sur le même navigateur ne doivent jamais se voir. Les préférences globales
 * `theme` et `rail` sont l'exception documentée : elles ne portent aucune
 * donnée pédagogique ni identifiable.
 *
 * Rien de ce qui est ici n'entre dans le calcul d'une observation ou d'un niveau, et
 * la dorsale reste Supabase (ADR-015).
 */

import { cleParCompte } from "./stockage-session";

export { cleParCompte };

/**
 * Silencieuses en cas d'échec, pour la même raison que leurs jumelles de
 * session : `localStorage` lève en navigation privée stricte et au quota, et ce
 * qui est perdu est un confort — jamais une donnée que le système prétend
 * détenir.
 */
export function lireLocal<T>(cle: string): T | null {
  try {
    const brut = window.localStorage.getItem(cle);
    if (!brut) return null;
    return JSON.parse(brut) as T;
  } catch {
    return null;
  }
}

export function ecrireLocal(cle: string, valeur: unknown): void {
  try {
    window.localStorage.setItem(cle, JSON.stringify(valeur));
  } catch {
    /* voir ci-dessus */
  }
}

/**
 * Accès bruts, pour les valeurs qui ne sont pas du JSON sérialisable ou qui
 * n'ont pas besoin de l'être (un drapeau `"1"`, un marqueur simple).
 * Même silence que leurs jumelles typées.
 */
export function lireLocalSimple(cle: string): string | null {
  try {
    return window.localStorage.getItem(cle);
  } catch {
    return null;
  }
}

export function ecrireLocalSimple(cle: string, valeur: string): void {
  try {
    window.localStorage.setItem(cle, valeur);
  } catch {
    /* voir ci-dessus */
  }
}

export function effacerLocal(cle: string): void {
  try {
    window.localStorage.removeItem(cle);
  } catch {
    /* voir ci-dessus */
  }
}
