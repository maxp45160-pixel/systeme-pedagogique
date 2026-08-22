import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { compteCourant } from "@/lib/supabase/server";
import { FormulaireNouveauMotDePasse } from "./formulaire";

export const metadata: Metadata = {
  title: "Nouveau mot de passe",
  description: "Choisissez un nouveau mot de passe pour votre compte.",
  robots: { index: false },
};

/**
 * Redéfinition du mot de passe.
 *
 * On n'arrive ici qu'avec une session : le lien du courriel passe d'abord par
 * `/auth/callback`, qui échange le code contre une session avant cette
 * redirection. Sans session (lien expiré, déjà consommé, ou visite directe),
 * il n'y a rien à redéfinir — on repart vers la demande, pas vers un
 * formulaire qui échouerait à la soumission.
 */
export default async function PageNouveauMotDePasse() {
  const compte = await compteCourant();
  if (!compte) {
    redirect(
      "/login?erreur=" +
        encodeURIComponent(
          "Ce lien est invalide ou a déjà été utilisé. Demandez-en un nouveau.",
        ),
    );
  }

  return (
    <main className="min-h-screen bg-fond px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-md">
        <header className="mb-8 text-center">
          <h1 className="font-serif text-2xl font-medium tracking-tight text-texte">
            Nouveau mot de passe
          </h1>
          <p className="mt-2 text-sm text-texte-attenue">
            Choisissez un mot de passe pour votre compte. Vos données restent
            intactes.
          </p>
        </header>

        <FormulaireNouveauMotDePasse />
      </div>
    </main>
  );
}
