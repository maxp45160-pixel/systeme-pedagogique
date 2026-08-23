"use client";

import { createNavigateurClient } from "@/lib/supabase/client";
import {
  annulerTeleversementPieceAction,
  enregistrerPieceJointeAction,
  preparerTeleversementPieceAction,
} from "@/lib/store/document-actions";
import type { PieceJointeDocument } from "./types-documents";
import {
  BUCKET_PIECES_JOINTES,
  erreurFichierPiece,
  estMimePieceJointe,
  mimeDepuisNomFichier,
  type MimePieceJointe,
} from "./pieces-jointes";

export interface FichierTeleverseable {
  name: string;
  type: string;
  size: number;
}

/** Le MIME déclaré par le navigateur, avec repli sur l'extension du nom. */
function mimeDuFichier(fichier: FichierTeleverseable): MimePieceJointe | null {
  if (estMimePieceJointe(fichier.type)) return fichier.type;
  return mimeDepuisNomFichier(fichier.name);
}

/**
 * Téléverse un fichier (PDF ou image) dans le bucket documentaire puis
 * l'inscrit dans la fiche support.
 */
export async function televerserFichier(
  documentId: string,
  fichier: File & FichierTeleverseable,
): Promise<PieceJointeDocument> {
  const erreur = erreurFichierPiece(fichier);
  if (erreur) throw new Error(erreur);

  const mime = mimeDuFichier(fichier);
  if (!mime) throw new Error("Seuls les fichiers PDF et les images JPEG, PNG ou WebP peuvent être attachés.");

  const client = createNavigateurClient();
  if (!client) throw new Error("Supabase n'est pas configuré.");

  let chemin: string | null = null;
  try {
    const preparation = await preparerTeleversementPieceAction(documentId, fichier.name, mime);
    chemin = preparation.chemin;
    const { error } = await client.storage
      .from(BUCKET_PIECES_JOINTES)
      .uploadToSignedUrl(preparation.chemin, preparation.token, fichier as File, { contentType: mime });
    if (error) throw error;
    return await enregistrerPieceJointeAction(documentId, preparation.chemin, fichier.name, fichier.size, mime);
  } catch (cause) {
    if (chemin) {
      try {
        await annulerTeleversementPieceAction(documentId, chemin);
      } catch {
        // Le nettoyage est secondaire : conserver l'erreur du téléversement.
      }
    }
    throw cause;
  }
}
