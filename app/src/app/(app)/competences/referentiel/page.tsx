import { redirect } from "next/navigation";

/**
 * La gestion du référentiel est fusionnée dans `/competences` (lot 2).
 *
 * Il n'existe pas de vue « Gérer » distincte : la gestion se fait par
 * domaine, depuis les cartes de la vue par défaut. Cette route redirige donc
 * vers `/competences` telle quelle — elle ne pointait déjà plus vers un
 * `?vue=gerer` reconnu (`type Vue` ne l'a jamais accepté, repli silencieux
 * sur `accueil`), seul le lien mentait sur sa destination. Conservée pour ne
 * pas casser les liens existants — bookmarks, historique de navigation.
 */
export default function PageReferentiel() {
  redirect("/competences");
}