"use server";

import { lireContexteOrganisationDepotAction } from "./depot-actions";
import { organiserDepuisReferentiel } from "@/lib/documents/organisation-assistant";
import { dorsaleCompte } from "./db";
import { referencesRessourcesConversation } from "@/lib/documents/conversation-ressources";

/** Identifie les liens encore accessibles avant d'ouvrir leurs analyses. */
export async function identifierRessourcesAssistantAction(documentIds: string[]) {
  const ids = referencesRessourcesConversation(documentIds);
  if (!ids.length || ids.length !== documentIds.length) throw new Error("Sélection de documents invalide.");
  const { supabase, userId } = await dorsaleCompte();
  const { data, error } = await supabase.from("documents").select("id,titre").eq("user_id", userId).in("id", ids);
  if (error) throw new Error("La liste des documents ne peut pas être chargée.");
  return ids.map((id) => {
    const document = data?.find((d) => d.id === id);
    return document ? { id, titre: String(document.titre), introuvable: false } : { id, introuvable: true };
  });
}

/** Relit les données du compte ; aucune analyse externe ni écriture au chargement. */
export async function lireRessourceAssistantAction(documentId: string) {
  const { ressources, referentiel } = await lireContexteOrganisationDepotAction([documentId]);
  const depot = ressources[0];
  if (!depot) throw new Error("Ressource introuvable dans le compte pilote.");
  const { aPreciser } = organiserDepuisReferentiel(depot, referentiel);
  const { supabase, userId } = await dorsaleCompte();
  const { data: liens, error } = await supabase.from("document_links").select("cible,resolu").eq("user_id", userId).eq("source_id", documentId);
  if (error) throw new Error("Les liens de la ressource ne peuvent pas être vérifiés.");
  const liensVerifies = depot.competencesLiees.every((code) => liens?.some((lien) => lien.cible === code && lien.resolu));
  return {
    depot, aPreciser, liensVerifies,
    domaine: referentiel.domaines.find((d) => d.id === depot.domaineId)?.nom,
    competences: depot.competencesLiees.map((code) => ({ code, intitule: referentiel.competences.find((c) => c.code === code)?.intitule ?? code })),
  };
}
