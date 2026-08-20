"use server";

import { revalidatePath } from "next/cache";

import {
  motifRefusProvenanceGlobale,
  type CorrespondanceCarteGlobale,
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

export async function publierElementGlobal(
  element: Extract<CommandeCarteGlobale, { type: "publier_element" }>["element"],
  provenance: ProvenanceGlobale,
): Promise<ResultatCommandeCarteGlobale> {
  return executerCommande({ type: "publier_element", element }, 0, provenance);
}

export async function corrigerElementGlobal(
  id: string,
  version: number,
  modification: { nom: string; description: string },
  provenance: ProvenanceGlobale,
): Promise<ResultatCommandeCarteGlobale> {
  return executerCommande({ type: "corriger_element", id, ...modification }, version, provenance);
}

export async function retirerElementGlobal(
  id: string,
  version: number,
  provenance: ProvenanceGlobale,
): Promise<ResultatCommandeCarteGlobale> {
  return executerCommande({ type: "retirer_element", id }, version, provenance);
}

export async function publierRelationGlobale(
  relation: Extract<CommandeCarteGlobale, { type: "publier_relation" }>["relation"],
  provenance: ProvenanceGlobale,
): Promise<ResultatCommandeCarteGlobale> {
  return executerCommande({ type: "publier_relation", relation }, 0, provenance);
}

export async function retirerRelationGlobale(
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

export async function rattacherCompetenceElementGlobal(
  competenceCode: string,
  elementGlobalId: string,
  provenance: CorrespondanceCarteGlobale["provenance"] = {
    type: "declaration-utilisateur",
    reference: "Rattachement confirmé depuis Explorer",
  },
): Promise<void> {
  if (!competenceCode.trim() || !elementGlobalId.trim()) {
    throw new Error("La compétence locale et l’élément global sont obligatoires.");
  }
  const refus = motifRefusProvenanceGlobale(provenance);
  if (refus) throw new Error(refus);
  const { supabase, userId } = await dorsaleCompte();
  const { data: existante, error: erreurLecture } = await supabase
    .from("carte_globale_correspondances")
    .select("competence_code")
    .eq("user_id", userId)
    .eq("competence_code", competenceCode.trim())
    .eq("element_global_id", elementGlobalId.trim())
    .maybeSingle();
  verifier("lecture du rattachement local et global", erreurLecture);
  if (!existante) {
    const { error } = await supabase
    .from("carte_globale_correspondances")
    .insert(
      {
        user_id: userId,
        competence_code: competenceCode.trim(),
        element_global_id: elementGlobalId.trim(),
        acteur: "personne",
        provenance,
      },
      { defaultToNull: false },
    );
    verifier("rattachement d’une compétence à un élément global", error);
  }
  revalidatePath("/", "layout");
}

export async function retirerCorrespondanceCompetenceElementGlobal(
  competenceCode: string,
  elementGlobalId: string,
): Promise<void> {
  const { supabase, userId } = await dorsaleCompte();
  const { error } = await supabase
    .from("carte_globale_correspondances")
    .delete()
    .eq("user_id", userId)
    .eq("competence_code", competenceCode)
    .eq("element_global_id", elementGlobalId);
  verifier("retrait d’une correspondance locale et globale", error);
  revalidatePath("/", "layout");
}
