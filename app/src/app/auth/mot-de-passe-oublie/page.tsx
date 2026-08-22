import type { Metadata } from "next";
import { FormulaireOubli } from "./formulaire";

export const metadata: Metadata = {
  title: "Mot de passe oublié",
  description: "Recevez un lien de redéfinition de votre mot de passe.",
  robots: { index: false },
};

/**
 * Demande de redéfinition de mot de passe.
 *
 * Route publique : un visiteur qui a perdu son mot de passe n'a par définition
 * pas de session. Le lien envoyé repasse par `/auth/callback`, qui échange le
 * code contre une session avant de mener à la page de redéfinition.
 */
export default function PageMotDePasseOublie() {
  return (
    <main className="min-h-screen bg-fond px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-md">
        <header className="mb-8 text-center">
          <h1 className="font-serif text-2xl font-medium tracking-tight text-texte">
            Mot de passe oublié
          </h1>
          <p className="mt-2 text-sm text-texte-attenue">
            Indiquez votre adresse : vous recevrez un lien pour choisir un
            nouveau mot de passe.
          </p>
        </header>

        <FormulaireOubli />

        <p className="mt-6 text-center text-[0.6875rem] leading-relaxed text-texte-discret">
          Vos résultats sont privés : personne d&apos;autre que vous ne peut les
          lire. La demande de redéfinition n&apos;ouvre rien d&apos;autre.
        </p>
      </div>
    </main>
  );
}
