/**
 * Configuration Supabase — point unique de lecture des variables d'environnement.
 *
 * Supabase est obligatoire. `supabaseConfigure` permet d'afficher une erreur
 * explicite avant tout accès produit ; il n'active aucun stockage de repli.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Vrai si les clés publiques sont présentes. N'indique pas qu'un compte est connecté. */
export const supabaseConfigure: boolean =
  SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
