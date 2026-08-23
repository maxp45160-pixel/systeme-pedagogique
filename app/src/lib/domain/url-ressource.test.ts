import { describe, expect, it } from "vitest";

import { validerUrlRessource } from "./url-ressource";

describe("validation d'une URL de ressource-lien", () => {
  it("accepte une URL https absolue et la normalise", () => {
    const resultat = validerUrlRessource("https://example.org/article");
    expect(resultat).toEqual({
      valide: true,
      url: "https://example.org/article",
    });
  });

  it("accepte une URL http et tolère les espaces d'extrémité", () => {
    const resultat = validerUrlRessource("  http://exemple.fr/page?q=1  ");
    expect(resultat.valide).toBe(true);
    if (resultat.valide) {
      expect(resultat.url).toBe("http://exemple.fr/page?q=1");
    }
  });

  it("refuse ce qui n'est pas une URL", () => {
    expect(validerUrlRessource("").valide).toBe(false);
    expect(validerUrlRessource("   ").valide).toBe(false);
    expect(validerUrlRessource("pas une url").valide).toBe(false);
    expect(validerUrlRessource("/chemin/relatif").valide).toBe(false);
    expect(validerUrlRessource("www.exemple.fr").valide).toBe(false);
  });

  it("refuse les schémas qui ne sont ni http ni https", () => {
    expect(validerUrlRessource("javascript:alert(1)").valide).toBe(false);
    expect(validerUrlRessource("data:text/html;base64,AAA=").valide).toBe(false);
    expect(validerUrlRessource("file:///c:/windows").valide).toBe(false);
    expect(validerUrlRessource("ftp://exemple.fr/fichier").valide).toBe(false);
  });

  it("refuse une URL sans hôte ou avec des caractères interdits", () => {
    expect(validerUrlRessource("https://").valide).toBe(false);
    expect(validerUrlRessource("https:///chemin").valide).toBe(false);
    expect(validerUrlRessource("https://exemple.fr/a b").valide).toBe(false);
  });

  it("refuse une URL trop longue pour le front-matter", () => {
    const longue = `https://exemple.fr/${"a".repeat(2100)}`;
    expect(validerUrlRessource(longue).valide).toBe(false);
  });
});
