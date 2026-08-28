/**
 * Résolution unifiée de l'identité utilisateur.
 *
 * Consolide les métadonnées issues du fournisseur d'authentification (Google SSO,
 * email/password), de la table `profiles` de PostgreSQL et des valeurs par défaut.
 *
 * Règle métier :
 * - Le nom priorise un prénom/nom personnalisé dans le profil (s'il n'est pas le
 *   défaut « Utilisateur »), puis les claims OAuth (`full_name`, `name`,
 *   `given_name` + `family_name`, `user_name`), puis le préfixe du mail (`split('@')[0]`),
 *   puis « Compte ».
 * - L'avatar vérifie `avatar_url`, `picture` (standard OIDC Google), `avatar` ou
 *   l'avatar stocké dans le profil PostgreSQL.
 */

export interface IdentiteUtilisateur {
  /** Nom d'affichage pour les en-têtes, le rail et les cartes de profil. */
  nom: string;
  /** URL de l'avatar photo (si disponible). */
  avatarUrl: string | null;
  /** Initiale de repli pour les avatars textuels. */
  initiale: string;
}

export interface DonneesCompteAuth {
  id?: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}

export interface DonneesProfil {
  prenom?: string | null;
  avatarUrl?: string | null;
}

/**
 * Prénom court pour une salutation. Un identifiant de courriel de repli ne
 * constitue pas un nom d'affichage : `maxime.peyredieu` devient donc
 * « Maxime », tandis qu'un nom déclaré garde son premier mot.
 */
export function prenomPourSalutation(
  identite: IdentiteUtilisateur,
  compte?: DonneesCompteAuth | null,
): string {
  const nom = identite.nom.trim();
  if (nom.length === 0) return "Compte";
  const emailPart =
    typeof compte?.email === "string" && compte.email.includes("@")
      ? compte.email.split("@")[0].trim()
      : null;
  const nomIssuDuCourriel = Boolean(emailPart && nom.toLowerCase() === emailPart.toLowerCase());
  const candidat = (nomIssuDuCourriel ? nom.split(/[._-]+/u)[0] : nom.split(/\s+/u)[0]).trim();
  if (candidat.length === 0) return "Compte";
  return candidat.charAt(0).toLocaleUpperCase("fr-FR") + candidat.slice(1);
}

export function resoudreIdentite(
  compte?: DonneesCompteAuth | null,
  profil?: DonneesProfil | null,
): IdentiteUtilisateur {
  const meta = compte?.user_metadata ?? {};

  // 1. Résolution de l'URL d'avatar
  const avatarCandidats = [
    typeof profil?.avatarUrl === "string" ? profil.avatarUrl.trim() : null,
    typeof meta.avatar_url === "string" ? (meta.avatar_url as string).trim() : null,
    typeof meta.picture === "string" ? (meta.picture as string).trim() : null,
    typeof meta.avatar === "string" ? (meta.avatar as string).trim() : null,
  ];
  const avatarUrl = avatarCandidats.find((url) => Boolean(url && url.length > 0)) ?? null;

  const emailPart =
    typeof compte?.email === "string" && compte.email.includes("@")
      ? compte.email.split("@")[0].trim()
      : null;

  // 2. Résolution du nom : un prénom en base n'est prioritaire sur les claims OAuth
  // que s'il a été explicitement saisi (différent de "Utilisateur" et du préfixe d'e-mail automatique).
  const prenomProfil = (() => {
    if (typeof profil?.prenom !== "string") return null;
    const p = profil.prenom.trim();
    if (p.length === 0 || p === "Utilisateur") return null;
    if (emailPart && p.toLowerCase() === emailPart.toLowerCase()) return null;
    return p;
  })();

  const fullNameMeta =
    typeof meta.full_name === "string" && meta.full_name.trim().length > 0
      ? meta.full_name.trim()
      : null;

  const nameMeta =
    typeof meta.name === "string" && meta.name.trim().length > 0 ? meta.name.trim() : null;

  const givenFamilyMeta = (() => {
    const given = typeof meta.given_name === "string" ? meta.given_name.trim() : "";
    const family = typeof meta.family_name === "string" ? meta.family_name.trim() : "";
    const combined = `${given} ${family}`.trim();
    return combined.length > 0 ? combined : null;
  })();

  const userNameMeta =
    typeof meta.user_name === "string" && meta.user_name.trim().length > 0
      ? meta.user_name.trim()
      : typeof meta.preferred_username === "string" && meta.preferred_username.trim().length > 0
      ? meta.preferred_username.trim()
      : null;



  const nom =
    prenomProfil ??
    fullNameMeta ??
    nameMeta ??
    givenFamilyMeta ??
    userNameMeta ??
    emailPart ??
    (typeof profil?.prenom === "string" && profil.prenom.trim().length > 0
      ? profil.prenom.trim()
      : "Compte");

  const premiereLettre = nom.trim().charAt(0).toUpperCase();
  const initiale = premiereLettre || "C";

  return {
    nom,
    avatarUrl,
    initiale,
  };
}
