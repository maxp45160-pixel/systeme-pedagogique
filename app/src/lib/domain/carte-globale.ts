/**
 * Contrats du noyau global Twiny (lot 3).
 *
 * La carte globale ne contient que des faits publies et sourcés. La relation
 * personnelle du compte est une selection, jamais une copie ni un etat de
 * progression. Le centre visuel « connaissance humaine » n'est pas une entite.
 */

export const TYPES_ELEMENT_GLOBAL = ["domaine", "connaissance", "competence"] as const;
export type TypeElementGlobal = (typeof TYPES_ELEMENT_GLOBAL)[number];

export const TYPES_RELATION_GLOBALE = ["PART_OF", "RELATED_TO"] as const;
export type TypeRelationGlobale = (typeof TYPES_RELATION_GLOBALE)[number];

export type StatutGlobal = "publie" | "retire";

export interface ProvenanceGlobale {
  type: string;
  reference: string;
  note?: string;
}
export interface ElementGlobal {
  id: string;
  type: TypeElementGlobal;
  nom: string;
  description: string;
  statut: StatutGlobal;
  provenance: ProvenanceGlobale;
  version: number;
  valideLe: string;
}

export interface RelationGlobale {
  id: string;
  sourceId: string;
  cibleId: string;
  type: TypeRelationGlobale;
  statut: StatutGlobal;
  provenance: ProvenanceGlobale;
  version: number;
  valideLe: string;
}

export interface SelectionCarteGlobale {
  elementId: string;
  selectionneLe: string;
}

export interface CarteGlobale {
  elements: ElementGlobal[];
  relations: RelationGlobale[];
}

export type CommandeCarteGlobale =
  | {
      type: "publier_element";
      element: Pick<ElementGlobal, "type" | "nom" | "description">;
    }
  | {
      type: "corriger_element";
      id: string;
      nom: string;
      description: string;
    }
  | { type: "retirer_element"; id: string }
  | {
      type: "publier_relation";
      relation: Pick<RelationGlobale, "sourceId" | "cibleId" | "type">;
    }
  | { type: "retirer_relation"; id: string };

export interface ResultatCommandeCarteGlobale {
  action: CommandeCarteGlobale["type"];
  objetType: "element" | "relation";
  objet: ElementGlobal | RelationGlobale;
  rejeu: boolean;
}

export function motifRefusProvenanceGlobale(provenance: ProvenanceGlobale): string | null {
  if (!provenance.type.trim() || provenance.type.length > 100) {
    return "Le type de provenance est obligatoire et limité à 100 caractères.";
  }
  if (!provenance.reference.trim() || provenance.reference.length > 1000) {
    return "La référence de provenance est obligatoire et limitée à 1 000 caractères.";
  }
  if (provenance.note !== undefined && (!provenance.note.trim() || provenance.note.length > 2000)) {
    return "La note de provenance, lorsqu’elle existe, est limitée à 2 000 caractères.";
  }
  return null;
}
