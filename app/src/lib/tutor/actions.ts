"use server";

import { chargerContexte } from "@/lib/store/context";
import { construireContexte, contexteEnTexte } from "./contexte";

/**
 * Prépare le prompt complet à coller dans Claude.
 *
 * Mode de repli lorsqu'aucune clé API n'est configurée : le système construit
 * exactement le même contexte que la route serveur, mais le rend à l'utilisateur
 * plutôt que de l'envoyer. Rien n'est simulé.
 */
export async function preparerPromptComplet(question: string): Promise<string> {
  const ctx = await chargerContexte();
  const pedagogique = await construireContexte(ctx);
  return contexteEnTexte(pedagogique, question.trim() || "(indique ici ta demande)");
}
