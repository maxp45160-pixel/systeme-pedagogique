"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";

import {
  ajouterCorrectionDepot,
  creerDepotDocumentaire,
  creerRessourceDocumentaire,
  lireDepotDocumentaire,
  type NouvelleRessourceDepot,
} from "./depot-documents";
import { dorsaleCompte } from "./db";
import { lireDocument, modifierDocument, supprimerDocument, resynchroniserLiensDocument } from "./documents";
import { lireReferentiel } from "./referentiel";
import { derniereOrganisationDepot, appliquerRangementDepot, type ContexteOrganisationDepot, type RangementRessourceDepot } from "@/lib/documents/organisation-depot";
import { definirChampsFrontMatter } from "@/lib/documents/markdown";
import { validerRangementActif } from "@/lib/documents/validation-rangement";

export async function supprimerDepotAction(id: string): Promise<void> {
  await lireDepotDocumentaire(id);
  await supprimerDocument(id);
  revalidatePath("/app");
  revalidatePath("/atelier");
}

export async function creerDepotAction(note: string, cle: string) { return creerDepotDocumentaire(note,cle); }
export async function creerRessourceDepotAction(entree: NouvelleRessourceDepot, cle: string) { return creerRessourceDocumentaire(entree,cle); }
export async function lireDepotAction(id: string) { return lireDepotDocumentaire(id); }
export async function corrigerDepotAction(documentId: string, elementId: string | null, texte: string, cle: string) {
  await ajouterCorrectionDepot(documentId,elementId,texte,cle);
  return lireDepotDocumentaire(documentId);
}

export async function lireContexteOrganisationDepotAction(documentIds: string[]): Promise<{ ressources: Awaited<ReturnType<typeof lireDepotDocumentaire>>[]; referentiel: ContexteOrganisationDepot }> {
  const ids = [...new Set(documentIds)];
  if (ids.length !== documentIds.length || ids.length > 30) throw new Error("Sélection de ressources invalide.");
  const dorsale = await dorsaleCompte();
  const [ressources, referentiel] = await Promise.all([
    Promise.all(ids.map((id) => lireDepotDocumentaire(id))),
    lireReferentiel(dorsale),
  ]);
  return {
    ressources:ressources.filter((ressource) => ressource.version === 2),
    referentiel:{
      compteId:dorsale.userId,
      domaines:referentiel.domaines.filter((domaine) => !domaine.archive).map(({id,nom,prefixe,description,parentId}) => ({id,nom,prefixe,description,parentId})),
      competences:referentiel.actifs.map((competence) => ({
        code:competence.code,
        intitule:competence.intitule,
        domaine:competence.domaine,
        domaineNom:referentiel.domainesParId.get(competence.domaine)?.nom ?? competence.domaine,
      })),
    },
  };
}

export async function marquerReferentielRessourceAction(documentId: string, analyseId: string, updatedAtAttendu: string) {
  const depot = await lireDepotDocumentaire(documentId);
  if (depot.version !== 2 || derniereOrganisationDepot(depot)?.analyseId !== analyseId) throw new Error("La proposition de référentiel n'est plus la plus récente.");
  if (depot.referentielAnalyseId === analyseId) return depot;
  const document = await lireDocument(documentId);
  const contenu = definirChampsFrontMatter(document.contenuMd,{
    referentiel_revu_le:new Date().toISOString(),
    referentiel_analyse_id:analyseId,
  });
  await modifierDocument(documentId,contenu,false,updatedAtAttendu);
  revalidatePath("/app");
  return lireDepotDocumentaire(documentId);
}

export async function rangerRessourceDepotAction(documentId: string, entree: RangementRessourceDepot, updatedAtAttendu: string) {
  return enregistrerRangement(documentId, entree, updatedAtAttendu, "personne");
}

async function enregistrerRangement(documentId: string, entree: RangementRessourceDepot, updatedAtAttendu: string, origine: "personne" | "assistant") {
  const codes = [...new Set(entree.codes)];
  const depot = await lireDepotDocumentaire(documentId);
  if (depot.version !== 2 || derniereOrganisationDepot(depot)?.analyseId !== entree.analyseId) throw new Error("La proposition de rangement n'est plus la plus récente.");
  if (origine === "personne" && depot.referentielAnalyseId !== entree.analyseId) throw new Error("Relisez d'abord les propositions du référentiel.");
  const referentiel = await lireReferentiel();
  validerRangementActif(entree, referentiel.domaines, referentiel.actifs);
  const normalise = { ...entree,titre:entree.titre.trim(),codes };
  const empreinte = createHash("sha256").update(JSON.stringify({ titre:normalise.titre,type:normalise.type,domaineId:normalise.domaineId ?? "",codes:[...codes].sort(),aTrier:Boolean(normalise.aTrier) })).digest("hex");
  const document = await lireDocument(documentId);
  if (document.frontmatter?.rangement_empreinte === empreinte && depot.rangementAnalyseId === entree.analyseId) {
    await resynchroniserLiensDocument(documentId);
    return depot;
  }
  const contenu = definirChampsFrontMatter(appliquerRangementDepot(document.contenuMd,normalise,new Date().toISOString(),empreinte), { rangement_origine: origine });
  await modifierDocument(documentId,contenu,false,updatedAtAttendu);
  revalidatePath("/app");
  return lireDepotDocumentaire(documentId);
}
