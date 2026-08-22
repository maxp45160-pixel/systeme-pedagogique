import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { mesurerPaires } from "../../../scripts/contraste";

const CHEMIN_TOKENS = new URL("../../../src/app/tokens.css", import.meta.url);

/**
 * Le contrat de contraste (WCAG 2.1 : 4,5:1 texte, 3:1 contour de contrôle)
 * est vérifié par calcul sur les paires jeton/fond réellement consommées, dans
 * les deux thèmes. Toute nouvelle paire entrant dans l'usage doit rejoindre
 * `PAIRES` dans `scripts/contraste.ts` — une paire non mesurée peut dériver
 * sans que rien ne le signale.
 *
 * Exécution détaillée : `node scripts/contraste.ts`.
 */
describe("contraste des jetons (WCAG 2.1, les deux thèmes)", () => {
  const resultats = mesurerPaires(readFileSync(CHEMIN_TOKENS, "utf8"));

  it("résout toutes les paires déclarées", () => {
    const nonResolues = resultats.filter((r) => r.erreur);
    expect(nonResolues).toEqual([]);
  });

  it("chaque paire atteint son seuil, dans chaque thème", () => {
    const echecs = resultats.filter((r) => !r.conforme);
    expect(
      echecs.map((r) => `${r.paire} [${r.theme}] = ${r.ratio}:1 < ${r.seuil}:1`),
    ).toEqual([]);
  });
});
