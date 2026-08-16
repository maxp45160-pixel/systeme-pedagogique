/** Lecture de la marge du cahier. */

import "server-only";

import { dorsaleCompte } from "./db";
import { verifier } from "./supabase-backend";
import { analyserMarge, ID_MARGE, type LigneMarge } from "@/lib/documents/marge";

/**
 * Le contenu du document, ou `null` s'il n'existe pas encore.
 *
 * ⚠️ **La lecture ne crée pas le document.** Ouvrir le cahier ne doit rien
 * écrire en base : une marge vide n'a rien à dire, et un document créé à la
 * première visite peuplerait l'Atelier de fiches que personne n'a voulues. Il
 * naît à la première ligne écrite.
 *
 * Séparé de `marge-actions.ts` volontairement : ce module n'est pas
 * `"use server"`, donc cette lecture n'est pas exposée comme Server Action
 * appelable depuis le client. Elle reste un appel serveur ordinaire.
 */
export async function lireContenuMarge(): Promise<string | null> {
  const { supabase, userId } = await dorsaleCompte();
  const { data, error } = await supabase
    .from("documents")
    .select("contenu_md")
    .eq("user_id", userId)
    .eq("id", ID_MARGE)
    .maybeSingle();
  verifier("lecture de la marge du cahier", error);
  return data ? String((data as { contenu_md: string }).contenu_md) : null;
}

export async function lireMarge(): Promise<LigneMarge[]> {
  const contenu = await lireContenuMarge();
  return contenu ? analyserMarge(contenu) : [];
}
