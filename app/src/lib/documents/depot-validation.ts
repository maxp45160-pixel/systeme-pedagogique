import { MAX_PAGES_ANALYSE_DEPOT, MAX_SORTIE_RESTITUTION, MAX_COMPETENCES_ORGANISATION_DEPOT, type CompetenceProposeeDepot, type CouvertureDepot, type DomaineProposeDepot, type DomaineReferenceDepot, type ElementRestitutionDepot, type PageExtraiteDepot, type PropositionOrganisationRessource, type SourceDepot, type TrancheDepot } from "./depot";
import { FORMATS_PAR_ROLE, formatAutorise } from "./roles-note";
import { composerIntitule, motifsRefusStructure, VERBES_ACTION, type IntituleStructure } from "@/lib/domain/atomicite";
import type { Palier } from "@/lib/domain/types";

export function objetDepot(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Réponse documentaire invalide.");
  return value as Record<string, unknown>;
}
export function texteDepot(value: unknown, maximum = 4000): string {
  if (typeof value !== "string" || !value.trim() || value.length > maximum) throw new Error("Texte documentaire invalide.");
  return value;
}
export function entierDepot(value: unknown, minimum = 1): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum) throw new Error("Repère documentaire invalide.");
  return value;
}
export function listeDepot(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error("Liste documentaire invalide.");
  return value;
}
export function validerPagesDepot(value: unknown): PageExtraiteDepot[] {
  const seen = new Set<string>();
  return listeDepot(value).map((item) => {
    const p = objetDepot(item);
    const pieceId = texteDepot(p.pieceId, 100);
    const page = entierDepot(p.page);
    if (seen.has(`${pieceId}:${page}`) || typeof p.texte !== "string" || p.texte.length > 1_000_000 || typeof p.incertain !== "boolean") throw new Error("Page extraite invalide.");
    seen.add(`${pieceId}:${page}`);
    const empreinteSource = p.empreinteSource === undefined ? undefined : texteDepot(p.empreinteSource,64);
    return { pieceId, page, texte: p.texte, incertain: p.incertain, ...(empreinteSource ? { empreinteSource } : {}) };
  });
}
export function validerCouverturesDepot(value: unknown): CouvertureDepot[] {
  return listeDepot(value).map((item) => {
    const c = objetDepot(item);
    const totalPages = entierDepot(c.totalPages);
    const pagesLues = listeDepot(c.pagesLues).map((p) => entierDepot(p));
    if (new Set(pagesLues).size !== pagesLues.length || pagesLues.some((p) => p > totalPages)) throw new Error("Couverture invalide.");
    return { pieceId: texteDepot(c.pieceId, 100), nom: texteDepot(c.nom, 160), totalPages, pagesLues };
  });
}
const normaliserCitation = (value: string) => value.normalize("NFC").replace(/\s+/g, " ").trim();

/** Vérifie le repère ET la citation dans la matière reçue ; jamais dans un autre PDF. */
export function validerSourceDepot(value: unknown, documentId: string, note: string, pages: PageExtraiteDepot[]): SourceDepot {
  const s = objetDepot(value);
  const citation = texteDepot(s.citation, 2000);
  const pieceId = s.pieceId === null || s.pieceId === undefined ? undefined : texteDepot(s.pieceId, 100);
  const page = s.page === null || s.page === undefined ? undefined : entierDepot(s.page);
  if (s.documentId !== undefined && s.documentId !== documentId) throw new Error("La source appartient à un autre document.");
  if (Boolean(pieceId) !== (page !== undefined)) throw new Error("Le fichier et la page doivent être désignés ensemble.");
  if (pieceId && !pages.some((p) => p.pieceId === pieceId)) throw new Error("Le fichier cité ne fait pas partie des pages lues.");
  const matiere = pieceId ? pages.find((p) => p.pieceId === pieceId && p.page === page)?.texte : note;
  if (matiere === undefined) throw new Error(`La page ${page} citée ne fait pas partie des pages lues de ce fichier.`);
  if (!matiere || !normaliserCitation(matiere).includes(normaliserCitation(citation))) {
    const repere = pieceId ? `page ${page}` : "note libre";
    const autresPages = pieceId ? pages.filter((p) => p.pieceId === pieceId && p.page !== page && normaliserCitation(p.texte).includes(normaliserCitation(citation))).map((p) => p.page) : [];
    const precision = autresPages.length
      ? ` Elle est présente sur les pages ${autresPages.join(", ")} du même fichier ; le repère proposé est refusé.`
      : "";
    throw new Error(`La citation n'existe pas dans le passage désigné (${repere}).${precision} Citation proposée, non validée : ${JSON.stringify(citation.slice(0, 500))}${citation.length > 500 ? "…" : ""}`);
  }
  return { documentId, ...(pieceId ? { pieceId, page } : {}), citation };
}
export function validerElementsDepot(value: unknown, documentId: string, note: string, pages: PageExtraiteDepot[], prefixe: string): ElementRestitutionDepot[] {
  const elements = listeDepot(objetDepot(value).elements);
  if (elements.length > 8) throw new Error("Restitution trop longue.");
  return elements.map((item, index) => {
    const e = objetDepot(item);
    if (e.nature !== "sujet" && e.nature !== "annotation" && e.nature !== "incertitude") throw new Error("Nature de restitution invalide.");
    const sources = listeDepot(e.sources).map((s) => validerSourceDepot(s, documentId, note, pages));
    if (!sources.length || sources.length > 3) throw new Error("Chaque élément doit citer une à trois sources.");
    return { id: `${prefixe}-${index}`, nature: e.nature, texte: texteDepot(e.texte, 700), sources };
  });
}

export interface ReferentielValidationDepot {
  domaines: readonly { id: string; nom: string }[];
  competences: readonly { code: string; intitule: string }[];
}

function validerSourcesProposition(value: Record<string, unknown>, documentId: string, note: string, pages: PageExtraiteDepot[]): Pick<PropositionOrganisationRessource, "justification" | "sources"> {
  const sources = listeDepot(value.sources).map((source) => validerSourceDepot(source, documentId, note, pages));
  if (sources.length < 1 || sources.length > 3) throw new Error("Chaque proposition doit citer une à trois sources.");
  return { justification: texteDepot(value.justification, 700), sources };
}

const nomComparable = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase("fr-FR");

function validerReferenceDomaine(value: unknown, referentiel?: ReferentielValidationDepot): DomaineReferenceDepot {
  const domaine = objetDepot(value);
  if (domaine.mode === "existant") {
    const id = texteDepot(domaine.id, 120);
    if (referentiel && !referentiel.domaines.some((item) => item.id === id)) throw new Error("Domaine proposé hors du référentiel actif.");
    return { mode: "existant", id };
  }
  if (domaine.mode !== "nouveau") throw new Error("Référence de domaine invalide.");
  if (domaine.id !== undefined || domaine.prefixe !== undefined) throw new Error("Un nouveau domaine ne reçoit ni identifiant ni préfixe du modèle.");
  return { mode: "nouveau", nom: texteDepot(domaine.nom, 120).trim() };
}

function validerDomainePropose(value: unknown, documentId: string, note: string, pages: PageExtraiteDepot[], referentiel?: ReferentielValidationDepot): DomaineProposeDepot | null {
  if (value === null || value === undefined) return null;
  const domaine = objetDepot(value);
  const sourcee = validerSourcesProposition(domaine, documentId, note, pages);
  const reference = validerReferenceDomaine(domaine, referentiel);
  if (reference.mode === "existant") return { ...reference, ...sourcee };
  if (referentiel?.domaines.some((item) => nomComparable(item.nom) === nomComparable(reference.nom))) {
    throw new Error("Un domaine existant a été présenté comme nouveau.");
  }
  return { ...reference, description: texteDepot(domaine.description, 700).trim(), ...sourcee };
}

const PALIERS: readonly Palier[] = ["fondamentaux", "intermediaire", "avance"];

function validerCompetenceProposee(value: unknown, documentId: string, note: string, pages: PageExtraiteDepot[], referentiel?: ReferentielValidationDepot): CompetenceProposeeDepot {
  const competence = objetDepot(value);
  const sourcee = validerSourcesProposition(competence, documentId, note, pages);
  if (competence.mode === "existante") {
    const code = texteDepot(competence.code, 100);
    if (referentiel && !referentiel.competences.some((item) => item.code === code)) throw new Error("Compétence proposée hors du référentiel actif.");
    return { mode: "existante", code, ...sourcee };
  }
  if (competence.mode !== "nouvelle") throw new Error("Proposition de compétence invalide.");
  if (competence.code !== undefined) throw new Error("Une nouvelle compétence ne reçoit aucun code du modèle.");
  const structure: IntituleStructure = {
    verbeAction: texteDepot(competence.verbeAction, 40),
    objet: texteDepot(competence.objet, 100),
    ...(competence.precision === undefined || competence.precision === null || competence.precision === "" ? {} : { precision: texteDepot(competence.precision, 80) }),
  };
  const refus = motifsRefusStructure(structure);
  if (refus.length > 0 || !VERBES_ACTION.includes(structure.verbeAction as (typeof VERBES_ACTION)[number])) throw new Error(refus[0] ?? "Verbe d'action inconnu.");
  const intitule = composerIntitule(structure);
  if (competence.intitule !== undefined && competence.intitule !== intitule) throw new Error("Intitulé de compétence incohérent.");
  if (referentiel?.competences.some((item) => nomComparable(item.intitule) === nomComparable(intitule))) {
    throw new Error("Une compétence existante a été présentée comme nouvelle.");
  }
  if (!PALIERS.includes(competence.palier as Palier)) throw new Error("Palier de compétence invalide.");
  if (typeof competence.importance !== "number" || !Number.isFinite(competence.importance) || competence.importance < 0 || competence.importance > 1) throw new Error("Importance de compétence invalide.");
  return {
    mode: "nouvelle",
    intitule,
    verbeAction: structure.verbeAction as (typeof VERBES_ACTION)[number],
    objet: structure.objet.trim(),
    ...(structure.precision ? { precision: structure.precision.trim() } : {}),
    palier: competence.palier as Palier,
    importance: competence.importance,
    domaine: validerReferenceDomaine(competence.domaine, referentiel),
    ...sourcee,
  };
}

/** Convertit la sortie du modèle en propositions historiques strictement sourcées. */
export function validerOrganisationDepot(value: unknown, documentId: string, note: string, pages: PageExtraiteDepot[], referentiel?: ReferentielValidationDepot): PropositionOrganisationRessource {
  const organisation = objetDepot(objetDepot(value).organisation);
  const typeSuggere = texteDepot(organisation.typeSuggere, 60);
  if (!formatAutorise("support", typeSuggere)) throw new Error("Type de ressource proposé hors de la liste autorisée.");
  const competences = listeDepot(organisation.competences);
  if (competences.length > MAX_COMPETENCES_ORGANISATION_DEPOT) throw new Error("Trop de compétences proposées pour une ressource.");
  const domaine = validerDomainePropose(organisation.domaine, documentId, note, pages, referentiel);
  const competencesValidees = competences.map((item) => validerCompetenceProposee(item, documentId, note, pages, referentiel));
  const domainesNouveaux = new Set(competencesValidees.flatMap((competence) => competence.mode === "nouvelle" && competence.domaine.mode === "nouveau" ? [nomComparable(competence.domaine.nom)] : []));
  if (domainesNouveaux.size > 1 || (domainesNouveaux.size === 1 && (domaine?.mode !== "nouveau" || !domainesNouveaux.has(nomComparable(domaine.nom))))) {
    throw new Error("Une ressource ne peut proposer qu'un nouveau domaine principal.");
  }
  if (domaine?.mode === "nouveau" && !competencesValidees.some((competence) => competence.mode === "nouvelle" && competence.domaine.mode === "nouveau" && nomComparable(competence.domaine.nom) === nomComparable(domaine.nom))) {
    throw new Error("Un nouveau domaine doit être accompagné d'au moins une compétence nouvelle.");
  }
  return {
    titreSuggere: texteDepot(organisation.titreSuggere, 200).trim(),
    typeSuggere,
    domaine,
    competences: competencesValidees,
    ...validerSourcesProposition(organisation, documentId, note, pages),
  };
}

export const TYPES_SUPPORT_DEPOT = FORMATS_PAR_ROLE.support.map(({ valeur }) => valeur);
export function prochainesTranchesDepot(fichiers: { pieceId: string; nom: string; totalPages: number }[], pagesDejaLues: PageExtraiteDepot[], maximum = MAX_PAGES_ANALYSE_DEPOT): { tranches: TrancheDepot[]; pagesRestantes: number } {
  entierDepot(maximum);
  if (maximum > MAX_PAGES_ANALYSE_DEPOT) throw new Error("Tranche trop grande.");
  let places = maximum;
  let pagesRestantes = 0;
  const connues = new Set(pagesDejaLues.map((p) => `${p.pieceId}:${p.page}`));
  const tranches: TrancheDepot[] = [];
  for (const fichier of fichiers) {
    entierDepot(fichier.totalPages);
    const pages: number[] = [];
    for (let page = 1; page <= fichier.totalPages; page++) {
      if (connues.has(`${fichier.pieceId}:${page}`)) continue;
      if (places > 0) { pages.push(page); places--; } else pagesRestantes++;
    }
    if (pages.length) tranches.push({ pieceId:fichier.pieceId, nom:fichier.nom, totalPages:fichier.totalPages, pages });
  }
  return { tranches, pagesRestantes };
}

/** Tarifs fixes majorés (2 EUR/USD), alignés avec la réservation PostgreSQL. */
export function coutDepotMicroEuros(pages: number, entreeOctets = 0, sortieMax = 0): number {
  for (const n of [pages, entreeOctets, sortieMax]) entierDepot(n, 0);
  if (pages > MAX_PAGES_ANALYSE_DEPOT || entreeOctets > 100_000 || sortieMax > MAX_SORTIE_RESTITUTION) throw new Error("Analyse hors limites.");
  return pages * 8000 + entreeOctets * 3 + sortieMax * 15;
}
