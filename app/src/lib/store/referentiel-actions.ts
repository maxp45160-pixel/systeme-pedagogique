"use server";

/**
 * Façade serveur des commandes de référentiel.
 *
 * Toutes les mutations passent par `appliquer_commande_referentiel` : une
 * commande, une transaction, une version d'agrégat et une entrée de journal.
 * Les fonctions exportées restent adaptées aux gestes de l'interface ; elles
 * ne contiennent plus de SQL métier concurrent.
 */

import { revalidatePath } from "next/cache";

import { dorsaleCompte } from "./db";
import { verifier } from "./supabase-backend";
import { lireReferentiel } from "./referentiel";
import {
  nouvelIdCommande,
  preparerCreationDomaine,
  preparerRevisionDomaine,
  type CompetenceDejaAuReferentiel,
  type AjoutCompetenceCommande,
  type CommandeReferentiel,
  type EnveloppeCommandeReferentiel,
  type ResultatCommandeReferentiel,
} from "@/lib/domain/gouvernance-referentiel";
import { normaliserImportance, normaliserPalier, validerCompetence } from "@/lib/domain/referentiel-compte";
import type { OrigineReferentiel, Palier, Referentiel } from "@/lib/domain/types";

async function executerCommande(
  commande: CommandeReferentiel,
  referentiel: Referentiel,
  origine: OrigineReferentiel,
  motif: string,
): Promise<ResultatCommandeReferentiel> {
  const dorsale = await dorsaleCompte();
  const domaineId = commande.type === "creer_domaine" ? commande.domaine.id : commande.domaineId;
  const enveloppe: EnveloppeCommandeReferentiel = {
    requestId: nouvelIdCommande(),
    expectedVersion: commande.type === "creer_domaine" ? null : referentiel.domainesParId.get(domaineId)?.version ?? null,
    origine,
    motif: motif.trim() || "Modification validée du référentiel",
    commande,
  };
  const { data, error } = await dorsale.supabase.rpc("appliquer_commande_referentiel", {
    p_request_id: enveloppe.requestId,
    p_expected_version: enveloppe.expectedVersion,
    p_origine: enveloppe.origine,
    p_motif: enveloppe.motif,
    p_commande: enveloppe.commande,
  });
  verifier("commande de référentiel", error);
  revalidatePath("/", "layout");
  return data as ResultatCommandeReferentiel;
}

export interface SoumissionBranche {
  domaine: string;
  prefixe: string;
  description: string;
  competences: Array<{ intitule: string; palier: string; importance: string; prerequis?: string[] }>;
  origine?: OrigineReferentiel;
}

export interface ResultatBranche {
  domaineId: string;
  domaineCree: boolean;
  codes: string[];
  /**
   * Compétences proposées que le référentiel portait déjà. Aucune n'a été
   * recréée sous un second code ; celles qui venaient d'un autre domaine ont
   * été **rattachées** à celui-ci. L'écran doit le dire : la personne les a
   * demandées, elle doit savoir sous quelle forme elle les a obtenues.
   */
  dejaAuReferentiel: CompetenceDejaAuReferentiel[];
}

export async function creerBranche(soumission: SoumissionBranche): Promise<ResultatBranche> {
  const dorsale = await dorsaleCompte();
  const referentiel = await lireReferentiel(dorsale);
  const origine = soumission.origine ?? "tuteur";
  const { commande, dejaAuReferentiel } = preparerCreationDomaine({ ...soumission, origine }, referentiel);

  /*
   * Sans commande, il n'y avait rien de neuf à écrire : toutes les compétences
   * demandées existaient déjà. Le domaine, lui, existe forcément — une création
   * sans compétence propre a été refusée en amont.
   */
  const resultat = commande
    ? await executerCommande(commande, referentiel, origine, "Branche relue et validée")
    : null;
  const domaineId =
    resultat?.domaineId ??
    referentiel.domaines.find(
      (d) => d.nom.toLocaleLowerCase("fr-FR") === soumission.domaine.trim().toLocaleLowerCase("fr-FR"),
    )?.id;
  if (!domaineId) throw new Error(`Domaine introuvable : ${soumission.domaine}`);

  await rattacherAutomatiquement(domaineId, dejaAuReferentiel);
  return {
    domaineId,
    domaineCree: commande?.type === "creer_domaine",
    codes: resultat?.codes ?? resultat?.ajoutees ?? [],
    dejaAuReferentiel,
  };
}

/**
 * Rattache ce que la personne a demandé et qui existait déjà ailleurs.
 *
 * Demander « Lire un tableau de données » dans Logistique, c'est demander que
 * ce savoir-faire y serve. Le système sait qu'il existe : le recréer
 * dédoublerait ses preuves, et l'écarter en silence perdrait la demande. Il le
 * rattache donc, sans autre geste (ADR-081).
 *
 * L'échec du rattachement ne défait pas l'écriture qui précède : les
 * compétences neuves sont créées, et le message dira lesquelles n'ont pas pu
 * être rattachées. Défaire serait pire — on perdrait un travail réussi pour un
 * complément manqué.
 */
async function rattacherAutomatiquement(
  domaineId: string,
  dejaAuReferentiel: CompetenceDejaAuReferentiel[],
): Promise<void> {
  const codes = dejaAuReferentiel
    .filter((competence) => competence.aRattacher && competence.domaineId !== domaineId)
    .map(({ code }) => code);
  if (codes.length === 0) return;
  await rattacherCompetences(domaineId, codes, true);
}

export interface ResultatRattachement {
  domaineId: string;
  rattachees: string[];
  detachees: string[];
}

/**
 * Rattache des compétences d'autres domaines à celui-ci, ou les en détache.
 *
 * Le domaine porteur ne bouge pas : il garde le code et la gouvernance. Ce
 * geste ajoute une lecture — la compétence devient visible depuis ce domaine et
 * compte dans sa couverture (ADR-081). Aucun code n'est créé, aucune preuve
 * n'est dupliquée.
 */
export async function rattacherCompetences(
  domaineId: string,
  codes: string[],
  rattache: boolean,
): Promise<ResultatRattachement> {
  const dorsale = await dorsaleCompte();
  const referentiel = await lireReferentiel(dorsale);
  const domaine = referentiel.domainesParId.get(domaineId);
  if (!domaine) throw new Error(`Domaine inconnu : ${domaineId}`);

  const demandes = [...new Set(codes)];
  for (const code of demandes) {
    const skill = referentiel.parCode.get(code);
    if (!skill) throw new Error(`Compétence inconnue : ${code}`);
    if (skill.domaine === domaineId) {
      throw new Error(`${code} est déjà portée par ${domaine.nom} : un rattachement ne se superpose pas au porteur.`);
    }
  }

  const { data, error } = await dorsale.supabase.rpc("rattacher_competences_domaine", {
    p_request_id: nouvelIdCommande(),
    p_expected_version: domaine.version ?? null,
    p_origine: "utilisateur",
    p_motif: rattache
      ? `Rattachement de ${demandes.join(", ")} à ${domaine.nom}`
      : `Détachement de ${demandes.join(", ")} de ${domaine.nom}`,
    p_domaine_id: domaineId,
    p_codes: demandes,
    p_rattache: rattache,
  });
  verifier("rattachement de compétences", error);
  revalidatePath("/", "layout");
  const resultat = data as { domaineId: string; rattachees?: string[]; detachees?: string[] };
  return {
    domaineId: resultat.domaineId,
    rattachees: resultat.rattachees ?? [],
    detachees: resultat.detachees ?? [],
  };
}

export interface ModificationCompetence {
  intitule?: string;
  palier?: Palier;
  importance?: number;
  prerequis?: string[];
  ordre?: number;
}

export async function modifierCompetence(code: string, champs: ModificationCompetence): Promise<void> {
  const dorsale = await dorsaleCompte();
  const referentiel = await lireReferentiel(dorsale);
  const skill = referentiel.parCode.get(code);
  if (!skill) throw new Error(`Compétence inconnue : ${code}`);
  const { commande } = preparerRevisionDomaine({
    domaineId: skill.domaine,
    ajouts: [],
    modifications: [{ code, ...champs }],
    retraits: [],
  }, referentiel, "utilisateur");
  // Une modification produit toujours une commande : elle ne passe pas par le
  // chemin des ajouts, seul à pouvoir n'avoir rien à écrire.
  if (!commande) throw new Error(`Rien à modifier pour ${code}.`);
  await executerCommande(commande, referentiel, "utilisateur", `Correction de formulation de ${code}`);
}

export interface SoumissionRevision {
  domaineId: string;
  domaine?: { nom?: string; description?: string; ordre?: number };
  ajouts: Array<{ intitule: string; palier: string; importance: string; prerequis?: string[] }>;
  modifications: Array<{ code: string; intitule?: string; palier?: string; importance?: string }>;
  retraits: string[];
}

export interface ResultatRevision {
  ajoutes: string[];
  modifiees: string[];
  supprimees: string[];
  archivees: string[];
  dejaAuReferentiel: CompetenceDejaAuReferentiel[];
}

export async function appliquerRevision(soumission: SoumissionRevision): Promise<ResultatRevision> {
  const dorsale = await dorsaleCompte();
  const referentiel = await lireReferentiel(dorsale);
  const { commande, dejaAuReferentiel } = preparerRevisionDomaine(soumission, referentiel, "tuteur");
  const resultat = commande
    ? await executerCommande(commande, referentiel, "tuteur", "Révision assistée relue et validée")
    : null;
  await rattacherAutomatiquement(soumission.domaineId, dejaAuReferentiel);
  return {
    ajoutes: resultat?.ajoutees ?? [],
    modifiees: resultat?.modifiees ?? [],
    supprimees: resultat?.supprimees ?? [],
    archivees: resultat?.archivees ?? [],
    dejaAuReferentiel,
  };
}

function domaineUnique(codes: string[], referentiel: Referentiel): string {
  const domaines = new Set(codes.map((code) => {
    const skill = referentiel.parCode.get(code);
    if (!skill) throw new Error(`Compétence inconnue : ${code}`);
    return skill.domaine;
  }));
  if (domaines.size !== 1) throw new Error("Une commande groupée ne peut pas traverser plusieurs domaines.");
  return [...domaines][0];
}

export interface CompetenceLisible {
  code: string;
  intitule: string;
  domaine: string;
  domaineNom: string;
}

/**
 * Le référentiel actif, réduit à ce qu'un écran a besoin de montrer.
 *
 * Une lecture, pas une commande — mais elle vit ici parce qu'un composant
 * client ne peut pas appeler `lireReferentiel` directement. Les modales qui
 * n'ont qu'un `compteId` (le parcours projet, ouvert depuis le `+` comme depuis
 * le tableau de bord) affichaient jusqu'ici le code brut d'une compétence,
 * faute de connaître son intitulé : « LOG-14 » ne dit pas ce qu'on va
 * travailler.
 */
export async function lireCompetencesActives(): Promise<CompetenceLisible[]> {
  const referentiel = await lireReferentiel();
  return referentiel.actifs.map((skill) => ({
    code: skill.code,
    intitule: skill.intitule,
    domaine: skill.domaine,
    domaineNom: referentiel.domainesParId.get(skill.domaine)?.nom ?? skill.domaine,
  }));
}

export async function basculerActives(codes: string[], active: boolean): Promise<void> {
  if (codes.length === 0) return;
  const dorsale = await dorsaleCompte();
  const referentiel = await lireReferentiel(dorsale);
  const domaineId = domaineUnique(codes, referentiel);
  await executerCommande({ type: "activer_competences", domaineId, codes: [...new Set(codes)], active }, referentiel, "utilisateur", active ? "Remise au périmètre" : "Sortie du périmètre");
}

export async function desarchiverCompetence(code: string): Promise<void> {
  const dorsale = await dorsaleCompte();
  const referentiel = await lireReferentiel(dorsale);
  const skill = referentiel.parCode.get(code);
  if (!skill) throw new Error(`Compétence inconnue : ${code}`);
  await executerCommande({ type: "desarchiver_competence", domaineId: skill.domaine, code }, referentiel, "utilisateur", `Désarchivage de ${code}`);
}

export interface ResultatRetraitGroupe {
  supprimees: string[];
  archivees: string[];
}

export async function retirerCompetences(codes: string[]): Promise<ResultatRetraitGroupe> {
  if (codes.length === 0) return { supprimees: [], archivees: [] };
  const dorsale = await dorsaleCompte();
  const referentiel = await lireReferentiel(dorsale);
  const domaineId = domaineUnique(codes, referentiel);
  const resultat = await executerCommande({ type: "retirer_competences", domaineId, codes: [...new Set(codes)] }, referentiel, "utilisateur", "Retrait validé de compétences");
  return { supprimees: resultat.supprimees ?? [], archivees: resultat.archivees ?? [] };
}

export async function archiverDomaine(domaineId: string): Promise<ResultatCommandeReferentiel> {
  const dorsale = await dorsaleCompte();
  const referentiel = await lireReferentiel(dorsale);
  if (!referentiel.domainesParId.has(domaineId)) throw new Error(`Domaine inconnu : ${domaineId}`);
  return executerCommande({ type: "archiver_domaine", domaineId }, referentiel, "utilisateur", "Retrait validé du domaine");
}

export async function restaurerDomaine(domaineId: string): Promise<void> {
  const dorsale = await dorsaleCompte();
  const referentiel = await lireReferentiel(dorsale);
  if (!referentiel.domainesParId.has(domaineId)) throw new Error(`Domaine inconnu : ${domaineId}`);
  await executerCommande({ type: "restaurer_domaine", domaineId }, referentiel, "utilisateur", "Restauration du domaine");
}

export async function remplacerCompetence(
  code: string,
  champs: { intitule: string; palier: Palier; importance: number; prerequis?: string[] },
): Promise<string> {
  const dorsale = await dorsaleCompte();
  const referentiel = await lireReferentiel(dorsale);
  const skill = referentiel.parCode.get(code);
  if (!skill) throw new Error(`Compétence inconnue : ${code}`);
  const candidate = {
    intitule: champs.intitule.trim(),
    palier: normaliserPalier(champs.palier),
    importance: normaliserImportance(champs.importance),
    prerequis: [...new Set(champs.prerequis ?? skill.prerequis)],
  };
  const erreurs = validerCompetence(candidate, referentiel, skill.domaine);
  if (erreurs.length) throw new Error(erreurs.join(" "));
  const successeur: AjoutCompetenceCommande = { ...candidate, ordre: skill.ordre, origine: "utilisateur" };
  const resultat = await executerCommande({ type: "remplacer_competence", domaineId: skill.domaine, code, successeur }, referentiel, "utilisateur", `Changement de sens de ${code}`);
  if (!resultat.successeur) throw new Error("La transaction n'a pas renvoyé le code successeur.");
  return resultat.successeur;
}

export interface ModificationProfil {
  formation?: string;
  objectifMoyenTerme?: string;
  objectifLongTerme?: string;
  preferencesPedagogiques?: string[];
  plan?: string;
}

export async function modifierProfil(champs: ModificationProfil): Promise<void> {
  const dorsale = await dorsaleCompte();
  const ligne: Record<string, unknown> = {};
  if (champs.formation !== undefined) ligne.formation = champs.formation.trim();
  if (champs.objectifMoyenTerme !== undefined) ligne.objectif_moyen_terme = champs.objectifMoyenTerme.trim();
  if (champs.objectifLongTerme !== undefined) ligne.objectif_long_terme = champs.objectifLongTerme.trim();
  if (champs.preferencesPedagogiques !== undefined) ligne.preferences_pedagogiques = champs.preferencesPedagogiques.map((preference) => preference.trim()).filter(Boolean);
  if (champs.plan !== undefined) ligne.plan = champs.plan.trim();
  if (Object.keys(ligne).length === 0) return;
  const { error } = await dorsale.supabase.from("profiles").update(ligne).eq("id", dorsale.userId);
  verifier("modification du profil", error);
  revalidatePath("/", "layout");
}

