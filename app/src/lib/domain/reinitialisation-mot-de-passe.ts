/**
 * Validation de la redéfinition de mot de passe.
 *
 * Logique pure, partagée par le formulaire client : aucune dépendance, aucun
 * accès réseau — le seul travail est de refuser localement ce que le serveur
 * d'authentification refuserait de toute façon (longueur minimale imposée par
 * Supabase Auth) et ce que lui ne peut pas voir (la confirmation).
 */

export const LONGUEUR_MINIMALE_MOT_DE_PASSE = 8;

export type VerdictRedefinition =
  | { valide: true; motDePasse: string }
  | { valide: false; erreurMotDePasse?: string; erreurConfirmation?: string };

export function validerRedefinition(
  motDePasse: string,
  confirmation: string,
): VerdictRedefinition {
  const erreurMotDePasse =
    motDePasse.length < LONGUEUR_MINIMALE_MOT_DE_PASSE
      ? `${LONGUEUR_MINIMALE_MOT_DE_PASSE} caractères minimum.`
      : undefined;
  const erreurConfirmation =
    !erreurMotDePasse && confirmation !== motDePasse
      ? "Les deux mots de passe ne concordent pas."
      : undefined;

  if (erreurMotDePasse || erreurConfirmation) {
    return { valide: false, erreurMotDePasse, erreurConfirmation };
  }
  return { valide: true, motDePasse };
}
