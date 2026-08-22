/** Accès serveur aux fichiers attachés aux notes support (PDF et images). */

import "server-only";

import { revalidatePath } from "next/cache";
import { dorsaleCompte, type DorsaleCompte } from "./db";
import { verifier } from "./supabase-backend";
import type { PieceJointeDocument } from "@/lib/documents/types-documents";
import {
  BUCKET_PIECES_JOINTES,
  MAX_PIECE_OCTETS,
  MIME_PDF,
  estMimePieceJointe,
  extensionPourMime,
  mimeDepuisNomFichier,
  type MimePieceJointe,
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

function normaliserNomPiece(nom: string, mimeDeclare: MimePieceJointe): string {
  const dernierSegment = nom.trim().replace(/^.*[\\/]/, "");
  if (!dernierSegment || !mimeDepuisNomFichier(dernierSegment)) {
    throw new Error("Le nom du fichier doit porter une extension reconnue (.pdf, .jpg, .png ou .webp).");
  }
  const mimeParExtension = mimeDepuisNomFichier(dernierSegment);
  if (mimeParExtension !== mimeDeclare) {
    throw new Error("L'extension du fichier ne correspond pas à son type déclaré.");
  }
  if (dernierSegment.length > 160) throw new Error("Le nom du fichier est trop long.");
  return dernierSegment;
}

function echapperRegExp(valeur: string): string {
  return valeur.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cheminAttendu(userId: string, documentId: string, chemin: string): boolean {
  const motif = new RegExp(`^${echapperRegExp(userId)}/${echapperRegExp(documentId)}/[0-9a-f-]{36}\\.(pdf|jpg|jpeg|png|webp)$`, "i");
  return motif.test(chemin);
}

function pieceDepuisLigne(ligne: LignePieceJointe, url?: string): PieceJointeDocument {
  return {
    id: ligne.id,
    nom: ligne.file_name,
    mimeType: estMimePieceJointe(ligne.mime_type) ? ligne.mime_type : MIME_PDF,
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
    throw new Error("Les pièces jointes peuvent uniquement être attachées à une note support.");
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

export async function preparerTeleversementPiece(
  documentId: string,
  nom: string,
  mimeType: MimePieceJointe,
): Promise<{ chemin: string; token: string }> {
  if (!estMimePieceJointe(mimeType)) {
    throw new Error("Seuls les fichiers PDF et les images JPEG, PNG ou WebP peuvent être attachés.");
  }
  const dorsale = await dorsaleCompte();
  const identifiant = await verifierNoteSupport(documentId, dorsale);
  normaliserNomPiece(nom, mimeType);
  const chemin = `${dorsale.userId}/${identifiant}/${crypto.randomUUID()}${extensionPourMime(mimeType)}`;
  const { data, error } = await dorsale.supabase.storage
    .from(BUCKET_PIECES_JOINTES)
    .createSignedUploadUrl(chemin);
  verifier("préparation du téléversement de la pièce jointe", error);
  if (!data?.token) throw new Error("Le téléversement n'a pas pu être préparé.");
  return { chemin, token: data.token };
}

export async function enregistrerPieceJointe(
  documentId: string,
  chemin: string,
  nom: string,
  tailleOctets: number,
  mimeType: MimePieceJointe,
): Promise<PieceJointeDocument> {
  if (!estMimePieceJointe(mimeType)) {
    throw new Error("Seuls les fichiers PDF et les images JPEG, PNG ou WebP peuvent être attachés.");
  }
  const dorsale = await dorsaleCompte();
  const identifiant = await verifierNoteSupport(documentId, dorsale);
  const nomNormalise = normaliserNomPiece(nom, mimeType);
  if (!cheminAttendu(dorsale.userId, identifiant, chemin)) throw new Error("Chemin de fichier invalide.");
  if (!Number.isInteger(tailleOctets) || tailleOctets <= 0 || tailleOctets > MAX_PIECE_OCTETS) {
    throw new Error("Le fichier doit peser entre 1 octet et 10 Mo.");
  }

  const dossier = `${dorsale.userId}/${identifiant}`;
  const nomObjet = chemin.slice(dossier.length + 1);
  const { data: objets, error: objetsErreur } = await dorsale.supabase.storage
    .from(BUCKET_PIECES_JOINTES)
    .list(dossier, { limit: 100, search: nomObjet });
  verifier("vérification du fichier téléversé", objetsErreur);
  const objet = (objets ?? []).find((candidat) => candidat.name === nomObjet);
  if (!objet) throw new Error("Le fichier téléversé est introuvable.");
  const metadata = objet.metadata && typeof objet.metadata === "object"
    ? objet.metadata as Record<string, unknown>
    : {};
  const tailleStockee = typeof metadata.size === "number" ? metadata.size : tailleOctets;
  const typeStocke = typeof metadata.mimetype === "string" ? metadata.mimetype : mimeType;
  if (typeStocke !== mimeType || tailleStockee <= 0 || tailleStockee > MAX_PIECE_OCTETS) {
    await dorsale.supabase.storage.from(BUCKET_PIECES_JOINTES).remove([chemin]);
    throw new Error("Le fichier téléversé ne correspond pas au type déclaré.");
  }

  const { data, error } = await dorsale.supabase
    .from(TABLE_PIECES_JOINTES)
    .insert({
      user_id: dorsale.userId,
      document_id: identifiant,
      storage_path: chemin,
      file_name: nomNormalise,
      mime_type: mimeType,
      size_bytes: tailleStockee,
    })
    .select("id, document_id, storage_path, file_name, mime_type, size_bytes, created_at")
    .single();
  if (error) {
    await dorsale.supabase.storage.from(BUCKET_PIECES_JOINTES).remove([chemin]);
  }
  verifier("enregistrement de la pièce jointe", error);
  revalidatePath("/atelier");
  return pieceDepuisLigne(data as LignePieceJointe);
}

export async function annulerTeleversementPiece(documentId: string, chemin: string): Promise<void> {
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
  verifier("suppression de la pèèce jointe", stockageErreur);
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
  verifier("suppression des fichiers du document", error);
}
