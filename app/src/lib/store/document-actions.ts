"use server";

import { creerDepuisTemplate } from "@/lib/documents/markdown";
import { formatAutorise, type RoleNote } from "@/lib/documents/roles-note";
import {
  nomFichierMarkdown,
  validerDocumentMarkdown,
  validerLotDocumentsMarkdown,
} from "@/lib/documents/archive";
import { creerDocument, creerDocuments, lireApercusDocuments, lireDocument, lireDocuments, modifierDocument, supprimerDocument } from "./documents";
import { dorsaleCompte, nouvelId } from "./db";
import { ligneVersEntite, verifier } from "./supabase-backend";
import type { SnapshotDocument, ResumeSnapshotDocument } from "@/lib/documents/types-documents";
import {
  enregistrerPieceJointe,
  lirePiecesJointes,
  preparerTeleversementPdf,
  annulerTeleversementPdf,
  supprimerPieceJointe,
} from "./document-attachments";

export interface MetadonneesNote {
  contexte: string;
  domaine: string;
  themeId?: string;
}

export async function creerDocumentAction(
  type: string,
  id: string,
  titre: string,
): Promise<{ id: string; contenuMd: string }> {
  const contenuMd = creerDepuisTemplate(type, id, titre);
  await creerDocument(id, contenuMd);
  return { id, contenuMd };
}

export async function creerDocumentBrutAction(
  id: string,
  contenuMd: string,
): Promise<{ id: string; contenuMd: string }> {
  await creerDocument(id, contenuMd);
  return { id, contenuMd };
}

/**
 * Capture orientée depuis le tableau de bord.
 *
 * Le rôle décrit l'intention de la fiche, pas une mesure : une note
 * opérationnelle ne devient une preuve qu'après une évaluation validée.
 */
export async function creerNoteAction(
  role: RoleNote,
  type: string,
  titre: string,
  metadonnees: MetadonneesNote,
): Promise<{ id: string; contenuMd: string }> {
  if (!formatAutorise(role, type)) {
    throw new Error("Ce format ne correspond pas au rôle de note choisi.");
  }
  const contexte = metadonnees.contexte.trim().replace(/\s+/g, " ");
  const domaine = metadonnees.domaine.trim();
  const themeId = metadonnees.themeId?.trim();
  if (!contexte) throw new Error("Le contexte de la fiche est obligatoire.");
  if (!domaine) throw new Error("Le domaine de la fiche est obligatoire.");
  if (contexte.length > 200) throw new Error("Le contexte de la fiche est limité à 200 caractères.");
  if (themeId && role !== "operationnel") {
    throw new Error("Un thème de travail ne peut être associé qu'à une note opérationnelle.");
  }

  const dorsale = domaine !== "transversal" || themeId ? await dorsaleCompte() : null;
  if (domaine !== "transversal") {
    if (!dorsale) throw new Error("La session du compte est introuvable.");
    const { data, error } = await dorsale.supabase
      .from("domaines")
      .select("id")
      .eq("user_id", dorsale.userId)
      .eq("id", domaine)
      .maybeSingle();
    verifier("validation du domaine de la note", error);
    if (!data) throw new Error("Le domaine choisi n'existe plus dans ce compte.");
  }

  if (themeId) {
    if (!dorsale) throw new Error("La session du compte est introuvable.");
    const { data, error } = await dorsale.supabase
      .from("themes")
      .select("id")
      .eq("user_id", dorsale.userId)
      .eq("id", themeId)
      .eq("archive", false)
      .maybeSingle();
    verifier("validation du thème de la note", error);
    if (!data) throw new Error("Le thème choisi n'existe plus dans ce compte.");
  }

  const id = nouvelId("doc");
  const contenuMd = creerDepuisTemplate(type, id, titre, undefined, {
    role,
    contexte,
    domaine,
    ...(themeId ? { theme_id: themeId } : {}),
  });
  await creerDocument(id, contenuMd);
  return { id, contenuMd };
}

export async function supprimerNoteSupportAction(id: string): Promise<void> {
  await supprimerDocument(id);
}

export async function supprimerDocumentAction(id: string): Promise<void> {
  await supprimerDocument(id);
}

export async function preparerTeleversementPdfAction(
  documentId: string,
  nom: string,
): Promise<{ chemin: string; token: string }> {
  return preparerTeleversementPdf(documentId, nom);
}

export async function enregistrerPieceJointeAction(
  documentId: string,
  chemin: string,
  nom: string,
  tailleOctets: number,
) {
  return enregistrerPieceJointe(documentId, chemin, nom, tailleOctets);
}

export async function annulerTeleversementPdfAction(documentId: string, chemin: string): Promise<void> {
  await annulerTeleversementPdf(documentId, chemin);
}

export async function lirePiecesJointesAction(documentId: string) {
  return lirePiecesJointes(documentId);
}

export async function supprimerPieceJointeAction(documentId: string, pieceId: string): Promise<void> {
  await supprimerPieceJointe(documentId, pieceId);
}

export async function sauvegarderDocumentAction(
  id: string,
  contenuMd: string,
  capturerRevision = false,
  updatedAtAttendu?: string,
): Promise<{
  version: number | null;
  revisionFigee: boolean;
  updatedAt: string;
  snapshot?: ResumeSnapshotDocument;
} | null> {
  const resultat = await modifierDocument(id, contenuMd, capturerRevision, updatedAtAttendu);
  if (!resultat.modifie && !resultat.snapshot) return null;
  return {
    version: resultat.snapshot?.version ?? null,
    revisionFigee: resultat.snapshot !== null,
    updatedAt: resultat.updatedAt,
    snapshot: resultat.snapshot
      ? {
        id: resultat.snapshot.id,
        documentId: resultat.snapshot.documentId,
        version: resultat.snapshot.version,
        captureReason: resultat.snapshot.captureReason,
        capturedAt: resultat.snapshot.capturedAt,
      }
      : undefined,
  };
}

/** Charge le corps d'une fiche à la demande, après affichage de son aperçu. */
export async function lireDocumentAction(
  id: string,
): Promise<{ id: string; contenuMd: string; updatedAt?: string }> {
  const document = await lireDocument(id);
  return { id: document.id, contenuMd: document.contenuMd, updatedAt: document.updatedAt };
}

/**
 * Importe un document Markdown sans remplacer silencieusement un document
 * existant. Les liens sont reconstruits par `creerDocument` après l'insertion.
 */
export async function importerDocumentAction(
  nomFichier: string,
  contenuMd: string,
): Promise<{ id: string; contenuMd: string }> {
  const importe = validerDocumentMarkdown(nomFichier, contenuMd);
  const documents = await lireApercusDocuments();
  if (documents.some((document) => document.id === importe.id)) {
    throw new Error(`Import Markdown refusé : le document « ${importe.id} » existe déjà.`);
  }

  await creerDocument(importe.id, importe.contenuMd);
  return { id: importe.id, contenuMd: importe.contenuMd };
}

export async function exporterDocumentsMarkdownAction(): Promise<
  Array<{ nomFichier: string; contenuMd: string }>
> {
  const documents = await lireDocuments();
  return documents.map((document) => ({
    nomFichier: nomFichierMarkdown(document.id),
    contenuMd: document.contenuMd,
  }));
}

/** Valide tout le lot avant la première écriture pour éviter un import partiel. */
export async function importerDocumentsAction(
  fichiers: Array<{ nomFichier: string; contenuMd: string }>,
): Promise<{ importes: number }> {
  const documents = await lireApercusDocuments();
  const importes = validerLotDocumentsMarkdown(
    fichiers,
    documents.map((document) => document.id),
  );

  await creerDocuments(importes.map(({ id, contenuMd }) => ({ id, contenuMd })));
  return { importes: importes.length };
}

export async function lireSnapshotAction(
  documentId: string,
  snapshotId: string,
): Promise<SnapshotDocument> {
  const { supabase, userId } = await dorsaleCompte();
  const { data, error } = await supabase
    .from("document_snapshots")
    .select("id, document_id, version, contenu_md, capture_reason, captured_at, created_at")
    .eq("user_id", userId)
    .eq("document_id", documentId)
    .eq("id", snapshotId)
    .maybeSingle();
  verifier("lecture du snapshot documentaire", error);
  if (!data) throw new Error("Snapshot documentaire introuvable.");
  return ligneVersEntite<SnapshotDocument>(data);
}
