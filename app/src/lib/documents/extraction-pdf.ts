/**
 * Le cache du texte d'un PDF attaché à une fiche support — JETABLE, pas une
 * archive.
 *
 * « Faire lire par le tuteur » demande le texte du PDF. L'extraction coûte un
 * téléchargement Storage et un passage pdf.js ; le résultat est donc mis en
 * cache dans le front-matter de la fiche (`extraitTexte` + `extraitLe` +
 * `extraitSource`). Trois frontières que ce module pose :
 *
 *   1. la limite de troncature est CONSTANTE et documentée : au-delà, on coupe
 *      proprement (à la fin d'un mot), on ne « résume » jamais ;
 *   2. un échec d'extraction est un échec affiché — aucune fabrication de
 *      texte, même partielle, même « approximative » ;
 *   3. le cache se valide contre la pièce jointe qui l'a produit : un PDF
 *      remplacé invalide mécaniquement l'ancien texte.
 *
 * Le front-matter de l'application n'analyse que des scalaires mono-ligne
 * (`parserFrontMatter`) : le texte stocké est aplati. C'est un cache pour un
 * prompt, pas une copie fidèle du document — le PDF, lui, reste intact dans le
 * bucket privé.
 */

/** Plafond du cache : assez pour ancrer la proposition, assez peu pour rester un cache. */
export const LIMITE_EXTRAIT_CARACTERES = 20_000;

/**
 * Retire ce qui n'est PAS du texte : fins de ligne Windows, caractères nuls
 * produits par certains producteurs de PDF, espaces traînantes. Aucun mot
 * n'est ajouté, reformulé ou supprimé.
 */
export function nettoyerTextePdf(brut: unknown): string {
  if (typeof brut !== "string") return "";
  return brut
    .replace(/\r\n?/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+$/gm, "")
    .trim();
}

/**
 * Tronque proprement à la limite : en fin de mot, jamais au milieu d'un
 * caractère ni en avalant la moitié d'un mot. La partie coupée est perdue —
 * c'est le contrat d'un cache borné, annoncé comme tel.
 */
export function tronquerTexteExtrait(
  texte: string,
  limite: number = LIMITE_EXTRAIT_CARACTERES,
): string {
  if (texte.length <= limite) return texte;
  const fenetre = texte.slice(0, limite);
  const coupure = fenetre.lastIndexOf(" ");
  return (coupure > 0 ? fenetre.slice(0, coupure) : fenetre).trimEnd();
}

/**
 * Une seule ligne pour survivre au front-matter YAML limité de l'application.
 *
 * Si le texte commence par « [ », il serait lu comme une liste inline au
 * retour : on le protège entre guillemets, que `parserFrontMatter` retire.
 */
export function aplatirPourFrontMatter(texte: string): string {
  const aplati = texte.replace(/\s+/g, " ").trim();
  return aplati.startsWith("[") ? `"${aplati}"` : aplati;
}

export interface CacheExtraitPdf {
  texte: string;
  sourcePieceId: string;
  extraitLe: string;
}

/**
 * Le cache n'est rendu que s'il désigne EXACTEMENT la pièce jointe courante :
 * une autre pièce, un champ manquant ou un texte vide valent absence de cache.
 */
export function lireCacheExtrait(
  frontmatter: Record<string, unknown> | null | undefined,
  pieceId: string,
): CacheExtraitPdf | null {
  if (!frontmatter) return null;
  const texte = frontmatter.extraitTexte;
  const source = frontmatter.extraitSource;
  const date = frontmatter.extraitLe;
  if (typeof texte !== "string" || texte.trim() === "") return null;
  if (source !== pieceId) return null;
  if (typeof date !== "string" || Number.isNaN(new Date(date).getTime())) return null;
  return { texte, sourcePieceId: source, extraitLe: date };
}

/**
 * Le sujet enrichi passé au canal existant de proposition (`/api/referentiel/
 * proposer`) : le titre porte l'intention, l'extrait porte le contenu. Sans
 * extrait, le titre seul — rien n'est inventé.
 */
export function composerSujetLecture(titre: string, extrait: string): string {
  const titrePropre = titre.trim() || "Document sans titre";
  const extraitPropre = extrait.trim();
  if (!extraitPropre) return titrePropre;
  return [
    `En te basant sur le document « ${titrePropre} », propose un référentiel couvrant son contenu.`,
    "",
    "Texte du document :",
    extraitPropre,
  ].join("\n");
}
