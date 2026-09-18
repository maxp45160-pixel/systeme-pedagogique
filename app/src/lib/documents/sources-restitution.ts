import type { PageExtraiteDepot } from "./depot";
import { listeDepot, objetDepot, texteDepot, validerPagesDepot } from "./depot-validation";

export const CONTRAT_SOURCES_RESTITUTION = "passages-extraits-v1";
export const CONTRATS_SOURCES_PRECEDENTS = ["sources-identifiees-v1"] as const;

/** Lignes exactes, bornées sans réécriture ; une ligne très longue devient plusieurs extraits. */
function passagesExacts(texte: string): string[] {
  const passages: string[] = [];
  for (const ligne of texte.match(/[^\r\n]+/gu) ?? []) {
    let debut = 0;
    while (debut < ligne.length) {
      let fin = Math.min(debut + 2000, ligne.length);
      if (fin < ligne.length) {
        const espace = ligne.lastIndexOf(" ", fin - 1);
        if (espace > debut + 1000) fin = espace + 1;
        // Ne jamais séparer les deux unités UTF-16 d'un caractère.
        if (/[\uD800-\uDBFF]/u.test(ligne[fin - 1]) && /[\uDC00-\uDFFF]/u.test(ligne[fin])) fin--;
      }
      const passage = ligne.slice(debut, fin);
      if (passage.trim()) passages.push(passage);
      debut = fin;
    }
  }
  return passages;
}

/** Identifiants temporaires de requête : aucune pagination n'est confiée au modèle. */
export function sourcesRestitution(note: string, pages: PageExtraiteDepot[]) {
  const references = new Map<string, { pieceId: string | null; page: number | null; citation: string }>();
  const sources: { nature: "note" | "page"; passages: { passageId: string; texte: string }[]; incertain: boolean }[] = [];
  const ajouter = (nature: "note" | "page", texte: string, incertain: boolean, pieceId: string | null, page: number | null) => {
    const passages = passagesExacts(texte).map((citation) => {
      const passageId = `passage-${references.size.toString(36)}`;
      references.set(passageId, { pieceId, page, citation });
      return { passageId, texte: citation };
    });
    sources.push({ nature, passages, incertain });
  };
  if (note.trim()) ajouter("note", note, false, null, null);
  for (const p of validerPagesDepot(pages)) ajouter("page", p.texte, p.incertain, p.pieceId, p.page);
  return { sources, references };
}

/** Traduction seulement ; les validateurs métier vérifient ensuite les citations exactes. */
export function traduireSourcesRestitution(value: unknown, note: string, pages: PageExtraiteDepot[]) {
  const { references } = sourcesRestitution(note, pages);
  const source = (value: unknown) => {
    const s = objetDepot(value);
    if (Object.keys(s).some((cle) => cle !== "passageId")) {
      throw new Error("Une source doit contenir uniquement passageId, sans citation ni autre repère.");
    }
    const repere = references.get(texteDepot(s.passageId, 100));
    if (!repere) throw new Error("Identifiant de passage inconnu dans cette restitution.");
    return { ...repere };
  };
  const avecSources = (value: unknown): Record<string, unknown> & { sources: ReturnType<typeof source>[] } => {
    const objet = objetDepot(value);
    return { ...objet, sources: listeDepot(objet.sources).map(source) };
  };
  const retour = objetDepot(value);
  const elements = listeDepot(retour.elements).map(avecSources);
  if (retour.organisation === undefined) return { ...retour, elements };
  const organisation = avecSources(retour.organisation);
  return { ...retour, elements, organisation: {
    ...organisation,
    domaine: organisation.domaine === null || organisation.domaine === undefined ? null : avecSources(organisation.domaine),
    competences: listeDepot(organisation.competences).map(avecSources),
  } };
}
