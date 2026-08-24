/**
 * Le titre d'une fiche de cours dérivée du nom du fichier déposé.
 *
 * « Déposer mon cours » commence par le PDF, pas par une saisie : le titre de
 * la fiche support se déduit donc du nom du fichier, et reste modifiable
 * ensuite dans l'espace de travail. Aucun mot n'est inventé : on nettoie des
 * séparateurs, on ne résume pas.
 */

const TITRE_DEFAUT = "Cours sans titre";

export function titreDepuisNomFichier(nom: string): string {
  const sansExtension = nom.replace(/\.[^.]+$/, "");
  const lisible = sansExtension
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!lisible) return TITRE_DEFAUT;
  return lisible.charAt(0).toLocaleUpperCase("fr-FR") + lisible.slice(1);
}
