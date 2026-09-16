import "server-only";
import { createHash } from "node:crypto";
import { lireDocument, modifierDocument, resynchroniserLiensDocument } from "./documents";
import { lireContexteOrganisationDepotAction } from "./depot-actions";
import { creerBranche, taguerCompetences } from "./referentiel-actions";
import { lireReferentiel } from "./referentiel";
import { definirChampsFrontMatter } from "@/lib/documents/markdown";
import { appliquerRangementDepot, derniereOrganisationDepot, type RangementRessourceDepot } from "@/lib/documents/organisation-depot";
import { formatAutorise } from "@/lib/documents/roles-note";
import { validerRangementActif } from "@/lib/documents/validation-rangement";
import { prefixeParDefaut, slugifier } from "@/lib/domain/referentiel-compte";
import { validerNouvelUsage } from "@/lib/domain/usage-domaine";
import { validerChoixRessource, type ChoixRessource, type ContexteDialogueRessource } from "@/lib/tutor/dialogue-ressource";
import type { MessageTuteur } from "@/lib/tutor/moteurs/types";
import type { DepotDocumentaire } from "@/lib/documents/depot";

const normalise = (texte: string) => texte.trim().replace(/\s+/g, " ").toLocaleLowerCase("fr-FR");
const empreinte = (x: unknown) => createHash("sha256").update(JSON.stringify(x)).digest("hex");
const base = (d: DepotDocumentaire) => empreinte([d.titre, d.type, d.domaineId ?? "", [...d.competencesLiees].sort()]);
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
  const contexte: ContexteDialogueRessource = {
    titre: depot.titre, type: depot.type, domaineId: depot.domaineId, codes: depot.competencesLiees,
    domaines: referentiel.domaines.map(({ id, nom }) => ({ id, nom })),
    competences: [...referentiel.competences.map(({ code, intitule }) => ({ code, intitule })), ...depot.competencesLiees.filter((c) => !referentiel.competences.some((s) => s.code === c)).map((code) => ({ code, intitule: code }))],
    propositions: derniere.organisation.competences.flatMap((p, index) => {
      if (p.mode !== "nouvelle") return [];
      const cible = p.domaine;
      return [{ index: String(index), intitule: p.intitule, domaine: cible.mode === "nouveau" ? cible.nom : referentiel.domaines.find((d) => d.id === cible.id)?.nom ?? cible.id }];
    }),
  };
  return { depot, derniere, referentiel, contexte, document: await lireDocument(documentId) };
}
export type DialogueCharge = Awaited<ReturnType<typeof chargerDialogueRessource>>;

/** Une vérification est une lecture : même une réparation d'index exige une reprise explicite. */
export function verifierOperationRessource(charge: DialogueCharge, cle: string) {
  const operation = lireOperation(charge.document.frontmatter?.assistant_operation);
  return operation?.cle === cle ? operation : null;
}

export function verifierChoixRessource(choix: ChoixRessource, charge: DialogueCharge, messages: MessageTuteur[]) {
  const { depot, referentiel, derniere } = charge;
  if (!validerChoixRessource(choix as unknown as Record<string, unknown>)) throw new Error("Commande documentaire invalide.");
  if (choix.action === "corriger") {
    if (choix.champ === "titre" && (!choix.valeur.trim() || choix.valeur.length > 200 || /[\r\n]/.test(choix.valeur))) throw new Error("Titre invalide.");
    if (choix.champ === "titre" && !messages.some((m) => m.role === "user" && m.content.includes(choix.valeur))) throw new Error("Précisez le titre exact à utiliser.");
    if (choix.champ === "type" && !formatAutorise("support", choix.valeur)) throw new Error("Type de support invalide.");
    if (choix.champ === "domaine" && !referentiel.domaines.some((d) => d.id === choix.valeur)) throw new Error("Précisez un domaine existant.");
    if (choix.champ.endsWith("liens") && (!choix.codes.length || choix.codes.some((c) => choix.champ === "retirer-liens" ? !depot.competencesLiees.includes(c) : !referentiel.competences.some((s) => s.code === c)))) throw new Error("Les compétences de cette correction ne sont pas disponibles.");
  }
  if (choix.action === "creer") {
    for (const index of choix.propositions) {
      const proposition = derniere.organisation.competences[Number(index)];
      if (proposition?.mode !== "nouvelle") throw new Error("La compétence n'est pas une proposition sourcée de cette analyse.");
      const d = proposition.domaine;
      const candidats = referentiel.domaines.filter((existant) => d.mode === "existant" ? existant.id === d.id : normalise(existant.nom) === normalise(d.nom));
      if (candidats.length > 1 || (d.mode === "existant" && !candidats.length)) throw new Error("Le domaine est absent ou ambigu. Précisez-le avant de créer.");
      if (!candidats.length) {
        const citation = choix.citationUsage;
        const declare = citation && messages.filter((m) => m.role === "user").some((m) => m.content.includes(citation));
        if (!declare || !choix.usage || !(choix.usage === "module" ? /module|universit|acad[eé]mi/i.test(citation) && citation.includes(choix.annee) : /continu/i.test(citation))) throw new Error("Précisez l'usage du nouveau domaine : progression continue ou module académique avec son année.");
        validerNouvelUsage({ type: choix.usage, ...(choix.usage === "module" ? { anneeAcademique: choix.annee } : {}) });
      }
    }
  }
}

/** Prépare la commande avant ses effets. Rejouer la même clé réutilise exactement cette commande. */
export async function preparerOperationRessource(charge: DialogueCharge, cle: string, choix: ChoixRessource, messages: MessageTuteur[]) {
  verifierChoixRessource(choix, charge, messages);
  const operation: Operation = { cle, choix, analyseId: charge.derniere.analyseId, base: base(charge.depot), terminee: false, recu: "", automatique: false };
  const md = definirChampsFrontMatter(charge.document.contenuMd, champOperation(operation));
  await modifierDocument(charge.depot.id, md, false, charge.depot.modifieLe);
}

export async function executerOperationRessource(charge: DialogueCharge, cle: string): Promise<string> {
  const operation = verifierOperationRessource(charge, cle);
  if (!operation) throw new Error("La commande n'a pas été retrouvée.");
  if (operation.automatique) throw new Error("Cette ancienne organisation automatique doit être confirmée dans la fenêtre de classement.");
  if (operation.terminee) { await resynchroniserLiensDocument(charge.depot.id); return operation.recu; }
  if (operation.analyseId !== charge.derniere.analyseId || operation.base !== base(charge.depot)) throw new Error("La ressource a été modifiée depuis cette demande. Ouvrez une nouvelle correction.");
  const { choix } = operation;
  const depot = charge.depot;
  const codes = new Set(depot.competencesLiees);
  const rangement: RangementRessourceDepot = { titre: depot.titre, type: depot.type, domaineId: depot.domaineId, codes: [], analyseId: operation.analyseId, aTrier: depot.rangementStatut === "a-trier" };
  const ajouts: string[] = [];
  if (choix.action === "creer") {
    for (const index of [...new Set(choix.propositions)]) {
      const proposition = charge.derniere.organisation.competences[Number(index)];
      if (proposition?.mode !== "nouvelle") throw new Error("La proposition source n'est plus disponible.");
      const r = await lireReferentiel();
      const d = proposition.domaine;
      const domaine = r.domaines.find((e) => d.mode === "existant" ? e.id === d.id : normalise(e.nom) === normalise(d.nom));
      if (domaine?.archive) throw new Error("Le domaine a été archivé. Aucune restauration automatique.");
      const homonymes = [...r.parCode.values()].filter((s) => normalise(s.intitule) === normalise(proposition.intitule));
      if (homonymes.length > 1 || homonymes.some((s) => s.archive)) throw new Error("Une compétence homonyme est ambiguë ou archivée. Aucune recréation automatique.");
      let code = homonymes[0]?.code;
      let domaineId = domaine?.id;
      if (!code || !domaine) {
        const nom = domaine?.nom ?? (d.mode === "nouveau" ? d.nom : "");
        if (!nom) throw new Error("Domaine introuvable.");
        if (!domaine && r.domaines.some((e) => e.id === slugifier(nom))) throw new Error("Le nom du nouveau domaine entre en conflit avec un domaine existant. Précisez le rangement.");
        let prefixe = domaine?.prefixe ?? prefixeParDefaut(nom);
        if (!domaine) {
          const racine = prefixe.slice(0, 3); let n = 0;
          while (r.domaines.some((e) => e.prefixe === prefixe)) {
            if (n >= 676) throw new Error("Aucun préfixe disponible pour ce domaine.");
            prefixe = `${racine}${String.fromCharCode(65 + Math.floor(n / 26))}${String.fromCharCode(65 + n % 26)}`;
            n++;
          }
        }
        const principal = charge.derniere.organisation.domaine;
        const cree = await creerBranche({ domaine: nom, prefixe, description: domaine?.description ?? (principal?.mode === "nouveau" && principal.nom === nom ? principal.description : nom),
          competences: code ? [] : [{ intitule: proposition.intitule, palier: proposition.palier, importance: String(proposition.importance) }],
          ...(!domaine && code && choix.usage === "continu" ? { rattachementsExistants: [code] } : {}),
          origine: "tuteur", signalerCroissanceReferentiel: false,
          ...(!domaine ? { usage: { type: choix.usage, ...(choix.usage === "module" ? { anneeAcademique: choix.annee } : {}) } } : {}),
        });
        const relu = await lireReferentiel();
        const trouves = relu.actifs.filter((s) => normalise(s.intitule) === normalise(proposition.intitule));
        if (trouves.length !== 1) throw new Error("La création doit être vérifiée avant de continuer.");
        code = trouves[0].code;
        domaineId = cree.domaineId;
        if (!rangement.domaineId) rangement.domaineId = cree.domaineId;
      }
      if (domaineId) await taguerCompetences(domaineId, [code], true);
      codes.add(code); ajouts.push(proposition.intitule);
    }
  } else if (choix.action === "corriger") {
    if (choix.champ === "titre") rangement.titre = choix.valeur.trim();
    if (choix.champ === "type") rangement.type = choix.valeur;
    if (choix.champ === "domaine") rangement.domaineId = choix.valeur;
    if (choix.champ === "ajouter-liens") choix.codes.forEach((c) => codes.add(c));
    if (choix.champ === "retirer-liens") choix.codes.forEach((c) => codes.delete(c));
  } else throw new Error("Cette réponse ne contient pas de commande.");
  const actuel = await lireReferentiel();
  if (choix.action === "creer") rangement.aTrier = charge.derniere.organisation.competences.some((p) => p.mode === "nouvelle" && !actuel.actifs.some((s) => normalise(s.intitule) === normalise(p.intitule))) || !rangement.domaineId;
  rangement.codes = [...codes].sort();
  validerRangementActif(rangement, actuel.domaines, actuel.actifs);
  operation.terminee = true;
  operation.recu = choix.action === "creer" ? `Compétences créées ou réutilisées et liées à « ${rangement.titre} » : ${ajouts.join(" ; ")}. Aucun niveau ni séance créé.` : `Correction enregistrée pour « ${rangement.titre} » (${choix.champ}). ${choix.champ === "retirer-liens" ? "Les compétences elles-mêmes sont conservées." : "Les autres ressources restent inchangées."}`;
  const md = definirChampsFrontMatter(appliquerRangementDepot(charge.document.contenuMd, rangement, new Date().toISOString(), empreinte(rangement)), { rangement_origine: operation.automatique ? "assistant" : "personne", ...champOperation(operation) });
  await modifierDocument(depot.id, md, false, depot.modifieLe);
  await resynchroniserLiensDocument(depot.id);
  return operation.recu;
}
