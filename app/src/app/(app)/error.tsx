"use client";

/**
 * Frontière d'erreur du groupe `(app)`.
 *
 * `verifier()` (`lib/store/supabase-backend.ts`) lève sur toute erreur
 * PostgREST, et le rendu des pages se fait maintenant derrière des frontières
 * `<Suspense>` : sans ce fichier, ce jet remontait jusqu'à la racine et Next
 * affichait son écran générique, hors du cadre du carnet.
 *
 * Il ne fabrique aucun chiffre et ne prétend rien mesurer : une lecture qui a
 * échoué ne vaut pas un zéro (protocole anti-hallucination). Il dit ce qui
 * s'est passé et propose de réessayer.
 */

import { useEffect } from "react";
import Link from "next/link";
import { Carte, classesBouton } from "@/components/ui/primitives";

export default function ErreurApp({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Trace côté navigateur : en production, le message est masqué par Next et
    // seul `digest` permet de relier l'écran à l'entrée des journaux serveur.
    console.error(error);
  }, [error]);

  return (
    <Carte>
      <div className="px-4 py-6">
        <h1 className="text-base font-semibold tracking-tight">
          Cette page n&apos;a pas pu être chargée
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-texte-attenue">
          La lecture des données a échoué. Rien n&apos;a été modifié, et aucun chiffre
          n&apos;est affiché à la place : une mesure absente n&apos;est pas une mesure à
          zéro. Si le problème persiste, la session a peut-être expiré — se reconnecter
          suffit en général.
        </p>

        {error.digest && (
          <p className="mt-3 font-mono text-[0.6875rem] text-texte-discret">
            Référence : {error.digest}
          </p>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={reset} className={classesBouton("principal")}>
            Réessayer
          </button>
          <Link href="/login" className={classesBouton("secondaire")}>
            Se reconnecter
          </Link>
        </div>
      </div>
    </Carte>
  );
}
