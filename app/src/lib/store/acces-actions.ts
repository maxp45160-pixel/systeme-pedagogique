"use server";

/**
 * Les trois écritures du panel d'administration (ADR-074).
 *
 * Chacune écrit dans `comptes_acces` **avec le client authentifié**, jamais
 * avec `service_role` : la politique `acces_commande_admin` et le trigger
 * `garde_comptes_acces` sont ce qui autorise réellement le geste. Un client
 * privilégié ferait de ces deux gardes une décoration.
 *
 * La révocation de session, elle, exige `service_role` — elle est demandée
 * après coup, et son échec n'annule pas la suspension (voir
 * `lib/supabase/admin-api.ts`).
 */

import { revalidatePath } from "next/cache";
import { dorsaleCompte } from "./db";
import { revoquerSession } from "@/lib/supabase/admin-api";
import { estRoleConnu, normaliserMotif, type RoleCompte } from "@/lib/domain/acces";

export interface ResultatActionAcces {
  ok: boolean;
  /** Ce que l'écran affiche : refus de la base, ou état de la révocation. */
  message: string;
}

/**
 * Message rendu à l'écran quand la base a refusé.
 *
 * Les deux interdits du trigger arrivent en `42501` avec leur phrase déjà
 * écrite en français : on la relaie telle quelle plutôt que de la retraduire —
 * deux formulations de la même règle finiraient par diverger.
 */
function messageErreur(cause: unknown, defaut: string): string {
  if (cause && typeof cause === "object" && "message" in cause) {
    const message = String((cause as { message: unknown }).message);
    if (message.trim().length > 0) return message;
  }
  return defaut;
}

export async function changerRoleAction(
  cibleId: string,
  role: string,
): Promise<ResultatActionAcces> {
  if (!estRoleConnu(role)) return { ok: false, message: "Rôle inconnu." };
  const nouveauRole: RoleCompte = role;

  const { supabase } = await dorsaleCompte();
  const { error } = await supabase
    .from("comptes_acces")
    .update({ role: nouveauRole })
    .eq("user_id", cibleId);

  if (error) {
    return { ok: false, message: messageErreur(error, "Le rôle n'a pas pu être modifié.") };
  }

  revalidatePath("/admin");
  return {
    ok: true,
    message: nouveauRole === "admin" ? "Rôle d'administrateur accordé." : "Rôle ramené à membre.",
  };
}

/**
 * Suspend un accès.
 *
 * Deux temps, dans cet ordre : l'écriture RLS, qui **est** la coupure, puis la
 * révocation de session, qui n'est qu'un raccourci. L'inverse laisserait une
 * fenêtre où la session est coupée sans que la base n'ait rien enregistré.
 */
export async function suspendreAction(
  cibleId: string,
  motif: string,
): Promise<ResultatActionAcces> {
  const { supabase, userId } = await dorsaleCompte();

  const { error } = await supabase
    .from("comptes_acces")
    .update({
      suspendu_le: new Date().toISOString(),
      suspendu_par: userId,
      motif: normaliserMotif(motif),
    })
    .eq("user_id", cibleId);

  if (error) {
    return { ok: false, message: messageErreur(error, "L'accès n'a pas pu être suspendu.") };
  }

  const revocation = await revoquerSession(cibleId, true);
  revalidatePath("/admin");

  if (revocation.statut === "revoque") {
    return { ok: true, message: "Accès suspendu, session révoquée." };
  }
  if (revocation.statut === "clef-absente") {
    return {
      ok: true,
      message:
        "Accès suspendu. La session ouverte survivra jusqu'à son expiration : " +
        "SUPABASE_SERVICE_ROLE_KEY n'est pas configurée.",
    };
  }
  return {
    ok: true,
    message: `Accès suspendu. La session n'a pas pu être révoquée : ${revocation.message}`,
  };
}

export async function reactiverAction(cibleId: string): Promise<ResultatActionAcces> {
  const { supabase } = await dorsaleCompte();

  const { error } = await supabase
    .from("comptes_acces")
    .update({ suspendu_le: null, suspendu_par: null, motif: null })
    .eq("user_id", cibleId);

  if (error) {
    return { ok: false, message: messageErreur(error, "L'accès n'a pas pu être rouvert.") };
  }

  const revocation = await revoquerSession(cibleId, false);
  revalidatePath("/admin");

  return {
    ok: true,
    message:
      revocation.statut === "echec"
        ? `Accès rouvert. Le ban Supabase n'a pas pu être levé : ${revocation.message}`
        : "Accès rouvert.",
  };
}
