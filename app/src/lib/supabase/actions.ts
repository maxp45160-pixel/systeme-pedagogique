"use server";

/**
 * Actions d'authentification.
 *
 * La déconnexion passe par le serveur : c'est lui qui détient les cookies de
 * session et qui peut les révoquer avec certitude. Un `signOut()` déclenché
 * seulement côté navigateur laisse la session serveur valide jusqu'à
 * expiration, et la page se réaffiche connectée au premier rechargement.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServeurClient } from "./server";

export async function seDeconnecter(): Promise<void> {
  const supabase = await createServeurClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  revalidatePath("/", "layout");
  redirect("/login");
}
