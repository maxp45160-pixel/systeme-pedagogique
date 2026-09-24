import { describe, expect, it } from "vitest";
import { XMLParser } from "fast-xml-parser";
import { lireStylesEpub, positionCssEpub, transcrireMathmlEpub } from "./extraction-epub-notations";

describe("notations EPUB conservatrices", () => {
  it("applique la cascade simple, spécificité et important sans heuristic de nom", () => {
    const limites = new Set<string>();
    const styles = lireStylesEpub([".a{vertical-align:sub!important} span.a {vertical-align:super} #x{vertical-align:top}"], limites);
    const n = { ":@": { "@_class": "a", "@_id": "x", "@_style": "vertical-align:bottom" } };
    expect(positionCssEpub(n, "span", styles, limites)).toBe("sub");
    n[":@"]["@_style"] = "vertical-align:baseline!important";
    expect(positionCssEpub(n, "span", styles, limites)).toBe("baseline");
    const ordre = lireStylesEpub([".a{vertical-align:sub}", ".a{vertical-align:super}"], limites);
    expect(positionCssEpub({ ":@": { "@_class": "a" } }, "span", ordre, limites)).toBe("super");
  });
  it.each(["@media print {.a{vertical-align:sub}}", ".parent .a{vertical-align:super}", ".a{vertical-align:var(--position)}"])("signale les styles non résolus : %s", (css) => {
    const limites = new Set<string>();
    const styles = lireStylesEpub([css], limites);
    expect(positionCssEpub({ ":@": { "@_class": "a" } }, "span", styles, limites)).toBe(styles.regles.length ? "incertaine" : undefined);
    expect(limites.size).toBeGreaterThan(0);
  });
  it.each([
    ['<math><msubsup><mo>∑</mo><mi>i</mi><mi>n</mi></msubsup><msqrt><mi>x</mi></msqrt></math>', "{∑}_{i}^{n} sqrt{x}"],
    ['<math><mfenced open="[" close="]" separators=";"><mi>a</mi><mi>b</mi><mi>c</mi></mfenced></math>', "[a;b;c]"],
    ['<math><semantics><mi>x</mi><annotation encoding="text/plain">FAUX</annotation></semantics></math>', "x"],
    ['<math><msub><mi>x</mi></msub></math>', "[expression MathML non transcrite]"],
    ['<math><mfrac linethickness="0"><mi>x</mi><mi>y</mi></mfrac></math>', "[expression MathML non transcrite]"],
    ['<math><mi mathvariant="double-struck">R</mi><mo>≠</mo><mi>R</mi></math>', "[expression MathML non transcrite]"],
    ['<math><ms lquote="[" rquote="]">abc</ms></math>', "[abc]"],
  ])("préserve la structure ou annonce son absence : %s", (xml, attendu) => {
    const arbre = new XMLParser({ preserveOrder: true, ignoreAttributes: false, parseTagValue: false }).parse(xml);
    expect(transcrireMathmlEpub(arbre, new Set()).trim()).toBe(attendu);
  });
  it("ne prend pas une chaîne CSS pour une déclaration et borne une feuille sans accolades", () => {
    expect(lireStylesEpub(['.a{content:";vertical-align:super"}'], new Set()).regles).toEqual([]);
    expect(lireStylesEpub(["x".repeat(1_000_000)], new Set()).regles).toEqual([]);
  });
  it("tolère les caractères CSS illisibles dans les commentaires seulement", () => {
    expect(lireStylesEpub(['/* \ufffd */ .a{vertical-align:sub}'], new Set()).ambigu).toBe(false);
    expect(lireStylesEpub(['.a{vertical-align:s\ufffdub}'], new Set()).ambigu).toBe(true);
  });
  it("ne transforme pas une classe sans position attestée en annotation positionnelle", () => {
    const limites = new Set<string>();
    const styles = lireStylesEpub(['@import url("externe.css"); .indice{vertical-align:sub}'], limites);
    expect(positionCssEpub({ ":@": { "@_class": "paragraphe" } }, "p", styles, limites)).toBeUndefined();
    expect(positionCssEpub({ ":@": { "@_class": "indice" } }, "span", styles, limites)).toBe("incertaine");
    expect(lireStylesEpub(['@charset "utf-8"; .indice{vertical-align:sub}'], new Set()).ambigu).toBe(false);
  });
});
