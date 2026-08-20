/**
 * Faits privés du lot 4 : objectifs, parcours et événements de leur cycle de vie.
 *
 * Ces types ne portent aucun état calculé. Une cible n'entre ici que parce
 * qu'elle a été choisie explicitement et sera vérifiée par la dorsale.
 */

export const TYPES_CIBLE_OBJECTIF = [
  "element-global",
  "domaine-local",
  "competence-locale",
  "relation-globale",
] as const;
export type TypeCibleObjectif = (typeof TYPES_CIBLE_OBJECTIF)[number];

export type CibleObjectif =
  | { type: "element-global"; elementId: string }
  | { type: "domaine-local"; domaineId: string }
  | { type: "competence-locale"; code: string }
  | { type: "relation-globale"; relationId: string };

export const HORIZONS_OBJECTIF = ["court-terme", "moyen-terme", "long-terme"] as const;
export type HorizonObjectif = (typeof HORIZONS_OBJECTIF)[number];

export const STATUTS_OBJECTIF = [
  "brouillon",
  "actif",
  "en-pause",
  "atteint",
  "abandonne",
] as const;
export type StatutObjectif = (typeof STATUTS_OBJECTIF)[number];

export const STATUTS_PARCOURS = [
  "brouillon",
  "actif",
  "en-pause",
  "termine",
  "abandonne",
] as const;
export type StatutParcours = (typeof STATUTS_PARCOURS)[number];

export const TYPES_EVENEMENT_LOT4 = [
  "objectif-cree",
  "objectif-modifie",
  "objectif-statut-change",
  "objectif-archive",
  "parcours-cree",
  "parcours-modifie",
  "parcours-statut-change",
  "parcours-archive",
  "session-rattachee",
] as const;
export type TypeEvenementLot4 = (typeof TYPES_EVENEMENT_LOT4)[number];

export type ActeurEvenementLot4 = "personne" | "systeme";

export interface ProvenanceLot4 {
  type: string;
  reference: string;
  note?: string;
}

export interface Objectif {
  id: string;
  formulation: string;
  cible: CibleObjectif;
  priorite: number;
  horizon: HorizonObjectif;
  echeanceLe?: string;
  statut: StatutObjectif;
  version: number;
  creeLe: string;
  modifieLe: string;
  archiveLe?: string;
}

export interface Parcours {
  id: string;
  objectifId?: string;
  contexte: string;
  cible: CibleObjectif;
  statut: StatutParcours;
  version: number;
  creeLe: string;
  modifieLe: string;
  archiveLe?: string;
}

export interface EvenementLot4 {
  id: string;
  requestId: string;
  type: TypeEvenementLot4;
  acteur: ActeurEvenementLot4;
  consentement: boolean;
  survenuLe: string;
  objectifId?: string;
  parcoursId?: string;
  sessionId?: string;
  provenance: ProvenanceLot4;
  payload: Record<string, unknown>;
}

export interface NouvelObjectif {
  formulation: string;
  cible: CibleObjectif;
  priorite: number;
  horizon: HorizonObjectif;
  echeanceLe?: string;
}

export type ModificationObjectif = NouvelObjectif;

export interface NouveauParcours {
  objectifId?: string;
  contexte: string;
  cible: CibleObjectif;
}

export type ModificationParcours = NouveauParcours;

export type CommandeLot4 =
  | ({ type: "creer_objectif" } & NouvelObjectif)
  | ({ type: "modifier_objectif"; objectifId: string; version: number } & ModificationObjectif)
  | { type: "changer_statut_objectif"; objectifId: string; version: number; statut: StatutObjectif }
  | { type: "archiver_objectif"; objectifId: string; version: number }
  | ({ type: "creer_parcours" } & NouveauParcours)
  | ({ type: "modifier_parcours"; parcoursId: string; version: number } & ModificationParcours)
  | { type: "changer_statut_parcours"; parcoursId: string; version: number; statut: StatutParcours }
  | { type: "archiver_parcours"; parcoursId: string; version: number }
  | { type: "rattacher_session"; parcoursId: string; sessionId: string };

export interface ResultatCommandeLot4 {
  requestId: string;
  rejoue: boolean;
  eventId: string;
  eventType: TypeEvenementLot4;
  objectifId?: string;
  parcoursId?: string;
  sessionId?: string;
}

function texte(valeur: unknown, nom: string): string | null {
  if (typeof valeur !== "string" || valeur.trim().length === 0) return `${nom} doit être renseigné.`;
  return null;
}

export function motifRefusProvenanceLot4(provenance: ProvenanceLot4): string | null {
  if (!provenance || typeof provenance !== "object") return "La provenance est obligatoire.";
  const type = texte(provenance.type, "Le type de provenance");
  if (type) return type;
  const reference = texte(provenance.reference, "La référence de provenance");
  if (reference) return reference;
  if (provenance.note !== undefined) {
    if (typeof provenance.note !== "string") return "La note de provenance doit être un texte.";
    if (provenance.note.length > 1000) {
      return "La note de provenance ne peut pas dépasser 1 000 caractères.";
    }
  }
  return null;
}

export function motifRefusCibleObjectif(cible: CibleObjectif): string | null {
  if (!cible || typeof cible !== "object" || !("type" in cible)) return "La cible est obligatoire.";
  if (!TYPES_CIBLE_OBJECTIF.includes(cible.type)) return "Le type de cible est invalide.";
  const cleReference = cible.type === "element-global"
    ? "elementId"
    : cible.type === "domaine-local"
      ? "domaineId"
      : cible.type === "competence-locale"
        ? "code"
        : "relationId";
  const cles = Object.keys(cible);
  if (cles.length !== 2 || !cles.includes("type") || !cles.includes(cleReference)) {
    return "La cible doit contenir exactement son type et une seule référence.";
  }
  const valeur = "elementId" in cible
    ? cible.elementId
    : "domaineId" in cible
      ? cible.domaineId
      : "code" in cible
        ? cible.code
        : cible.relationId;
  return texte(valeur, "La référence de cible");
}

export function motifRefusNouvelObjectif(entree: NouvelObjectif): string | null {
  if (!entree || typeof entree !== "object") return "L’objectif est obligatoire.";
  const formulation = texte(entree.formulation, "La formulation");
  if (formulation) return formulation;
  if (entree.formulation.trim().length > 4000) return "La formulation ne peut pas dépasser 4 000 caractères.";
  const cible = motifRefusCibleObjectif(entree.cible);
  if (cible) return cible;
  if (!Number.isInteger(entree.priorite) || entree.priorite < 1 || entree.priorite > 5) {
    return "La priorité doit être un entier compris entre 1 et 5.";
  }
  if (!HORIZONS_OBJECTIF.includes(entree.horizon)) return "L’horizon est invalide.";
  if (entree.echeanceLe !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(entree.echeanceLe)) {
    return "L’échéance doit être une date ISO (AAAA-MM-JJ).";
  }
  return null;
}

export function motifRefusNouveauParcours(entree: NouveauParcours): string | null {
  if (!entree || typeof entree !== "object") return "Le parcours est obligatoire.";
  const contexte = texte(entree.contexte, "Le contexte du parcours");
  if (contexte) return contexte;
  if (entree.contexte.trim().length > 4000) return "Le contexte ne peut pas dépasser 4 000 caractères.";
  return motifRefusCibleObjectif(entree.cible);
}

export function transitionObjectifAutorisee(
  actuelle: StatutObjectif,
  suivante: StatutObjectif,
): boolean {
  const transitions: Record<StatutObjectif, readonly StatutObjectif[]> = {
    brouillon: ["actif", "abandonne"],
    actif: ["en-pause", "atteint", "abandonne"],
    "en-pause": ["actif", "abandonne"],
    atteint: [],
    abandonne: [],
  };
  return transitions[actuelle]?.includes(suivante) ?? false;
}

export function transitionParcoursAutorisee(
  actuelle: StatutParcours,
  suivante: StatutParcours,
): boolean {
  const transitions: Record<StatutParcours, readonly StatutParcours[]> = {
    brouillon: ["actif", "abandonne"],
    actif: ["en-pause", "termine", "abandonne"],
    "en-pause": ["actif", "abandonne"],
    termine: [],
    abandonne: [],
  };
  return transitions[actuelle]?.includes(suivante) ?? false;
}
