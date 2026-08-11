import { redirect } from "next/navigation";

/**
 * L'ancien `/exercices` est absorbé par le pôle Séances (ADR-061) : cette route
 * redirige vers `/seances` — conservée pour ne pas casser les liens existants
 * (bookmarks, historique, liens internes). La fiche `/exercices/[id]`, elle,
 * reste là où elle est : c'est l'écran unitaire que la séance déroule.
 */
export default function PageExercices() {
  redirect("/seances");
}
