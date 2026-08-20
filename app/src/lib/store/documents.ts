/** Accès serveur au corpus Markdown. */

import "server-only";

import { cache } from "react";
import { revalidatePath } from "next/cache";
import { dorsaleCompte, type DorsaleCompte } from "./db";
import { ligneVersEntite, verifier } from "./supabase-backend";
import { reconstruireIndexDocumentaire } from "@/lib/documents/index";
import { validerTailleMarkdown } from "@/lib/documents/archive";
import { analyserDocumentMarkdown, SCHEMA_MARKDOWN, type FrontMatter } from "@/lib/documents/markdown";
import type {
  ApercuDocument,
  LigneDocument,
  ResumeSnapshotDocument,
  SnapshotDocument,
} from "@/lib/documents/types-documents";
import {
  memeProductionHorsHorodatage,
  type DocumentProductionPreuve,
} from "@/lib/documents/production";
import { supprimerStockagePiecesJointes } from "./document-attachments";

const TABLE_DOCUMENTS = "documents";
const TABLE_LIENS = "document_links";
const TABLE_SNAPSHOTS = "document_snapshots";

function verifierIdentifiant(id: string): string {
  const propre = id.trim();
  if (!/^[a-z0-9][a-z0-9-]*$/.test(propre)) {
    throw new Error("Identifiant documentaire invalide.");
  }
  return propre;
}

async function lireDocumentsDepuisDorsale(
  dorsale: DorsaleCompte,
): Promise<LigneDocument[]> {
  const { data, error } = await dorsale.supabase
    .from(TABLE_DOCUMENTS)
    .select("id, contenu_md, created_at, updated_at, titre, type, tags, schema_version, frontmatter")
    .eq("user_id", dorsale.userId)
    .order("updated_at", { ascending: false });
  verifier("lecture des documents", error);
  return ((data ?? []) as Record<string, unknown>[]).map((ligne) =>
    ligneVersEntite<LigneDocument>(ligne),
  );
}

function metadataDepuisContenu(id: string, contenuMd: string) {
  const analyse = analyserDocumentMarkdown(id, contenuMd);
  const tags = analyse.frontMatter.tags;
  return {
    titre: analyse.titre,
    type: analyse.type ?? "document",
    tags: Array.isArray(tags) ? tags : typeof tags === "string" && tags.trim() ? [tags] : [],
    schema_version: analyse.schema,
    frontmatter: analyse.frontMatter,
  };
}

function frontMatterDepuisLigne(ligne: Record<string, unknown>): FrontMatter {
  const valeur = ligne.frontmatter;
  return valeur && typeof valeur === "object" && !Array.isArray(valeur)
    ? valeur as FrontMatter
    : {};
}

async function lireApercusDocumentsDepuisDorsale(
  dorsale: DorsaleCompte,
): Promise<ApercuDocument[]> {
  const { data, error } = await dorsale.supabase
    .from(TABLE_DOCUMENTS)
    .select("id, titre, type, tags, schema_version, frontmatter, created_at, updated_at")
    .eq("user_id", dorsale.userId)
    .order("updated_at", { ascending: false });
  verifier("lecture des aperçus documentaires", error);

  const { data: liensData, error: liensErreur } = await dorsale.supabase
    .from(TABLE_LIENS)
    .select("source_id, cible, libelle, ancre")
    .eq("user_id", dorsale.userId);
  verifier("lecture des liens documentaires", liensErreur);

  const liensParSource = new Map<string, Array<{ cible: string; libelle?: string; ancre?: string }>>();
  for (const ligne of (liensData ?? []) as Record<string, unknown>[]) {
    const sourceId = String(ligne.source_id);
    const liens = liensParSource.get(sourceId) ?? [];
    liens.push({
      cible: String(ligne.cible),
      ...(typeof ligne.libelle === "string" && ligne.libelle ? { libelle: ligne.libelle } : {}),
      ...(typeof ligne.ancre === "string" && ligne.ancre ? { ancre: ligne.ancre } : {}),
    });
    liensParSource.set(sourceId, liens);
  }

  return ((data ?? []) as Record<string, unknown>[]).map((ligne) => {
    const schema = typeof ligne.schema_version === "string" ? ligne.schema_version : null;
    const frontMatter = frontMatterDepuisLigne(ligne);
    const tags = Array.isArray(ligne.tags)
      ? ligne.tags.filter((tag): tag is string => typeof tag === "string")
      : [];
    return {
      id: String(ligne.id),
      titre: typeof ligne.titre === "string" && ligne.titre ? ligne.titre : String(ligne.id),
      type: typeof ligne.type === "string" && ligne.type ? ligne.type : "document",
      tags,
      schema,
      schemaCompatible: schema === null || schema === SCHEMA_MARKDOWN,
      frontMatter,
      liens: liensParSource.get(String(ligne.id)) ?? [],
      createdAt: typeof ligne.created_at === "string" ? ligne.created_at : undefined,
      updatedAt: typeof ligne.updated_at === "string" ? ligne.updated_at : undefined,
    } satisfies ApercuDocument;
  });
}

export const lireDocuments = cache(async (): Promise<LigneDocument[]> => {
  return lireDocumentsDepuisDorsale(await dorsaleCompte());
});

/** Lecture légère de l'explorateur : aucun corps Markdown n'est transféré. */
export const lireApercusDocuments = cache(async (): Promise<ApercuDocument[]> => {
  return lireApercusDocumentsDepuisDorsale(await dorsaleCompte());
});

export async function lireDocument(id: string): Promise<LigneDocument> {
  const dorsale = await dorsaleCompte();
  const identifiant = verifierIdentifiant(id);
  const { data, error } = await dorsale.supabase
    .from(TABLE_DOCUMENTS)
    .select("id, contenu_md, created_at, updated_at, titre, type, tags, schema_version, frontmatter")
    .eq("user_id", dorsale.userId)
    .eq("id", identifiant)
    .maybeSingle();
  verifier("lecture du document", error);
  if (!data) throw new Error("Document introuvable.");
  return ligneVersEntite<LigneDocument>(data as Record<string, unknown>);
}

/**
 * Supprime une note qui n'a encore rien démontré.
 *
 * La règle n'est pas le rôle, c'est la preuve. Une fiche ayant produit un
 * snapshot reste conservée : le snapshot porte une preuve historique et la
 * FK documentaire la protège déjà contre une suppression silencieuse. Tant
 * qu'aucun snapshot n'existe, la fiche n'est qu'une intention déclarée — et une
 * intention se retire.
 *
 * Restreindre la suppression au seul rôle `support` enfermait la personne avec
 * ses brouillons : une note opérationnelle ouverte par erreur ne pouvait plus
 * disparaître, alors qu'elle n'avait produit aucune mesure. Le rôle décrit une
 * intention, il ne protège rien (ADR-064) ; c'est la preuve qui protège.
 *
 * Une projection n'est pas concernée : elle n'existe pas en base.
 */
export async function supprimerDocument(id: string): Promise<void> {
  const { supabase, userId } = await dorsaleCompte();
  const identifiant = verifierIdentifiant(id);
  const { data: document, error: lectureErreur } = await supabase
    .from(TABLE_DOCUMENTS)
    .select("frontmatter")
    .eq("user_id", userId)
    .eq("id", identifiant)
    .maybeSingle();
  verifier("lecture du document à supprimer", lectureErreur);
  if (!document) throw new Error("Document introuvable.");

  const frontMatter = frontMatterDepuisLigne(document as Record<string, unknown>);
  if (frontMatter.role !== "support" && frontMatter.role !== "operationnel") {
    throw new Error("Seules les notes capturées peuvent être supprimées depuis l'Atelier.");
  }

  const { data: snapshots, error: snapshotsErreur } = await supabase
    .from(TABLE_SNAPSHOTS)
    .select("id")
    .eq("user_id", userId)
    .eq("document_id", identifiant)
    .limit(1);
  verifier("vérification des snapshots du document", snapshotsErreur);
  if ((snapshots ?? []).length > 0) {
    throw new Error("Cette note possède une version figée et ne peut plus être supprimée.");
  }

  await supprimerStockagePiecesJointes(identifiant, { supabase, userId, courriel: undefined });

  const { error } = await supabase
    .from(TABLE_DOCUMENTS)
    .delete()
    .eq("user_id", userId)
    .eq("id", identifiant);
  verifier("suppression de la note", error);
  revalidatePath("/atelier");
  revalidatePath("/");
}

export const lireApercusSnapshots = cache(async (): Promise<ResumeSnapshotDocument[]> => {
  const { supabase, userId } = await dorsaleCompte();
  const { data, error } = await supabase
    .from(TABLE_SNAPSHOTS)
    .select("id, document_id, version, capture_reason, captured_at")
    .eq("user_id", userId)
    .order("captured_at", { ascending: false });
  verifier("lecture des snapshots documentaires", error);
  return ((data ?? []) as Record<string, unknown>[]).map((ligne) =>
    ligneVersEntite<ResumeSnapshotDocument>(ligne),
  );
});

async function synchroniserLiens(
  contenu: LigneDocument[],
  dorsaleFournie?: DorsaleCompte,
  sourcesCiblees?: readonly string[],
): Promise<void> {
  const { supabase, userId } = dorsaleFournie ?? (await dorsaleCompte());
  const [competences, exercices] = await Promise.all([
    supabase.from("competences").select("code").eq("user_id", userId),
    supabase.from("exercises").select("id").eq("user_id", userId),
  ]);
  verifier("lecture des cibles documentaires", competences.error);
  verifier("lecture des exercices documentaires", exercices.error);
  const ciblesConnues = [
    ...((competences.data ?? []) as Array<{ code: string }>).map((ligne) => ligne.code),
    ...((exercices.data ?? []) as Array<{ id: string }>).flatMap((ligne) => [ligne.id, `exercice:${ligne.id}`]),
  ];
  const index = reconstruireIndexDocumentaire(contenu, ciblesConnues);
  const sources = sourcesCiblees ? new Set(sourcesCiblees) : null;
  let suppression = supabase.from(TABLE_LIENS).delete().eq("user_id", userId);
  if (sources && sources.size > 0) {
    suppression = suppression.in("source_id", [...sources]);
  }
  const { error: suppressionErreur } = await suppression;
  verifier("reconstruction des liens documentaires", suppressionErreur);

  const liens = sources
    ? index.liens.filter(({ sourceId }) => sources.has(sourceId))
    : index.liens;
  if (liens.length === 0) return;
  const lignes = [...new Map(liens.map(({ sourceId, cible, lien, resolu }) => [
    `${sourceId}\u0000${cible}\u0000${lien.ancre ?? ""}`,
    {
    user_id: userId,
    source_id: sourceId,
    cible,
    libelle: lien.libelle ?? null,
    ancre: lien.ancre ?? "",
    resolu,
    },
  ])).values()];
  const { error } = await supabase.from(TABLE_LIENS).insert(lignes);
  verifier("écriture des liens documentaires", error);
}

export async function creerDocument(
  id: string,
  contenuMd: string,
  dorsaleFournie?: DorsaleCompte,
): Promise<void> {
  validerTailleMarkdown(contenuMd);
  const metadata = metadataDepuisContenu(id, contenuMd);
  const { supabase, userId } = dorsaleFournie ?? (await dorsaleCompte());
  const identifiant = verifierIdentifiant(id);
  const { error } = await supabase.from(TABLE_DOCUMENTS).insert({
    user_id: userId,
    id: identifiant,
    contenu_md: contenuMd,
    ...metadata,
  });
  verifier("création du document", error);
  const documents = await lireDocumentsDepuisDorsale({ supabase, userId, courriel: undefined });
  await synchroniserLiens(documents, { supabase, userId, courriel: undefined }, [identifiant]);
  revalidatePath("/atelier");
}

export async function creerDocuments(
  documentsAInserer: Array<{ id: string; contenuMd: string }>,
): Promise<void> {
  if (documentsAInserer.length === 0) return;
  documentsAInserer.forEach(({ contenuMd }) => validerTailleMarkdown(contenuMd));
  const dorsale = await dorsaleCompte();
  const lignes = documentsAInserer.map((document) => ({
    user_id: dorsale.userId,
    id: verifierIdentifiant(document.id),
    contenu_md: document.contenuMd,
    ...metadataDepuisContenu(document.id, document.contenuMd),
  }));
  const { error } = await dorsale.supabase.from(TABLE_DOCUMENTS).insert(lignes);
  verifier("création groupée des documents", error);
  const documents = await lireDocumentsDepuisDorsale(dorsale);
  await synchroniserLiens(documents, dorsale, lignes.map((ligne) => ligne.id));
  revalidatePath("/atelier");
}

export async function modifierDocument(
  id: string,
  contenuMd: string,
  capturerRevision = false,
  updatedAtAttendu?: string,
): Promise<{ modifie: boolean; snapshot: SnapshotDocument | null; updatedAt: string }> {
  validerTailleMarkdown(contenuMd);
  const { supabase, userId } = await dorsaleCompte();
  const identifiant = verifierIdentifiant(id);
  const { data: actuel, error: lectureErreur } = await supabase
    .from(TABLE_DOCUMENTS)
    .select("id, contenu_md, updated_at")
    .eq("user_id", userId)
    .eq("id", identifiant)
    .maybeSingle();
  verifier("lecture du document à modifier", lectureErreur);
  if (!actuel) throw new Error("Document introuvable.");
  const updatedAtActuel = String(actuel.updated_at);
  if (updatedAtAttendu && updatedAtActuel !== updatedAtAttendu) {
    throw new Error("Document modifié ailleurs. Recharge la fiche avant de l'enregistrer.");
  }
  const modifie = String(actuel.contenu_md) !== contenuMd;
  if (!modifie && !capturerRevision) return { modifie: false, snapshot: null, updatedAt: updatedAtActuel };

  let updatedAt = updatedAtActuel;
  if (modifie) {
    const { data, error } = await supabase
      .from(TABLE_DOCUMENTS)
      .update({ contenu_md: contenuMd, ...metadataDepuisContenu(identifiant, contenuMd) })
      .eq("user_id", userId)
      .eq("id", identifiant)
      .eq("updated_at", updatedAtActuel)
      .select("id, updated_at")
      .maybeSingle();
    verifier("modification du document", error);
    if (!data) throw new Error("Document modifié ailleurs. Recharge la fiche avant de l'enregistrer.");
    updatedAt = String(data.updated_at);
  }

  const snapshot = capturerRevision
    ? await creerSnapshotDocument(identifiant, "révision éditoriale", {
      supabase,
      userId,
      courriel: undefined,
    })
    : null;

  if (modifie) {
    const documents = await lireDocumentsDepuisDorsale({ supabase, userId, courriel: undefined });
    await synchroniserLiens(documents, { supabase, userId, courriel: undefined }, [identifiant]);
  }
  revalidatePath("/atelier");
  return { modifie, snapshot, updatedAt };
}

export async function creerSnapshotDocument(
  documentId: string,
  captureReason: string,
  dorsaleFournie?: DorsaleCompte,
): Promise<SnapshotDocument> {
  const dorsale = dorsaleFournie ?? (await dorsaleCompte());
  const identifiant = verifierIdentifiant(documentId);
  const { data: document, error: lectureErreur } = await dorsale.supabase
    .from(TABLE_DOCUMENTS)
    .select("id, contenu_md")
    .eq("user_id", dorsale.userId)
    .eq("id", identifiant)
    .maybeSingle();
  verifier("lecture du document à figer", lectureErreur);
  if (!document) throw new Error("Document introuvable.");

  const { data: dernier, error: versionErreur } = await dorsale.supabase
    .from(TABLE_SNAPSHOTS)
    .select("version")
    .eq("user_id", dorsale.userId)
    .eq("document_id", identifiant)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  verifier("lecture de la version du snapshot", versionErreur);

  const version = typeof dernier?.version === "number" ? dernier.version + 1 : 1;
  const snapshot = {
    id: `${identifiant}-v${version}`,
    document_id: identifiant,
    version,
    contenu_md: String(document.contenu_md),
    capture_reason: captureReason,
    captured_at: new Date().toISOString(),
  };
  const { error: insertionErreur } = await dorsale.supabase
    .from(TABLE_SNAPSHOTS)
    .insert({ user_id: dorsale.userId, ...snapshot });
  verifier("création du snapshot documentaire", insertionErreur);

  return ligneVersEntite<SnapshotDocument>({
    id: snapshot.id,
    document_id: snapshot.document_id,
    version: snapshot.version,
    contenu_md: snapshot.contenu_md,
    capture_reason: snapshot.capture_reason,
    captured_at: snapshot.captured_at,
  });
}

/**
 * Capture un contenu produit et le fige immédiatement.
 *
 * L'écriture du document reste éditable pour les corrections futures ; le
 * snapshot retourné, lui, ne peut être ni modifié ni supprimé par le client.
 */
export async function capturerDocumentProduction(
  production: DocumentProductionPreuve,
  captureReason: string,
): Promise<{ documentId: string; snapshotId: string }> {
  const dorsale = await dorsaleCompte();
  const identifiant = verifierIdentifiant(production.id);
  const { data: existant, error: lectureErreur } = await dorsale.supabase
    .from(TABLE_DOCUMENTS)
    .select("contenu_md")
    .eq("user_id", dorsale.userId)
    .eq("id", identifiant)
    .maybeSingle();
  verifier("lecture de la production déjà capturée", lectureErreur);

  if (existant) {
    // Une RPC peut échouer après cette capture, puis être rejouée. La date de
    // la nouvelle soumission change, pas la production. On réutilise le
    // snapshot déjà figé uniquement si tout le contenu hors horodatage est
    // identique ; une réponse ou un support différent est refusé explicitement.
    if (
      typeof existant.contenu_md !== "string" ||
      !memeProductionHorsHorodatage(existant.contenu_md, production.contenuMd)
    ) {
      throw new Error(
        `La production ${identifiant} existe déjà avec un contenu différent : clôture refusée.`,
      );
    }

    const { data: snapshotExistant, error: snapshotErreur } = await dorsale.supabase
      .from(TABLE_SNAPSHOTS)
      .select("id")
      .eq("user_id", dorsale.userId)
      .eq("document_id", identifiant)
      .order("version", { ascending: true })
      .limit(1)
      .maybeSingle();
    verifier("lecture du snapshot de production existant", snapshotErreur);
    if (snapshotExistant) {
      if (typeof snapshotExistant.id !== "string" || snapshotExistant.id.length === 0) {
        throw new Error(`Snapshot invalide pour la production ${identifiant}.`);
      }
      return { documentId: identifiant, snapshotId: snapshotExistant.id };
    }
  } else {
    await creerDocument(identifiant, production.contenuMd, dorsale);
  }

  const snapshot = await creerSnapshotDocument(production.id, captureReason, dorsale);
  return { documentId: identifiant, snapshotId: snapshot.id };
}

/**
 * Crée la fiche d'un exercice, ou y ajoute le passage qui vient d'avoir lieu.
 *
 * Le corps existant n'est jamais régénéré : `enrichir` reçoit ce qui est en
 * base et n'y ajoute que sa ligne. Reconstruire la fiche à chaque passage
 * effacerait les remarques écrites entre deux.
 *
 * Aucun snapshot n'est pris : la fiche est éditoriale. Ce qui doit être figé
 * l'est déjà par `capturerDocumentProduction`, sur le document de preuve.
 *
 * L'échec n'est pas propagé. Cette écriture accompagne la fin d'un exercice ;
 * la preuve et l'Observation, elles, sont déjà enregistrées. Faire échouer la
 * clôture parce qu'une fiche documentaire n'a pas pu s'écrire ferait perdre à
 * la personne un travail réellement accompli.
 */
export async function inscrireFicheExercice(
  fiche: { id: string; contenuMd: string },
  enrichir: (contenuMd: string) => string,
): Promise<void> {
  try {
    const dorsale = await dorsaleCompte();
    const { data, error } = await dorsale.supabase
      .from(TABLE_DOCUMENTS)
      .select("contenu_md")
      .eq("user_id", dorsale.userId)
      .eq("id", verifierIdentifiant(fiche.id))
      .maybeSingle();
    verifier("lecture de la fiche d'exercice", error);

    if (!data) {
      await creerDocument(fiche.id, fiche.contenuMd, dorsale);
      return;
    }

    const existant = (data as { contenu_md: string }).contenu_md;
    const suivant = enrichir(existant);
    if (suivant !== existant) await modifierDocument(fiche.id, suivant);
  } catch (cause) {
    console.error("Fiche d'exercice non inscrite", cause);
  }
}
