import type { Metadata } from "next";
import { FormulaireConnexion } from "./formulaire";
import { supabaseConfigure } from "@/lib/supabase/config";
import { Carte } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Connexion & Découverte",
  description:
    "Centre de pilotage personnel du développement de compétences : génération d'exercices, évaluation continue et suivi longitudinal.",
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
  const destination = suite?.startsWith("/") && !suite.startsWith("//") ? suite : "/";

  return (
    <main className="min-h-screen bg-fond px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        {/* En-tête principal & Marque */}
        <header className="mb-12 text-center">
          <div className="mx-auto mb-4 flex size-13 items-center justify-center rounded-2xl bg-primaire text-primaire-contraste shadow-sm">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-7"
              aria-hidden
            >
              <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
              <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
            </svg>
          </div>
          <h1 className="font-serif text-3xl font-medium tracking-tight text-texte sm:text-4xl">
            Système pédagogique
          </h1>
          <p className="mt-2 text-base text-texte-attenue sm:text-lg">
            Suivi longitudinal des compétences & apprentissage adaptatif
          </p>
        </header>

        {/* Section principale : Formulaire d'accès & Présentation synthétique */}
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
          {/* Colonne Présentation & Valeur ajoutée */}
          <section className="space-y-6 lg:col-span-7">
            <div className="space-y-3">
              <h2 className="font-serif text-xl font-medium text-texte">
                Pilotez votre progression avec des preuves tangibles
              </h2>
              <p className="text-sm leading-relaxed text-texte-attenue">
                Une approche rigoureuse pour l&apos;ingénierie des compétences complexes :
                chaque niveau de maîtrise s&apos;appuie sur des démonstrations concrètes et
                observées, sans fabrication arbitraire de données.
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
                  Exercices contextualisés et séances calibrées selon votre temps réel.
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
                  Mesure continue et preuves tangibles archivées de façon immuable.
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
                  Recommandations ciblées sur vos faiblesses réelles pour progresser.
                </p>
              </div>
            </div>

            {/* Invariants & Garanties de confiance */}
            <div className="rounded-xl border border-bordure bg-surface-2/60 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-texte">
                Principes fondamentaux & Confidentialité
              </h3>
              <ul className="mt-2 space-y-1.5 text-xs text-texte-attenue">
                <li className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-primaire" />
                  <span><strong>Souveraineté des données :</strong> Vos preuves restent strictement privées et cloisonnées à votre compte.</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-primaire" />
                  <span><strong>Absence de preuve ≠ zéro :</strong> Aucune notation artificielle sans observation réelle.</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-primaire" />
                  <span><strong>Persistance immuable :</strong> Vos compétences validées et votre historique sont conservés dans le temps.</span>
                </li>
              </ul>
            </div>
          </section>

          {/* Colonne Formulaire de Connexion */}
          <section className="lg:col-span-5" aria-label="Formulaire d'accès">
            <Carte className="p-6">
              <div className="mb-4">
                <h2 className="text-base font-medium text-texte">Accéder à votre espace</h2>
                <p className="mt-0.5 text-xs text-texte-discret">
                  Identifiez-vous pour retrouver votre carnet d&apos;apprentissage.
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
                Vos preuves de compétence restent privées : elles ne sont lisibles que par
                votre compte.
              </p>
            </Carte>
          </section>
        </div>

        {/* Section FAQ & Présentation approfondie pour les visiteurs et l'indexation */}
        <section className="mt-16 border-t border-bordure pt-10">
          <h2 className="text-center font-serif text-xl font-medium text-texte sm:text-2xl">
            Questions fréquentes sur le système
          </h2>
          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-bordure bg-surface p-5">
              <h3 className="text-sm font-semibold text-texte">
                Qu&apos;est-ce que le suivi longitudinal des compétences ?
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-texte-attenue">
                Contrairement à une évaluation ponctuelle, le suivi longitudinal observe l&apos;évolution de vos compétences au fil des séances, des révisions et des projets, garantissant une rétention durable dans le temps.
              </p>
            </div>

            <div className="rounded-xl border border-bordure bg-surface p-5">
              <h3 className="text-sm font-semibold text-texte">
                Comment sont générés les exercices et séances ?
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-texte-attenue">
                Le moteur pédagogique analyse vos forces et faiblesses réelles pour vous proposer des exercices adaptés à votre niveau et calibrés sur votre créneau horaire disponible.
              </p>
            </div>

            <div className="rounded-xl border border-bordure bg-surface p-5">
              <h3 className="text-sm font-semibold text-texte">
                Mes données personnelles sont-elles partagées ?
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-texte-attenue">
                Non. Votre référentiel et vos preuves d&apos;apprentissage appartiennent exclusivement à votre compte et sont protégés au niveau de la base de données via PostgreSQL Row-Level Security.
              </p>
            </div>

            <div className="rounded-xl border border-bordure bg-surface p-5">
              <h3 className="text-sm font-semibold text-texte">
                Puis-je personnaliser mon référentiel de compétences ?
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-texte-attenue">
                Oui. Le système vous permet de structurer vos propres domaines, thèmes et codes de compétences selon vos objectifs d&apos;apprentissage ou votre parcours d&apos;ingénierie.
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
