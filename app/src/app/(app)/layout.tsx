import { Suspense } from "react";
import { redirect } from "next/navigation";
import { compteCourant } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { NavMobile } from "@/components/layout/nav-mobile";
import { CompteMobile } from "@/components/layout/compte";
import { ProfilPage } from "@/components/dev/profil-page";
import { ProfilWrapper } from "@/components/dev/profil-wrapper";
import { ProfilTracker } from "@/components/dev/profil-tracker";
import { TuteurGlobal } from "@/components/tuteur/tuteur-global";

/**
 * Cadre du carnet : rail de navigation, marge.
 *
 * Le groupe `(app)` n'apparaît pas dans les URL : `/competences` reste
 * `/competences`. Il sépare seulement les pages qui ont besoin du cadre de
 * celles qui n'en veulent pas (connexion, retour OAuth).
 */
export default async function AppLayout({
  children,
  fiche,
}: {
  children: React.ReactNode;
  /**
   * Créneau parallèle `@fiche` — vide partout sauf sur l'interception de
   * `/competences/[code]`, où il porte le tiroir ouvert depuis le graphe.
   * Rendu hors du flux principal : le graphe reste monté derrière, avec son
   * zoom et ses filtres.
   */
  fiche: React.ReactNode;
}) {
  const compte = await compteCourant();
  if (!compte) redirect("/login");

  const session = {
    courriel: compte.email ?? null,
    nom:
      (compte.user_metadata?.full_name as string | undefined) ??
      (compte.user_metadata?.name as string | undefined) ??
      null,
    avatar: (compte.user_metadata?.avatar_url as string | undefined) ?? null,
    // Identifiant du compte — isole la clé API saisie côté client (voir
    // `cle-client.ts` et `cleParCompte`).
    compteId: compte.id,
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
        <main className="flex flex-1 flex-col px-4 sm:px-6 lg:px-10">
          <div className="mx-auto w-full max-w-7xl flex-1 pb-24 pt-6 lg:border-l lg:border-marge lg:pb-12 lg:pl-10 lg:pt-8">
            <ProfilWrapper compteId={compte.id}>
              <ProfilTracker compteId={compte.id} />
              <ProfilPage compteId={compte.id}>{children}</ProfilPage>
            </ProfilWrapper>
          </div>
        </main>
      </div>

      {fiche}

      <NavMobile />
      {/*
        Le tiroir du tuteur, monté hors du flux : `Suspense` le laisse streamer
        après la page, l'assemblage de son contexte ne retarde donc aucun rendu.
      */}
      <Suspense fallback={null}>
        <TuteurGlobal />
      </Suspense>
    </div>
  );
}
