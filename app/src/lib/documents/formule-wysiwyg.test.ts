import { describe, expect, it } from "vitest";

import { formaterEnLigneVersHtml } from "./wysiwyg-markdown";
import { relireSourceFormule, sourceFormule } from "./formule-noeud";

/**
 * Ce que fige ce fichier : dans l'éditeur, une formule est une formule.
 *
 * ## Le défaut d'origine
 *
 * `*` est un opérateur en mathématiques et un délimiteur d'italique en
 * Markdown ; `_` est un indice et une emphase. `formaterEnLigneVersHtml`
 * appliquait l'emphase à la ligne entière, LaTeX compris :
 *
 *     SS = k*\sigma*\sqrt{}*(L)   →   SS = k<em>\sigma</em>\sqrt{}*(L)
 *
 * Une fiche ressource n'ayant pas de vue rendue — son corps ne passe que par
 * l'éditeur — c'était le rendu final, pas une étape intermédiaire.
 * `components/ui/markdown.tsx` segmentait déjà les formules AVANT l'emphase et
 * notait pourquoi ; le chemin WYSIWYG ne le faisait pas.
 */

describe("l'emphase ne touche plus au LaTeX", () => {
  it("ne coupe pas une formule sur ses opérateurs", () => {
    const html = formaterEnLigneVersHtml(String.raw`SS = \(k*\sigma*\sqrt{L}\)`);
    expect(html).not.toContain("<em>");
    expect(html).toContain('data-latex="k*\\sigma*\\sqrt{L}"');
  });

  it("ne prend pas un indice pour une emphase", () => {
    const html = formaterEnLigneVersHtml(String.raw`\(x_1 + x_2\)`);
    expect(html).not.toContain("<em>");
  });

  it("laisse l'emphase agir sur la prose autour", () => {
    const html = formaterEnLigneVersHtml(String.raw`Un *mot* et \(\pi\) ensuite`);
    expect(html).toContain("<em>mot</em>");
    expect(html).toContain("data-latex");
  });

  /*
   * Le repli compte autant que la composition : une commande que KaTeX refuse
   * doit ressortir lisible, jamais en message d'erreur ni en vide.
   */
  it("retombe sur le texte Unicode quand KaTeX refuse", () => {
    const html = formaterEnLigneVersHtml(String.raw`\(\commandeInconnue{x}\)`);
    expect(html).toContain("data-latex");
    expect(html).not.toBe("");
  });
});

describe("l'aller-retour d'une formule éditée", () => {
  /*
   * Une formule rendue à `\(…\)` alors qu'elle venait de `\[…\]` changerait le
   * document à chaque passage dans l'éditeur — une réécriture silencieuse à
   * chaque ouverture de fiche.
   */
  it("garde le délimiteur d'origine", () => {
    const enLigne = sourceFormule("x^2", false);
    const horsLigne = sourceFormule("x^2", true);
    expect(enLigne).toBe(String.raw`\(x^2\)`);
    expect(horsLigne).toBe(String.raw`\[x^2\]`);
    expect(relireSourceFormule(enLigne)).toEqual({ latex: "x^2", bloc: false });
    expect(relireSourceFormule(horsLigne)).toEqual({ latex: "x^2", bloc: true });
  });

  it("marque bien les formules hors-ligne à la composition", () => {
    expect(formaterEnLigneVersHtml(String.raw`\[x^2\]`)).toContain('data-bloc="1"');
    expect(formaterEnLigneVersHtml(String.raw`\(x^2\)`)).toContain('data-bloc="0"');
  });

  /*
   * On efface un délimiteur en corrigeant une formule. Le texte doit ressortir
   * NU, jamais disparaître : une frappe ne supprime pas ce qui est écrit.
   */
  it("rend null quand la source n'est plus une formule", () => {
    expect(relireSourceFormule("x^2 sans délimiteur")).toBeNull();
    expect(relireSourceFormule("")).toBeNull();
  });
});
