import { redirect } from "next/navigation";
import { chargerContexte } from "@/lib/store/context";
import { EntetePage } from "@/components/layout/entete-page";
import { Carte } from "@/components/ui/primitives";
import { FormulaireAmorcage } from "@/components/demarrer/formulaire-amorcage";

/**
 * Amorçage d'un compte neuf (ADR-026).
 *
 * Un compte démarre sans référentiel : il n'y a rien à mesurer, et le tableau
 * de bord n'aurait que des tirets à montrer. Cet écran demande les trois seules
 * choses que le système ne peut pas dériver — le sujet, l'objectif, le point de
 * départ — puis passe la main au tuteur.
 *
 * Trois champs, pas un assistant en douze étapes : le référentiel se construit
 * dans la conversation qui suit, pas dans un formulaire. Ces trois réponses
 * servent à la rendre possible — sans objectif déclaré, l'importance d'une
 * compétence ne se rapporte à rien (protocole du référentiel §4).
 *
 * Écrit dans `profiles.formation` et les deux objectifs : c'est le premier
 * chemin d'écriture vers ces colonnes, qui existaient depuis l'origine sans que
 * rien ne les renseigne (ADR-009, prérequis matériel).
 */
export default async function PageDemarrer() {
  const ctx = await chargerContexte();

  // Le référentiel existe déjà : il n'y a rien à amorcer. On ne réaffiche pas
  // un écran d'accueil à quelqu'un qui travaille depuis des semaines.
  if (ctx.referentiel.skills.length > 0) {
    redirect("/competences");
  }

  const u = ctx.donnees.user;
  // Les valeurs par défaut de `profiles` sont des libellés, pas des réponses :
  // les proposer comme contenu initial ferait passer un trou pour une donnée.
  const nonRenseigne = (v: string) => (v.includes("à renseigner") ? "" : v);

  return (
    <>
      <EntetePage
        titre="Sur quoi veux-tu progresser ?"
        sousTitre="Ce système mesure des savoir-faire à partir de preuves. Il ne sait pas encore lesquels te concernent — c'est la seule chose qu'il ne peut pas déduire."
      />

      <Carte>
        <div className="px-5 py-4">
          <FormulaireAmorcage
            formation={nonRenseigne(u.formation)}
            objectifMoyenTerme={nonRenseigne(u.objectifMoyenTerme)}
            objectifLongTerme={nonRenseigne(u.objectifLongTerme)}
            compteId={u.id}
          />
        </div>
      </Carte>

      <p className="mt-4 px-1 text-xs text-texte-attenue">
        Rien n&apos;est figé : le référentiel se modifie, s&apos;étend et se réduit à tout moment
        depuis l&apos;écran <span className="font-medium">Compétences</span>.
      </p>
    </>
  );
}
