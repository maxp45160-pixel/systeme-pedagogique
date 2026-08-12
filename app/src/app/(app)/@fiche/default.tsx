/**
 * L'état par défaut du créneau `@fiche` : rien.
 *
 * Un créneau parallèle sans `default` fait échouer le rendu de toute route qui
 * ne le remplit pas — c'est-à-dire toutes, sauf l'interception. Ce fichier est
 * donc la condition pour que le reste de l'application continue de s'afficher.
 */
export default function AucuneFiche() {
  return null;
}
