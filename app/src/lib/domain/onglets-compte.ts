/**
 * Les onglets du compte — une seule définition, partagée par la page (serveur)
 * et le panneau (client).
 *
 * La liste vit ici et non dans le composant : un export d'un module
 * `"use client"` appelé depuis un composant serveur est une référence client,
 * pas une fonction — l'appeler pendant le rendu serveur casse la page.
 */

/** Les identifires valides : le paramètre `?onglet=` ne peut rien inventer. */
export const ONGLETS_COMPTE = ["profil", "tuteur", "preferences", "donnees"] as const;

export type OngletCompte = (typeof ONGLETS_COMPTE)[number];

export function estOngletCompte(valeur: string | undefined): valeur is OngletCompte {
  return (ONGLETS_COMPTE as readonly string[]).includes(valeur ?? "");
}

/**
 * Un retour est un chemin interne : il commence par « / » et n'est pas
 * protocol-relative. Tout le reste — `//exemple.com`, une URL absolue, du
 * bruit — est jeté : le paramètre `?retour=` ne peut jamais servir de
 * redirection ouverte.
 */
export function cheminRetourSain(brut?: string): string | undefined {
  if (!brut) return undefined;
  return brut.startsWith("/") && !brut.startsWith("//") ? brut : undefined;
}
