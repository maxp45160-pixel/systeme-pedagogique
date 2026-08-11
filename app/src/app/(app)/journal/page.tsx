import { redirect } from "next/navigation";

/**
 * Le journal est remplacé par le cahier du pôle Séances (ADR-061) : cette route
 * redirige vers `/seances` pour ne pas casser les liens existants (bookmarks,
 * historique, liens internes).
 */
export default function PageJournal() {
  redirect("/seances");
}
