import type { ApercuDocument } from "./types-documents";
import { FORMATS_PAR_ROLE } from "./roles-note";

export interface RecommandationDocumentaire {
  id: string;
  format: string;
  formatLibelle: string;
  intitule: string;
  description: string;
  raison: string;
}

interface ActionDocumentaire {
  format: string;
  intitule: string;
  description: string;
}

/**
 * Gestes documentaires connus par la saisie de support.
 *
 * L'ordre ne remplace pas le classement : il départage seulement les formats
 * également absents. Les deux premières actions seront donc article puis
 * cours sur un corpus vide, tandis qu'une formule remontera dès qu'elle est
 * la moins représentée.
 */
const ACTIONS_DOCUMENTAIRES: readonly ActionDocumentaire[] = [
  {
    format: "article",
    intitule: "Lire un papier de recherche",
    description: "Conserver le résumé et les points importants.",
  },
  {
    format: "cours",
    intitule: "Renseigner un cours",
    description: "Structurer les objectifs, le contenu et ce qui est à retenir.",
  },
  {
    format: "formule",
    intitule: "Noter des formules",
    description: "Garder la définition, les variables et un exemple.",
  },
  {
    format: "reference",
    intitule: "Ficher une référence",
    description: "Résumer la ressource et les passages utiles.",
  },
  {
    format: "livre",
    intitule: "Documenter un livre",
    description: "Retenir les chapitres utiles et les idées importantes.",
  },
  {
    format: "note",
    intitule: "Capturer une note",
    description: "Conserver une idée, un contexte et ce qui mérite relecture.",
  },
  {
    format: "reflexion",
    intitule: "Formaliser une réflexion",
    description: "Poser une question, une analyse et une conclusion.",
  },
];

const LIBELLES_FORMATS = new Map(
  FORMATS_PAR_ROLE.support.map((format) => [format.valeur, format.libelle]),
);

/**
 * Classe les gestes documentaires à partir des seuls aperçus du corpus.
 *
 * Aucun corps n'est chargé et aucun score n'est stocké : un format absent ou
 * peu représenté remonte, avec une raison lisible qui porte sa source.
 */
export function recommanderActionsDocumentaires(
  aperçus: readonly ApercuDocument[],
  limite = 2,
): RecommandationDocumentaire[] {
  const compteParFormat = new Map<string, number>();
  for (const apercu of aperçus) {
    if (!LIBELLES_FORMATS.has(apercu.type)) continue;
    compteParFormat.set(apercu.type, (compteParFormat.get(apercu.type) ?? 0) + 1);
  }

  const classees = ACTIONS_DOCUMENTAIRES.map((action, ordre) => {
    const count = compteParFormat.get(action.format) ?? 0;
    const formatLibelle = LIBELLES_FORMATS.get(action.format) ?? action.format;
    return {
      ...action,
      id: `document:${action.format}`,
      formatLibelle,
      count,
      ordre,
      raison: count === 0
        ? `Aucun document de type « ${formatLibelle} » dans ton corpus.`
        : `${count} fiche${count > 1 ? "s" : ""} de type « ${formatLibelle} » déjà présente${count > 1 ? "s" : ""}.`,
    };
  }).sort((a, b) => a.count - b.count || a.ordre - b.ordre);

  return classees.slice(0, Math.max(0, Math.floor(limite))).map((action) => ({
    id: action.id,
    format: action.format,
    formatLibelle: action.formatLibelle,
    intitule: action.intitule,
    description: action.description,
    raison: action.raison,
  }));
}
