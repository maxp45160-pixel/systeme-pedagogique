import { redirect } from "next/navigation";

/**
 * Le journal est fusionné dans `/competences` (lot 4) : il y est un panneau du
 * pôle Suivi, pas un écran séparé — la navigation à trois pôles ne le
 * référence plus.
 *
 * Cette route redirige vers la vue « Journal ». Elle est conservée pour ne pas
 * casser les liens existants — bookmarks, historique de navigation, liens
 * internes pas encore mis à jour. Même geste que `/competences/referentiel`.
 */
export default function PageJournal() {
  redirect("/competences?vue=journal");
}
