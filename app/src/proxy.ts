/**
 * Proxy (ex-« middleware », renommé en Next.js 16).
 *
 * Deux rôles, dans cet ordre :
 *
 * 1. Rafraîchir le jeton Supabase et réémettre les cookies. Sans cela, la
 *    session expire au bout d'une heure et les Server Components ne voient
 *    plus aucun compte connecté — c'est la cause classique du « je suis
 *    déconnecté sans avoir cliqué sur déconnexion ».
 * 2. Rediriger les visiteurs anonymes vers `/login`. Contrôle *optimiste* :
 *    l'autorisation réelle est assurée par les politiques RLS de PostgreSQL,
 *    qui restent la seule barrière à laquelle on accorde de la confiance.
 *
 * Tant que Supabase n'est pas configuré, le proxy laisse tout passer :
 * l'application reste utilisable en mode local mono-utilisateur.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigure } from "@/lib/supabase/config";

/** Chemins accessibles sans compte. */
const PUBLICS = ["/login", "/auth", "/api/dev-todos"];

function estPublic(chemin: string): boolean {
  return PUBLICS.some((p) => chemin === p || chemin.startsWith(`${p}/`));
}

export async function proxy(request: NextRequest) {
  if (!supabaseConfigure) return NextResponse.next();

  // `reponse` est réassignée par `setAll` : les cookies rafraîchis doivent
  // partir à la fois vers la requête (pour la suite du rendu) et vers la
  // réponse (pour le navigateur).
  let reponse = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(aPoser) {
        for (const { name, value } of aPoser) {
          request.cookies.set(name, value);
        }
        reponse = NextResponse.next({ request });
        for (const { name, value, options } of aPoser) {
          reponse.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const chemin = request.nextUrl.pathname;

  if (!user && !estPublic(chemin)) {
    const versLogin = request.nextUrl.clone();
    versLogin.pathname = "/login";
    // Mémorise la destination pour y revenir après connexion.
    versLogin.searchParams.set("suite", `${chemin}${request.nextUrl.search}`);
    return NextResponse.redirect(versLogin);
  }

  if (user && chemin === "/login") {
    const versAccueil = request.nextUrl.clone();
    versAccueil.pathname = "/";
    versAccueil.search = "";
    return NextResponse.redirect(versAccueil);
  }

  return reponse;
}

export const config = {
  // Exclut les assets et l'image optimisée : le proxy ne doit pas coûter un
  // aller-retour d'authentification sur chaque fichier statique.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
