import { definitionTypeDocument, type TypeDocument } from "./types-documents";

/** Version du contrat d'échange Markdown exporté par l'application. */
export const SCHEMA_MARKDOWN = "pedagogie/v1" as const;

export type ValeurFrontMatter = string | number | boolean | null | string[];
export type FrontMatter = Record<string, ValeurFrontMatter>;

export interface ExtractionFrontMatter {
  frontmatterBrut: string;
  corps: string;
}

/**
 * Expression rationnelle partagée pour découper les éléments en ligne
 * (wikiliens, gras, italique, code) en conservant les délimiteurs.
 *
 * Utilisée par :
 * - `wysiwyg-markdown.ts` pour générer le HTML de l'éditeur direct ;
 * - `markdown.tsx` pour le rendu des énoncés, corrections et notes.
 */
export const REGEX_INLINE_MARKDOWN = /(\[\[[^\]]+\]\]|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;

/**
 * Une liste Markdown de wikiliens — `- [[valeur]]`, une ligne par valeur.
 *
 * Les fiches d'exercice et les documents de preuve l'écrivaient chacun de leur
 * côté ; le format d'un document durable ne doit pas dépendre du module qui
 * le construit. Le consommateur qui veut un bloc joint les lignes lui-même.
 */
export function listeMarkdown(valeurs: readonly string[]): string[] {
  return valeurs.map((valeur) => `- [[${valeur}]]`);
}

/**
 * Isole le bloc Frontmatter YAML brut (s'il existe) du corps Markdown.
 *
 * C'est la brique de base de tout parsing de document : `parserFrontMatter`
 * s'appuie dessus pour parser les métadonnées YAML, et l'éditeur WYSIWYG
 * s'appuie dessus pour préserver le frontmatter sans le modifier.
 */
export function separerFrontMatterEtCorps(contenuMd: string): ExtractionFrontMatter {
  const normalise = contenuMd.replace(/\r\n/g, "\n");
  if (!normalise.startsWith("---\n")) {
    return { frontmatterBrut: "", corps: normalise };
  }

  const fin = normalise.indexOf("\n---", 4);
  if (fin === -1) {
    return { frontmatterBrut: "", corps: normalise };
  }

  const finFrontmatter = fin + "\n---".length;
  const frontmatterBrut = normalise.slice(0, finFrontmatter);
  const corps = normalise.slice(finFrontmatter).replace(/^\n+/, "");

  return { frontmatterBrut, corps };
}

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
  const { frontmatterBrut, corps } = separerFrontMatterEtCorps(contenuMd);
  const frontMatter: FrontMatter = {};

  if (frontmatterBrut === "") return { frontMatter, corps };

  const brut = frontmatterBrut.slice(4, -4);
  const lignes = brut.split("\n");

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

  return { frontMatter, corps };
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
  if (titre) return titre;
  const premiereLigne = corps.trim().split("\n")[0]?.trim().replace(/^#+\s*/, "");
  if (
    premiereLigne &&
    !premiereLigne.startsWith("- ") &&
    !premiereLigne.startsWith("> ") &&
    !premiereLigne.startsWith("[[") &&
    premiereLigne.length <= 120
  ) {
    return premiereLigne;
  }
  return repli;
}

export function analyserDocumentMarkdown(id: string, contenuMd: string): DocumentMarkdown {
  const { frontMatter, corps } = parserFrontMatter(contenuMd);
  const type = typeof frontMatter.type === "string" ? frontMatter.type : null;
  const schema = typeof frontMatter.schema === "string" ? frontMatter.schema : null;
  const titreFrontMatter =
    typeof frontMatter.title === "string" && frontMatter.title.trim()
      ? frontMatter.title.trim()
      : typeof frontMatter.titre === "string" && frontMatter.titre.trim()
        ? frontMatter.titre.trim()
        : null;
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

/**
 * Insère ou met à jour la clé `archive: true/false` dans le frontmatter YAML d'un document Markdown.
 */
export function definirArchiveFrontMatter(contenuMd: string, archive: boolean): string {
  const { frontmatterBrut, corps } = separerFrontMatterEtCorps(contenuMd);
  if (!frontmatterBrut) {
    return `---\nschema: ${SCHEMA_MARKDOWN}\narchive: ${archive}\n---\n\n${corps}`;
  }
  const brut = frontmatterBrut.slice(4, -4);
  const lignes = brut.split("\n");
  let trouve = false;
  const nouvellesLignes = lignes.map((ligne) => {
    if (/^archive\s*:/i.test(ligne.trim())) {
      trouve = true;
      return `archive: ${archive}`;
    }
    return ligne;
  });
  if (!trouve) {
    nouvellesLignes.push(`archive: ${archive}`);
  }
  return `---\n${nouvellesLignes.join("\n")}\n---\n\n${corps}`;
}

