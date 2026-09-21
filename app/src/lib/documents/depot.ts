import type { CreationDomaineDeleguee } from "./creation-domaine-deleguee";
import type { PieceJointeDocument } from "./types-documents";
import type { Palier } from "@/lib/domain/types";
import type { BrouillonClassementRessource } from "./brouillon-classement";
import type { CorrectionCompetenceClassement } from "./corrections-classement";
import type { VerbeAction } from "@/lib/domain/atomicite";
import type { ContextePersonnelRessource } from "./contexte-ressource";

/** Contrats documentaires du pilote. Aucun de ces contenus ne mesure l'apprenant. */
export const VERSION_DEPOT = 1;
export const VERSION_RESSOURCE_DEPOT = 2;
/** Invalide les devis non exécutés lorsque le contrat partagé de proposition change. */
export const VERSION_QUALITE_RESTITUTION = "propositions-hierarchie-v2";
export const SECTION_COMPETENCES_RESSOURCE = "Compétences liées";
export const MODELE_OCR_DEPOT = "mistral-ocr-4-1";
export const MODELE_RESTITUTION_DEPOT = "mistral-medium-3-5";
export const MAX_PAGES_ANALYSE_DEPOT = 20;
export const MAX_NOTE_DEPOT = 12_000;
export const MAX_FICHIERS_DEPOT = 100;
export const MAX_OCTETS_DEPOT = 100 * 1024 * 1024;
export const MAX_SORTIE_RESTITUTION_V1 = 2_500;
// Aligné avec depot_reserver, migration depot_restitution_v2_sortie_8192 appliquée.
export const MAX_SORTIE_RESTITUTION = 8_192;
export function limiteSortieRestitution(version: 1 | 2): number {
  return version === VERSION_RESSOURCE_DEPOT ? MAX_SORTIE_RESTITUTION : MAX_SORTIE_RESTITUTION_V1;
}
export const MAX_COMPETENCES_ORGANISATION_DEPOT = 30;
export const BUDGET_DEPOT_MICRO_EUROS = 5_000_000;

export interface SectionDepot { chemin: string; titre: string; limites?: string[] }

export interface SourceDepot {
  section?: SectionDepot;
  documentId: string;
  pieceId?: string;
  /** Numéro affiché à la personne, à partir de 1. Absent pour la note libre. */
  page?: number;
  citation: string;
}

export interface PageExtraiteDepot {
  section?: SectionDepot;
  pieceId: string;
  page: number;
  texte: string;
  incertain: boolean;
  /** Empreinte des octets originaux ; absente uniquement avant écriture du cache. */
  empreinteSource?: string;
}

export interface CouvertureDepot {
  unite?: "section";
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
export interface RestitutionDepotV1 {
  version: 1;
  modele: string;
  creeLe: string;
  elements: ElementRestitutionDepot[];
  couvertures: CouvertureDepot[];
}

export interface PropositionSourceeDepot {
  justification: string;
  sources: SourceDepot[];
}

export type DomaineReferenceDepot =
  | { mode: "existant"; id: string }
  | { mode: "nouveau"; nom: string };

export type DomaineProposeDepot =
  | ({ mode: "existant"; id: string } & PropositionSourceeDepot)
  | ({ mode: "nouveau"; nom: string; description: string; parentId?: string } & PropositionSourceeDepot);

export type CompetenceProposeeDepot =
  | ({ mode: "existante"; code: string } & PropositionSourceeDepot)
  | ({
      mode: "nouvelle";
      intitule: string;
      verbeAction: VerbeAction;
      objet: string;
      precision?: string;
      palier: Palier;
      importance: number;
      domaine: DomaineReferenceDepot;
    } & PropositionSourceeDepot);

export interface PropositionOrganisationRessource extends PropositionSourceeDepot {
  titreSuggere: string;
  typeSuggere: string;
  domaine: DomaineProposeDepot | null;
  competences: CompetenceProposeeDepot[];
}

export interface ReferentielDepotPourModele {
  domaines: Array<{ id: string; nom: string; description: string; parentId?: string }>;
  competences: Array<{ code: string; intitule: string; domaine: string }>;
}

export interface RestitutionDepotV2 {
  version: 2;
  modele: string;
  creeLe: string;
  elements: ElementRestitutionDepot[];
  couvertures: CouvertureDepot[];
  organisation: PropositionOrganisationRessource;
}

export type RestitutionDepot = RestitutionDepotV1 | RestitutionDepotV2;

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
  contextePersonnel?: ContextePersonnelRessource;
  id: string;
  version: 1 | 2;
  titre: string;
  note: string;
  creeLe: string;
  modifieLe: string;
  type: string;
  domaineId?: string;
  sourceRelativePath?: string;
  referentielRevuLe?: string;
  referentielAnalyseId?: string;
  rangementRevuLe?: string;
  rangementAnalyseId?: string;
  rangementStatut?: "rangee" | "a-trier";
  rangementOrigine?: "assistant" | "personne";
  brouillonClassement?: BrouillonClassementRessource;
  correctionsClassement?: { analyseId: string; corrections: CorrectionCompetenceClassement[] };
  creationDomaineDeleguee?: CreationDomaineDeleguee;
  competencesLiees: string[];
  pieces: PieceJointeDocument[];
  analyses: AnalyseDepot[];
  corrections: CorrectionDepot[];
}

export interface ResumeDepotDocumentaire {
  id: string;
  version: 1 | 2;
  titre: string;
  type: string;
  creeLe: string;
  analyseStatut?: AnalyseDepot["statut"];
  referentielRevuLe?: string;
  rangementRevuLe?: string;
  rangementStatut?: "rangee" | "a-trier";
}

export interface TrancheDepot {
  unite?: "section";
  sections?: SectionDepot[];
  pieceId: string;
  nom: string;
  totalPages: number;
  pages: number[];
}

export interface PreparationAnalyseDepot {
  /** Nouvelle synthèse explicitement demandée sur les transcriptions de cette analyse. */
  syntheseDe?: string;
  fournisseur?: "qwen";
  coutMaximumMicroDollars?: number;
  budgetRestantMicroDollars?: number;
  documentId: string;
  empreinte: string;
  tranches: TrancheDepot[];
  /** Sections sans texte extractible : jamais comptées comme analysées. */
  sectionsNonAnalysees?: { pieceId: string; nom: string; sections: SectionDepot[] }[];
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
  return [VERSION_DEPOT, VERSION_RESSOURCE_DEPOT].includes(Number(frontmatter.depot_version));
}

export function estRessourceDepot(frontmatter: Record<string, unknown>): boolean {
  return Number(frontmatter.depot_version) === VERSION_RESSOURCE_DEPOT;
}
