/**
 * Client Supabase côté serveur (Server Components, Server Functions, routes).
 *
 * Le rafraîchissement du jeton est assuré par `src/proxy.ts` : ici on se
 * contente de lire les cookies de la requête. En Server Component la mutation
 * de cookies est interdite par React ; l'échec est donc attendu et ignoré,
 * contrairement aux erreurs réseau qui, elles, doivent remonter.
 */

import "server-only";

import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User as CompteSupabase } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigure } from "./config";

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

  const jar = await cookies();

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
 * Compte connecté, ou `null` (Supabase absent / visiteur anonyme).
 *
 * Utilise `getUser()` et non `getSession()` : seul `getUser()` revalide le
 * jeton auprès du serveur d'authentification. Se fier au cookie de session
 * reviendrait à faire confiance à une valeur modifiable par le client.
 *
 * `cache()` (React) mémoïse l'appel pour la durée d'une requête serveur : la
 * mise en page, la page et la dorsale partagent alors un seul aller-retour
 * `getUser()` au lieu d'en refaire un chacun. La garantie de sécurité est
 * intacte — le jeton reste revalidé une fois par requête —, seule la
 * répétition disparaît.
 */
export const compteCourant = cache(async (): Promise<CompteSupabase | null> => {
  const supabase = await createServeurClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user ?? null;
});

export type { CompteSupabase };
