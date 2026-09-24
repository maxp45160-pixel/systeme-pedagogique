"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { DepotDocumentaire } from "@/lib/documents/depot";
import { appliquerRangementDepot, type RangementRessourceDepot } from "@/lib/documents/organisation-depot";
import { definirChampsFrontMatter } from "@/lib/documents/markdown";
import { validerRangementActif } from "@/lib/documents/validation-rangement";
import { lireDepotDocumentaire } from "./depot-documents";
import { lireDocument, modifierDocument, resynchroniserLiensDocument } from "./documents";
import { lireReferentiel } from "./referentiel";

type EntreeRangementManuel = {
  documentId: string;
  updatedAtAttendu: string;
  titre: string;
  type: string;
  domaineId?: string;
  codes: string[];
};

function validerEntree(brut: unknown): EntreeRangementManuel {
  if (!brut || typeof brut !== "object" || Array.isArray(brut)) throw new Error("Rangement invalide.");
  const entree = brut as Record<string, unknown>;
  if (typeof entree.documentId !== "string" || !/^[a-z0-9][a-z0-9-]{0,119}$/.test(entree.documentId)) throw new Error("Ressource invalide.");
  if (typeof entree.updatedAtAttendu !== "string" || !entree.updatedAtAttendu.trim() || entree.updatedAtAttendu.length > 80) throw new Error("Version de ressource invalide.");
  if (typeof entree.titre !== "string" || !entree.titre.trim() || entree.titre.length > 200 || /[\r\n]/.test(entree.titre)) throw new Error("Titre de ressource invalide.");
  if (typeof entree.type !== "string" || entree.type.length > 80) throw new Error("Type de support invalide.");
  if (entree.domaineId !== undefined && (typeof entree.domaineId !== "string" || entree.domaineId.length > 120 || /[\r\n]/.test(entree.domaineId))) throw new Error("Domaine de rangement invalide.");
  if (!Array.isArray(entree.codes) || entree.codes.length > 1000 || entree.codes.some((code) => typeof code !== "string" || !code || code.length > 120 || /[\r\n]/.test(code))) throw new Error("Compétences de rangement invalides.");
  if (new Set(entree.codes).size !== entree.codes.length) throw new Error("Compétences de rangement répétées.");
  return {
    documentId: entree.documentId,
    updatedAtAttendu: entree.updatedAtAttendu,
    titre: entree.titre.trim(),
    type: entree.type,
    ...(typeof entree.domaineId === "string" && entree.domaineId.trim() ? { domaineId: entree.domaineId } : {}),
    codes: [...entree.codes].sort(),
  };
}

function empreinteRangement(entree: EntreeRangementManuel): string {
  return createHash("sha256").update(JSON.stringify({
    titre: entree.titre,
    type: entree.type,
    domaineId: entree.domaineId ?? "",
    codes: entree.codes,
    aTrier: !entree.domaineId,
  })).digest("hex");
}

/** Rangement humain d'une ressource V2, indépendant de l'état des analyses IA. */
export async function enregistrerRangementManuelSansAnalyseAction(brut: EntreeRangementManuel): Promise<DepotDocumentaire> {
  const entree = validerEntree(brut);
  const depot = await lireDepotDocumentaire(entree.documentId);
  if (depot.version !== 2) throw new Error("Cette ressource n'est pas compatible avec le rangement manuel.");
  const [document, referentiel] = await Promise.all([lireDocument(entree.documentId), lireReferentiel()]);
  if (document.updatedAt !== depot.modifieLe) throw new Error("La ressource a changé pendant la lecture. Actualisez son rangement.");
  const rangement: RangementRessourceDepot = {
    titre: entree.titre,
    type: entree.type,
    ...(entree.domaineId ? { domaineId: entree.domaineId } : {}),
    codes: entree.codes,
    // Absence d'analyse réelle : le champ reste vide, sans identifiant fabriqué.
    analyseId: "",
    aTrier: !entree.domaineId,
  };
  validerRangementActif(rangement, referentiel.domaines, referentiel.actifs);
  const empreinte = empreinteRangement(entree);
  const dejaApplique = document.frontmatter?.rangement_empreinte === empreinte
    && document.frontmatter?.rangement_origine === "personne"
    && !document.frontmatter?.rangement_analyse_id
    && depot.titre === entree.titre
    && depot.type === entree.type
    && (depot.domaineId ?? "") === (entree.domaineId ?? "")
    && depot.rangementStatut === (entree.domaineId ? "rangee" : "a-trier")
    && JSON.stringify([...depot.competencesLiees].sort()) === JSON.stringify(entree.codes);
  if (dejaApplique) {
    await resynchroniserLiensDocument(entree.documentId);
    return depot;
  }
  if (depot.modifieLe !== entree.updatedAtAttendu) throw new Error("La ressource a été modifiée. Actualisez avant de confirmer son rangement.");
  const contenu = definirChampsFrontMatter(
    appliquerRangementDepot(document.contenuMd, rangement, new Date().toISOString(), empreinte),
    { rangement_origine: "personne" },
  );
  await modifierDocument(entree.documentId, contenu, false, entree.updatedAtAttendu);
  revalidatePath("/app");
  return lireDepotDocumentaire(entree.documentId);
}
