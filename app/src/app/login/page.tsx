import Link from "next/link";
import { FormulaireConnexion } from "./formulaire";
import { supabaseConfigure } from "@/lib/supabase/config";

/**
 * Écran de connexion — hors du groupe `(app)` : pas de rail, pas de contexte
 * pédagogique chargé pour un visiteur qui n'a pas encore de compte.
 */
export default async function PageConnexion({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string; suite?: string }>;
}) {
  const { erreur, suite } = await searchParams;

  // Une destination ne peut être qu'un chemin interne : accepter une URL
  // absolue ferait de l'écran de connexion un tremplin de redirection.
  const destination = suite?.startsWith("/") && !suite.startsWith("//") ? suite : "/";

  return (
    <main className="flex min-h-screen items-center justify-center bg-fond px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 flex size-11 items-center justify-center rounded-xl bg-primaire text-primaire-contraste">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-6"
              aria-hidden
            >
              <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
              <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
            </svg>
          </span>
          <h1 className="font-serif text-xl font-medium tracking-tight text-texte">
            Système pédagogique
          </h1>
          <p className="mt-1 text-sm text-texte-discret">
            Suivi longitudinal des compétences
          </p>
        </div>

        <div className="rounded-xl border border-bordure bg-surface p-5 shadow-[var(--ombre-carte)]">
          {supabaseConfigure ? (
            <FormulaireConnexion destination={destination} erreurInitiale={erreur ?? null} />
          ) : (
            <div className="space-y-3 text-sm">
              <p className="font-medium text-texte">Comptes non activés</p>
              <p className="text-xs leading-relaxed text-texte-attenue">
                Ce déploiement n&apos;a pas de clés Supabase. L&apos;application
                fonctionne en mode local mono-utilisateur : le journal reste dans{" "}
                <code className="chiffres">app/data/store/</code>.
              </p>
              <p className="text-xs leading-relaxed text-texte-attenue">
                Pour activer les comptes, renseignez{" "}
                <code className="chiffres">NEXT_PUBLIC_SUPABASE_URL</code> et{" "}
                <code className="chiffres">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, puis
                redémarrez le serveur.
              </p>
              <Link
                href="/"
                className="inline-flex h-9 items-center rounded-md border border-bordure-forte bg-surface px-3.5 text-sm font-medium transition-colors hover:bg-surface-2"
              >
                Continuer en local
              </Link>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-[0.6875rem] leading-relaxed text-texte-discret">
          Vos preuves de compétence restent privées : elles ne sont lisibles que par
          votre compte.
        </p>
      </div>
    </main>
  );
}
