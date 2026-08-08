/**
 * Page introuvable du groupe `(app)`.
 *
 * Trois `notFound()` retombaient sur l'écran 404 générique de Next — hors du
 * cadre du carnet, sans rail, sans thème, sans retour : `exercices/[id]`,
 * `competences/[code]`, `competences/domaine/[id]`, chacun quand l'identifiant
 * de l'URL ne correspond à rien de réel (lien périmé, faute de frappe,
 * ressource retirée depuis).
 *
 * Ce fichier est statique (pas de `error.tsx`, pas de logique) : Next
 * l'affiche pour tout `notFound()` levé sous ce groupe.
 */
import Link from "next/link";
import { Carte, classesLienBouton } from "@/components/ui/primitives";

export default function IntrouvableApp() {
  return (
    <Carte>
      <div className="px-4 py-3.5">
        <h1 className="text-base font-semibold tracking-tight">
          Cette page n&apos;existe pas
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-texte-attenue">
          L&apos;adresse ne correspond à rien de connu — un lien périmé, ou une
          ressource retirée depuis. Rien n&apos;a été perdu ailleurs dans
          l&apos;application.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Link href="/" className={classesLienBouton("principal")}>
            Retour au tableau de bord
          </Link>
        </div>
      </div>
    </Carte>
  );
}
