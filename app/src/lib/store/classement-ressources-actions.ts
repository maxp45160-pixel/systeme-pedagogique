"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { analysePourClassement, validerChoixClassementRessources, type ChoixClassementRessource } from "@/lib/documents/classement-ressources";
import type { DepotDocumentaire, CompetenceProposeeDepot } from "@/lib/documents/depot";
import { appliquerRangementDepot, type ContexteOrganisationDepot } from "@/lib/documents/organisation-depot";
import { definirChampsFrontMatter } from "@/lib/documents/markdown";
import { validerRangementActif } from "@/lib/documents/validation-rangement";
import { prefixeParDefaut, slugifier } from "@/lib/domain/referentiel-compte";
import { preparerCreationDomaine } from "@/lib/domain/gouvernance-referentiel";
import type { Referentiel } from "@/lib/domain/types";
import { lireDepotDocumentaire } from "./depot-documents";
import { dorsaleCompte } from "./db";
import { lireDocument, modifierDocument, resynchroniserLiensDocument } from "./documents";
import { lireReferentiel } from "./referentiel";
import { creerBranche, deplacerDomaine, taguerCompetences } from "./referentiel-actions";
import { verifier } from "./supabase-backend";

type NouvelleCompetence = Extract<CompetenceProposeeDepot, { mode: "nouvelle" }>;
interface Confirmation {
  cle: string;
  base: string;
  analyseId: string;
  terminee: boolean;
  tentativeId?: string;
  domaineId?: string;
  codes?: string[];
  choixPrealable?: string;
}
export interface ResultatClassementRessource {
  documentId: string;
  statut: "confirmee" | "echec";
  ressource?: DepotDocumentaire;
  erreur?: string;
}
const normalise = (s: string) => s.trim().replace(/\s+/g, " ").toLocaleLowerCase("fr-FR");
const empreinte = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
const baseRessource = (d: DepotDocumentaire) => empreinte([d.titre, d.type, d.domaineId ?? "", [...d.competencesLiees].sort()]);
// La version change à chaque étape de la confirmation. Cette empreinte permet
// de reprendre nos propres écritures sans effacer un geste humain intercalé.
const champsChoix = ["classement_brouillon", "rangement_origine", "rangement_analyse_id", "rangement_revu_le", "rangement_statut", "rangement_empreinte", "referentiel_revu_le", "referentiel_analyse_id"] as const;
const empreinteChoix = (frontmatter: Record<string, unknown> = {}) => empreinte(champsChoix.map((cle) => frontmatter[cle] ?? ""));
const champsConfirmation = (c: Confirmation) => ({ classement_confirmation: Buffer.from(JSON.stringify(c)).toString("base64url") });
const cleCreation = (cle: string) => `classement:${cle}:domaine`;

/** Le reçu SQL atteste la création même si la réponse ou l'écriture suivante a été perdue. */
async function domaineCreeParConfirmation(cle: string, nom: string): Promise<string | undefined> {
  const { supabase, userId } = await dorsaleCompte();
  const { data, error } = await supabase.from("referentiel_changes").select("domaine_id,type").eq("user_id", userId).eq("request_id", cleCreation(cle)).maybeSingle();
  verifier("relecture de la création confirmée", error);
  if (!data) return undefined;
  if (data.type !== "creer_domaine" || data.domaine_id !== slugifier(nom)) throw new Error("Le reçu de création ne correspond pas au classement confirmé.");
  return data.domaine_id;
}

function preparerDomaineConfirme(choix: ChoixClassementRessource, nouvelles: NouvelleCompetence[], dejaConnues: string[], r: Referentiel) {
  if (choix.domaine.mode !== "nouveau") throw new Error("Création de domaine non demandée.");
  const d = choix.domaine;
  return preparerCreationDomaine({
    domaine: d.nom, prefixe: prefixeDisponible(d.nom, r), description: d.nom,
    competences: nouvelles.map((p) => ({ intitule: p.intitule, palier: p.palier, importance: p.importance })),
    origine: "utilisateur",
    ...(d.usage.type === "module" ? { usage: { type: "module" as const, module: { anneeAcademique: d.usage.anneeAcademique!, ...(d.usage.periode ? { periode: d.usage.periode } : {}) } } } : d.usage.type === "continu" ? { usage: { type: "continu" as const } } : {}),
    ...(d.usage.type === "continu" ? { rattachementsExistants: [...new Set([...choix.codes, ...dejaConnues])] } : {}),
  }, r);
}

async function creerDomaineConfirme(choix: ChoixClassementRessource, cle: string, nouvelles: NouvelleCompetence[], dejaConnues: string[], r: Referentiel) {
  if (choix.domaine.mode !== "nouveau") throw new Error("Création de domaine non demandée.");
  const d = choix.domaine;
  const preuve = await domaineCreeParConfirmation(cle, d.nom);
  if (preuve) return preuve;
  const { commande } = preparerDomaineConfirme(choix, nouvelles, dejaConnues, r);
  if (commande?.type !== "creer_domaine") {
    const reprise = await domaineCreeParConfirmation(cle, d.nom);
    if (reprise) return reprise;
    throw new Error("Le domaine a été créé ailleurs. Actualisez pour le sélectionner.");
  }
  const { supabase } = await dorsaleCompte();
  const { data, error } = await supabase.rpc("appliquer_commande_referentiel", {
    p_request_id: cleCreation(cle), p_expected_version: null, p_origine: "utilisateur",
    p_motif: "Classement documentaire confirmé", p_commande: commande,
  });
  verifier("création du domaine confirmé", error);
  if (!data || data.domaineId !== commande.domaine.id) throw new Error("Le reçu de création doit être vérifié avant de continuer.");
  revalidatePath("/", "layout");
  return commande.domaine.id;
}
function lireConfirmation(v: unknown): Confirmation | null {
  if (typeof v !== "string" || v.length > 10000) return null;
  try {
    const c = JSON.parse(Buffer.from(v, "base64url").toString("utf8"));
    return c && typeof c.cle === "string" && /^[a-f0-9]{64}$/.test(c.cle) && typeof c.base === "string" && /^[a-f0-9]{64}$/.test(c.base) && typeof c.analyseId === "string" && typeof c.terminee === "boolean" && (c.choixPrealable === undefined || (typeof c.choixPrealable === "string" && /^[a-f0-9]{64}$/.test(c.choixPrealable))) && (c.domaineId === undefined || typeof c.domaineId === "string") && (c.codes === undefined || (Array.isArray(c.codes) && c.codes.every((code: unknown) => typeof code === "string"))) ? c : null;
  } catch { return null; }
}

/** Inclut les ressources historiques V1 : leur analyse reste classable sans OCR neuf. */
export async function lireClassementRessourcesAction(documentIds: string[]): Promise<{ ressources: DepotDocumentaire[]; referentiel: ContexteOrganisationDepot }> {
  if (!Array.isArray(documentIds) || !documentIds.length || documentIds.length > 101 || documentIds.some((id) => typeof id !== "string" || !id || id.length > 200) || new Set(documentIds).size !== documentIds.length) throw new Error("Sélection de ressources invalide.");
  const dorsale = await dorsaleCompte();
  const [ressources, referentiel] = await Promise.all([Promise.all(documentIds.map(lireDepotDocumentaire)), lireReferentiel(dorsale)]);
  return {
    ressources,
    referentiel: {
      compteId: dorsale.userId,
      domaines: referentiel.domaines.filter((d) => !d.archive).map(({ id, nom, prefixe, description, parentId }) => ({ id, nom, prefixe, description, parentId })),
      competences: referentiel.actifs.map((s) => ({ code: s.code, intitule: s.intitule, domaine: s.domaine, domaineNom: referentiel.domainesParId.get(s.domaine)?.nom ?? s.domaine })),
    },
  };
}

function propositionsSelectionnees(depot: DepotDocumentaire, choix: ChoixClassementRessource): NouvelleCompetence[] {
  const restitution = analysePourClassement(depot, choix.analyseId).restitution!;
  return choix.propositions.map((i) => {
    const p = restitution.version === 2 ? restitution.organisation.competences[i] : undefined;
    if (!p || p.mode !== "nouvelle") throw new Error("Une compétence choisie n'est pas une proposition nouvelle de cette analyse.");
    return p;
  });
}

function verifierReferentiel(choix: ChoixClassementRessource, propositions: NouvelleCompetence[], r: Referentiel, domaineRepris?: string) {
  if (choix.codes.some((c) => !r.actifs.some((s) => s.code === c))) throw new Error("Une compétence sélectionnée est absente ou archivée.");
  for (const p of propositions) {
    const homonymes = [...r.parCode.values()].filter((s) => normalise(s.intitule) === normalise(p.intitule));
    if (homonymes.length > 1 || homonymes.some((s) => s.archive || !r.actifs.some((a) => a.code === s.code))) throw new Error(`Compétence ambiguë ou archivée : ${p.intitule}. Choisissez explicitement une compétence existante.`);
  }
  const d = choix.domaine;
  if (d.mode === "existant") {
    if (!r.domaines.some((v) => v.id === d.id && !v.archive)) throw new Error("Le domaine choisi est absent ou archivé.");
  } else {
    if (d.parentId && !r.domaines.some((v) => v.id === d.parentId && !v.archive)) throw new Error("Le domaine parent est absent ou archivé.");
    const collisions = r.domaines.filter((v) => normalise(v.nom) === normalise(d.nom) || v.id === slugifier(d.nom));
    if (collisions.some((v) => v.archive || v.id !== domaineRepris)) throw new Error(`Le domaine « ${d.nom} » existe déjà ou son nom est ambigu. Choisissez-le dans la liste.`);
    if (domaineRepris && !collisions.some((v) => v.id === domaineRepris && !v.archive)) throw new Error("Le domaine créé précédemment n'est plus disponible.");
  }
}

async function chargerChoix(choix: ChoixClassementRessource, domaineCreeDansLot?: string) {
  const [depot, document, referentiel] = await Promise.all([lireDepotDocumentaire(choix.documentId), lireDocument(choix.documentId), lireReferentiel()]);
  if (document.updatedAt !== depot.modifieLe) throw new Error("La ressource a changé pendant la lecture. Actualisez son classement.");
  const propositions = propositionsSelectionnees(depot, choix);
  const precedente = lireConfirmation(document.frontmatter?.classement_confirmation);
  const cle = empreinte(choix);
  let confirmation = precedente?.cle === cle && precedente.analyseId === choix.analyseId ? precedente : null;
  if (confirmation && !confirmation.domaineId && choix.domaine.mode === "nouveau") {
    const domaineId = await domaineCreeParConfirmation(cle, choix.domaine.nom);
    if (domaineId) confirmation = { ...confirmation, domaineId };
  }
  if (!confirmation && depot.modifieLe !== choix.updatedAtAttendu) throw new Error("La ressource a été modifiée. Actualisez avant de confirmer son classement.");
  if (confirmation && !confirmation.terminee && confirmation.base !== baseRessource(depot)) throw new Error("Le classement a été corrigé pendant cette confirmation. Actualisez la ressource.");
  // Un ancien reçu sans empreinte ne prouve rien sur un brouillon ou un choix
  // déjà présent : exiger alors une nouvelle confirmation de la version relue.
  if (confirmation && !confirmation.terminee
    && (confirmation.choixPrealable ?? empreinteChoix({})) !== empreinteChoix(document.frontmatter)) {
    throw new Error("Votre choix de classement a changé pendant cette confirmation. Actualisez la ressource avant de confirmer.");
  }
  verifierReferentiel(choix, propositions, referentiel, confirmation?.domaineId ?? domaineCreeDansLot);
  if (choix.domaine.mode === "nouveau" && !confirmation?.domaineId && !domaineCreeDansLot) {
    const nouvelles = propositions.filter((p) => !referentiel.actifs.some((s) => normalise(s.intitule) === normalise(p.intitule)));
    const connues = propositions.flatMap((p) => referentiel.actifs.filter((s) => normalise(s.intitule) === normalise(p.intitule)).map((s) => s.code));
    preparerDomaineConfirme(choix, nouvelles, connues, referentiel);
  }
  return { depot, document, referentiel, propositions, confirmation, cle };
}

function prefixeDisponible(nom: string, r: Referentiel) {
  const base = prefixeParDefaut(nom);
  if (!r.domaines.some((d) => d.prefixe === base)) return base;
  for (let i = 0; i < 676; i++) {
    const candidat = `${base.slice(0, 3)}${String.fromCharCode(65 + Math.floor(i / 26))}${String.fromCharCode(65 + i % 26)}`;
    if (!r.domaines.some((d) => d.prefixe === candidat)) return candidat;
  }
  throw new Error("Aucun préfixe de domaine disponible.");
}

async function confirmerUneRessource(choix: ChoixClassementRessource, domaineCreeDansLot?: string): Promise<DepotDocumentaire> {
  const charge = await chargerChoix(choix, domaineCreeDansLot);
  let confirmation: Confirmation = charge.confirmation ?? { cle: charge.cle, base: baseRessource(charge.depot), choixPrealable: empreinteChoix(charge.document.frontmatter), analyseId: choix.analyseId, terminee: false, ...(domaineCreeDansLot ? { domaineId: domaineCreeDansLot } : {}) };
  if (confirmation.terminee) {
    if (charge.depot.domaineId !== confirmation.domaineId || empreinte([...charge.depot.competencesLiees].sort()) !== empreinte(confirmation.codes ?? [])) throw new Error("Le classement a été corrigé depuis cette confirmation. Actualisez la ressource.");
    await resynchroniserLiensDocument(choix.documentId);
    return charge.depot;
  }
  // La version est réservée avant toute création. Le marqueur conserve le geste
  // confirmé, jamais un score ni un plan pédagogique dérivé.
  let contenu = charge.document.contenuMd;
  let version = charge.depot.modifieLe;
  const enregistrerEtape = async () => {
    contenu = definirChampsFrontMatter(contenu, champsConfirmation(confirmation));
    version = (await modifierDocument(choix.documentId, contenu, false, version)).updatedAt;
  };
  // Une reprise réclame elle aussi la version avant ses effets. Le nonce force
  // une vraie écriture CAS même si la commande métier est identique : deux
  // reprises parties de la même version ne peuvent pas toutes deux continuer.
  confirmation = { ...confirmation, tentativeId: randomUUID() };
  await enregistrerEtape();
  const d = choix.domaine;
  let referentiel = await lireReferentiel();
  verifierReferentiel(choix, charge.propositions, referentiel, confirmation.domaineId);
  let domaineId = d.mode === "existant" ? d.id : confirmation.domaineId;
  const nouvelles = charge.propositions.filter((p) => !referentiel.actifs.some((s) => normalise(s.intitule) === normalise(p.intitule)));
  const dejaConnues = charge.propositions.flatMap((p) => referentiel.actifs.filter((s) => normalise(s.intitule) === normalise(p.intitule)).map((s) => s.code));
  if (!domaineId) {
    domaineId = await creerDomaineConfirme(choix, charge.cle, nouvelles, dejaConnues, referentiel);
    confirmation = { ...confirmation, domaineId };
    await enregistrerEtape();
  } else if (nouvelles.length) {
    const existant = domaineId ? referentiel.domainesParId.get(domaineId) : undefined;
    const nom = existant?.nom ?? (d.mode === "nouveau" ? d.nom : "");
    if (!nom) throw new Error("Domaine introuvable.");
    const creation = await creerBranche({
      domaine: nom, prefixe: existant?.prefixe ?? prefixeDisponible(nom, referentiel), description: existant?.description ?? nom,
      competences: nouvelles.map((p) => ({ intitule: p.intitule, palier: p.palier, importance: String(p.importance) })),
      origine: "utilisateur", signalerCroissanceReferentiel: false,
      ...(!existant && d.mode === "nouveau" ? { usage: d.usage, ...(d.usage.type === "continu" ? { rattachementsExistants: [...new Set([...choix.codes, ...dejaConnues])] } : {}) } : {}),
    });
    domaineId = creation.domaineId;
    confirmation = { ...confirmation, domaineId };
    await enregistrerEtape();
  }
  if (!domaineId) throw new Error("Le domaine n'a pas été enregistré.");
  referentiel = await lireReferentiel();
  verifierReferentiel(choix, charge.propositions, referentiel, d.mode === "nouveau" ? domaineId : undefined);
  if (d.mode === "nouveau" && d.parentId) {
    const domaine = referentiel.domainesParId.get(domaineId);
    if (domaine?.parentId && domaine.parentId !== d.parentId) throw new Error("La parenté du nouveau domaine a été modifiée ailleurs. Actualisez le classement.");
    if (domaine?.parentId !== d.parentId) await deplacerDomaine(domaineId, d.parentId);
  }
  referentiel = await lireReferentiel();
  const codes = [...new Set([...choix.codes, ...charge.propositions.map((p) => {
    const candidats = referentiel.actifs.filter((s) => normalise(s.intitule) === normalise(p.intitule));
    if (candidats.length !== 1) throw new Error("Une compétence créée doit être vérifiée avant de continuer.");
    return candidats[0].code;
  })])].sort();
  if (codes.length) await taguerCompetences(domaineId, codes, true);
  const rangement = { titre: charge.depot.titre, type: charge.depot.type, domaineId, codes, analyseId: choix.analyseId };
  validerRangementActif(rangement, referentiel.domaines, referentiel.actifs);
  // La relecture finale évite d'appliquer le résultat d'une analyse remplacée
  // pendant les commandes de référentiel ; le CAS protège aussi le contenu.
  analysePourClassement(await lireDepotDocumentaire(choix.documentId), choix.analyseId);
  confirmation = { ...confirmation, domaineId, codes, terminee: true };
  contenu = definirChampsFrontMatter(appliquerRangementDepot(contenu, rangement, new Date().toISOString(), empreinte(rangement)), {
    rangement_origine: "personne", referentiel_revu_le: new Date().toISOString(), referentiel_analyse_id: choix.analyseId, ...champsConfirmation(confirmation),
  });
  await modifierDocument(choix.documentId, contenu, false, version);
  await resynchroniserLiensDocument(choix.documentId);
  return lireDepotDocumentaire(choix.documentId);
}

/** Chaque ressource est versionnée ; un lot n'est pas une transaction SQL. */
export async function confirmerClassementRessourcesAction(brut: ChoixClassementRessource[]): Promise<{ resultats: ResultatClassementRessource[] }> {
  const choix = validerChoixClassementRessources(brut);
  const cleDomaine = (c: ChoixClassementRessource) => c.domaine.mode === "nouveau" ? empreinte({ ...c.domaine, nom: normalise(c.domaine.nom) }) : "";
  const creations = new Map<string, string>();
  const noms = new Map<string, string>();
  for (const c of choix) {
    if (c.domaine.mode !== "nouveau") continue;
    const nom = normalise(c.domaine.nom);
    const cle = cleDomaine(c);
    if (noms.has(nom) && noms.get(nom) !== cle) throw new Error("Le même nouveau domaine porte des parents ou usages différents dans la sélection.");
    noms.set(nom, cle);
  }
  // Aucun effet tant qu'une erreur connue existe dans la sélection complète.
  for (const c of choix) {
    const charge = await chargerChoix(c, creations.get(cleDomaine(c)));
    if (c.domaine.mode === "nouveau" && charge.confirmation?.domaineId) creations.set(cleDomaine(c), charge.confirmation.domaineId);
  }
  const resultats: ResultatClassementRessource[] = [];
  for (const c of choix) {
    try {
      const ressource = await confirmerUneRessource(c, creations.get(cleDomaine(c)));
      resultats.push({ documentId: c.documentId, statut: "confirmee", ressource });
      if (c.domaine.mode === "nouveau" && ressource.domaineId) creations.set(cleDomaine(c), ressource.domaineId);
    } catch (error) {
      resultats.push({ documentId: c.documentId, statut: "echec", erreur: error instanceof Error ? error.message : "Le classement n'a pas abouti." });
      break; // Les écritures déjà réussies restent visibles ; aucune relance implicite.
    }
  }
  revalidatePath("/app");
  revalidatePath("/atelier");
  return { resultats };
}
