"use server";

/**
 * Extraction du texte d'un PDF attaché à une fiche support — le cache jetable
 * de « Faire lire par le tuteur » (chantier C1).
 *
 * Le chemin : l'objet Storage est téléchargé via le client SSR du compte — la
 * RLS s'applique, personne ne lit le PDF d'un autre. Le texte extrait est
 * nettoyé puis tronqué à une limite constante (`LIMITE_EXTRAIT_CARACTERES`),
 * et mis en cache dans `documents.frontmatter` via la mise à jour documentaire
 * existante (`modifierDocument`, qui recalcule la colonne frontmatter depuis
 * le Markdown). Un échec d'extraction est une erreur affichée : JAMAIS un
 * texte fabriqué, même partiellement.
 *
 * Ce cache n'est pas une mesure : il ne produit aucune Observation ni
 * Connaissance, il alimente uniquement le prompt du tuteur.
 */

import { extractText, getDocumentProxy } from "unpdf";
import { dorsaleCompte } from "./db";
import { verifier } from "./supabase-backend";
import { lireDocument, modifierDocument } from "./documents";
import { BUCKET_PIECES_JOINTES, MIME_PDF } from "@/lib/documents/pieces-jointes";
import {
  LIMITE_EXTRAIT_CARACTERES,
  aplatirPourFrontMatter,
  lireCacheExtrait,
  nettoyerTextePdf,
  tronquerTexteExtrait,
} from "@/lib/documents/extraction-pdf";
import { definirChampsFrontMatter } from "@/lib/documents/markdown";

export interface ExtraitSupport {
  /** Texte nettoyé et tronqué à `LIMITE_EXTRAIT_CARACTERES`. */
  extrait: string;
  /** Date ISO de production du cache — un horodatage, pas une mesure. */
  extraitLe: string;
  /** Vrai quand un cache valide a servi sans re-télécharger le PDF. */
  depuisCache: boolean;
}

export async function extraireTexteSupportAction(
  documentId: string,
  sourceAttachmentId?: string,
): Promise<ExtraitSupport> {
  const identifiant = documentId.trim();
  if (!identifiant) throw new Error("Fiche introuvable.");

  const dorsale = await dorsaleCompte();
  const document = await lireDocument(identifiant);
  if (document.frontmatter?.role !== "support") {
    throw new Error("Seule une fiche support peut être lue par le tuteur.");
  }

  // Dernier PDF attaché : c'est lui que « faire lire » désigne.
  let requete = dorsale.supabase
    .from("document_attachments")
    .select("id, storage_path")
    .eq("user_id", dorsale.userId)
    .eq("document_id", identifiant)
    .eq("mime_type", MIME_PDF);
  if (sourceAttachmentId) requete = requete.eq("id", sourceAttachmentId);
  const { data: lignes, error } = await requete
    .order("created_at", { ascending: false })
    .limit(1);
  verifier("lecture de la pièce jointe PDF", error);
  const piece = ((lignes ?? []) as Array<{ id: string; storage_path: string }>)[0];
  if (!piece) {
    throw new Error(sourceAttachmentId
      ? "Le PDF source de cette séance n'est plus attaché à ce cours."
      : "Aucun PDF n'est attaché à cette ressource.");
  }

  const cache = lireCacheExtrait(document.frontmatter, piece.id);
  if (cache) {
    return { extrait: cache.texte, extraitLe: cache.extraitLe, depuisCache: true };
  }

  const telecharge = await dorsale.supabase.storage
    .from(BUCKET_PIECES_JOINTES)
    .download(piece.storage_path);
  verifier("téléchargement du PDF attaché", telecharge.error);
  if (!telecharge.data) throw new Error("Le fichier PDF attaché est introuvable.");

  let brut: string;
  try {
    const tampon = new Uint8Array(await telecharge.data.arrayBuffer());
    const pdf = await getDocumentProxy(tampon);
    const resultat = await extractText(pdf, { mergePages: true });
    brut = resultat.text;
  } catch {
    throw new Error(
      "Le texte de ce PDF n'a pas pu être lu. Rien n'a été inventé à sa place.",
    );
  }

  const nettoye = tronquerTexteExtrait(
    nettoyerTextePdf(brut),
    LIMITE_EXTRAIT_CARACTERES,
  );
  if (!nettoye) {
    throw new Error(
      "Ce PDF ne contient aucun texte extractible (probablement un scan). Rien n'a été inventé à sa place.",
    );
  }

  const extraitLe = new Date().toISOString();
  const contenuCache = definirChampsFrontMatter(document.contenuMd, {
    extraitTexte: aplatirPourFrontMatter(nettoye),
    extraitSource: piece.id,
    extraitLe,
  });
  await modifierDocument(identifiant, contenuCache);

  return { extrait: nettoye, extraitLe, depuisCache: false };
}
