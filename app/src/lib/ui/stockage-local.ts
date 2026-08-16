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
 * Un marque-page n'est rien de tout cela : c'est une date, celle de la page du
 * cahier qu'on regardait. Sa valeur est précisément de survivre à la fermeture
 * — un marque-page qui tombe quand on referme le cahier n'est pas un
 * marque-page. Les deux modules coexistent donc, chacun avec la portée que son
 * contenu justifie, plutôt qu'un seul qui trancherait mal pour l'un des deux.
 *
 * ⚠️ **Toute clé passe par `cleParCompte`** (ADR-029) : deux comptes sur le même
 * navigateur ne doivent jamais se voir, fût-ce à travers une date.
 *
 * Rien de ce qui est ici n'entre dans le calcul d'une preuve ou d'un niveau, et
 * la dorsale reste Supabase (ADR-015).
 */

import { cleParCompte } from "./stockage-session";

export { cleParCompte };

/** Clé du marque-page du cahier — la dernière page consultée. */
export function cleMarquePage(compteId: string): string {
  return cleParCompte("cahier:marque-page", compteId);
}

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
