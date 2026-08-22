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
import { Bouton, Carte, classesLienBouton } from "@/components/ui/primitives";

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

  const sessionHorodateeDansLeFutur = /PGRST303|JWT issued at future/i.test(
    error.message ?? "",
  );

  return (
    <Carte>
      <div className="px-4 py-3.5">
        <h1 className="text-base font-semibold tracking-tight">
          Cette page n&apos;a pas pu être chargée
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-texte-attenue">
          {sessionHorodateeDansLeFutur ? (
            <>
              La session est horodatée dans le futur par rapport au serveur. Synchronise
              la date et l&apos;heure de Windows, puis réessaie. Si le problème persiste,
              reconnecte-toi.
            </>
          ) : (
            <>
              La lecture des données a échoué. Rien n&apos;a été modifié, et aucun chiffre
              n&apos;est affiché à la place : une mesure absente n&apos;est pas une mesure à
              zéro. Si le problème persiste, la session a peut-être expiré — se reconnecter
              suffit en général.
            </>
          )}
        </p>

        {error.digest && (
          <p className="mt-3 font-mono text-[0.6875rem] text-texte-discret">
            Référence : {error.digest}
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Bouton onClick={reset} variante="principal">
            Réessayer
          </Bouton>
          <Link href="/login" className={classesLienBouton("secondaire")}>
            Se reconnecter
          </Link>
        </div>
      </div>
    </Carte>
  );
}
