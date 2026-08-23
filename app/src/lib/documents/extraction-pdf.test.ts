import { describe, expect, it } from "vitest";
import {
  LIMITE_EXTRAIT_CARACTERES,
  aplatirPourFrontMatter,
  composerSujetLecture,
  lireCacheExtrait,
  nettoyerTextePdf,
  tronquerTexteExtrait,
} from "./extraction-pdf";
import { parserFrontMatter } from "./markdown";

/*
 * Ce que ces tests protègent : le cache d'extraction n'invente rien — un texte
 * non extractible reste vide, la troncature coupe en fin de mot, et le cache
 * ne vaut que pour la pièce jointe qui l'a produit.
 */

describe("nettoyerTextePdf", () => {
  it("retire les caractères non textuels sans toucher aux mots", () => {
    expect(nettoyerTextePdf("Chapitre 1\r\n\r\nLe flux logistique\u0000")).toBe(
      "Chapitre 1\n\nLe flux logistique",
    );
  });

  it("rend une chaîne vide pour toute entrée qui n'est pas du texte", () => {
    expect(nettoyerTextePdf(null)).toBe("");
    expect(nettoyerTextePdf(undefined)).toBe("");
    expect(nettoyerTextePdf(42)).toBe("");
  });

  it("ne fabrique rien sur un PDF sans texte (scan)", () => {
    expect(nettoyerTextePdf("   \n  \t ")).toBe("");
  });
});

describe("tronquerTexteExtrait", () => {
  it("laisse intact un texte sous la limite", () => {
    const texte = "un texte court";
    expect(tronquerTexteExtrait(texte)).toBe(texte);
  });

  it("coupe à la fin d'un mot avant la limite", () => {
    const texte = `${"mot ".repeat(6000)}fin`;
    const tronque = tronquerTexteExtrait(texte.trim(), LIMITE_EXTRAIT_CARACTERES);
    expect(tronque.length).toBeLessThanOrEqual(LIMITE_EXTRAIT_CARACTERES);
    expect(tronque.endsWith("mot")).toBe(true);
  });

  it("honore une limite explicite plus basse", () => {
    expect(tronquerTexteExtrait("alpha beta gamma delta", 10)).toBe("alpha");
  });
});

describe("aplatirPourFrontMatter — le stockage survit au parseur YAML limité", () => {
  it("produit un scalaire mono-ligne relisible par parserFrontMatter", () => {
    const source = "Ligne une.\n\nLigne   deux.";
    const md = [
      "---",
      `extraitTexte: ${aplatirPourFrontMatter(source)}`,
      "---",
      "",
      "# Titre",
    ].join("\n");
    const { frontMatter } = parserFrontMatter(md);
    expect(frontMatter.extraitTexte).toBe("Ligne une. Ligne deux.");
  });

  it("protège un texte commençant par « [ » d'une lecture en liste inline", () => {
    const aplati = aplatirPourFrontMatter("[1] Référence en début de texte.");
    const md = ["---", `extraitTexte: ${aplati}`, "---", "", "# Titre"].join("\n");
    const { frontMatter } = parserFrontMatter(md);
    expect(Array.isArray(frontMatter.extraitTexte)).toBe(false);
    expect(frontMatter.extraitTexte).toBe("[1] Référence en début de texte.");
  });
});

describe("lireCacheExtrait — un cache ne vaut que pour sa pièce", () => {
  const cacheValide = {
    extraitTexte: "Contenu extrait.",
    extraitSource: "piece-1",
    extraitLe: "2026-08-22T10:00:00.000Z",
  };

  it("rend le cache quand tout concorde", () => {
    expect(lireCacheExtrait(cacheValide, "piece-1")).toEqual({
      texte: "Contenu extrait.",
      sourcePieceId: "piece-1",
      extraitLe: "2026-08-22T10:00:00.000Z",
    });
  });

  it("refuse le cache d'une autre pièce jointe", () => {
    expect(lireCacheExtrait(cacheValide, "piece-2")).toBeNull();
  });

  it("refuse un cache incomplet, vide ou daté de travers", () => {
    expect(lireCacheExtrait(null, "piece-1")).toBeNull();
    expect(lireCacheExtrait({ extraitTexte: "  ", extraitSource: "piece-1" }, "piece-1")).toBeNull();
    expect(
      lireCacheExtrait({ ...cacheValide, extraitLe: "pas-une-date" }, "piece-1"),
    ).toBeNull();
  });
});

describe("composerSujetLecture", () => {
  it("porte le titre et l'extrait dans le canal existant", () => {
    const sujet = composerSujetLecture("Cours de logistique", "Le flux push…");
    expect(sujet).toContain("« Cours de logistique »");
    expect(sujet).toContain("Le flux push…");
  });

  it("retombe sur le titre seul sans extrait — rien n'est inventé", () => {
    expect(composerSujetLecture("Mon titre", "  ")).toBe("Mon titre");
    expect(composerSujetLecture("", "")).toBe("Document sans titre");
  });
});
