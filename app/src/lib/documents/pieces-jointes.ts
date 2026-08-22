/**
 * Contrat partagé entre l'interface et le stockage des pièces jointes
 * documentaires.
 *
 * Une pièce jointe est un fichier déposé par la personne — PDF de support ou
 * photo de cahier. L'application n'affirme rien sur son contenu : aucune
 * analyse, aucune mesure, seulement la conservation du fichier tel quel
 * derrière le bucket privé.
 */

export const BUCKET_PIECES_JOINTES = "document-support";
export const MIME_PDF = "application/pdf";

/** Types MIME acceptés à l'attachement d'une fiche support. */
export const MIMES_PIECES_JOINTES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type MimePieceJointe = (typeof MIMES_PIECES_JOINTES)[number];

export const MAX_PIECE_OCTETS = 10 * 1024 * 1024;

const EXTENSIONS_PAR_MIME: Record<MimePieceJointe, readonly string[]> = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
};

export function estMimePieceJointe(valeur: unknown): valeur is MimePieceJointe {
  return (
    typeof valeur === "string" &&
    (MIMES_PIECES_JOINTES as readonly string[]).includes(valeur)
  );
}

/** L'extension canonique d'un type MIME accepté, point incluse. */
export function extensionPourMime(mime: MimePieceJointe): string {
  return EXTENSIONS_PAR_MIME[mime][0];
}

/** Déduit le type MIME d'un fichier depuis l'extension de son nom. */
export function mimeDepuisNomFichier(nom: string): MimePieceJointe | null {
  const propre = nom.trim().toLocaleLowerCase("fr-FR");
  for (const [mime, extensions] of Object.entries(EXTENSIONS_PAR_MIME)) {
    if ((extensions as readonly string[]).some((extension) => propre.endsWith(extension))) {
      return mime as MimePieceJointe;
    }
  }
  return null;
}

/**
 * Validation d'un fichier avant téléversement — côté client comme côté
 * serveur. Retourne `null` quand le fichier est acceptable, sinon le motif
 * du refus.
 */
export function erreurFichierPiece(fichier: { name: string; type: string; size: number }): string | null {
  const mime = estMimePieceJointe(fichier.type)
    ? fichier.type
    : mimeDepuisNomFichier(fichier.name);
  if (!mime) {
    return "Seuls les fichiers PDF et les images JPEG, PNG ou WebP peuvent être attachés.";
  }
  if (fichier.size <= 0 || fichier.size > MAX_PIECE_OCTETS) {
    return "Le fichier doit peser entre 1 octet et 10 Mo.";
  }
  return null;
}
