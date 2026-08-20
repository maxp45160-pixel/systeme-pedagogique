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
import { extraireEcheanceBesoin } from "@/lib/domain/echeance-besoin";
import { lireReferentiel } from "./referentiel";

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

/**
 * Transforme une échéance explicitement écrite dans « Nouveau besoin » en
 * cible court terme interne. Aucun formulaire d'objectif n'est ouvert : le
 * clic de confirmation du besoin est le seul accord nécessaire.
 */
export async function enregistrerBesoinCourtTerme(
  formulation: string,
  codes: string[],
): Promise<void> {
  const texte = formulation.trim();
  const echeanceLe = extraireEcheanceBesoin(texte);
  if (!echeanceLe) return;

  const referentiel = await lireReferentiel();
  const codesActifs = new Set(referentiel.actifs.map((skill) => skill.code));
  const codesValides = [...new Set(codes.map((code) => code.trim().toUpperCase()))]
    .filter((code) => codesActifs.has(code));
  if (codesValides.length === 0) return;

  const objectifs = await lireObjectifs();
  for (const code of codesValides) {
    const dejaEnregistre = objectifs.some(
      (objectif) =>
        objectif.statut === "actif"
        && objectif.horizon === "court-terme"
        && objectif.echeanceLe === echeanceLe
        && objectif.cible.type === "competence-locale"
        && objectif.cible.code === code
        && objectif.formulation === texte,
    );
    if (dejaEnregistre) continue;

    const requestId = `besoin-court-terme:${crypto.randomUUID()}`;
    const provenance = {
      type: "nouveau-besoin",
      reference: requestId,
      note: "Cible court terme dérivée d'une échéance écrite dans Nouveau besoin.",
    } as const;
    const objectif = await creerObjectif(
      {
        formulation: texte,
        cible: { type: "competence-locale", code },
        priorite: 5,
        horizon: "court-terme",
        echeanceLe,
      },
      requestId,
      provenance,
    );
    const actif = await changerStatutObjectif(
      objectif.id,
      objectif.version,
      "actif",
      objectif.statut,
      `${requestId}:activer`,
      provenance,
    );
    const parcours = await creerParcours(
      {
        objectifId: actif.id,
        contexte: texte,
        cible: { type: "competence-locale", code },
      },
      `${requestId}:parcours`,
      provenance,
    );
    await changerStatutParcours(
      parcours.id,
      parcours.version,
      "actif",
      parcours.statut,
      `${requestId}:activer-parcours`,
      provenance,
    );
  }
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
