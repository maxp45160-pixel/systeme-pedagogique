/** Contrat partagé entre l'interface et le stockage des PDF documentaires. */

export const BUCKET_PIECES_JOINTES = "document-support";
export const MIME_PDF = "application/pdf";
export const MAX_PDF_OCTETS = 10 * 1024 * 1024;

export function nomPdfValide(nom: string): boolean {
  return nom.trim().toLocaleLowerCase("fr-FR").endsWith(".pdf");
}
