import type { PieceJointeDocument } from "./types-documents";

/** Contrats documentaires du pilote. Aucun de ces contenus ne mesure l'apprenant. */
export const VERSION_DEPOT = 1;
export const MODELE_OCR_DEPOT = "mistral-ocr-4-1";
export const MODELE_RESTITUTION_DEPOT = "mistral-medium-3-5";
export const MAX_PAGES_ANALYSE_DEPOT = 20;
export const MAX_NOTE_DEPOT = 12_000;
export const MAX_FICHIERS_DEPOT = 100;
export const MAX_OCTETS_DEPOT = 100 * 1024 * 1024;
export const MAX_SORTIE_RESTITUTION = 2_500;
export const BUDGET_DEPOT_MICRO_EUROS = 5_000_000;

export interface SourceDepot {
  documentId: string;
  pieceId?: string;
  /** Numéro affiché à la personne, à partir de 1. Absent pour la note libre. */
  page?: number;
  citation: string;
}

export interface PageExtraiteDepot {
  pieceId: string;
  page: number;
  texte: string;
  incertain: boolean;
  /** Empreinte des octets originaux ; absente uniquement avant écriture du cache. */
  empreinteSource?: string;
}

export interface CouvertureDepot {
  pieceId: string;
  nom: string;
  totalPages: number;
  /** Pages réellement traitées, jamais les pages seulement demandées. */
  pagesLues: number[];
}

export interface ElementRestitutionDepot {
  id: string;
  nature: "sujet" | "annotation" | "incertitude";
  texte: string;
  sources: SourceDepot[];
}

/** Message effectivement présenté, attribué à l'IA ; jamais une vérité métier. */
export interface RestitutionDepot {
  version: 1;
  modele: string;
  creeLe: string;
  elements: ElementRestitutionDepot[];
  couvertures: CouvertureDepot[];
}

export interface CorrectionDepot {
  id: string;
  elementId: string | null;
  texte: string;
  creeLe: string;
}

export interface AnalyseDepot {
  id: string;
  documentId: string;
  empreinte: string;
  statut: "en-cours" | "terminee" | "interrompue" | "echec";
  pages: PageExtraiteDepot[];
  couvertures: CouvertureDepot[];
  restitution: RestitutionDepot | null;
  erreur: string | null;
  creeLe: string;
  modifieLe: string;
}

export interface DepotDocumentaire {
  id: string;
  titre: string;
  note: string;
  creeLe: string;
  pieces: PieceJointeDocument[];
  analyses: AnalyseDepot[];
  corrections: CorrectionDepot[];
}

export interface TrancheDepot {
  pieceId: string;
  nom: string;
  totalPages: number;
  pages: number[];
}

export interface PreparationAnalyseDepot {
  documentId: string;
  empreinte: string;
  tranches: TrancheDepot[];
  noteIncluse: boolean;
  pagesRestantes: number;
  coutMaximumMicroEuros: number;
  budgetRestantMicroEuros: number;
  analyseExistante: AnalyseDepot | null;
  disponible: boolean;
  motifIndisponible?: string;
}

export function urlSourceDepot(url: string, page?: number): string {
  return page === undefined ? url : `${url.split("#")[0]}#page=${page}`;
}

export function estDepotDocumentaire(frontmatter: Record<string, unknown>): boolean {
  return frontmatter.depot_version === VERSION_DEPOT || frontmatter.depot_version === String(VERSION_DEPOT);
}
