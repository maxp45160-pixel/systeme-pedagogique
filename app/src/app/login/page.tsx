import type { Metadata } from "next";
import { FormulaireConnexion } from "./formulaire";
import { supabaseConfigure } from "@/lib/supabase/config";
import { IconeMarque } from "@/components/ui/icones";
import { Carte } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Connexion",
  description:
    "Maîtrisez n'importe quel sujet par la pratique. Des exercices sur vos sujets, des résultats mesurés sur ce que vous savez vraiment faire.",
};

/**
 * Écran de connexion et vitrine de présentation pour les nouveaux utilisateurs
 * et les moteurs de recherche.
 */
export default async function PageConnexion({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string; suite?: string }>;
}) {
  const { erreur, suite } = await searchParams;

  // Une destination ne peut être qu'un chemin interne : accepter une URL
  // absolue ferait de l'écran de connexion un tremplin de redirection.
  const destination = suite?.startsWith("/") && !suite.startsWith("//") ? suite : "/app";

  return (
    <main className="min-h-screen bg-fond px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        {/* En-tête principal & Marque */}
        <header className="mb-12 text-center">
          <div className="mx-auto mb-4 flex size-13 items-center justify-center rounded-2xl bg-primaire text-primaire-contraste shadow-sm">
            <IconeMarque className="size-7" />
          </div>
          <h1 className="font-serif text-3xl font-medium tracking-tight text-texte sm:text-4xl">
            Système pédagogique
          </h1>
          <p className="mt-2 text-base text-texte-attenue sm:text-lg">
            Apprendre par la pratique, et voir où vous en êtes vraiment
          </p>
        </header>

        {/* Section principale : Formulaire d'accès & Présentation synthétique */}
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
          {/* Colonne Présentation & Valeur ajoutée */}
          <section className="space-y-6 lg:col-span-7">
            <div className="space-y-3">
              <h2 className="font-serif text-xl font-medium text-texte">
                Progressez pour de vrai, pas au feeling
              </h2>
              <p className="text-sm leading-relaxed text-texte-attenue">
                Vous vous entraînez, on note ce que vous savez faire. Chaque niveau
                affiché vient d&apos;un exercice que vous avez réellement fait. Rien
                n&apos;est inventé.
              </p>
            </div>

            {/* Les 3 temps de la boucle pédagogique */}
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
              <div className="rounded-xl border border-bordure bg-surface p-4 shadow-[var(--ombre-carte)]">
                <div className="mb-2 flex size-7 items-center justify-center rounded-lg bg-primaire-faible text-xs font-semibold text-primaire">
                  1
                </div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-texte">
                  Génération
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-texte-discret">
                  Des exercices sur vos sujets, dans le temps que vous avez.
                </p>
              </div>

              <div className="rounded-xl border border-bordure bg-surface p-4 shadow-[var(--ombre-carte)]">
                <div className="mb-2 flex size-7 items-center justify-center rounded-lg bg-primaire-faible text-xs font-semibold text-primaire">
                  2
                </div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-texte">
                  Évaluation
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-texte-discret">
                  Chaque exercice laisse une trace. Rien ne s&apos;efface.
                </p>
              </div>

              <div className="rounded-xl border border-bordure bg-surface p-4 shadow-[var(--ombre-carte)]">
                <div className="mb-2 flex size-7 items-center justify-center rounded-lg bg-primaire-faible text-xs font-semibold text-primaire">
                  3
                </div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-texte">
                  Adaptation
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-texte-discret">
                  On vous propose ensuite ce qui n&apos;est pas encore acquis.
                </p>
              </div>
            </div>

            {/* Invariants et garanties de confiance */}
            <div className="rounded-xl border border-bordure bg-surface-2/60 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-texte">
                Ce sur quoi on ne transige pas
              </h3>
              <ul className="mt-2 space-y-1.5 text-xs text-texte-attenue">
                <li className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-primaire" />
                  <span><strong>Privé :</strong> personne d&apos;autre que vous ne voit vos résultats.</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-primaire" />
                  <span><strong>Pas de note inventée :</strong> tant que vous n&apos;avez rien montré, on affiche un tiret, pas un zéro.</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-primaire" />
                  <span><strong>Rien ne se perd :</strong> vos acquis restent là, même six mois après.</span>
                </li>
              </ul>
            </div>
          </section>

          {/* Colonne Formulaire de Connexion */}
          <section className="lg:col-span-5" aria-label="Formulaire d'accès">
            <Carte className="p-6">
              <div className="mb-4">
                <h2 className="text-base font-medium text-texte">Se connecter</h2>
                <p className="mt-0.5 text-xs text-texte-discret">
                  Content de vous revoir. Votre carnet vous attend.
                </p>
              </div>

              {supabaseConfigure ? (
                <FormulaireConnexion destination={destination} erreurInitiale={erreur ?? null} />
              ) : (
                <div className="space-y-3 text-sm">
                  <p className="font-medium text-texte">Configuration Supabase requise</p>
                  <p className="text-xs leading-relaxed text-texte-attenue">
                    Ce déploiement ne possède pas les clés publiques Supabase requises.
                    Aucune donnée n&apos;est lue ou écrite tant que la configuration est incomplète.
                  </p>
                  <p className="text-xs leading-relaxed text-texte-attenue">
                    Renseignez{" "}
                    <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> et{" "}
                    <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, puis
                    redémarrez le serveur.
                  </p>
                </div>
              )}

              <p className="mt-4 text-center text-[0.6875rem] leading-relaxed text-texte-discret">
                Vos résultats sont privés : personne d&apos;autre que vous ne peut les lire.
              </p>
            </Carte>
          </section>
        </div>

        {/* Section FAQ et présentation approfondie pour les visiteurs et l'indexation */}
        <section className="mt-16 border-t border-bordure pt-10">
          <h2 className="text-center font-serif text-xl font-medium text-texte sm:text-2xl">
            Questions fréquentes
          </h2>
          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-bordure bg-surface p-5">
              <h3 className="text-sm font-semibold text-texte">
                En quoi c&apos;est différent d&apos;un test de niveau ?
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-texte-attenue">
                Un test vous note un jour donné. Ici, on suit ce que vous savez faire au fil des semaines : ce que vous avez démontré reste, ce que vous n&apos;avez pas encore montré reste ouvert.
              </p>
            </div>

            <div className="rounded-xl border border-bordure bg-surface p-5">
              <h3 className="text-sm font-semibold text-texte">
                D&apos;où viennent les exercices ?
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-texte-attenue">
                Ils sont écrits sur mesure pour vos sujets, à votre niveau du moment, et taillés pour le temps dont vous disposez.
              </p>
            </div>

            <div className="rounded-xl border border-bordure bg-surface p-5">
              <h3 className="text-sm font-semibold text-texte">
                Mes données sont-elles privées ?
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-texte-attenue">
                100 % privé : vos notes, vos exercices et vos résultats n&apos;appartiennent qu&apos;à vous. Rien n&apos;est partagé sans votre accord explicite.
              </p>
            </div>

            <div className="rounded-xl border border-bordure bg-surface p-5">
              <h3 className="text-sm font-semibold text-texte">
                Puis-je organiser mes compétences comme je veux ?
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-texte-attenue">
                Oui. Vous créez vos propres sujets et compétences, vous les renommez, vous les rangez. Tout se modifie à tout moment.
              </p>
            </div>
          </div>
        </section>

        {/* Pied de page */}
        <footer className="mt-16 text-center text-xs text-texte-discret">
          <p>© {new Date().getFullYear()} Système pédagogique — Tous droits réservés.</p>
        </footer>
      </div>
    </main>
  );
}
