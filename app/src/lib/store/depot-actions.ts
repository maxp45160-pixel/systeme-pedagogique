"use server";
import { ajouterCorrectionDepot, creerDepotDocumentaire, lireDepotDocumentaire } from "./depot-documents";
import { supprimerDocument } from "./documents";
import { revalidatePath } from "next/cache";

export async function supprimerDepotAction(id: string): Promise<void> {
  await lireDepotDocumentaire(id);
  await supprimerDocument(id);
  revalidatePath("/app");
  revalidatePath("/atelier");
}

export async function creerDepotAction(note: string, cle: string) { return creerDepotDocumentaire(note,cle); }
export async function lireDepotAction(id: string) { return lireDepotDocumentaire(id); }
export async function corrigerDepotAction(documentId: string, elementId: string | null, texte: string, cle: string) {
  await ajouterCorrectionDepot(documentId,elementId,texte,cle);
  return lireDepotDocumentaire(documentId);
}
