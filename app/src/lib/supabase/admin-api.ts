/**
 * Révocation de session — le seul usage de `service_role` du dépôt (ADR-074).
 *
 * ## Pourquoi ce module existe alors que RLS suffit
 *
 * La suspension est portée par RLS : un compte suspendu ne lit plus une ligne
 * métier, son jeton fût-il parfaitement valide. C'est la barrière, et elle
 * tient seule.
 *
 * Ce qu'elle ne fait pas, c'est **invalider le jeton**. La personne suspendue
 * garde une session ouverte jusqu'à son expiration : elle voit l'application
 * se vider plutôt que d'être déconnectée. Le ban Supabase, lui, coupe à la
 * source — mais il exige `service_role`, c'est-à-dire une clé qui contourne
 * RLS. Elle vit donc ici, dans un module `server-only`, et nulle part ailleurs.
 *
 * ## Absence de clé = fonctionnement dégradé, jamais d'échec
 *
 * `SUPABASE_SERVICE_ROLE_KEY` est **facultative**. Sans elle, la suspension
 * s'applique quand même et ce module le dit ; il ne lève pas, et l'écran
 * affiche que la session en cours survivra jusqu'à son expiration. Faire de la
 * révocation une condition de la suspension rendrait la fonction principale
 * dépendante d'un secret optionnel.
 */

import "server-only";

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./config";

/** Un ban Supabase se déclare en durée. Cent ans vaut « jusqu'à révocation ». */
const DUREE_BAN = "876000h";

export type ResultatRevocation =
  | { statut: "revoque" }
  | { statut: "clef-absente" }
  | { statut: "echec"; message: string };

function clientAdmin() {
  const clef = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!clef || !SUPABASE_URL) return null;

  return createClient(SUPABASE_URL, clef, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Coupe (ou rouvre) la session d'un compte.
 *
 * Appelée **après** l'écriture RLS, jamais à sa place : si elle échoue, la
 * suspension reste acquise en base et l'appelant se contente de le signaler.
 */
export async function revoquerSession(
  userId: string,
  bannir: boolean,
): Promise<ResultatRevocation> {
  const admin = clientAdmin();
  if (!admin) return { statut: "clef-absente" };

  const { error } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: bannir ? DUREE_BAN : "none",
  });

  if (error) return { statut: "echec", message: error.message };
  return { statut: "revoque" };
}
