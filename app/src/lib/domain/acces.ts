/**
 * Rôle et état d'accès d'un compte — couche domaine pure (ADR-074).
 *
 * Ce fichier ne parle ni à Supabase ni à React. Il détient les deux règles que
 * l'interface et la base doivent appliquer **identiquement** : qui peut agir
 * sur qui, et ce qu'un compte suspendu conserve.
 *
 * Les mêmes règles existent en SQL, dans le trigger `garde_comptes_acces`.
 * Ce n'est pas une duplication : la base est la barrière — elle refuse même si
 * l'interface se trompe — et cette couche existe pour **désactiver le bouton
 * avant le clic**, avec la raison écrite à côté. Un garde-fou qui n'apparaît
 * qu'après coup, sous forme d'erreur PostgreSQL, n'est pas une interface.
 */

export const ROLES = ["membre", "admin"] as const;

export type RoleCompte = (typeof ROLES)[number];

export function estRoleConnu(valeur: string): valeur is RoleCompte {
  return (ROLES as readonly string[]).includes(valeur);
}

export const LIBELLES_ROLE: Record<RoleCompte, string> = {
  membre: "Membre",
  admin: "Administrateur",
};

/** Une ligne du panel : identité, accès, et des compteurs — jamais du contenu. */
export interface CompteAdministre {
  userId: string;
  email: string | null;
  prenom: string | null;
  role: RoleCompte;
  /** ISO, ou `null` si l'accès est ouvert. */
  suspenduLe: string | null;
  motif: string | null;
  creeLe: string | null;
  observations: number;
  exercices: number;
  seances: number;
  competences: number;
  derniereActivite: string | null;
  /** Générations offertes par mois sur la clé serveur (ADR-116). */
  quotaMensuel: number;
  /** Générations déjà consommées sur le mois courant. Zéro si la période a tourné. */
  quotaAppels: number;
}

export function estSuspendu(compte: CompteAdministre): boolean {
  return compte.suspenduLe !== null;
}

/**
 * Pourquoi une action d'accès est refusée, ou `null` si elle est permise.
 *
 * Renvoie le motif plutôt qu'un booléen : l'écran doit pouvoir écrire à côté
 * du bouton grisé pourquoi il l'est. Un `false` nu obligerait chaque appelant à
 * redevenir la règle pour la formuler.
 */
export type RefusAcces = string | null;

/**
 * Trois interdits, dans l'ordre où on les rencontre.
 *
 * 1. **Soi-même.** Se retirer son propre rôle ou se suspendre est le seul geste
 *    de cet écran qu'on ne peut pas défaire ensuite — il faut un autre admin,
 *    ou un accès SQL.
 * 2. **Le dernier administrateur.** Le rôle ne s'accorde que depuis ce panel :
 *    le retirer au dernier admin ferme la porte de l'intérieur.
 * 3. Rien d'autre. Suspendre un membre, promouvoir, réactiver : permis.
 */
export function refusChangementRole(
  cible: CompteAdministre,
  nouveauRole: RoleCompte,
  moiId: string,
): RefusAcces {
  if (cible.role === nouveauRole) return "Ce compte a déjà ce rôle.";
  if (cible.userId === moiId) return "Tu ne peux pas modifier ton propre rôle.";
  if (cible.role === "admin" && nouveauRole !== "admin") {
    return "Un administrateur ne peut pas être rétrogradé.";
  }
  return null;
}

export function refusSuspension(
  cible: CompteAdministre,
  moiId: string,
): RefusAcces {
  if (estSuspendu(cible)) return "Ce compte est déjà suspendu.";
  if (cible.userId === moiId) return "Tu ne peux pas suspendre ton propre accès.";
  if (cible.role === "admin") {
    return "Un administrateur ne peut pas être suspendu.";
  }
  return null;
}

export function refusReactivation(cible: CompteAdministre): RefusAcces {
  return estSuspendu(cible) ? null : "Ce compte n'est pas suspendu.";
}

/** Un motif de suspension est facultatif, mais jamais un blanc déguisé. */
export const MOTIF_MAX = 200;

export function normaliserMotif(motif: string): string | null {
  const propre = motif.trim().replace(/\s+/g, " ").slice(0, MOTIF_MAX);
  return propre.length > 0 ? propre : null;
}
