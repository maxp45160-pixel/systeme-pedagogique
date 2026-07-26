/**
 * Point de retour OAuth / lien e-mail.
 *
 * `signInWithOAuth` (flux PKCE) renvoie ici avec un `code` à échanger contre
 * une session. Sans cet échange, le retour de Google repart avec un code
 * jamais consommé et l'utilisateur reste anonyme : c'est l'étape qui manquait
 * pour que le SSO aboutisse réellement.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createServeurClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const suite = searchParams.get("suite") ?? "/";

  // Derrière un proxy (Vercel), `origin` pointe sur l'hôte interne : on
  // reconstruit l'URL publique à partir des en-têtes de transfert.
  const hoteTransfere = request.headers.get("x-forwarded-host");
  const protocole = request.headers.get("x-forwarded-proto") ?? "https";
  const base = hoteTransfere ? `${protocole}://${hoteTransfere}` : origin;

  // `suite` vient de l'URL : on n'accepte qu'un chemin interne, jamais une
  // URL absolue, sous peine de redirection ouverte vers un site tiers.
  const destination = suite.startsWith("/") && !suite.startsWith("//") ? suite : "/";

  if (!code) {
    const erreur = searchParams.get("error_description") ?? "Code d'autorisation absent.";
    return NextResponse.redirect(`${base}/login?erreur=${encodeURIComponent(erreur)}`);
  }

  const supabase = await createServeurClient();
  if (!supabase) {
    return NextResponse.redirect(
      `${base}/login?erreur=${encodeURIComponent("Supabase n'est pas configuré sur ce déploiement.")}`,
    );
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${base}/login?erreur=${encodeURIComponent(error.message)}`);
  }

  return NextResponse.redirect(`${base}${destination}`);
}
