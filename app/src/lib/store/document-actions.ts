"use server";

import { creerDepuisTemplate, definirArchiveFrontMatter } from "@/lib/documents/markdown";
import { formatAutorise, type RoleNote } from "@/lib/documents/roles-note";
import { creerDocument, lireDocument, modifierDocument, supprimerDocument } from "./documents";
import { dorsaleCompte, nouvelId } from "./db";
import { ligneVersEntite, verifier } from "./supabase-backend";
import type { SnapshotDocument, ResumeSnapshotDocument } from "@/lib/documents/types-documents";
import {
  enregistrerPieceJointe,
  lirePiecesJointes,
  preparerTeleversementPiece,
  annulerTeleversementPiece,
  supprimerPieceJointe,
} from "./document-attachments";
import { validerUrlRessource } from "@/lib/domain/url-ressource";

export interface MetadonneesNote {
  contexte: string;
  domaine: string;
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
 * opérationnelle ne produit une Observation qu'après une évaluation validée.
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
  if (!contexte) throw new Error("Le contexte de la fiche est obligatoire.");
  if (!domaine) throw new Error("Le domaine de la fiche est obligatoire.");
  if (contexte.length > 200) throw new Error("Le contexte de la fiche est limité à 200 caractères.");

  if (domaine !== "transversal") {
    const dorsale = await dorsaleCompte();
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

  const id = nouvelId("doc");
  const contenuMd = creerDepuisTemplate(type, id, titre, undefined, {
    role,
    contexte,
    domaine,
  });
  await creerDocument(id, contenuMd);
  return { id, contenuMd };
}

export async function supprimerDocumentAction(id: string): Promise<void> {
  await supprimerDocument(id);
}

/**
 * Crée une fiche « lien » : une adresse déclarée, un titre, des rattachements
 * facultatifs.
 *
 * Le lien n'est jamais scrapé ni converti en Connaissance : il reste une
 * ressource documentaire dont l'URL vit dans le front-matter. Les
 * rattachements sont des codes du référentiel du compte, vérifiés avant
 * l'écriture — jamais inventés. La validation d'URL passe par la seule
 * implémentation partagée (`lib/domain/url-ressource`).
 */
export async function creerLienAction(
  titre: string,
  url: string,
  codes: string[] = [],
): Promise<{ id: string }> {
  const titrePropre = titre.trim().replace(/\s+/g, " ");
  if (!titrePropre) throw new Error("Le titre du lien est obligatoire.");
  if (titrePropre.length > 200) throw new Error("Le titre du lien est limité à 200 caractères.");

  const resultatUrl = validerUrlRessource(url);
  if (!resultatUrl.valide) throw new Error(resultatUrl.erreur);

  const codesPropres = [...new Set(codes.map((code) => code.trim()).filter(Boolean))];
  const dorsale = await dorsaleCompte();
  if (codesPropres.length > 0) {
    const { data, error } = await dorsale.supabase
      .from("competences")
      .select("code")
      .eq("user_id", dorsale.userId)
      .in("code", codesPropres);
    verifier("validation des rattachements du lien", error);
    const connus = new Set(((data ?? []) as Array<{ code: string }>).map((ligne) => ligne.code));
    const inconnu = codesPropres.find((code) => !connus.has(code));
    if (inconnu) throw new Error(`La compétence ${inconnu} n'existe pas dans ce compte.`);
  }

  const id = nouvelId("doc");
  const date = new Date().toISOString().slice(0, 10);
  const base = creerDepuisTemplate("lien", id, titrePropre, date, {
    role: "support",
    url: resultatUrl.url,
  });
  const corps = codesPropres.length > 0
    ? `${base}\n${codesPropres.map((code) => `- [[${code}]]`).join("\n")}\n`
    : base;
  await creerDocument(id, corps);
  return { id };
}

export async function archiverDocumentAction(id: string): Promise<void> {
  const doc = await lireDocument(id);
  const nouveauContenu = definirArchiveFrontMatter(doc.contenuMd, true);
  await modifierDocument(id, nouveauContenu);
}

export async function restaurerDocumentAction(id: string): Promise<void> {
  const doc = await lireDocument(id);
  const nouveauContenu = definirArchiveFrontMatter(doc.contenuMd, false);
  await modifierDocument(id, nouveauContenu);
}

export async function preparerTeleversementPieceAction(
  documentId: string,
  nom: string,
  mimeType: "application/pdf" | "image/jpeg" | "image/png" | "image/webp",
): Promise<{ chemin: string; token: string }> {
  return preparerTeleversementPiece(documentId, nom, mimeType);
}

export async function enregistrerPieceJointeAction(
  documentId: string,
  chemin: string,
  nom: string,
  tailleOctets: number,
  mimeType: "application/pdf" | "image/jpeg" | "image/png" | "image/webp",
) {
  return enregistrerPieceJointe(documentId, chemin, nom, tailleOctets, mimeType);
}

export async function annulerTeleversementPieceAction(documentId: string, chemin: string): Promise<void> {
  await annulerTeleversementPiece(documentId, chemin);
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
