"use client";

import { createNavigateurClient } from "@/lib/supabase/client";
import {
  annulerTeleversementPdfAction,
  enregistrerPieceJointeAction,
  preparerTeleversementPdfAction,
} from "@/lib/store/document-actions";
import type { PieceJointeDocument } from "./types-documents";
import { BUCKET_PIECES_JOINTES, MAX_PDF_OCTETS, MIME_PDF, nomPdfValide } from "./pieces-jointes";

export interface FichierPdf {
  name: string;
  type: string;
  size: number;
}

export function erreurFichierPdf(fichier: FichierPdf): string | null {
  if (!nomPdfValide(fichier.name) || (fichier.type && fichier.type !== MIME_PDF)) {
    return "Seuls les fichiers PDF peuvent être attachés.";
  }
  if (fichier.size <= 0 || fichier.size > MAX_PDF_OCTETS) {
    return "Le PDF doit peser entre 1 octet et 10 Mo.";
  }
  return null;
}

/** Téléverse un PDF dans le bucket documentaire puis l'inscrit dans la fiche. */
export async function televerserPdf(
  documentId: string,
  fichier: FichierPdf,
): Promise<PieceJointeDocument> {
  const erreur = erreurFichierPdf(fichier);
  if (erreur) throw new Error(erreur);

  const client = createNavigateurClient();
  if (!client) throw new Error("Supabase n'est pas configuré.");

  let chemin: string | null = null;
  try {
    const preparation = await preparerTeleversementPdfAction(documentId, fichier.name);
    chemin = preparation.chemin;
    const { error } = await client.storage
      .from(BUCKET_PIECES_JOINTES)
      .uploadToSignedUrl(preparation.chemin, preparation.token, fichier as File, { contentType: MIME_PDF });
    if (error) throw error;
    return await enregistrerPieceJointeAction(documentId, preparation.chemin, fichier.name, fichier.size);
  } catch (cause) {
    if (chemin) {
      try {
        await annulerTeleversementPdfAction(documentId, chemin);
      } catch {
        // Le nettoyage est secondaire : conserver l'erreur du téléversement.
      }
    }
    throw cause;
  }
}
