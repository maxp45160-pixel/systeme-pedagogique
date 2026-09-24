"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { estRessourceDepot } from "@/lib/documents/depot";
import {
  composerSeanceTravailDocumentaire,
  correspondAuTravailDocumentaire,
  validerEntreeTravailDocumentaire,
  type EntreeTravailDocumentaire,
  type RessourceTravailDocumentaire,
} from "@/lib/domain/travail-documentaire";
import { ajouter, dorsaleCompte, lireParId } from "./db";

/** Enregistre le geste déclaré sur des ressources du compte, sans mesure. */
export async function enregistrerTravailDocumentaireAction(
  entreeBrute: EntreeTravailDocumentaire,
): Promise<{ sessionId: string }> {
  const entree = validerEntreeTravailDocumentaire(entreeBrute);
  const compte = await dorsaleCompte();
  const empreinte = createHash("sha256").update(`${compte.userId}:${entree.cle}`).digest("hex").slice(0, 32);
  const sessionId = `ses-travail-doc-${empreinte}`;
  const existante = await lireParId("sessions", sessionId, compte);
  if (existante) {
    if (!correspondAuTravailDocumentaire(existante, entree)) {
      throw new Error("Cette clé a déjà enregistré un autre travail documentaire.");
    }
    return { sessionId };
  }

  const { data, error } = await compte.supabase.from("documents")
    .select("id,titre,frontmatter")
    .eq("user_id", compte.userId)
    .in("id", entree.documentIds);
  if (error) throw new Error("La vérification des ressources est indisponible.");
  const parId = new Map<string, RessourceTravailDocumentaire>();
  for (const ligne of data ?? []) {
    if (typeof ligne.id !== "string" || !entree.documentIds.includes(ligne.id) ||
      typeof ligne.titre !== "string" || !ligne.titre.trim() ||
      !ligne.frontmatter || typeof ligne.frontmatter !== "object" || Array.isArray(ligne.frontmatter) ||
      !estRessourceDepot(ligne.frontmatter as Record<string, unknown>)) {
      throw new Error("Une ressource sélectionnée est introuvable ou n’est pas une ressource documentaire V2.");
    }
    parId.set(ligne.id, { id: ligne.id, titre: ligne.titre });
  }
  if (parId.size !== entree.documentIds.length) {
    throw new Error("Une ressource sélectionnée est introuvable ou appartient à un autre compte.");
  }
  const ressources = entree.documentIds.map((id) => parId.get(id)!);
  const seance = composerSeanceTravailDocumentaire(sessionId, new Date().toISOString(), entree, ressources);
  try {
    await ajouter("sessions", seance, compte);
  } catch (erreur) {
    const concurrente = await lireParId("sessions", sessionId, compte);
    if (!concurrente) throw erreur;
    if (!correspondAuTravailDocumentaire(concurrente, entree)) {
      throw new Error("Cette clé a déjà enregistré un autre travail documentaire.");
    }
  }
  revalidatePath("/seances");
  revalidatePath("/app");
  return { sessionId };
}
