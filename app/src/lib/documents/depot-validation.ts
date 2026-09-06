import { MAX_PAGES_ANALYSE_DEPOT, type CouvertureDepot, type ElementRestitutionDepot, type PageExtraiteDepot, type SourceDepot, type TrancheDepot } from "./depot";

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
  const matiere = pieceId ? pages.find((p) => p.pieceId === pieceId && p.page === page)?.texte : note;
  if (!matiere || !normaliserCitation(matiere).includes(normaliserCitation(citation))) throw new Error("La citation n'existe pas dans le passage désigné.");
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
  if (pages > 20 || entreeOctets > 100_000 || sortieMax > 2500) throw new Error("Analyse hors limites.");
  return pages * 8000 + entreeOctets * 3 + sortieMax * 15;
}
