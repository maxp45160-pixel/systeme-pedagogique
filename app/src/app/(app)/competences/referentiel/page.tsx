import { redirect } from "next/navigation";

/**
 * La gestion du référentiel est fusionnée dans `/competences` (lot 2).
 *
 * Cette route redirige vers la vue « Gérer » de `/competences`. Elle est
 * conservée pour ne pas casser les liens existants — bookmarks, historique de
 * navigation, liens internes pas encore mis à jour.
 */
export default function PageReferentiel() {
  redirect("/competences?vue=gerer");
}