"use server";

import { revalidatePath } from "next/cache";

import {
  motifRefusProvenanceGlobale,
  type CommandeCarteGlobale,
  type ProvenanceGlobale,
  type ResultatCommandeCarteGlobale,
} from "@/lib/domain/carte-globale";
import { dorsaleCompte } from "./db";
import { ligneVersEntite, verifier } from "./supabase-backend";
import { validerResultatCommandeCarteGlobale } from "./validation-carte-globale";

function nouvelIdCommande(): string {
  return `cgcmd-${Date.now().toString(36)}-${crypto.randomUUID()}`;
}
async function executerCommande(
  commande: CommandeCarteGlobale,
  expectedVersion: number,
  provenance: ProvenanceGlobale,
): Promise<ResultatCommandeCarteGlobale> {
  const refus = motifRefusProvenanceGlobale(provenance);
  if (refus) throw new Error(refus);

  const { supabase } = await dorsaleCompte();
  const { data, error } = await supabase.rpc("appliquer_commande_carte_globale", {
    p_request_id: nouvelIdCommande(),
    p_expected_version: expectedVersion,
    p_commande: commande,
    p_provenance: {
      type: provenance.type.trim(),
      reference: provenance.reference.trim(),
      ...(provenance.note?.trim() ? { note: provenance.note.trim() } : {}),
    },
  });
  verifier("commande de carte globale", error);
  const brut = data as Record<string, unknown>;
  const resultat = validerResultatCommandeCarteGlobale({
    ...brut,
    objet: ligneVersEntite((brut.objet ?? {}) as Record<string, unknown>),
  });
  revalidatePath("/", "layout");
  return resultat;
}

export function publierElementGlobal(
  element: Extract<CommandeCarteGlobale, { type: "publier_element" }>["element"],
  provenance: ProvenanceGlobale,
): Promise<ResultatCommandeCarteGlobale> {
  return executerCommande({ type: "publier_element", element }, 0, provenance);
}

export function corrigerElementGlobal(
  id: string,
  version: number,
  modification: { nom: string; description: string },
  provenance: ProvenanceGlobale,
): Promise<ResultatCommandeCarteGlobale> {
  return executerCommande({ type: "corriger_element", id, ...modification }, version, provenance);
}

export function retirerElementGlobal(
  id: string,
  version: number,
  provenance: ProvenanceGlobale,
): Promise<ResultatCommandeCarteGlobale> {
  return executerCommande({ type: "retirer_element", id }, version, provenance);
}

export function publierRelationGlobale(
  relation: Extract<CommandeCarteGlobale, { type: "publier_relation" }>["relation"],
  provenance: ProvenanceGlobale,
): Promise<ResultatCommandeCarteGlobale> {
  return executerCommande({ type: "publier_relation", relation }, 0, provenance);
}

export function retirerRelationGlobale(
  id: string,
  version: number,
  provenance: ProvenanceGlobale,
): Promise<ResultatCommandeCarteGlobale> {
  return executerCommande({ type: "retirer_relation", id }, version, provenance);
}

export async function selectionnerElementGlobal(elementId: string): Promise<void> {
  const { supabase, userId } = await dorsaleCompte();
  const { error } = await supabase
    .from("carte_globale_selections")
    .upsert(
      { user_id: userId, element_id: elementId },
      { onConflict: "user_id,element_id", ignoreDuplicates: true },
    );
  verifier("sélection d’un élément global", error);
  revalidatePath("/", "layout");
}

export async function deselectionnerElementGlobal(elementId: string): Promise<void> {
  const { supabase, userId } = await dorsaleCompte();
  const { error } = await supabase
    .from("carte_globale_selections")
    .delete()
    .eq("user_id", userId)
    .eq("element_id", elementId);
  verifier("retrait d’une sélection globale", error);
  revalidatePath("/", "layout");
}
