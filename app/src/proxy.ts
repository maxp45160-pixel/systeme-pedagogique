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
 * Sans configuration Supabase, aucune route produit n'est ouverte : la page
 * de connexion affiche l'erreur de configuration au lieu de simuler un mode local.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigure } from "@/lib/supabase/config";
import { fetchSupabase } from "@/lib/supabase/fetch";

/**
 * Chemins accessibles sans compte : vitrine publique (`/`, `/methode`,
 * `/etudiants`, `/autodidactes`) et routes d'authentification. Les routes
 * générées `robots.txt`, `sitemap.xml` et la carte Open Graph doivent rester
 * atteignables par les moteurs et réseaux sociaux malgré le matcher du proxy :
 * un fetcher sans session (Discord, LinkedIn…) qui tombait sur une redirection
 * vers `/login` recevrait du HTML au lieu de l'annonce.
 */
const PREFIX_PUBLICS = ["/opengraph-image"];
const PUBLICS = [
  "/",
  "/login",
  "/auth",
  "/methode",
  "/etudiants",
  "/autodidactes",
  "/robots.txt",
  "/sitemap.xml",
];

function estPublic(chemin: string): boolean {
  return (
    PUBLICS.some((p) => chemin === p || chemin.startsWith(`${p}/`)) ||
    PREFIX_PUBLICS.some((p) => chemin.startsWith(p))
  );
}

export async function proxy(request: NextRequest) {
  const chemin = request.nextUrl.pathname;
  if (!supabaseConfigure) {
    if (estPublic(chemin)) return NextResponse.next();
    if (chemin.startsWith("/api/")) {
      return NextResponse.json({ erreur: "configuration-supabase-absente" }, { status: 503 });
    }
    const versLogin = request.nextUrl.clone();
    versLogin.pathname = "/login";
    versLogin.search = "";
    versLogin.searchParams.set("erreur", "configuration-supabase-absente");
    return NextResponse.redirect(versLogin);
  }

  // `reponse` est réassignée par `setAll` : les cookies rafraîchis doivent
  // partir à la fois vers la requête (pour la suite du rendu) et vers la
  // réponse (pour le navigateur).
  let reponse = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { fetch: fetchSupabase },
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

  // `getClaims()` et non `getUser()` (ADR-022) : le projet signe ses jetons en
  // ES256, la signature et `exp` sont donc vérifiées localement par WebCrypto
  // contre le JWKS — mis en cache dix minutes par auth-js. Le proxy s'exécutant
  // sur *chaque* requête, y compris les charges RSC de navigation, l'appel au
  // serveur d'authentification qu'on supprime ici était le poste de latence
  // dominant du rendu.
  const { data } = await supabase.auth.getClaims();
  const connecte = data !== null;

  if (!connecte && !estPublic(chemin)) {
    // Une route d'API répond en JSON. La rediriger vers `/login` renverrait une
    // page HTML avec un statut 200, que `fetch` interpréterait comme un succès.
    if (chemin.startsWith("/api/")) {
      return NextResponse.json({ erreur: "non-authentifie" }, { status: 401 });
    }

    const versLogin = request.nextUrl.clone();
    versLogin.pathname = "/login";
    // Mémorise la destination pour y revenir après connexion.
    versLogin.searchParams.set("suite", `${chemin}${request.nextUrl.search}`);
    return NextResponse.redirect(versLogin);
  }

  if (connecte && chemin === "/login") {
    const versAccueil = request.nextUrl.clone();
    versAccueil.pathname = "/app";
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
