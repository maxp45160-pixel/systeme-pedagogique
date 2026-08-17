/** Garde-fou commun aux écritures de fiches. */
const TAILLE_MAXIMUM_MARKDOWN = 2_000_000;

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
