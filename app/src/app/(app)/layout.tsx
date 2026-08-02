import { compteCourant } from "@/lib/supabase/server";
import { supabaseConfigure } from "@/lib/supabase/config";
import { Sidebar } from "@/components/layout/sidebar";
import { NavMobile } from "@/components/layout/nav-mobile";
import { CompteMobile } from "@/components/layout/compte";
import { ProfilFlottant } from "@/components/dev/profil-flottant";

/**
 * Cadre du carnet : rail de navigation, marge.
 *
 * Le groupe `(app)` n'apparaît pas dans les URL : `/competences` reste
 * `/competences`. Il sépare seulement les pages qui ont besoin du cadre de
 * celles qui n'en veulent pas (connexion, retour OAuth).
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const compte = await compteCourant();

  const session = {
    configure: supabaseConfigure,
    connecte: compte !== null,
    courriel: compte?.email ?? null,
    nom:
      (compte?.user_metadata?.full_name as string | undefined) ??
      (compte?.user_metadata?.name as string | undefined) ??
      null,
    avatar: (compte?.user_metadata?.avatar_url as string | undefined) ?? null,
    // Identifiant du compte — isole la clé API saisie côté client (voir
    // `cle-client.ts` et `cleParCompte`). Toujours présent quand Supabase est
    // configuré : `compteCourant()` renvoie `null` seulement sans session, et
    // `dorsaleCompte()` redirige avant d'atteindre cette mise en page.
    compteId: compte?.id ?? "local",
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar session={session} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/*
          Barre supérieure mobile : le nom du système et l'accès au compte.

          Le pied du rail — compte, export du journal, déconnexion, thème — est
          `hidden lg:flex`. Sans ce bouton, aucun de ces réglages n'était
          atteignable sur mobile (ADR-025).
        */}
        <div className="flex h-12 items-center justify-between gap-2 border-b border-bordure bg-surface px-4 lg:hidden">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tracking-tight">
              Système pédagogique
            </div>
          </div>
          <CompteMobile session={session} />
        </div>

        {/*
          Marge de carnet : filet discret courant sur toute la hauteur de la
          fenêtre (desktop). Le `flex-1` est ce qui le rend continu — porté par
          le bloc de contenu seul, le trait s'arrêtait à la dernière carte et
          laissait le bas de l'écran vide. Les paddings verticaux sont posés à
          l'intérieur du bloc pour que la bordure les englobe.
        */}
        <main className="flex flex-1 flex-col px-4 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-6xl flex-1 pb-20 pt-5 lg:border-l lg:border-marge lg:pb-10 lg:pl-8 lg:pt-6">
            {children}
          </div>
        </main>
      </div>

      <NavMobile />

      {/* Panneau flottant de profilage : visible pendant qu'on utilise l'app. */}
      <ProfilFlottant />
    </div>
  );
}