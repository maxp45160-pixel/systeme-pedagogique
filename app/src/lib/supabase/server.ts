/**
 * Client Supabase côté serveur (Server Components, Server Functions, routes).
 *
 * Le rafraîchissement du jeton est assuré par `src/proxy.ts` : ici on se
 * contente de lire les cookies de la requête. En Server Component la mutation
 * de cookies est interdite par React ; l'échec est donc attendu et ignoré,
 * contrairement aux erreurs réseau qui, elles, doivent remonter.
 *
 * L'identité du visiteur est établie par vérification locale du jeton
 * (`getClaims`, ADR-022), non par un appel au serveur d'authentification.
 */

import "server-only";

import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigure } from "./config";
import { mesurer } from "@/lib/profiling/server";

/**
 * Client Supabase de la requête en cours.
 *
 * `cache()` (React) a exactement la portée de `cookies()` : la requête
 * serveur. Mémoïser la construction est donc sémantiquement identique à la
 * refaire, à ceci près qu'on cesse de relire le bocal à cookies et de
 * reconstruire un client pour chaque consommateur. La mise en page, la
 * dorsale et les routes partagent maintenant une seule instance, là où une
 * page en construisait trois.
 */
export const createServeurClient = cache(async (): Promise<SupabaseClient | null> => {
  if (!supabaseConfigure) return null;

  const jar = await mesurer("cookies()", () => cookies());

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return jar.getAll();
      },
      setAll(aPoser) {
        try {
          for (const { name, value, options } of aPoser) {
            jar.set(name, value, options);
          }
        } catch {
          // Server Component en lecture seule : le proxy a déjà rafraîchi la session.
        }
      },
    },
  });
});

/**
 * Identité du compte, dérivée des seules revendications d'un jeton vérifié.
 *
 * Volontairement plus étroite que le type `User` de supabase-js : ces trois
 * champs sont les seuls réellement consommés (mise en page `(app)`,
 * `dorsaleCompte`, `/api/dev-todos`, `export.ts`), et tous figurent dans le
 * jeton. Rien de ce qui n'est pas lu n'est transporté.
 */
export interface Compte {
  readonly id: string;
  readonly email: string | undefined;
  readonly user_metadata: Record<string, unknown> | undefined;
  /** Session anonyme Supabase. Aucun chemin ne l'active aujourd'hui. */
  readonly estAnonyme: boolean;
}

/**
 * Compte connecté, ou `null` (Supabase absent / visiteur anonyme).
 *
 * Utilise `getClaims()` (ADR-022) et non `getSession()`, ni `getUser()`.
 *
 * `getSession()` seul reste interdit : il se contenterait de lire le cookie,
 * c'est-à-dire une valeur modifiable par le client. `getClaims()` **vérifie
 * cryptographiquement** la signature du jeton — le projet signe en ES256, la
 * vérification se fait donc localement par WebCrypto contre la clé publique
 * du JWKS, sans aller-retour réseau. Elle valide aussi `exp`. Ces deux
 * garanties sont celles que `getUser()` apportait ; ce qui disparaît, c'est
 * l'appel au serveur d'authentification, payé jusqu'ici sur chaque page et
 * chaque requête RSC — en double, avec celui du proxy.
 *
 * `allowExpired` n'est jamais passé : la validation de `exp` fait partie du
 * contrat. Si le projet repassait à une clé symétrique, auth-js retomberait
 * de lui-même sur `getUser()` — la sécurité ne dépend pas de notre choix.
 *
 * L'autorisation réelle, elle, reste entièrement du ressort des politiques
 * RLS de PostgreSQL : ce compte ne sert qu'au contrôle optimiste (afficher ou
 * rediriger) et à fournir l'identifiant des clauses `.eq("user_id", …)`, que
 * RLS double de toute façon.
 *
 * `cache()` (React) mémoïse l'appel pour la durée d'une requête serveur.
 */
export const compteCourant = cache(async (): Promise<Compte | null> => {
  const supabase = await createServeurClient();
  if (!supabase) return null;

  // Trois variantes de retour :
  //   { data, error: null }        jeton présent et signature vérifiée ;
  //   { data: null, error }        jeton invalide, expiré, ou erreur réseau ;
  //   { data: null, error: null }  aucun cookie de session (visiteur anonyme).
  // Les deux dernières se traitent identiquement : pas de compte.
  const { data, error } = await mesurer("supabase:getClaims", () => supabase.auth.getClaims());
  if (error || !data) return null;

  const revendications = data.claims;
  return {
    id: revendications.sub,
    email: revendications.email,
    user_metadata: revendications.user_metadata,
    estAnonyme: revendications.is_anonymous === true,
  };
});
