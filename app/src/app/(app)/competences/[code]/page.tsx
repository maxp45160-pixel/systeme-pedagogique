import { FicheCompetence } from "@/components/competences/fiche-competence";

/**
 * La fiche d'une compétence, en page pleine.
 *
 * Le contenu vit dans `FicheCompetence` : la même implémentation sert le
 * tiroir ouvert depuis le graphe (`@fiche/(.)competences/[code]`). Cette route
 * reste la destination canonique — elle répond au rechargement, au partage
 * d'URL et à toute navigation qui n'est pas un clic depuis le graphe.
 */
export default async function PageCompetence(props: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await props.params;
  return <FicheCompetence code={code} />;
}
