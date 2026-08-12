import { analyserDocumentMarkdown, SCHEMA_MARKDOWN } from "./markdown";

/** Garde-fou commun pour les importations et écritures de fiches. */
export const TAILLE_MAXIMUM_MARKDOWN = 2_000_000;

export interface DocumentMarkdownImporte {
  id: string;
  titre: string;
  type: string;
  contenuMd: string;
}

/** Nom de fichier stable pour l'export d'un document du vault. */
export function nomFichierMarkdown(id: string): string {
  return `${id}.md`;
}

export function estIdentifiantDocumentValide(id: string): boolean {
  return /^[a-z0-9][a-z0-9-]*$/.test(id);
}

/** Refuse les fiches vides ou excessivement volumineuses avant toute écriture. */
export function validerTailleMarkdown(contenuMd: string): void {
  if (
    typeof contenuMd !== "string" ||
    contenuMd.trim() === "" ||
    contenuMd.length > TAILLE_MAXIMUM_MARKDOWN
  ) {
    throw new Error("Le document Markdown est vide ou dépasse la taille maximale de 2 Mo.");
  }
}

function erreurImport(message: string): never {
  throw new Error(`Import Markdown refusé : ${message}`);
}

/**
 * Valide le contrat minimal d'un fichier importable.
 *
 * Les types inconnus restent acceptés : le registre peut évoluer sans rendre
 * un export ancien illisible. En revanche, l'identité et la date canonique
 * sont obligatoires pour ne pas créer un document anonyme ou non traçable.
 */
export function validerDocumentMarkdown(
  nomFichier: string,
  contenuMd: string,
): DocumentMarkdownImporte {
  if (!/\.md$/i.test(nomFichier) || /[\\/]/.test(nomFichier)) {
    erreurImport("le fichier doit être un fichier .md simple");
  }
  if (
    typeof contenuMd !== "string" ||
    contenuMd.trim() === "" ||
    contenuMd.length > TAILLE_MAXIMUM_MARKDOWN
  ) {
    erreurImport("le fichier est vide ou dépasse la taille maximale de 2 Mo");
  }

  const idFichier = nomFichier.slice(0, -3);
  const analyse = analyserDocumentMarkdown(idFichier, contenuMd);
  const id = analyse.frontMatter.id;
  const type = analyse.frontMatter.type;
  const createdAt = analyse.frontMatter.created_at;

  if (typeof id !== "string" || !estIdentifiantDocumentValide(id)) {
    erreurImport("le frontmatter doit contenir un id minuscule stable");
  }
  if (id !== idFichier) {
    erreurImport(`l'id du frontmatter (${id}) ne correspond pas au fichier (${idFichier})`);
  }
  if (typeof type !== "string" || type.trim() === "") {
    erreurImport("le frontmatter doit contenir un type");
  }
  if (analyse.schema !== null && analyse.schema !== SCHEMA_MARKDOWN) {
    erreurImport(`le contrat Markdown « ${analyse.schema} » n'est pas pris en charge`);
  }
  if (
    typeof createdAt !== "string" ||
    createdAt.trim() === "" ||
    !Number.isFinite(new Date(createdAt).getTime())
  ) {
    erreurImport("le frontmatter doit contenir une date created_at valide");
  }

  return {
    id,
    titre: analyse.titre,
    type,
    contenuMd,
  };
}

export function validerLotDocumentsMarkdown(
  fichiers: Array<{ nomFichier: string; contenuMd: string }>,
  idsExistants: Iterable<string> = [],
): DocumentMarkdownImporte[] {
  const importes = fichiers.map((fichier) =>
    validerDocumentMarkdown(fichier.nomFichier, fichier.contenuMd),
  );
  const ids = new Set(idsExistants);
  for (const document of importes) {
    if (ids.has(document.id)) {
      erreurImport(`le document « ${document.id} » existe déjà`);
    }
    ids.add(document.id);
  }
  return importes;
}
