import { redirect } from "next/navigation";

/**
 * L'ancien `/exercices` est devenu la vue « Bibliothèque » du pôle Séances
 * (ADR-053). Cette route redirige vers `/seances?vue=bibliotheque` — elle est
 * conservée pour ne pas casser les liens existants (bookmarks, historique,
 * liens internes pas encore mis à jour). La fiche `/exercices/[id]`, elle,
 * reste là où elle est : c'est l'écran unitaire que la séance déroule.
 */
export default function PageExercices() {
  redirect("/seances?vue=bibliotheque");
}
