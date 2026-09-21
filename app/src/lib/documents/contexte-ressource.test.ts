import { expect, it } from "vitest";
import { CHAMP_CONTEXTE_RESSOURCE, champsContexteRessource, lireContexteRessource } from "./contexte-ressource";
import { definirChampsFrontMatter, parserFrontMatter } from "./markdown";

it("conserve les déclarations exactes sans injecter de champs dans le document", () => {
  const personnel = { contexte: { texte: 'Cours d’été : "thermodynamique"\nrole: admin\n---\nMon rôle', declareLe: "2026-09-19T00:00:00.000Z" } };
  const md = definirChampsFrontMatter("---\ntitle: Original\n---\nMon document", champsContexteRessource(personnel));
  const { frontMatter, corps } = parserFrontMatter(md);
  expect(lireContexteRessource(frontMatter)).toEqual(personnel);
  expect(frontMatter.role).toBeUndefined(); expect(frontMatter.title).toBe("Original");
  expect(corps).toContain("Mon document");
});

it("distingue absence et données invalides sans fabriquer une déclaration", () => {
  expect(lireContexteRessource({})).toEqual({});
  for (const invalide of [null, "", "%xx", encodeURIComponent(JSON.stringify({ version: 2 })), encodeURIComponent(JSON.stringify({ version: 1, compris: true }))]) {
    expect(() => lireContexteRessource({ [CHAMP_CONTEXTE_RESSOURCE]: invalide })).toThrow("invalide");
  }
});

it("refuse contenu vide, trop long, caractères de contrôle et provenance invalide", () => {
  for (const texte of [" ", "a".repeat(2001), "Bonjour\u0000"]) {
    expect(() => champsContexteRessource({ intention: { texte, declareLe: "2026-09-19T00:00:00.000Z" } })).toThrow();
  }
  expect(() => champsContexteRessource({ intention: { texte: "Réviser", declareLe: "hier" } })).toThrow();
});
