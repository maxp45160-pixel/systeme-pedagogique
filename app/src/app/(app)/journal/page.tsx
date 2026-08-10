import { redirect } from "next/navigation";

/**
 * Le journal est une vue du pôle Séances (ADR-053) : `?vue=journal`. Cette
 * route redirige pour ne pas casser les liens existants.
 */
export default function PageJournal() {
  redirect("/seances?vue=journal");
}
