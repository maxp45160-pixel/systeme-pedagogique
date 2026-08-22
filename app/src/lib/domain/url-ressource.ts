/**
 * Validation d'une URL de ressource-lien — une seule implémentation, côté
 * serveur comme côté interface.
 *
 * Un lien est une adresse déclarée par la personne : l'application ne le
 * scrape pas, n'en déduit rien et ne le convertit jamais en Connaissance.
 * La validation refuse donc tout ce qui n'est pas une URL http(s) absolue —
 * les schémas `javascript:`, `data:` ou `file:` n'ont rien à faire dans un
 * corpus consultable.
 */

/** Longueur maximale d'une URL stockée dans le front-matter. */
export const LONGUEUR_URL_MAX = 2048;

export type ResultatValidationUrl =
  | { valide: true; url: string }
  | { valide: false; erreur: string };

/**
 * Valide et normalise une URL saisie. Retourne l'URL normalisée (le parseur
 * WHATWG ajoute le chemin `/` et encode ce qui doit l'être), ou le motif
 * du refus.
 */
export function validerUrlRessource(valeur: string): ResultatValidationUrl {
  const propre = valeur.trim();
  if (!propre) {
    return { valide: false, erreur: "L’adresse du lien est obligatoire." };
  }
  if (/[\s<>"'`]/.test(propre)) {
    return { valide: false, erreur: "L’adresse ne doit contenir ni espace ni caractère spécial." };
  }
  if (propre.length > LONGUEUR_URL_MAX) {
    return { valide: false, erreur: `L’adresse dépasse ${LONGUEUR_URL_MAX} caractères.` };
  }

  let url: URL;
  try {
    url = new URL(propre);
  } catch {
    return { valide: false, erreur: "Cette adresse n’est pas une URL valide." };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { valide: false, erreur: "Seules les adresses http et https sont acceptées." };
  }
  if (!url.hostname || !url.hostname.includes(".")) {
    return { valide: false, erreur: "L’adresse doit pointer vers un hôte valide." };
  }

  return { valide: true, url: url.toString() };
}
