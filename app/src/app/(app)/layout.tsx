import { chargerContexte } from "@/lib/store/context";
import { compteCourant } from "@/lib/supabase/server";
import { supabaseConfigure } from "@/lib/supabase/config";
import { Sidebar } from "@/components/layout/sidebar";
import { NavMobile } from "@/components/layout/nav-mobile";
import { BasculeTheme } from "@/components/layout/bascule-theme";

/**
 * Cadre du carnet : rail de navigation, marge.
 *
 * Le groupe `(app)` n'apparaît pas dans les URL : `/competences` reste
 * `/competences`. Il sépare seulement les pages qui ont besoin du cadre de
 * celles qui n'en veulent pas (connexion, retour OAuth).
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [{ xp }, compte] = await Promise.all([chargerContexte(), compteCourant()]);

  const resumeXp = {
    niveau: xp.palier.niveau,
    nom: xp.palier.nom,
    xpTotal: xp.xpTotal,
    fraction: xp.fraction,
    xpDansPalier: xp.xpDansPalier,
    xpRequisPalier: xp.xpRequisPalier,
    suivant: xp.suivant?.nom ?? null,
  };

  const session = {
    configure: supabaseConfigure,
    connecte: compte !== null,
    courriel: compte?.email ?? null,
    nom:
      (compte?.user_metadata?.full_name as string | undefined) ??
      (compte?.user_metadata?.name as string | undefined) ??
      null,
    avatar: (compte?.user_metadata?.avatar_url as string | undefined) ?? null,
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar xp={resumeXp} session={session} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barre supérieure mobile : le nom du système et la bascule de thème. */}
        <div className="flex h-12 items-center justify-between gap-2 border-b border-bordure bg-surface px-4 lg:hidden">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tracking-tight">
              Système pédagogique
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="chiffres text-[0.6875rem] text-texte-discret">
              N{resumeXp.niveau} · {resumeXp.xpTotal} XP
            </span>
            <BasculeTheme />
          </div>
        </div>

        <main className="flex-1 px-4 pb-20 pt-5 sm:px-6 lg:px-8 lg:pb-10">
          {/* Marge de carnet : filet terracotta discret le long du contenu (desktop). */}
          <div className="mx-auto w-full max-w-6xl lg:border-l lg:border-danger/15 lg:pl-10">
            {children}
          </div>
        </main>
      </div>

      <NavMobile />
    </div>
  );
}
