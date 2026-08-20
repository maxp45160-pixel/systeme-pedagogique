"use server";

/**
 * Actions de gestion de compte et de purge de données souveraines.
 *
 * Permet à un utilisateur de réinitialiser intégralement ses données d'apprentissage
 * (repartir à zéro sur une base saine) ou de supprimer l'ensemble de ses données
 * et de se déconnecter.
 *
 * Conforme aux invariants du projet :
 * - Toutes les données appartiennent au compte (ADR-015).
 * - La suppression passe par la dorsale Supabase authentifiée (RLS).
 * - Les déclencheurs de gouvernance autorisent la suppression en cascade depuis `profiles`.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dorsaleCompte } from "./db";
import { verifier } from "./supabase-backend";

export type ModeReinitialisationCompte = "reset" | "supprimer_et_deconnecter";

export interface ResultatReinitialisationCompte {
  succes: boolean;
  mode: ModeReinitialisationCompte;
  message: string;
}

export async function reinitialiserDonneesCompteAction(
  mode: ModeReinitialisationCompte = "reset",
): Promise<ResultatReinitialisationCompte> {
  const dorsale = await dorsaleCompte();
  const userId = dorsale.userId;
  const courriel = dorsale.courriel;

  // 1. Nettoyage des fichiers dans Supabase Storage (bucket privé document-support)
  try {
    const { data: pieces } = await dorsale.supabase
      .from("document_attachments")
      .select("storage_path")
      .eq("user_id", userId);

    if (pieces && pieces.length > 0) {
      const chemins = pieces
        .map((p) => (typeof p.storage_path === "string" ? p.storage_path : null))
        .filter((p): p is string => Boolean(p));

      if (chemins.length > 0) {
        await dorsale.supabase.storage.from("document-support").remove(chemins);
      }
    }
  } catch {
    // Si le bucket de stockage n'est pas actif ou configuré en local, continuer la purge DB
  }

  // 2. Suppression ordonnée des tables documentaires
  // document_snapshots a une contrainte ON DELETE RESTRICT vers documents : on la vide en premier
  const { error: errSnapshots } = await dorsale.supabase
    .from("document_snapshots")
    .delete()
    .eq("user_id", userId);
  verifier("purge des instantanés documentaires", errSnapshots);

  const { error: errPieces } = await dorsale.supabase
    .from("document_attachments")
    .delete()
    .eq("user_id", userId);
  verifier("purge des pièces jointes documentaires", errPieces);

  const { error: errLinks } = await dorsale.supabase
    .from("document_links")
    .delete()
    .eq("user_id", userId);
  verifier("purge des liens documentaires", errLinks);

  const { error: errDocs } = await dorsale.supabase
    .from("documents")
    .delete()
    .eq("user_id", userId);
  verifier("purge des documents", errDocs);

  // 3. Suppression des traces d'apprentissage et du journal
  const { error: errObservations } = await dorsale.supabase.rpc("purger_observations_compte");
  verifier("purge des observations", errObservations);

  const { error: errTentatives } = await dorsale.supabase
    .from("attempts")
    .delete()
    .eq("user_id", userId);
  verifier("purge des tentatives", errTentatives);

  const { error: errSeances } = await dorsale.supabase
    .from("sessions")
    .delete()
    .eq("user_id", userId);
  verifier("purge des séances", errSeances);

  const { error: errRefus } = await dorsale.supabase
    .from("refus_recommandations")
    .delete()
    .eq("user_id", userId);
  verifier("purge des refus", errRefus);

  const { error: errExercices } = await dorsale.supabase
    .from("exercises")
    .delete()
    .eq("user_id", userId);
  verifier("purge des exercices", errExercices);

  const { error: errThemes } = await dorsale.supabase
    .from("themes")
    .delete()
    .eq("user_id", userId);
  verifier("purge des thèmes", errThemes);

  // 4. Suppression du référentiel (compétences et domaines)
  const { error: errCompetences } = await dorsale.supabase
    .from("competences")
    .delete()
    .eq("user_id", userId);
  verifier("purge des compétences", errCompetences);

  const { error: errDomaines } = await dorsale.supabase
    .from("domaines")
    .delete()
    .eq("user_id", userId);
  verifier("purge des domaines", errDomaines);

  // 5. Suppression de la ligne de profil (déclenche la cascade PostgreSQL sur referentiel_codes_emis et referentiel_changes)
  const { error: errProfil } = await dorsale.supabase
    .from("profiles")
    .delete()
    .eq("id", userId);
  verifier("purge du profil de compte", errProfil);

  // 6. Gestion post-suppression selon le mode
  if (mode === "reset") {
    // Réinsertion d'un profil neutre par défaut pour permettre la reprise immédiate
    const prenomRepli = courriel?.split("@")[0] ?? "Utilisateur";
    const { error: errReinsertion } = await dorsale.supabase.from("profiles").insert({
      id: userId,
      email: courriel ?? `${userId}@compte.local`,
      prenom: prenomRepli,
      formation: "Formation à renseigner",
      debut_suivi: new Date().toISOString().slice(0, 10),
      preferences_pedagogiques: [],
    });
    verifier("réinitialisation du profil neutre", errReinsertion);

    revalidatePath("/", "layout");
    return {
      succes: true,
      mode: "reset",
      message: "Toutes les données ont été réinitialisées. Ton compte est désormais vierge.",
    };
  }

  // Mode suppression totale avec déconnexion
  if (dorsale.supabase) {
    await dorsale.supabase.auth.signOut();
  }
  revalidatePath("/", "layout");
  redirect("/login");
}
