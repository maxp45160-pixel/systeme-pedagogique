/**
 * Stockage de session du navigateur, isolé par compte.
 *
 * Sert au travail **en cours** qui ne mérite pas encore d'être écrit en base :
 * une conversation avec le tuteur, un brouillon d'exercice. Ce n'est pas une
 * dorsale — la seule reste Supabase (ADR-015) — et rien de ce qui est ici
 * n'entre dans le calcul d'une preuve ou d'un niveau.
 *
 * `sessionStorage` et non `localStorage` : la portée d'un onglet correspond à
 * celle d'une séance de travail, et rien ne survit à sa fermeture. Persister
 * indéfiniment côté client des échanges pédagogiques personnels demanderait une
 * décision de rétention qui n'a pas été prise.
 *
 * ⚠️ **Toute clé passe par `cleParCompte`.** ADR-029 vient de corriger une fuite
 * de profil entre comptes ; une clé partagée reproduirait la même faute d'un
 * cran plus bas. Deux comptes sur le même navigateur ne doivent jamais se voir.
 */

const PREFIXE = "systeme-pedagogique";

export function cleParCompte(usage: string, compteId: string): string {
  return `${PREFIXE}:${usage}:${compteId}`;
}

/**
 * Toutes les fonctions sont silencieuses en cas d'échec.
 *
 * `sessionStorage` lève en navigation privée stricte et quand le quota est
 * atteint. Aucun de ces cas ne justifie d'interrompre l'utilisateur : ce qui est
 * perdu est un confort, jamais une donnée que le système prétend détenir.
 */
export function lireSession<T>(cle: string): T | null {
  try {
    const brut = window.sessionStorage.getItem(cle);
    if (!brut) return null;
    return JSON.parse(brut) as T;
  } catch {
    return null;
  }
}

export function ecrireSession(cle: string, valeur: unknown): void {
  try {
    window.sessionStorage.setItem(cle, JSON.stringify(valeur));
  } catch {
    /* voir ci-dessus */
  }
}

export function effacerSession(cle: string): void {
  try {
    window.sessionStorage.removeItem(cle);
  } catch {
    /* voir ci-dessus */
  }
}
