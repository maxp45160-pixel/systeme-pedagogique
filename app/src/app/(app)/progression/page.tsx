import { redirect } from "next/navigation";

/**
 * La progression vit dans le pôle Compétences (ADR-061) : cette route redirige
 * vers `/competences` pour ne pas casser les liens existants — bookmarks,
 * historique, liens internes pas encore mis à jour.
 */
export default function PageProgression() {
  redirect("/competences");
}
