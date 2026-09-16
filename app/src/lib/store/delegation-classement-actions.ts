"use server";

import { revalidatePath } from "next/cache";
import { evaluerDelegationClassement } from "@/lib/documents/delegation-classement";
import type { DepotDocumentaire } from "@/lib/documents/depot";
import { definirChampsFrontMatter } from "@/lib/documents/markdown";
import { lireContexteOrganisationDepotAction } from "./depot-actions";
import { lireDocument, modifierDocument } from "./documents";

export interface ResultatDelegationClassement {
  statut: "rattache" | "a-controler" | "preserve";
  ressource: DepotDocumentaire;
  raison?: string;
}

async function lireEtat(documentId: string, analyseId: string) {
  // Le contexte exige le compte courant et le lecteur documentaire le pilote.
  const { ressources, referentiel } = await lireContexteOrganisationDepotAction([documentId]);
  const ressource = ressources.find((r) => r.id === documentId);
  if (!ressource) throw new Error("Ressource introuvable ou incompatible avec le classement délégué.");
  const document = await lireDocument(documentId);
  if (document.updatedAt !== ressource.modifieLe) throw new Error("La ressource a changé pendant la lecture. Actualisez son classement.");
  return { ressource, document, referentiel, decision: evaluerDelegationClassement(ressource, analyseId, referentiel, document.frontmatter) };
}

/** Aucun appel IA : seulement le rattachement issu de la première analyse. */
export async function rattacherDomaineDelegueAction(
  documentId: string,
  analyseId: string,
  updatedAtAttendu: string,
): Promise<ResultatDelegationClassement> {
  if (![documentId, analyseId, updatedAtAttendu].every((v) => typeof v === "string" && v.trim().length > 0)) throw new Error("Demande de rattachement invalide.");
  const initial = await lireEtat(documentId, analyseId);
  if (initial.decision.statut !== "eligible") return { ...initial.decision, ressource: initial.ressource };
  if (initial.ressource.modifieLe !== updatedAtAttendu) throw new Error("La ressource a été modifiée. Actualisez son classement.");

  // Analyses, corrections et référentiel vivent hors de la version CAS du
  // document : les relire avant l'effet, puis protéger la fiche par son CAS.
  const actuel = await lireEtat(documentId, analyseId);
  if (actuel.referentiel.compteId !== initial.referentiel.compteId) throw new Error("Le compte courant a changé.");
  if (actuel.decision.statut !== "eligible") return { ...actuel.decision, ressource: actuel.ressource };
  if (actuel.ressource.modifieLe !== updatedAtAttendu) throw new Error("La ressource a été modifiée. Actualisez son classement.");
  if (actuel.decision.domaineId !== initial.decision.domaineId) return { statut: "a-controler", raison: "Le domaine proposé a changé pendant la lecture.", ressource: actuel.ressource };
  const contenu = definirChampsFrontMatter(actuel.document.contenuMd, {
    domaine: actuel.decision.domaineId,
    rangement_origine: "assistant",
    rangement_analyse_id: analyseId,
    rangement_revu_le: new Date().toISOString(),
    rangement_statut: "rangee",
  });
  try {
    await modifierDocument(documentId, contenu, false, updatedAtAttendu);
  } catch (erreur) {
    // Une sauvegarde peut réussir avant que sa réponse échoue. Aucun réessai
    // d'écriture : seul le reçu relu autorise à annoncer le rattachement.
    const relu = await lireEtat(documentId, analyseId);
    if (relu.decision.statut !== "rattache") throw erreur;
    revalidatePath("/app");
    return { statut: "rattache", ressource: relu.ressource };
  }
  revalidatePath("/app");
  const relu = await lireEtat(documentId, analyseId);
  if (relu.decision.statut === "eligible") throw new Error("Le rattachement enregistré doit être vérifié. Actualisez la ressource.");
  return { ...relu.decision, ressource: relu.ressource };
}

function retraitDejaEnregistre(ressource: DepotDocumentaire, analyseId: string): boolean {
  return ressource.rangementOrigine === "personne" && ressource.rangementStatut === "a-trier"
    && ressource.rangementAnalyseId === analyseId && Boolean(ressource.rangementRevuLe) && !ressource.domaineId;
}

/** Le retrait est un choix humain durable, jamais une suppression de source. */
export async function annulerRattachementDelegueAction(
  documentId: string,
  analyseId: string,
  updatedAtAttendu: string,
): Promise<ResultatDelegationClassement> {
  if (![documentId, analyseId, updatedAtAttendu].every((v) => typeof v === "string" && v.trim().length > 0)) throw new Error("Demande de retrait invalide.");
  const retour = (ressource: DepotDocumentaire, retire: boolean): ResultatDelegationClassement => ({
    statut: "preserve", ressource,
    raison: retire ? "Vous avez retiré ce rattachement. La ressource reste à trier." : "Le classement a changé : votre choix actuel est préservé.",
  });
  const initial = await lireEtat(documentId, analyseId);
  if (retraitDejaEnregistre(initial.ressource, analyseId)) return retour(initial.ressource, true);
  if (initial.decision.statut !== "rattache") return retour(initial.ressource, false);
  if (initial.ressource.modifieLe !== updatedAtAttendu) throw new Error("La ressource a été modifiée. Actualisez avant de retirer son rattachement.");

  const actuel = await lireEtat(documentId, analyseId);
  if (actuel.referentiel.compteId !== initial.referentiel.compteId) throw new Error("Le compte courant a changé.");
  if (retraitDejaEnregistre(actuel.ressource, analyseId)) return retour(actuel.ressource, true);
  if (actuel.decision.statut !== "rattache") return retour(actuel.ressource, false);
  if (actuel.ressource.modifieLe !== updatedAtAttendu) throw new Error("La ressource a été modifiée. Actualisez avant de retirer son rattachement.");
  const contenu = definirChampsFrontMatter(actuel.document.contenuMd, {
    domaine: "",
    rangement_origine: "personne",
    rangement_statut: "a-trier",
  });
  try {
    await modifierDocument(documentId, contenu, false, updatedAtAttendu);
  } catch (erreur) {
    const relu = await lireEtat(documentId, analyseId);
    if (!retraitDejaEnregistre(relu.ressource, analyseId)) throw erreur;
    revalidatePath("/app");
    return retour(relu.ressource, true);
  }
  revalidatePath("/app");
  const relu = await lireEtat(documentId, analyseId);
  return retour(relu.ressource, retraitDejaEnregistre(relu.ressource, analyseId));
}
