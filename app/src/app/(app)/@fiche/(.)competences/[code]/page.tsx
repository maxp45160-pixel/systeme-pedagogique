import { FicheCompetence } from "@/components/competences/fiche-competence";
import { TiroirFiche } from "@/components/competences/tiroir-fiche";

/**
 * Interception de `/competences/[code]` — la fiche en tiroir.
 *
 * `(.)` intercepte au même niveau que le créneau : depuis `@fiche`, cela vise
 * `(app)/competences/[code]`. L'interception ne joue **que** sur une
 * navigation côté client — un rechargement ou une URL partagée rend la page
 * pleine. La fiche reste donc adressable telle quelle ; le tiroir n'est
 * qu'une façon d'y arriver sans perdre le graphe.
 *
 * Le contenu est le composant de la page pleine, en présentation tiroir.
 */
export default async function FicheInterceptee(props: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await props.params;
  return (
    <TiroirFiche>
      <FicheCompetence code={code} enTiroir />
    </TiroirFiche>
  );
}
