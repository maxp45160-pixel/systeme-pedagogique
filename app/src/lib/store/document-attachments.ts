/** Accès serveur aux PDF attachés aux notes support. */

import "server-only";

import { revalidatePath } from "next/cache";
import { dorsaleCompte, type DorsaleCompte } from "./db";
import { verifier } from "./supabase-backend";
import type { PieceJointeDocument } from "@/lib/documents/types-documents";
import {
  BUCKET_PIECES_JOINTES,
  MAX_PDF_OCTETS,
  MIME_PDF,
  nomPdfValide,
} from "@/lib/documents/pieces-jointes";

const TABLE_PIECES_JOINTES = "document_attachments";

interface LignePieceJointe {
  id: string;
  document_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

function verifierIdentifiantDocument(id: string): string {
  const propre = id.trim();
  if (!/^[a-z0-9][a-z0-9-]*$/.test(propre)) throw new Error("Identifiant documentaire invalide.");
  return propre;
}

function normaliserNomPdf(nom: string): string {
  const dernierSegment = nom.trim().replace(/^.*[\\/]/, "");
  if (!dernierSegment || !nomPdfValide(dernierSegment)) {
    throw new Error("Seuls les fichiers PDF peuvent être attachés.");
  }
  if (dernierSegment.length > 160) throw new Error("Le nom du PDF est trop long.");
  return dernierSegment;
}

function echapperRegExp(valeur: string): string {
  return valeur.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cheminAttendu(userId: string, documentId: string, chemin: string): boolean {
  const motif = new RegExp(`^${echapperRegExp(userId)}/${echapperRegExp(documentId)}/[0-9a-f-]{36}\\.pdf$`, "i");
  return motif.test(chemin);
}

function pieceDepuisLigne(ligne: LignePieceJointe, url?: string): PieceJointeDocument {
  return {
    id: ligne.id,
    nom: ligne.file_name,
    mimeType: MIME_PDF,
    tailleOctets: ligne.size_bytes,
    creeLe: ligne.created_at,
    ...(url ? { url } : {}),
  };
}

async function verifierNoteSupport(
  documentId: string,
  dorsale: DorsaleCompte,
): Promise<string> {
  const identifiant = verifierIdentifiantDocument(documentId);
  const { data, error } = await dorsale.supabase
    .from("documents")
    .select("frontmatter")
    .eq("user_id", dorsale.userId)
    .eq("id", identifiant)
    .maybeSingle();
  verifier("lecture de la note support", error);
  const frontmatter = data?.frontmatter;
  if (!frontmatter || typeof frontmatter !== "object" || Array.isArray(frontmatter) || (frontmatter as Record<string, unknown>).role !== "support") {
    throw new Error("Les PDF peuvent uniquement être attachés à une note support.");
  }
  return identifiant;
}

async function lireLignes(documentId: string, dorsale: DorsaleCompte): Promise<LignePieceJointe[]> {
  const { data, error } = await dorsale.supabase
    .from(TABLE_PIECES_JOINTES)
    .select("id, document_id, storage_path, file_name, mime_type, size_bytes, created_at")
    .eq("user_id", dorsale.userId)
    .eq("document_id", documentId)
    .order("created_at", { ascending: false });
  verifier("lecture des pièces jointes", error);
  return (data ?? []) as LignePieceJointe[];
}

export async function preparerTeleversementPdf(documentId: string, nom: string): Promise<{ chemin: string; token: string }> {
  const dorsale = await dorsaleCompte();
  const identifiant = await verifierNoteSupport(documentId, dorsale);
  normaliserNomPdf(nom);
  const chemin = `${dorsale.userId}/${identifiant}/${crypto.randomUUID()}.pdf`;
  const { data, error } = await dorsale.supabase.storage
    .from(BUCKET_PIECES_JOINTES)
    .createSignedUploadUrl(chemin);
  verifier("préparation du téléversement PDF", error);
  if (!data?.token) throw new Error("Le téléversement PDF n'a pas pu être préparé.");
  return { chemin, token: data.token };
}

export async function enregistrerPieceJointe(
  documentId: string,
  chemin: string,
  nom: string,
  tailleOctets: number,
): Promise<PieceJointeDocument> {
  const dorsale = await dorsaleCompte();
  const identifiant = await verifierNoteSupport(documentId, dorsale);
  const nomNormalise = normaliserNomPdf(nom);
  if (!cheminAttendu(dorsale.userId, identifiant, chemin)) throw new Error("Chemin de fichier invalide.");
  if (!Number.isInteger(tailleOctets) || tailleOctets <= 0 || tailleOctets > MAX_PDF_OCTETS) {
    throw new Error("Le PDF doit peser entre 1 octet et 10 Mo.");
  }

  const dossier = `${dorsale.userId}/${identifiant}`;
  const nomObjet = chemin.slice(dossier.length + 1);
  const { data: objets, error: objetsErreur } = await dorsale.supabase.storage
    .from(BUCKET_PIECES_JOINTES)
    .list(dossier, { limit: 100, search: nomObjet });
  verifier("vérification du PDF téléversé", objetsErreur);
  const objet = (objets ?? []).find((candidat) => candidat.name === nomObjet);
  if (!objet) throw new Error("Le PDF téléversé est introuvable.");
  const metadata = objet.metadata && typeof objet.metadata === "object"
    ? objet.metadata as Record<string, unknown>
    : {};
  const tailleStockee = typeof metadata.size === "number" ? metadata.size : tailleOctets;
  const typeStocke = typeof metadata.mimetype === "string" ? metadata.mimetype : MIME_PDF;
  if (typeStocke !== MIME_PDF || tailleStockee <= 0 || tailleStockee > MAX_PDF_OCTETS) {
    await dorsale.supabase.storage.from(BUCKET_PIECES_JOINTES).remove([chemin]);
    throw new Error("Le fichier téléversé n'est pas un PDF valide.");
  }

  const { data, error } = await dorsale.supabase
    .from(TABLE_PIECES_JOINTES)
    .insert({
      user_id: dorsale.userId,
      document_id: identifiant,
      storage_path: chemin,
      file_name: nomNormalise,
      mime_type: MIME_PDF,
      size_bytes: tailleStockee,
    })
    .select("id, document_id, storage_path, file_name, mime_type, size_bytes, created_at")
    .single();
  if (error) {
    await dorsale.supabase.storage.from(BUCKET_PIECES_JOINTES).remove([chemin]);
  }
  verifier("enregistrement du PDF", error);
  revalidatePath("/atelier");
  return pieceDepuisLigne(data as LignePieceJointe);
}

export async function annulerTeleversementPdf(documentId: string, chemin: string): Promise<void> {
  const dorsale = await dorsaleCompte();
  const identifiant = await verifierNoteSupport(documentId, dorsale);
  if (!cheminAttendu(dorsale.userId, identifiant, chemin)) throw new Error("Chemin de fichier invalide.");
  const { error } = await dorsale.supabase.storage
    .from(BUCKET_PIECES_JOINTES)
    .remove([chemin]);
  verifier("annulation du téléversement PDF", error);
}

export async function lirePiecesJointes(documentId: string): Promise<PieceJointeDocument[]> {
  const dorsale = await dorsaleCompte();
  const identifiant = await verifierNoteSupport(documentId, dorsale);
  const lignes = await lireLignes(identifiant, dorsale);
  const pieces = await Promise.all(lignes.map(async (ligne) => {
    const { data, error } = await dorsale.supabase.storage
      .from(BUCKET_PIECES_JOINTES)
      .createSignedUrl(ligne.storage_path, 3600);
    if (error || !data?.signedUrl) return null;
    return pieceDepuisLigne(ligne, data.signedUrl);
  }));
  return pieces.filter((piece): piece is PieceJointeDocument => piece !== null);
}

export async function supprimerPieceJointe(documentId: string, pieceId: string): Promise<void> {
  const dorsale = await dorsaleCompte();
  const identifiant = await verifierNoteSupport(documentId, dorsale);
  const { data, error } = await dorsale.supabase
    .from(TABLE_PIECES_JOINTES)
    .select("id, storage_path")
    .eq("user_id", dorsale.userId)
    .eq("document_id", identifiant)
    .eq("id", pieceId)
    .maybeSingle();
  verifier("lecture de la pièce jointe à supprimer", error);
  if (!data) throw new Error("Pièce jointe introuvable.");
  const chemin = String(data.storage_path);
  if (!cheminAttendu(dorsale.userId, identifiant, chemin)) throw new Error("Chemin de fichier invalide.");
  const { error: stockageErreur } = await dorsale.supabase.storage
    .from(BUCKET_PIECES_JOINTES)
    .remove([chemin]);
  verifier("suppression du PDF", stockageErreur);
  const { error: suppressionErreur } = await dorsale.supabase
    .from(TABLE_PIECES_JOINTES)
    .delete()
    .eq("user_id", dorsale.userId)
    .eq("document_id", identifiant)
    .eq("id", pieceId);
  verifier("suppression de la pièce jointe", suppressionErreur);
  revalidatePath("/atelier");
}

export async function supprimerStockagePiecesJointes(
  documentId: string,
  dorsaleFournie?: DorsaleCompte,
): Promise<void> {
  const dorsale = dorsaleFournie ?? (await dorsaleCompte());
  const identifiant = verifierIdentifiantDocument(documentId);
  const lignes = await lireLignes(identifiant, dorsale);
  if (lignes.length === 0) return;
  const { error } = await dorsale.supabase.storage
    .from(BUCKET_PIECES_JOINTES)
    .remove(lignes.map((ligne) => ligne.storage_path));
  verifier("suppression des PDF du document", error);
}
