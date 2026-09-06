"use server";
import { ajouterCorrectionDepot, creerDepotDocumentaire, lireDepotDocumentaire } from "./depot-documents";

export async function creerDepotAction(note: string, cle: string) { return creerDepotDocumentaire(note,cle); }
export async function lireDepotAction(id: string) { return lireDepotDocumentaire(id); }
export async function corrigerDepotAction(documentId: string, elementId: string | null, texte: string, cle: string) {
  await ajouterCorrectionDepot(documentId,elementId,texte,cle);
  return lireDepotDocumentaire(documentId);
}
