/**
 * Configuration Supabase — point unique de lecture des variables d'environnement.
 *
 * L'application doit rester utilisable sans Supabase : tant que les deux
 * variables ne sont pas renseignées, le système retombe sur le journal JSON
 * local mono-utilisateur (comportement historique). C'est `supabaseConfigure`
 * qui arbitre, jamais un `try/catch` silencieux.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Vrai si les clés publiques sont présentes. N'indique pas qu'un compte est connecté. */
export const supabaseConfigure: boolean =
  SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;

/**
 * Message unique affiché quand une action nécessite Supabase et qu'il manque
 * la configuration. Centralisé pour ne pas diverger entre écrans.
 */
export const MESSAGE_NON_CONFIGURE =
  "Supabase n'est pas configuré. Renseignez NEXT_PUBLIC_SUPABASE_URL et " +
  "NEXT_PUBLIC_SUPABASE_ANON_KEY (dans app/.env.local ou les variables Vercel) " +
  "pour activer les comptes et la synchronisation.";
