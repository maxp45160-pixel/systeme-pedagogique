/**
 * Ce que la réponse de Supabase à une inscription veut dire.
 *
 * Le défaut (25/08/2026) : toute réponse non-erreur était annoncée « Compte
 * créé. Ouvrez le lien de confirmation… » — même quand la personne tapait un
 * e-mail qui avait DÉJÀ un compte. Deux situations passaient alors pour un
 * succès :
 *
 * 1. **L'erreur explicite** — quand les confirmations sont désactivées,
 *    GoTrue répond `User already registered`. L'écran restait en mode
 *    inscription avec un message d'erreur brut, sans proposer la connexion.
 * 2. **Le masquage** — quand les confirmations sont activées, Supabase
 *    documente qu'une inscription sur une adresse déjà prise répond un succès
 *    SANS session, avec un utilisateur dont la liste `identities` est VIDE :
 *    c'est délibéré, pour ne pas révéler l'existence du compte (protection
 *    contre l'énumération). Annoncer « Compte créé » dans ce cas est un mensonge
 *    — aucun e-mail ne partira jamais.
 *
 * La règle vit ici, pure et testée, parce qu'elle doit être exacte dans les
 * deux sens : basculer vers la connexion au moindre doute affaiblirait la
 * protection elle-même (on confirmerait l'existence d'un compte que Supabase
 * refuse de confirmer). Le cas ambigu reste donc AMBIGU : message neutre, et
 * un geste explicite vers la connexion — jamais une redirection automatique.
 *
 * Le parcours Google ne passe pas ici : OAuth redirige via `/auth/callback`,
 * il n'y a rien à classer.
 */

/** Ce que le formulaire lit dans la réponse de `auth.signUp`. Volontairement minimal. */
export interface ReponseInscription {
  error?: { message: string } | null;
  /** Session posée directement : la confirmation par e-mail est désactivée. */
  session?: unknown;
  /** Utilisateur renvoyé — sa liste `identities` porte le seul signal de masquage. */
  user?: { identities?: readonly unknown[] | null } | null;
}

export type ClassificationInscription =
  /** Erreur explicite : l'adresse a déjà un compte. */
  | { cas: "compte-existant" }
  /**
   * Succès sans session ni identité : Supabase masque peut-être un compte
   * existant. Ne se prononce PAS.
   */
  | { cas: "existe-peut-etre" }
  /** Nouveau compte créé ; un e-mail de confirmation part. */
  | { cas: "confirmation-envoyee" }
  /** Compte créé ET session ouverte : confirmation désactivée côté projet. */
  | { cas: "connecte" }
  /** Toute autre erreur, à afficher telle quelle. */
  | { cas: "erreur"; message: string };

/**
 * Les formulations d'erreur connues pour « cette adresse a déjà un compte ».
 * GoTrue répond en anglais (« User already registered ») ; les variantes
 * francophones couvrent un éventuel proxy localisé.
 */
const MOTIF_COMPTE_EXISTANT =
  /already\s+(registered|exist)|already\s+been\s+registered|déjà\s+inscrit|existe\s+déjà/i;

export function classerInscription(reponse: ReponseInscription): ClassificationInscription {
  if (reponse.error) {
    return MOTIF_COMPTE_EXISTANT.test(reponse.error.message)
      ? { cas: "compte-existant" }
      : { cas: "erreur", message: reponse.error.message };
  }

  if (reponse.session) return { cas: "connecte" };

  /*
   * Sans session, un NOUVEL enregistrement renvoie un utilisateur portant UNE
   * identité (l'e-mail, en attente de confirmation). Une liste vide est le
   * marqueur documenté du compte masqué.
   */
  if (Array.isArray(reponse.user?.identities)) {
    return reponse.user.identities.length === 0
      ? { cas: "existe-peut-etre" }
      : { cas: "confirmation-envoyee" };
  }

  // Réponse atypique (utilisateur absent) : rester du côté du message neutre,
  // jamais d'un « Compte créé » affirmé.
  return { cas: "existe-peut-etre" };
}
