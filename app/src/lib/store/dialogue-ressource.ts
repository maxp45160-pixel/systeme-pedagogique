import "server-only";
import { createHash } from "node:crypto";
import { lireDocument, modifierDocument, resynchroniserLiensDocument } from "./documents";
import { lireContexteOrganisationDepotAction } from "./depot-actions";
import { lireReferentiel } from "./referentiel";
import { definirChampsFrontMatter } from "@/lib/documents/markdown";
import { appliquerRangementDepot, derniereOrganisationDepot, type RangementRessourceDepot } from "@/lib/documents/organisation-depot";
import { formatAutorise } from "@/lib/documents/roles-note";
import { validerRangementActif } from "@/lib/documents/validation-rangement";
import { CHAMP_CONTEXTE_RESSOURCE, champsContexteRessource, lireContexteRessource } from "@/lib/documents/contexte-ressource";
import { MESSAGE_DOCUMENTAIRE_PREFIXE } from "@/lib/documents/dialogue-documentaire";
import { validerChoixRessource, type ChoixRessource, type ContexteDialogueRessource } from "@/lib/tutor/dialogue-ressource";
import type { MessageTuteur } from "@/lib/tutor/moteurs/types";
import type { DepotDocumentaire } from "@/lib/documents/depot";

const empreinte = (x: unknown) => createHash("sha256").update(JSON.stringify(x)).digest("hex");
const base = (d: DepotDocumentaire, frontmatter: Record<string, unknown>) => empreinte([
  d.titre, d.type, d.domaineId ?? "", [...d.competencesLiees].sort(),
  ...(frontmatter[CHAMP_CONTEXTE_RESSOURCE] === undefined ? [] : [frontmatter[CHAMP_CONTEXTE_RESSOURCE]]),
]);
interface Operation { cle: string; analyseId: string; base: string; choix: ChoixRessource; terminee: boolean; recu: string; automatique: boolean }
function lireOperation(valeur: unknown): Operation | null {
  if (typeof valeur !== "string" || valeur.length > 20000) return null;
  try {
    const o = JSON.parse(Buffer.from(valeur, "base64url").toString("utf8"));
    return o && /^[a-f0-9]{64}$/.test(o.cle) && typeof o.analyseId === "string" && /^[a-f0-9]{64}$/.test(o.base) &&
      typeof o.terminee === "boolean" && typeof o.automatique === "boolean" && typeof o.recu === "string" && validerChoixRessource(o.choix) ? o : null;
  } catch { return null; }
}
const champOperation = (o: Operation) => ({ assistant_operation: Buffer.from(JSON.stringify(o)).toString("base64url") });

export async function chargerDialogueRessource(documentId: string) {
  const { ressources, referentiel } = await lireContexteOrganisationDepotAction([documentId]);
  const depot = ressources[0];
  const derniere = depot && derniereOrganisationDepot(depot);
  if (!depot || !derniere || !depot.analyses.some((a) => a.id === derniere.analyseId && a.statut === "terminee")) throw new Error("Analysez d'abord cette ressource pour pouvoir corriger son organisation.");
  const document = await lireDocument(documentId);
  const contexte: ContexteDialogueRessource = {
    personnel: lireContexteRessource(document.frontmatter ?? {}),
    titre: depot.titre, type: depot.type, domaineId: depot.domaineId, codes: depot.competencesLiees,
    domaines: referentiel.domaines.map(({ id, nom }) => ({ id, nom })),
    competences: [...referentiel.competences.map(({ code, intitule }) => ({ code, intitule })), ...depot.competencesLiees.filter((c) => !referentiel.competences.some((s) => s.code === c)).map((code) => ({ code, intitule: code }))],
    propositions: derniere.organisation.competences.flatMap((p, index) => {
      if (p.mode !== "nouvelle") return [];
      const cible = p.domaine;
      return [{ index: String(index), intitule: p.intitule, domaine: cible.mode === "nouveau" ? cible.nom : referentiel.domaines.find((d) => d.id === cible.id)?.nom ?? cible.id }];
    }),
  };
  return { depot, derniere, referentiel, contexte, document };
}
export type DialogueCharge = Awaited<ReturnType<typeof chargerDialogueRessource>>;

/** Une vérification est une lecture : même une réparation d'index exige une reprise explicite. */
export function verifierOperationRessource(charge: DialogueCharge, cle: string) {
  const operation = lireOperation(charge.document.frontmatter?.assistant_operation);
  return operation?.cle === cle ? operation : null;
}

export function verifierChoixRessource(choix: ChoixRessource, charge: DialogueCharge, messages: MessageTuteur[]) {
  const { depot, referentiel } = charge;
  if (!validerChoixRessource(choix as unknown as Record<string, unknown>)) throw new Error("Commande documentaire invalide.");
  if (choix.action === "corriger") {
    if (choix.champ === "titre" && (!choix.valeur.trim() || choix.valeur.length > 200 || /[\r\n]/.test(choix.valeur))) throw new Error("Titre invalide.");
    if (choix.champ === "titre" && !messages.some((m) => m.role === "user" && m.content.includes(choix.valeur))) throw new Error("Précisez le titre exact à utiliser.");
    if (choix.champ === "type" && !formatAutorise("support", choix.valeur)) throw new Error("Type de support invalide.");
    if (choix.champ === "domaine" && !referentiel.domaines.some((d) => d.id === choix.valeur)) throw new Error("Précisez un domaine existant.");
    if (choix.champ.endsWith("liens") && (!choix.codes.length || choix.codes.some((c) => choix.champ === "retirer-liens" ? !depot.competencesLiees.includes(c) : !referentiel.competences.some((s) => s.code === c)))) throw new Error("Les compétences de cette correction ne sont pas disponibles.");
  }
  if (choix.action === "creer") throw new Error("Ouvrez la fenêtre de classement pour créer les compétences proposées avec vos corrections conservées.");
  if (choix.action === "declarer") {
    const dernier = messages.at(-1);
    if (dernier?.role !== "user" || dernier.content.trim() !== choix.valeur) throw new Error("La déclaration doit reprendre exactement votre dernier message, sans reformulation.");
    if (choix.valeur.startsWith(MESSAGE_DOCUMENTAIRE_PREFIXE) || choix.valeur.includes("--- début des extraits documentaires ---") || choix.valeur.includes("--- fin des extraits documentaires ---")) throw new Error("Un extrait documentaire ne devient pas une déclaration personnelle. Précisez votre contexte dans un message distinct.");
  }
}

/** Prépare la commande avant ses effets. Rejouer la même clé réutilise exactement cette commande. */
export async function preparerOperationRessource(charge: DialogueCharge, cle: string, choix: ChoixRessource, messages: MessageTuteur[]) {
  verifierChoixRessource(choix, charge, messages);
  const operation: Operation = { cle, choix, analyseId: charge.derniere.analyseId, base: base(charge.depot, charge.document.frontmatter ?? {}), terminee: false, recu: "", automatique: false };
  const md = definirChampsFrontMatter(charge.document.contenuMd, champOperation(operation));
  await modifierDocument(charge.depot.id, md, false, charge.depot.modifieLe);
}

export async function executerOperationRessource(charge: DialogueCharge, cle: string): Promise<string> {
  const operation = verifierOperationRessource(charge, cle);
  if (!operation) throw new Error("La commande n'a pas été retrouvée.");
  if (operation.automatique) throw new Error("Cette ancienne organisation automatique doit être confirmée dans la fenêtre de classement.");
  if (operation.terminee) { if (operation.choix.action !== "declarer") await resynchroniserLiensDocument(charge.depot.id); return operation.recu; }
  if (operation.choix.action === "creer") throw new Error("Ouvrez la fenêtre de classement pour vérifier cette ancienne création et conserver vos corrections.");
  if (operation.analyseId !== charge.derniere.analyseId || operation.base !== base(charge.depot, charge.document.frontmatter ?? {})) throw new Error("La ressource a été modifiée depuis cette demande. Ouvrez une nouvelle correction.");
  const { choix } = operation;
  const depot = charge.depot;
  if (choix.action === "declarer") {
    if (choix.champ !== "contexte" && choix.champ !== "intention") throw new Error("Champ de déclaration invalide.");
    const personnel = lireContexteRessource(charge.document.frontmatter ?? {});
    personnel[choix.champ] = { texte: choix.valeur, declareLe: new Date().toISOString() };
    operation.terminee = true;
    operation.recu = `J’ai conservé ${choix.champ === "intention" ? "votre intention" : "le contexte personnel de ce document"} dans vos mots : « ${choix.valeur} ». Vous pouvez le préciser ou le corriger ici, ou en rester là.`;
    const md = definirChampsFrontMatter(charge.document.contenuMd, { ...champsContexteRessource(personnel), ...champOperation(operation) });
    await modifierDocument(depot.id, md, false, depot.modifieLe);
    return operation.recu;
  }
  const codes = new Set(depot.competencesLiees);
  const rangement: RangementRessourceDepot = { titre: depot.titre, type: depot.type, domaineId: depot.domaineId, codes: [], analyseId: operation.analyseId, aTrier: depot.rangementStatut === "a-trier" };
  if (choix.action === "corriger") {
    if (choix.champ === "titre") rangement.titre = choix.valeur.trim();
    if (choix.champ === "type") rangement.type = choix.valeur;
    if (choix.champ === "domaine") rangement.domaineId = choix.valeur;
    if (choix.champ === "ajouter-liens") choix.codes.forEach((c) => codes.add(c));
    if (choix.champ === "retirer-liens") choix.codes.forEach((c) => codes.delete(c));
  } else throw new Error("Cette réponse ne contient pas de commande.");
  const actuel = await lireReferentiel();
  rangement.codes = [...codes].sort();
  validerRangementActif(rangement, actuel.domaines, actuel.actifs);
  operation.terminee = true;
  operation.recu = `Correction enregistrée pour « ${rangement.titre} » (${choix.champ}). ${choix.champ === "retirer-liens" ? "Les compétences elles-mêmes sont conservées." : "Les autres ressources restent inchangées."}`;
  const md = definirChampsFrontMatter(appliquerRangementDepot(charge.document.contenuMd, rangement, new Date().toISOString(), empreinte(rangement)), { rangement_origine: operation.automatique ? "assistant" : "personne", ...champOperation(operation) });
  await modifierDocument(depot.id, md, false, depot.modifieLe);
  await resynchroniserLiensDocument(depot.id);
  return operation.recu;
}
