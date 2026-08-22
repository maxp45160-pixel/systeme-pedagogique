import { redirect } from "next/navigation";
import { lireAccesCourant } from "@/lib/store/acces";
import { seDeconnecter } from "@/lib/supabase/actions";
import { formatDateComplete } from "@/lib/engine/dates";
import { Bouton, Carte } from "@/components/ui/primitives";

/**
 * L'écran d'un compte suspendu (ADR-074).
 *
 * Hors du groupe `(app)` : le cadre applicatif redirige ici, y rester
 * produirait une boucle. Et il n'y a rien à encadrer — ni rail, ni tuteur, ni
 * point d'entrée de création, puisque aucune de ces surfaces ne peut plus lire
 * quoi que ce soit.
 *
 * Ce qui est affiché vient de `comptes_acces`, la seule table qu'un compte
 * suspendu lit encore, et seulement sur sa propre ligne. Le motif, s'il en
 * existe un, est celui saisi par l'administrateur : on ne le reformule pas.
 *
 * Aucune donnée n'a été supprimée, et la page le dit — un écran de suspension
 * muet se lit comme une perte de compte.
 */
export default async function PageSuspendu() {
  const acces = await lireAccesCourant();

  // Accès rouvert (ou jamais fermé) : cette page n'a rien à dire.
  if (!acces || acces.suspenduLe === null) redirect("/app");

  const depuis = formatDateComplete(acces.suspenduLe);

  return (
    <main className="grid min-h-screen place-items-center bg-fond px-4 py-12">
      <Carte className="w-full max-w-lg p-6">
        <h1 className="font-serif text-2xl font-medium tracking-tight">Accès suspendu</h1>
        <p className="mt-2 text-sm text-texte-attenue">
          L&apos;accès à ce compte a été fermé le {depuis} par un administrateur.
        </p>

        {acces.motif && (
          <p className="mt-3 rounded-lg border border-alerte/30 bg-alerte-faible px-3 py-2 text-sm text-alerte">
            {acces.motif}
          </p>
        )}

        <p className="mt-4 text-xs leading-relaxed text-texte-discret">
          Rien n&apos;a été supprimé : le référentiel, les observations, les exercices et les documents
          sont conservés en l&apos;état et redeviennent lisibles dès la réouverture de l&apos;accès.
        </p>

        <form action={seDeconnecter} className="mt-5">
          <Bouton type="submit" variante="secondaire">
            Se déconnecter
          </Bouton>
        </form>
      </Carte>
    </main>
  );
}
