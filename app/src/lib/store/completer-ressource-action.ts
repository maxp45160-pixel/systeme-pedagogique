"use server";
import { completerRessourceAnalysee } from "./dialogue-ressource";
/** Reprise explicite de l'organisation sourcée, sans appel fournisseur. */
export async function completerRessourceAction(documentId: string, analyseId: string) {
  return completerRessourceAnalysee(documentId, analyseId);
}
