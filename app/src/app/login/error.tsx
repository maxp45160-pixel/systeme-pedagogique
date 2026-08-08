"use client";

/**
 * Frontière d'erreur de `/login`.
 *
 * `/login` vit hors du groupe `(app)` (pas de rail, pas de session à
 * charger) et n'héritait donc de rien : une erreur ici — Supabase
 * injoignable, une redirection malformée — sortait de l'application.
 * Même contrat que `(app)/error.tsx` : ne fabrique rien, dit ce qui s'est
 * passé, propose de réessayer.
 */

import { useEffect } from "react";
import { Bouton, Carte } from "@/components/ui/primitives";

export default function ErreurConnexion({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-fond px-4 py-10">
      <div className="w-full max-w-sm">
        <Carte className="p-5">
          <h1 className="text-base font-semibold tracking-tight">
            La connexion n&apos;a pas pu s&apos;afficher
          </h1>
          <p className="mt-2 text-sm text-texte-attenue">
            Rien n&apos;a été modifié. Si le problème persiste après un nouvel
            essai, le service peut être temporairement indisponible.
          </p>

          {error.digest && (
            <p className="mt-3 font-mono text-[0.6875rem] text-texte-discret">
              Référence : {error.digest}
            </p>
          )}

          <div className="mt-5">
            <Bouton onClick={reset} variante="principal">
              Réessayer
            </Bouton>
          </div>
        </Carte>
      </div>
    </main>
  );
}
