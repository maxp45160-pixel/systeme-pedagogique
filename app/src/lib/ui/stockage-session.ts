/**
 * Stockage de session du navigateur, isolé par compte.
 *
 * Sert au travail **en cours** qui ne mérite pas encore d'être écrit en base :
 * une conversation avec le tuteur, un brouillon d'exercice. Ce n'est pas une
 * dorsale — la seule reste Supabase (ADR-015) — et rien de ce qui est ici
 * n'entre dans le calcul d'une observation ou d'un niveau.
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
 * Clé du fil de conversation du tuteur — un fil par exercice.
 *
 * Il n'y avait qu'une conversation par compte, quel que soit l'exercice
 * ouvert. Le contexte pédagogique envoyé au serveur, lui, suivait bien
 * l'exercice courant (`serialiserExerciceEnCours`) : l'historique affiché
 * parlait donc d'un exercice pendant que le tuteur en lisait un autre. Rien
 * n'était perdu, mais les deux se contredisaient, et seule la personne
 * pouvait s'en apercevoir.
 *
 * Sans exercice — le bouton flottant, une fiche compétence — le fil général
 * garde la clé historique : la renommer viderait les conversations ouvertes
 * au moment du déploiement.
 */
export function cleConversationTuteur(compteId: string, exerciceId?: string): string {
  return cleParCompte(
    exerciceId ? `conversation:exercice:${exerciceId}` : "conversation",
    compteId,
  );
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
