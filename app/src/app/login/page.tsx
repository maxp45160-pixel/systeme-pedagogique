import type { Metadata } from "next";
import Link from "next/link";
import { FormulaireConnexion } from "./formulaire";
import { supabaseConfigure } from "@/lib/supabase/config";
import { IconeMarque } from "@/components/ui/icones";
import { Carte } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Connexion",
  description:
    "Connectez-vous ou créez votre compte pour apprendre par la pratique et suivre ce que vous savez vraiment faire.",
  // Cette page ne doit pas concurrencer la vitrine : c'est un formulaire, pas
  // une présentation.
  robots: { index: false, follow: true },
};

/**
 * Connexion et inscription — et rien d'autre.
 *
 * Cette page portait une seconde vitrine : les trois temps de la boucle sous
 * d'autres mots (« Génération · Évaluation · Adaptation » là où `/` dit
 * « Déclarez · Travaillez · Voyez »), les trois mêmes garanties, et quatre
 * questions fréquentes. Le formulaire, lui, tenait dans cinq douzièmes de la
 * largeur, à droite. Quelqu'un qui vient de lire la vitrine relisait la
 * vitrine ; quelqu'un qui vient se connecter cherchait le champ.
 *
 * Ce qui a été retiré vit toujours sur `/` et sur `/methode`, qui sont les
 * pages faites pour ça. Le lien « Comprendre la méthode » y ramène.
 */
export default async function PageConnexion({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string; suite?: string; mode?: string }>;
}) {
  const { erreur, suite, mode } = await searchParams;

  // Une destination ne peut être qu'un chemin interne : accepter une URL
  // absolue ferait de l'écran de connexion un tremplin de redirection.
  const destination = suite?.startsWith("/") && !suite.startsWith("//") ? suite : "/app";

  /*
   * `?mode=inscription` — posé par les appels à l'action de la vitrine.
   *
   * Sans lui, « Créer mon compte gratuitement » ouvrait un formulaire de
   * connexion titré « Content de vous revoir », sur lequel il fallait trouver
   * un lien en petits caractères pour basculer. Seule cette valeur est
   * reconnue : tout le reste retombe sur la connexion.
   */
  const modeInitial = mode === "inscription" ? "inscription" : "connexion";

  return (
    <main className="flex min-h-screen items-center justify-center bg-fond px-4 py-12 sm:px-6">
      <div className="w-full max-w-md">
        <header className="mb-8 text-center">
          <Link
            href="/"
            className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-primaire text-primaire-contraste shadow-sm"
            aria-label="Retour à l'accueil"
          >
            <IconeMarque className="size-6" />
          </Link>
          <h1 className="font-serif text-2xl font-medium tracking-tight text-texte sm:text-3xl">
            Système pédagogique
          </h1>
          <p className="mt-2 text-sm text-texte-attenue">
            Apprendre par la pratique, et voir où vous en êtes vraiment
          </p>
        </header>

        <Carte className="p-6">
          {supabaseConfigure ? (
            <FormulaireConnexion
              destination={destination}
              erreurInitiale={erreur ?? null}
              modeInitial={modeInitial}
            />
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

        <p className="mt-6 text-center text-xs text-texte-discret">
          Vous découvrez ?{" "}
          <Link href="/methode" className="text-texte-attenue underline-offset-2 hover:text-texte hover:underline">
            Comprendre la méthode
          </Link>
        </p>
      </div>
    </main>
  );
}
