import { describe, expect, it } from "vitest";

import { curseurDansFormule, insererFormuleDansTexte } from "./insertion-formule";

/**
 * Ce que fige ce fichier : un symbole de la palette tombe TOUJOURS dans une
 * formule.
 *
 * Ce n'est pas une préférence d'ergonomie. Hors d'un `\(…\)`, un `\sigma` nu
 * n'est pas une formule pour `segmenterFormulesEnLigne` : le document le garde
 * tel quel et l'affiche tel quel. La première version de la palette insérait
 * des symboles nus, et cliquer « √ » dans de la prose écrivait littéralement
 * `\sqrt{}` dans la fiche — le défaut visible dans la capture du 23/08/2026.
 */

describe("où se trouve le curseur", () => {
  it("reconnaît une formule ouverte", () => {
    expect(curseurDansFormule(String.raw`Soit \(x`, 8)).toBe(true);
    expect(curseurDansFormule(String.raw`Soit \[x`, 8)).toBe(true);
  });

  it("reconnaît une formule déjà refermée", () => {
    expect(curseurDansFormule(String.raw`Soit \(x\) puis`, 15)).toBe(false);
    expect(curseurDansFormule(String.raw`Soit \[x\] puis`, 15)).toBe(false);
  });

  it("ne voit aucune formule dans de la prose", () => {
    expect(curseurDansFormule("Une phrase ordinaire", 10)).toBe(false);
  });

  /*
   * Le dollar est délibérément ignoré : `segmenterFormulesEnLigne` ne le
   * reconnaît que sous conditions, précisément pour que « payer 30$ puis 40$ »
   * reste de la prose. Le traiter comme une ouverture enfermerait le symbole
   * dans un texte qui n'est pas une formule.
   */
  it("ne prend pas un montant en dollars pour une formule ouverte", () => {
    expect(curseurDansFormule("payer 30$ puis ", 15)).toBe(false);
  });
});

describe("insertion d'un symbole", () => {
  it("pose l'enveloppe quand le curseur est dans de la prose", () => {
    const { texte, curseur } = insererFormuleDansTexte("SS = ", 5, 5, "\\sigma ", 0);
    expect(texte).toBe(String.raw`SS = \(\sigma \)`);
    // Curseur juste avant le `\)` fermant : on continue d'écrire dans la formule.
    expect(texte.slice(curseur)).toBe("\\)");
  });

  it("n'ajoute rien quand le curseur est déjà dans une formule", () => {
    const depart = String.raw`SS = \(k `;
    const { texte } = insererFormuleDansTexte(depart, depart.length, depart.length, "\\times ", 0);
    expect(texte).toBe(String.raw`SS = \(k \times `);
  });

  /*
   * Une enveloppe enveloppée donnerait `\(\(\)\)`, que rien ne sait relire :
   * le segmenteur s'arrêterait au premier `\)` et laisserait un `\)` orphelin
   * dans la prose.
   */
  it("n'enveloppe pas une enveloppe", () => {
    const { texte, curseur } = insererFormuleDansTexte("Soit ", 5, 5, "\\(\\)", 2);
    expect(texte).toBe(String.raw`Soit \(\)`);
    expect(texte.slice(curseur)).toBe("\\)");
  });

  it("place le curseur dans le numérateur d'une fraction", () => {
    const { texte, curseur } = insererFormuleDansTexte("", 0, 0, "\\frac{}{}", 3);
    expect(texte).toBe(String.raw`\(\frac{}{}\)`);
    expect(texte.slice(curseur)).toBe(String.raw`}{}\)`);
  });

  it("remplace la sélection plutôt que de s'y ajouter", () => {
    const { texte } = insererFormuleDansTexte("a REMPLACER b", 2, 11, "\\pi ", 0);
    expect(texte).toBe(String.raw`a \(\pi \) b`);
  });
});
