import type { EntreeUsageDomaine } from "@/lib/domain/usage-domaine";
import { validerNouvelUsage } from "@/lib/domain/usage-domaine";
import { MAX_COMPETENCES_ORGANISATION_DEPOT, type DepotDocumentaire } from "./depot";
import type { DomaineOrganisationDepot } from "./organisation-depot";
import { validerCorrectionsClassement, type CorrectionCompetenceClassement } from "./corrections-classement";

/** Borne d'entrée des liens cumulés d'une ressource, distincte des 30 propositions
 * d'une analyse. Un dépassement est refusé explicitement, jamais tronqué. */
export const MAX_COMPETENCES_LIEES_RESSOURCE = 1000;

export interface ChoixClassementRessource {
  documentId: string;
  analyseId: string;
  updatedAtAttendu: string;
  domaine: { mode: "existant"; id: string } | {
    mode: "nouveau"; nom: string; parentId?: string; usage: EntreeUsageDomaine;
  };
  codes: string[];
  /** Indices des seules compétences nouvelles dans l'analyse conservée. */
  propositions: number[];
  corrections?: CorrectionCompetenceClassement[];
}

const objet = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const texte = (v: unknown, max = 200): v is string => typeof v === "string" && v.trim().length > 0 && v.length <= max && !/[\r\n]/.test(v);

export function validerSelectionCompetencesClassement(codes: unknown, propositions: unknown): { codes: string[]; propositions: number[] } {
  if (!Array.isArray(codes) || codes.length > MAX_COMPETENCES_LIEES_RESSOURCE || !codes.every((c) => texte(c, 100)) || !Array.isArray(propositions) || propositions.length > MAX_COMPETENCES_ORGANISATION_DEPOT || !propositions.every((i) => Number.isInteger(i) && i >= 0 && i < MAX_COMPETENCES_ORGANISATION_DEPOT)) throw new Error("Sélection de compétences invalide.");
  if (new Set(codes).size !== codes.length || new Set(propositions).size !== propositions.length) throw new Error("Les compétences sélectionnées sont répétées.");
  if (codes.length + propositions.length > MAX_COMPETENCES_LIEES_RESSOURCE) throw new Error(`La sélection dépasse la limite technique de ${MAX_COMPETENCES_LIEES_RESSOURCE} compétences liées à une ressource. Aucun lien n’a été retiré.`);
  return { codes: [...codes].sort(), propositions: [...propositions].sort((a, b) => a - b) };
}

/** Frontière réseau : ne jamais faire confiance aux types du formulaire. */
export function validerChoixClassementRessources(brut: unknown): ChoixClassementRessource[] {
  if (!Array.isArray(brut) || !brut.length || brut.length > 101) throw new Error("Sélection de ressources invalide.");
  const ids = new Set<string>();
  return brut.map((v) => {
    if (!objet(v) || !texte(v.documentId) || !texte(v.analyseId) || !texte(v.updatedAtAttendu) || ids.has(v.documentId)) throw new Error("Une ressource est invalide ou sélectionnée plusieurs fois.");
    ids.add(v.documentId);
    const selection = validerSelectionCompetencesClassement(v.codes, v.propositions);
    const corrections = validerCorrectionsClassement(v.corrections);
    const d = v.domaine;
    let domaine: ChoixClassementRessource["domaine"];
    if (objet(d) && d.mode === "existant" && texte(d.id)) domaine = { mode: "existant", id: d.id };
    else if (objet(d) && d.mode === "nouveau" && texte(d.nom, 80) && (d.parentId === undefined || texte(d.parentId)) && objet(d.usage) && (d.usage.type === "indetermine" || d.usage.type === "continu" || d.usage.type === "module")) {
      if ((d.usage.anneeAcademique !== undefined && !texte(d.usage.anneeAcademique, 100)) || (d.usage.periode !== undefined && !texte(d.usage.periode, 100))) throw new Error("Usage déclaré invalide.");
      const usage: EntreeUsageDomaine = { type: d.usage.type, ...(typeof d.usage.anneeAcademique === "string" ? { anneeAcademique: d.usage.anneeAcademique } : {}), ...(typeof d.usage.periode === "string" ? { periode: d.usage.periode } : {}) };
      validerNouvelUsage(usage);
      if (usage.type === "continu" && !selection.codes.length && !selection.propositions.length) throw new Error("Un nouveau domaine continu demande au moins une compétence sélectionnée.");
      domaine = { mode: "nouveau", nom: d.nom.trim(), ...(typeof d.parentId === "string" ? { parentId: d.parentId } : {}), usage };
    } else throw new Error("Choisissez un domaine existant ou déclarez le nouveau domaine et son usage.");
    return { documentId: v.documentId, analyseId: v.analyseId, updatedAtAttendu: v.updatedAtAttendu, domaine, ...selection, ...(corrections.length ? { corrections } : {}) };
  });
}

/** L'analyse la plus récente décide, même lorsqu'elle est encore en cours. */
export function analysePourClassement(depot: DepotDocumentaire, analyseId: string) {
  const analyse = [...depot.analyses].sort((a, b) => Date.parse(b.creeLe) - Date.parse(a.creeLe))[0];
  if (!analyse || analyse.id !== analyseId || analyse.statut !== "terminee" || !analyse.restitution) throw new Error("L'analyse a changé ou n'est pas terminée. Actualisez les ressources.");
  return analyse;
}

/** Lisible dans les listes de choix, sans transformer la parenté déclarée. */
export function cheminDomaineClassement(id: string, domaines: readonly DomaineOrganisationDepot[]): string {
  const parId = new Map(domaines.map((d) => [d.id, d]));
  const noms: string[] = [];
  const vus = new Set<string>();
  let courant = parId.get(id);
  while (courant && !vus.has(courant.id)) {
    vus.add(courant.id);
    noms.unshift(courant.nom);
    courant = courant.parentId ? parId.get(courant.parentId) : undefined;
  }
  return noms.join(" › ") || id;
}
