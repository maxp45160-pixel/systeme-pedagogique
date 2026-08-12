import { definitionTypeDocument, type TypeDocument } from "./types-documents";

/** Version du contrat d'échange Markdown exporté par l'application. */
export const SCHEMA_MARKDOWN = "pedagogie/v1" as const;

export type ValeurFrontMatter = string | number | boolean | null | string[];
export type FrontMatter = Record<string, ValeurFrontMatter>;

export interface LienMarkdown {
  cible: string;
  libelle?: string;
  ancre?: string;
}

export interface DocumentMarkdown {
  id: string;
  contenuMd: string;
  createdAt?: string;
  updatedAt?: string;
  frontMatter: FrontMatter;
  corps: string;
  titre: string;
  type: string | null;
  typeConnu: TypeDocument | null;
  schema: string | null;
  schemaCompatible: boolean;
  liens: LienMarkdown[];
}

function valeurScalaire(valeur: string): ValeurFrontMatter {
  const propre = valeur.trim();
  if (propre === "") return "";
  if (propre === "null" || propre === "~") return null;
  if (propre === "true") return true;
  if (propre === "false") return false;
  if (/^-?\d+(?:\.\d+)?$/.test(propre)) return Number(propre);

  if (propre.startsWith("[") && propre.endsWith("]")) {
    const contenu = propre.slice(1, -1).trim();
    if (!contenu) return [];
    return contenu.split(",").map((item) => nettoyerChaine(item.trim()));
  }

  return nettoyerChaine(propre);
}

function nettoyerChaine(valeur: string): string {
  if (
    (valeur.startsWith("\"") && valeur.endsWith("\"")) ||
    (valeur.startsWith("'") && valeur.endsWith("'"))
  ) {
    return valeur.slice(1, -1);
  }
  return valeur;
}

/**
 * Parse le sous-ensemble YAML volontairement limité aux métadonnées du vault.
 * Il couvre les scalaires, les listes inline et les listes indentées, sans
 * prétendre être un parseur YAML généraliste.
 */
export function parserFrontMatter(contenuMd: string): {
  frontMatter: FrontMatter;
  corps: string;
} {
  const normalise = contenuMd.replace(/\r\n/g, "\n");
  if (!normalise.startsWith("---\n")) return { frontMatter: {}, corps: normalise };

  const fin = normalise.indexOf("\n---", 4);
  if (fin === -1) return { frontMatter: {}, corps: normalise };

  const brut = normalise.slice(4, fin);
  const lignes = brut.split("\n");
  const frontMatter: FrontMatter = {};

  for (let i = 0; i < lignes.length; i += 1) {
    const ligne = lignes[i];
    const correspondance = /^(\s*)([A-Za-z_][\w-]*):(?:\s*(.*))?$/.exec(ligne);
    if (!correspondance || correspondance[1].length > 0) continue;

    const [, indentation, cle, brutValeur = ""] = correspondance;
    if (indentation.length > 0) continue;
    if (brutValeur.trim() !== "") {
      frontMatter[cle] = valeurScalaire(brutValeur);
      continue;
    }

    const liste: string[] = [];
    let j = i + 1;
    while (j < lignes.length) {
      const item = /^\s+-\s+(.*)$/.exec(lignes[j]);
      if (!item) break;
      liste.push(nettoyerChaine(item[1].trim()));
      j += 1;
    }
    if (liste.length > 0) {
      frontMatter[cle] = liste;
      i = j - 1;
    } else {
      frontMatter[cle] = "";
    }
  }

  const debutCorps = fin + "\n---".length;
  return { frontMatter, corps: normalise.slice(debutCorps).replace(/^\n/, "") };
}

export function extraireLiensMarkdown(contenuMd: string): LienMarkdown[] {
  const liens: LienMarkdown[] = [];
  const motif = /\[\[([^\]]+)\]\]/g;
  for (const correspondance of contenuMd.matchAll(motif)) {
    const brut = correspondance[1].trim();
    if (!brut) continue;
    const [cibleEtAncre, libelle] = brut.split("|", 2);
    const [cible, ancre] = cibleEtAncre.split("#", 2);
    const ciblePropre = cible.trim();
    if (!ciblePropre) continue;
    liens.push({
      cible: ciblePropre,
      ...(libelle?.trim() ? { libelle: libelle.trim() } : {}),
      ...(ancre?.trim() ? { ancre: ancre.trim() } : {}),
    });
  }
  return liens;
}

function titreDepuisCorps(corps: string, repli: string): string {
  const titre = corps.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return titre || repli;
}

export function analyserDocumentMarkdown(id: string, contenuMd: string): DocumentMarkdown {
  const { frontMatter, corps } = parserFrontMatter(contenuMd);
  const type = typeof frontMatter.type === "string" ? frontMatter.type : null;
  const schema = typeof frontMatter.schema === "string" ? frontMatter.schema : null;
  const titreFrontMatter = typeof frontMatter.title === "string" ? frontMatter.title : null;
  const titre = titreFrontMatter || titreDepuisCorps(corps, id);

  return {
    id,
    contenuMd,
    frontMatter,
    corps,
    titre,
    type,
    typeConnu: type && definitionTypeDocument(type) ? (type as TypeDocument) : null,
    schema,
    // Les documents historiques sans version restent lisibles. Seule une
    // version explicitement inconnue rend le document incompatible.
    schemaCompatible: schema === null || schema === SCHEMA_MARKDOWN,
    liens: extraireLiensMarkdown(contenuMd),
  };
}

export function creerDepuisTemplate(
  type: string,
  id: string,
  titre: string,
  date = new Date().toISOString().slice(0, 10),
  metadonnees: Record<string, string> = {},
): string {
  const definition = definitionTypeDocument(type);
  const sections = definition?.sections ?? ["Contenu"];
  const relations = definition?.relationsRecommandees ?? [];
  const relationBlock = relations.length
    ? `\n## Relations recommandées\n\n${relations.map((relation) => `- [[${relation}]]`).join("\n")}\n`
    : "";
  const corps = sections.map((section) => `## ${section}\n\n`).join("\n");

  return [
    "---",
    `schema: ${SCHEMA_MARKDOWN}`,
    `type: ${type}`,
    `id: ${id}`,
    ...Object.entries(metadonnees).map(([cle, valeur]) => `${cle}: ${valeur}`),
    `created_at: ${date}`,
    "---",
    "",
    `# ${titre}`,
    "",
    corps.trimEnd(),
    relationBlock.trimEnd(),
    "",
  ].join("\n");
}
