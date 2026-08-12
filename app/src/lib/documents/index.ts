import { analyserDocumentMarkdown, type DocumentMarkdown, type LienMarkdown } from "./markdown";
import { definitionTypeDocument, type ApercuDocument, type LigneDocument, type TypeDocument } from "./types-documents";

export type { LigneDocument } from "./types-documents";

export interface IndexDocumentaire {
  documents: DocumentMarkdown[];
  parId: Map<string, DocumentMarkdown>;
  liens: Array<{ sourceId: string; cible: string; lien: LienMarkdown; resolu: boolean }>;
  sortants: Map<string, string[]>;
  entrants: Map<string, string[]>;
}

/**
 * Recalcule toutes les relations depuis les corps Markdown.
 * Aucun lien n'est fabriqué : une cible inconnue reste une référence non
 * résolue, ce qui permet de la signaler sans la transformer en arête réelle.
 */
export function reconstruireIndexDocumentaire(
  lignes: LigneDocument[],
  ciblesConnues: Iterable<string> = [],
): IndexDocumentaire {
  const documents = lignes.map((ligne) => {
    const document = analyserDocumentMarkdown(ligne.id, ligne.contenuMd);
    return {
      ...document,
      createdAt: ligne.createdAt,
      updatedAt: ligne.updatedAt,
    };
  });
  return indexerDocuments(documents, ciblesConnues);
}

/**
 * Reconstruit l'index depuis les métadonnées matérialisées et l'index de liens.
 * Le corps Markdown reste volontairement vide : cette vue sert aux listes et
 * au graphe, pas à l'éditeur. Le document complet est chargé à la demande.
 */
export function reconstruireIndexDepuisApercus(
  aperçus: ApercuDocument[],
  ciblesConnues: Iterable<string> = [],
): IndexDocumentaire {
  return indexerDocuments(
    aperçus.map((apercu) => ({
      id: apercu.id,
      contenuMd: "",
      createdAt: apercu.createdAt,
      updatedAt: apercu.updatedAt,
      frontMatter: apercu.frontMatter,
      corps: "",
      titre: apercu.titre || apercu.id,
      type: apercu.type || null,
      typeConnu: apercu.type && definitionTypeDocument(apercu.type) ? apercu.type as TypeDocument : null,
      schema: apercu.schema,
      schemaCompatible: apercu.schemaCompatible,
      liens: apercu.liens,
    })),
    ciblesConnues,
  );
}

function indexerDocuments(
  documents: DocumentMarkdown[],
  ciblesConnues: Iterable<string>,
): IndexDocumentaire {
  const parId = new Map(documents.map((document) => [document.id, document]));
  const projections = new Set(ciblesConnues);
  const liens: IndexDocumentaire["liens"] = [];
  const sortants = new Map<string, string[]>();
  const entrants = new Map<string, string[]>();

  for (const document of documents) {
    for (const lien of document.liens) {
      const resolu = parId.has(lien.cible) || projections.has(lien.cible);
      liens.push({ sourceId: document.id, cible: lien.cible, lien, resolu });
      if (!resolu) continue;

      const sorties = sortants.get(document.id) ?? [];
      if (!sorties.includes(lien.cible)) sorties.push(lien.cible);
      sortants.set(document.id, sorties);

      const entrees = entrants.get(lien.cible) ?? [];
      if (!entrees.includes(document.id)) entrees.push(document.id);
      entrants.set(lien.cible, entrees);
    }
  }

  return { documents, parId, liens, sortants, entrants };
}
