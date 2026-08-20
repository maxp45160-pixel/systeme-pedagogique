"use server";

import { revalidatePath } from "next/cache";

import {
  motifRefusNouveauParcours,
  motifRefusNouvelObjectif,
  motifRefusProvenanceLot4,
  transitionObjectifAutorisee,
  transitionParcoursAutorisee,
  type CommandeLot4,
  type ModificationObjectif,
  type ModificationParcours,
  type NouveauParcours,
  type NouvelObjectif,
  type ProvenanceLot4,
  type ResultatCommandeLot4,
  type StatutObjectif,
  type StatutParcours,
} from "@/lib/domain/objectifs";
import { dorsaleCompte } from "./db";
import { lireObjectifs, lireParcours } from "./objectifs";
import { verifier } from "./supabase-backend";
import { validerResultatCommandeLot4 } from "./validation-objectifs";

function validerRequestId(requestId: string): void {
  if (typeof requestId !== "string" || requestId.trim().length === 0 || requestId.length > 200) {
    throw new Error("L’identifiant de requête du lot 4 est obligatoire et limité à 200 caractères.");
  }
}

function validerProvenance(provenance: ProvenanceLot4): void {
  const refus = motifRefusProvenanceLot4(provenance);
  if (refus) throw new Error(refus);
}

async function executer(
  commande: CommandeLot4,
  requestId: string,
  provenance: ProvenanceLot4,
): Promise<ResultatCommandeLot4> {
  validerRequestId(requestId);
  validerProvenance(provenance);
  const { supabase } = await dorsaleCompte();
  const { data, error } = await supabase.rpc("executer_commande_lot4", {
    p_request_id: requestId.trim(),
    p_commande: commande,
    p_provenance: {
      type: provenance.type.trim(),
      reference: provenance.reference.trim(),
      ...(provenance.note?.trim() ? { note: provenance.note.trim() } : {}),
    },
    p_acteur: "personne",
    p_consentement: true,
  });
  verifier("commande du lot 4", error);
  const resultat = validerResultatCommandeLot4(data);
  revalidatePath("/", "layout");
  return resultat;
}

async function objectifDepuisCommande(resultat: ResultatCommandeLot4) {
  if (!resultat.objectifId) throw new Error("La commande n’a pas renvoyé d’objectif.");
  const objectifs = await lireObjectifs();
  const objectif = objectifs.find((entree) => entree.id === resultat.objectifId);
  if (!objectif) throw new Error("L’objectif écrit n’est pas relisible dans le compte courant.");
  return objectif;
}

async function parcoursDepuisCommande(resultat: ResultatCommandeLot4) {
  if (!resultat.parcoursId) throw new Error("La commande n’a pas renvoyé de parcours.");
  const parcours = await lireParcours();
  const entree = parcours.find((valeur) => valeur.id === resultat.parcoursId);
  if (!entree) throw new Error("Le parcours écrit n’est pas relisible dans le compte courant.");
  return entree;
}

export async function creerObjectif(
  entree: NouvelObjectif,
  requestId: string,
  provenance: ProvenanceLot4,
) {
  const refus = motifRefusNouvelObjectif(entree);
  if (refus) throw new Error(refus);
  const resultat = await executer({ type: "creer_objectif", ...entree }, requestId, provenance);
  return objectifDepuisCommande(resultat);
}

export async function modifierObjectif(
  objectifId: string,
  version: number,
  modification: ModificationObjectif,
  requestId: string,
  provenance: ProvenanceLot4,
) {
  const refus = motifRefusNouvelObjectif(modification);
  if (refus) throw new Error(refus);
  const resultat = await executer(
    { type: "modifier_objectif", objectifId, version, ...modification },
    requestId,
    provenance,
  );
  return objectifDepuisCommande(resultat);
}

export async function changerStatutObjectif(
  objectifId: string,
  version: number,
  statut: StatutObjectif,
  statutActuel: StatutObjectif,
  requestId: string,
  provenance: ProvenanceLot4,
) {
  if (!transitionObjectifAutorisee(statutActuel, statut)) {
    throw new Error(`Transition d’objectif interdite : ${statutActuel} → ${statut}.`);
  }
  const resultat = await executer(
    { type: "changer_statut_objectif", objectifId, version, statut },
    requestId,
    provenance,
  );
  return objectifDepuisCommande(resultat);
}

export async function archiverObjectif(
  objectifId: string,
  version: number,
  requestId: string,
  provenance: ProvenanceLot4,
) {
  const resultat = await executer(
    { type: "archiver_objectif", objectifId, version },
    requestId,
    provenance,
  );
  return objectifDepuisCommande(resultat);
}

export async function creerParcours(
  entree: NouveauParcours,
  requestId: string,
  provenance: ProvenanceLot4,
) {
  const refus = motifRefusNouveauParcours(entree);
  if (refus) throw new Error(refus);
  const resultat = await executer({ type: "creer_parcours", ...entree }, requestId, provenance);
  return parcoursDepuisCommande(resultat);
}

export async function modifierParcours(
  parcoursId: string,
  version: number,
  modification: ModificationParcours,
  requestId: string,
  provenance: ProvenanceLot4,
) {
  const refus = motifRefusNouveauParcours(modification);
  if (refus) throw new Error(refus);
  const resultat = await executer(
    { type: "modifier_parcours", parcoursId, version, ...modification },
    requestId,
    provenance,
  );
  return parcoursDepuisCommande(resultat);
}

export async function changerStatutParcours(
  parcoursId: string,
  version: number,
  statut: StatutParcours,
  statutActuel: StatutParcours,
  requestId: string,
  provenance: ProvenanceLot4,
) {
  if (!transitionParcoursAutorisee(statutActuel, statut)) {
    throw new Error(`Transition de parcours interdite : ${statutActuel} → ${statut}.`);
  }
  const resultat = await executer(
    { type: "changer_statut_parcours", parcoursId, version, statut },
    requestId,
    provenance,
  );
  return parcoursDepuisCommande(resultat);
}

export async function archiverParcours(
  parcoursId: string,
  version: number,
  requestId: string,
  provenance: ProvenanceLot4,
) {
  const resultat = await executer(
    { type: "archiver_parcours", parcoursId, version },
    requestId,
    provenance,
  );
  return parcoursDepuisCommande(resultat);
}

export async function rattacherSessionParcours(
  parcoursId: string,
  sessionId: string,
  requestId: string,
  provenance: ProvenanceLot4,
): Promise<ResultatCommandeLot4> {
  return executer({ type: "rattacher_session", parcoursId, sessionId }, requestId, provenance);
}
