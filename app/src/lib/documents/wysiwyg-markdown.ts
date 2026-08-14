/**
 * Moteur de synchronisation bi-directionnelle WYSIWYG <-> Markdown.
 *
 * Permet l'édition directe in-place (« Document Vivant ») tout en garantissant :
 * 1. La préservation stricte et invisible du Frontmatter YAML.
 * 2. La sérialisation fidèle du Markdown canonique (titres, listes, citations, emphase, wikiliens).
 * 3. Zéro dépendance externe lourde.
 */

import {
  separerFrontMatterEtCorps,
  REGEX_INLINE_MARKDOWN,
  type ExtractionFrontMatter,
} from "@/lib/documents/markdown";

export { separerFrontMatterEtCorps, REGEX_INLINE_MARKDOWN };
export type { ExtractionFrontMatter };

/**
 * Recompose le document complet avec son frontmatter YAML d'origine.
 */
export function recomposerDocumentComplet(frontmatterBrut: string, corpsMd: string): string {
  const frontPropre = frontmatterBrut.trim();
  const corpsPropre = corpsMd.trim();
  if (!frontPropre) return corpsPropre;
  if (!corpsPropre) return frontPropre;
  return `${frontPropre}\n\n${corpsPropre}`;
}

/**
 * Échappe les caractères HTML spéciaux d'une chaîne texte.
 */
function echapperHtml(texte: string): string {
  return texte
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Formate les éléments en ligne (gras, italique, code, wikiliens) en balises HTML.
 */
export function formaterEnLigneVersHtml(texte: string): string {
  const tokens: Array<{ type: "html" | "text"; value: string }> = [];
  // Découpe sur les wikiliens, le gras, l'italique et le code
  const regex = REGEX_INLINE_MARKDOWN;
  let dernierIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(texte)) !== null) {
    if (match.index > dernierIndex) {
      tokens.push({ type: "text", value: texte.slice(dernierIndex, match.index) });
    }
    const brut = match[0];
    if (brut.startsWith("[[") && brut.endsWith("]]") && brut.length > 4) {
      const contenu = brut.slice(2, -2).trim();
      const [cible, libelle] = contenu.split("|", 2);
      const texteAffiche = (libelle || cible).trim();
      tokens.push({
        type: "html",
        value: `<span class="wikilien-badge" data-wikilien="${echapperHtml(cible)}">[[${echapperHtml(texteAffiche)}]]</span>`,
      });
    } else if (brut.startsWith("**") && brut.endsWith("**")) {
      tokens.push({
        type: "html",
        value: `<strong>${echapperHtml(brut.slice(2, -2))}</strong>`,
      });
    } else if (brut.startsWith("*") && brut.endsWith("*") && brut.length > 2) {
      tokens.push({
        type: "html",
        value: `<em>${echapperHtml(brut.slice(1, -1))}</em>`,
      });
    } else if (brut.startsWith("`") && brut.endsWith("`") && brut.length > 2) {
      tokens.push({
        type: "html",
        value: `<code>${echapperHtml(brut.slice(1, -1))}</code>`,
      });
    } else {
      tokens.push({ type: "text", value: brut });
    }
    dernierIndex = regex.lastIndex;
  }

  if (dernierIndex < texte.length) {
    tokens.push({ type: "text", value: texte.slice(dernierIndex) });
  }

  return tokens
    .map((token) => (token.type === "html" ? token.value : echapperHtml(token.value)))
    .join("");
}

/**
 * Convertit un corps Markdown en HTML structuré pour l'éditeur ContentEditable.
 */
export function markdownVersHtml(corpsMd: string): string {
  const lignes = corpsMd.split("\n");
  const htmlBlocs: string[] = [];
  let i = 0;

  while (i < lignes.length) {
    const ligne = lignes[i];
    const ligneTrim = ligne.trim();

    // Ligne vide
    if (ligneTrim === "") {
      i++;
      continue;
    }

    // Titres
    const titreMatch = /^(#{1,4})\s+(.*)$/.exec(ligne);
    if (titreMatch) {
      const niveau = titreMatch[1].length;
      const tag = niveau <= 2 ? "h2" : "h3";
      htmlBlocs.push(`<${tag}>${formaterEnLigneVersHtml(titreMatch[2])}</${tag}>`);
      i++;
      continue;
    }

    // Citations
    if (ligneTrim.startsWith(">")) {
      const citationLignes: string[] = [];
      while (i < lignes.length && lignes[i].trim().startsWith(">")) {
        citationLignes.push(lignes[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      htmlBlocs.push(`<blockquote>${formaterEnLigneVersHtml(citationLignes.join(" "))}</blockquote>`);
      continue;
    }

    // Listes à puces
    if (/^\s*[-*]\s+/.test(ligne)) {
      const items: string[] = [];
      while (i < lignes.length && /^\s*[-*]\s+/.test(lignes[i])) {
        const itemTexte = lignes[i].replace(/^\s*[-*]\s+/, "");
        items.push(`<li>${formaterEnLigneVersHtml(itemTexte)}</li>`);
        i++;
      }
      htmlBlocs.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    // Listes numérotées
    if (/^\s*\d+\.\s+/.test(ligne)) {
      const items: string[] = [];
      while (i < lignes.length && /^\s*\d+\.\s+/.test(lignes[i])) {
        const itemTexte = lignes[i].replace(/^\s*\d+\.\s+/, "");
        items.push(`<li>${formaterEnLigneVersHtml(itemTexte)}</li>`);
        i++;
      }
      htmlBlocs.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    // Blocs de code
    if (ligneTrim.startsWith("```")) {
      const codeLignes: string[] = [];
      i++;
      while (i < lignes.length && !lignes[i].trim().startsWith("```")) {
        codeLignes.push(echapperHtml(lignes[i]));
        i++;
      }
      i++; // Fermeture
      htmlBlocs.push(`<pre><code>${codeLignes.join("\n")}</code></pre>`);
      continue;
    }

    // Paragraphe par défaut
    const paragrapheLignes: string[] = [ligne];
    i++;
    while (
      i < lignes.length &&
      lignes[i].trim() !== "" &&
      !lignes[i].trim().startsWith("#") &&
      !lignes[i].trim().startsWith(">") &&
      !/^\s*[-*]\s+/.test(lignes[i]) &&
      !/^\s*\d+\.\s+/.test(lignes[i]) &&
      !lignes[i].trim().startsWith("```")
    ) {
      paragrapheLignes.push(lignes[i]);
      i++;
    }
    htmlBlocs.push(`<p>${formaterEnLigneVersHtml(paragrapheLignes.join(" "))}</p>`);
  }

  return htmlBlocs.length > 0 ? htmlBlocs.join("\n") : "<p><br></p>";
}

/**
 * Traite récursivement les nœuds inline d'un élément DOM vers du texte Markdown.
 */
function serialiserNœudsInlineVersMarkdown(node: Node): string {
  if (node.nodeType === 3) {
    // TEXT_NODE
    return (node.textContent ?? "").replace(/\u00a0/g, " ");
  }

  if (node.nodeType === 1) {
    // ELEMENT_NODE
    const el = node as HTMLElement;
    const tagName = el.tagName.toLowerCase();

    if (el.classList.contains("wikilien-badge") || el.hasAttribute("data-wikilien")) {
      const cible = el.getAttribute("data-wikilien") ?? "";
      const texteAffiche = el.textContent?.replace(/^\[\[|\]\]$/g, "").trim() ?? "";
      if (!cible) return texteAffiche ? `[[${texteAffiche}]]` : "";
      return texteAffiche && texteAffiche !== cible ? `[[${cible}|${texteAffiche}]]` : `[[${cible}]]`;
    }

    const enfants = Array.from(el.childNodes)
      .map(serialiserNœudsInlineVersMarkdown)
      .join("");

    switch (tagName) {
      case "strong":
      case "b":
        return enfants ? `**${enfants}**` : "";
      case "em":
      case "i":
        return enfants ? `*${enfants}*` : "";
      case "code":
        return enfants ? `\`${enfants}\`` : "";
      case "br":
        return "\n";
      default:
        return enfants;
    }
  }

  return "";
}

/**
 * Convertit un arbre DOM issu de ContentEditable en chaîne Markdown canonique.
 */
export function domVersMarkdown(conteneur: HTMLElement): string {
  const blocs: string[] = [];

  for (const child of Array.from(conteneur.childNodes)) {
    if (child.nodeType === 3) {
      // TEXT_NODE
      const texte = (child.textContent ?? "").replace(/\u00a0/g, " ").trim();
      if (texte) blocs.push(texte);
      continue;
    }

    if (child.nodeType === 1) {
      // ELEMENT_NODE
      const el = child as HTMLElement;
      const tag = el.tagName.toLowerCase();

      switch (tag) {
        case "h1":
        case "h2": {
          const texte = serialiserNœudsInlineVersMarkdown(el).trim();
          if (texte) blocs.push(`## ${texte}`);
          break;
        }
        case "h3":
        case "h4":
        case "h5":
        case "h6": {
          const texte = serialiserNœudsInlineVersMarkdown(el).trim();
          if (texte) blocs.push(`### ${texte}`);
          break;
        }
        case "blockquote": {
          const texte = serialiserNœudsInlineVersMarkdown(el).trim();
          if (texte) blocs.push(`> ${texte}`);
          break;
        }
        case "ul": {
          const items = Array.from(el.querySelectorAll(":scope > li"))
            .map((li) => `- ${serialiserNœudsInlineVersMarkdown(li).trim()}`)
            .filter((item) => item !== "-");
          if (items.length > 0) blocs.push(items.join("\n"));
          break;
        }
        case "ol": {
          const items = Array.from(el.querySelectorAll(":scope > li"))
            .map((li, index) => `${index + 1}. ${serialiserNœudsInlineVersMarkdown(li).trim()}`)
            .filter((item) => !item.endsWith("."));
          if (items.length > 0) blocs.push(items.join("\n"));
          break;
        }
        case "pre": {
          const codeEl = el.querySelector("code") ?? el;
          const texte = codeEl.textContent ?? "";
          blocs.push(`\`\`\`\n${texte.trim()}\n\`\`\``);
          break;
        }
        case "p":
        case "div": {
          const texte = serialiserNœudsInlineVersMarkdown(el).trim();
          if (texte) blocs.push(texte);
          break;
        }
        default: {
          const texte = serialiserNœudsInlineVersMarkdown(el).trim();
          if (texte) blocs.push(texte);
        }
      }
    }
  }

  return blocs.join("\n\n").trim();
}

export interface EtatFormatage {
  bold: boolean;
  italic: boolean;
  h2: boolean;
  ul: boolean;
  ol: boolean;
  blockquote: boolean;
}

export const ETAT_FORMATAGE_DEFAUT: EtatFormatage = {
  bold: false,
  italic: false,
  h2: false,
  ul: false,
  ol: false,
  blockquote: false,
};

/**
 * Détecte les formats appliqués au point d'insertion ou à la sélection active.
 */
export function detecterEtatFormatage(rootElement: HTMLElement | null): EtatFormatage {
  if (typeof window === "undefined" || typeof document === "undefined" || !rootElement) {
    return { ...ETAT_FORMATAGE_DEFAUT };
  }

  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) {
    return { ...ETAT_FORMATAGE_DEFAUT };
  }

  let node: Node | null = sel.anchorNode;
  if (!node || !rootElement.contains(node)) {
    return { ...ETAT_FORMATAGE_DEFAUT };
  }

  let isBold = false;
  let isItalic = false;
  let isH2 = false;
  let isUl = false;
  let isOl = false;
  let isBlockquote = false;

  try {
    isBold = document.queryCommandState("bold");
    isItalic = document.queryCommandState("italic");
  } catch {}

  while (node && node !== rootElement && node !== document.body) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();
      if (tag === "h1" || tag === "h2") isH2 = true;
      if (tag === "ul") isUl = true;
      if (tag === "ol") isOl = true;
      if (tag === "blockquote") isBlockquote = true;
      if (tag === "strong" || tag === "b") isBold = true;
      if (tag === "em" || tag === "i") isItalic = true;
    }
    node = node.parentNode;
  }

  return {
    bold: isBold,
    italic: isItalic,
    h2: isH2,
    ul: isUl,
    ol: isOl,
    blockquote: isBlockquote,
  };
}

