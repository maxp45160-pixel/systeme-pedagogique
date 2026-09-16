"use server";

import { revalidatePath } from "next/cache";
import { analysePourClassement } from "@/lib/documents/classement-ressources";
import { encoderBrouillonClassement, lireBrouillonClassement, validerEntreeBrouillonClassement, type BrouillonClassementRessource, type EntreeBrouillonClassement } from "@/lib/documents/brouillon-classement";
import { definirChampsFrontMatter } from "@/lib/documents/markdown";
import type { DepotDocumentaire } from "@/lib/documents/depot";
import { lireDepotDocumentaire } from "./depot-documents";
import { lireDocument, modifierDocument } from "./documents";
import { lireReferentiel } from "./referentiel";

/** Un geste humain préparatoire : aucune création de domaine ou compétence. */
export async function enregistrerBrouillonClassementAction(brut: EntreeBrouillonClassement): Promise<DepotDocumentaire> {
  const entree = validerEntreeBrouillonClassement(brut);
  // Le lecteur exige le compte pilote et filtre les ressources par compte.
  const depot = await lireDepotDocumentaire(entree.documentId);
  const analyse = analysePourClassement(depot, entree.analyseId);
  const document = await lireDocument(entree.documentId);
  if (document.updatedAt !== depot.modifieLe) throw new Error("La ressource a changé pendant la lecture. Actualisez avant de garder votre choix.");
  const referentiel = await lireReferentiel();
  const d = entree.domaine;
  const domaineDisponible = (id: string) => referentiel.domaines.some((v) => v.id === id && !v.archive);
  if (d?.mode === "existant" && !domaineDisponible(d.id)) throw new Error("Le domaine choisi est absent ou archivé.");
  if (d?.mode === "nouveau" && d.parentId && !domaineDisponible(d.parentId)) throw new Error("Le domaine parent est absent ou archivé.");
  if (entree.codes.some((c) => !referentiel.actifs.some((s) => s.code === c))) throw new Error("Une compétence du brouillon est absente ou archivée.");
  if (entree.propositions.some((i) => analyse.restitution?.version !== 2 || analyse.restitution.organisation.competences[i]?.mode !== "nouvelle")) throw new Error("Une compétence du brouillon n'est pas une proposition nouvelle de cette analyse.");
  const { analyseId, domaine, codes, propositions } = entree;
  const contenuChoix = { analyseId, domaine, codes, propositions };
  const ancien = lireBrouillonClassement(document.frontmatter?.classement_brouillon);
  if (ancien && JSON.stringify({ analyseId: ancien.analyseId, domaine: ancien.domaine, codes: ancien.codes, propositions: ancien.propositions }) === JSON.stringify(contenuChoix)) return depot;
  if (depot.modifieLe !== entree.updatedAtAttendu) throw new Error("La ressource a été modifiée. Actualisez avant de garder votre choix.");
  const brouillon: BrouillonClassementRessource = { ...contenuChoix, modifieLe: new Date().toISOString(), origine: "personne" };
  const contenu = definirChampsFrontMatter(document.contenuMd, { classement_brouillon: encoderBrouillonClassement(brouillon) });
  // Les analyses sont conservées séparément de la fiche : sa version CAS
  // ne suffit pas à détecter une nouvelle analyse pendant les validations.
  analysePourClassement(await lireDepotDocumentaire(entree.documentId), entree.analyseId);
  await modifierDocument(entree.documentId, contenu, false, entree.updatedAtAttendu);
  revalidatePath("/app");
  return lireDepotDocumentaire(entree.documentId);
}
