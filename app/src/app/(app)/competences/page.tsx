import { redirect } from "next/navigation";

/**
 * Compatibilité des anciens favoris : l'Atelier est désormais l'unique
 * surface de consultation du référentiel et du graphe.
 */
export default function PageCompetences() {
  redirect("/atelier");
}
