/**
 * Client Supabase côté navigateur.
 *
 * Renvoie `null` quand Supabase n'est pas configuré : les composants client
 * affichent alors l'état « profil local » au lieu de casser.
 */

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigure } from "./config";

let cache: SupabaseClient | null = null;

export function createNavigateurClient(): SupabaseClient | null {
  if (!supabaseConfigure) return null;
  // Un seul client par onglet : `onAuthStateChange` ne doit pas être réabonné
  // à chaque rendu, sous peine de fuites d'abonnements.
  cache ??= createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return cache;
}

export const createClient = createNavigateurClient;
