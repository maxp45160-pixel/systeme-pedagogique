import {
  TYPES_ELEMENT_GLOBAL,
  TYPES_RELATION_GLOBALE,
  motifRefusProvenanceGlobale,
  type ElementGlobal,
  type CorrespondanceCarteGlobale,
  type ProvenanceGlobale,
  type RelationGlobale,
  type SelectionCarteGlobale,
} from "@/lib/domain/carte-globale";
import { DonneeSupabaseInvalide } from "./validation-supabase";

type Objet = Record<string, unknown>;

function objet(valeur: unknown, chemin: string): Objet {
  if (!valeur || typeof valeur !== "object" || Array.isArray(valeur)) {
    throw new DonneeSupabaseInvalide(chemin, "objet attendu");
  }
  return valeur as Objet;
}

function texte(valeur: unknown, chemin: string, vide = false): string {
  if (typeof valeur !== "string" || (!vide && valeur.trim() === "")) {
    throw new DonneeSupabaseInvalide(chemin, vide ? "texte attendu" : "texte non vide attendu");
  }
  return valeur;
}

function date(valeur: unknown, chemin: string): string {
  const resultat = texte(valeur, chemin);
  if (Number.isNaN(Date.parse(resultat))) {
    throw new DonneeSupabaseInvalide(chemin, "date ISO attendue");
  }
  return resultat;
}

function version(valeur: unknown, chemin: string): number {
  if (typeof valeur !== "number" || !Number.isInteger(valeur) || valeur < 1) {
    throw new DonneeSupabaseInvalide(chemin, "entier positif attendu");
  }
  return valeur;
}

function enumeration<const T extends readonly string[]>(
  valeur: unknown,
  valeurs: T,
  chemin: string,
): T[number] {
  if (typeof valeur !== "string" || !valeurs.includes(valeur)) {
    throw new DonneeSupabaseInvalide(chemin, `une valeur parmi ${valeurs.join(", ")} attendue`);
  }
  return valeur;
}

export function validerProvenanceGlobale(
  valeur: unknown,
  chemin = "provenance",
): ProvenanceGlobale {
  const provenance = objet(valeur, chemin);
  const cles = Object.keys(provenance);
  if (cles.some((cle) => !["type", "reference", "note"].includes(cle))) {
    throw new DonneeSupabaseInvalide(chemin, "seules les clés type, reference et note sont admises");
  }
  const resultat: ProvenanceGlobale = {
    type: texte(provenance.type, `${chemin}.type`),
    reference: texte(provenance.reference, `${chemin}.reference`),
    ...(provenance.note === undefined ? {} : { note: texte(provenance.note, `${chemin}.note`) }),
  };
  const refus = motifRefusProvenanceGlobale(resultat);
  if (refus) throw new DonneeSupabaseInvalide(chemin, refus);
  return resultat;
}

export function validerElementGlobal(valeur: unknown, chemin = "elementGlobal"): ElementGlobal {
  const element = objet(valeur, chemin);
  return {
    id: texte(element.id, `${chemin}.id`),
    type: enumeration(element.type, TYPES_ELEMENT_GLOBAL, `${chemin}.type`),
    nom: texte(element.nom, `${chemin}.nom`),
    description: texte(element.description, `${chemin}.description`, true),
    statut: enumeration(element.statut, ["publie", "retire"] as const, `${chemin}.statut`),
    provenance: validerProvenanceGlobale(element.provenance, `${chemin}.provenance`),
    version: version(element.version, `${chemin}.version`),
    valideLe: date(element.valideLe, `${chemin}.valideLe`),
  };
}

export function validerRelationGlobale(
  valeur: unknown,
  chemin = "relationGlobale",
): RelationGlobale {
  const relation = objet(valeur, chemin);
  const sourceId = texte(relation.sourceId, `${chemin}.sourceId`);
  const cibleId = texte(relation.cibleId, `${chemin}.cibleId`);
  if (sourceId === cibleId) {
    throw new DonneeSupabaseInvalide(chemin, "source et cible distinctes attendues");
  }
  return {
    id: texte(relation.id, `${chemin}.id`),
    sourceId,
    cibleId,
    type: enumeration(relation.type, TYPES_RELATION_GLOBALE, `${chemin}.type`),
    statut: enumeration(relation.statut, ["publie", "retire"] as const, `${chemin}.statut`),
    provenance: validerProvenanceGlobale(relation.provenance, `${chemin}.provenance`),
    version: version(relation.version, `${chemin}.version`),
    valideLe: date(relation.valideLe, `${chemin}.valideLe`),
  };
}

export function validerSelectionCarteGlobale(
  valeur: unknown,
  chemin = "selectionCarteGlobale",
): SelectionCarteGlobale {
  const selection = objet(valeur, chemin);
  return {
    elementId: texte(selection.elementId, `${chemin}.elementId`),
    selectionneLe: date(selection.selectionneLe, `${chemin}.selectionneLe`),
  };
}

export function validerCorrespondanceCarteGlobale(
  valeur: unknown,
  chemin = "correspondanceCarteGlobale",
): CorrespondanceCarteGlobale {
  const correspondance = objet(valeur, chemin);
  return {
    competenceCode: texte(correspondance.competenceCode, `${chemin}.competenceCode`),
    elementGlobalId: texte(correspondance.elementGlobalId, `${chemin}.elementGlobalId`),
    acteur: enumeration(correspondance.acteur, ["personne", "systeme"] as const, `${chemin}.acteur`),
    provenance: validerProvenanceGlobale(correspondance.provenance, `${chemin}.provenance`),
    rattacheLe: date(correspondance.rattacheLe, `${chemin}.rattacheLe`),
  };
}
