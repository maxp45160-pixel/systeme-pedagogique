import type { Domaine, Skill } from "@/lib/domain/types";

/**
 * Proposition de classement d'une compétence sans tag.
 *
 * Le domaine de création est un fait déjà déclaré au référentiel. Il sert ici
 * de point de départ lisible, jamais de rattachement implicite : seule la
 * commande humaine de la vue « À classer » pose le tag.
 */
export interface PropositionClassementAtelier {
  domaineId: string;
  domaineNom: string;
  justification: string;
}

export function proposerClassementDepuisDomaineCreation(
  skill: Pick<Skill, "domaine">,
  domaines: readonly Pick<Domaine, "id" | "nom" | "archive">[],
): PropositionClassementAtelier | null {
  const domaine = domaines.find((candidat) => candidat.id === skill.domaine && !candidat.archive);
  if (!domaine) return null;

  return {
    domaineId: domaine.id,
    domaineNom: domaine.nom,
    justification: "Ce domaine a créé cette compétence ; vérifiez qu’elle y sert toujours.",
  };
}
