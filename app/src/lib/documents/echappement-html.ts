/**
 * Échappement HTML — une seule implémentation pour tout le dépôt.
 *
 * Elle vivait en privé dans `wysiwyg-markdown.ts`. Le rendu des formules dans
 * l'éditeur (`formule-noeud.ts`) en a besoin aussi, et les deux modules ne
 * peuvent pas s'importer l'un l'autre sans cycle. Elle est donc ici, en
 * dessous des deux.
 */
export function echapperHtml(texte: string): string {
  return texte
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
