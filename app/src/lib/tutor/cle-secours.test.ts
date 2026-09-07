import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ecrireConfigTuteur, effacerConfigTuteur, lireConfigTuteur, type ConfigTuteurClient } from "./cle-client";

describe("clés principale et de secours", () => {
  const principale: ConfigTuteurClient = { fournisseur: "mistral", cle: "cle-factice-principale" };
  const secours: ConfigTuteurClient = { fournisseur: "groq", cle: "gsk_factice_secours" };
  beforeEach(() => {
    const valeurs = new Map<string, string>();
    vi.stubGlobal("window", {
      dispatchEvent: vi.fn(),
      localStorage: {
        getItem: (cle: string) => valeurs.get(cle) ?? null,
        setItem: (cle: string, valeur: string) => valeurs.set(cle, valeur),
        removeItem: (cle: string) => valeurs.delete(cle),
      },
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("conserve la clé principale quand le secours est ajouté ou effacé", () => {
    ecrireConfigTuteur("c1", principale);
    ecrireConfigTuteur("c1", secours, "secours");
    expect(lireConfigTuteur("c1")).toEqual(principale);
    expect(lireConfigTuteur("c1", "secours")).toEqual(secours);
    effacerConfigTuteur("c1", "secours");
    expect(lireConfigTuteur("c1", "secours")).toBeNull();
    expect(lireConfigTuteur("c1")).toEqual(principale);
  });

  it("ne partage aucune des deux clés avec un autre compte", () => {
    ecrireConfigTuteur("c1", principale);
    ecrireConfigTuteur("c1", secours, "secours");
    expect(lireConfigTuteur("c2")).toBeNull();
    expect(lireConfigTuteur("c2", "secours")).toBeNull();
  });

  it("garde le secours lors d'un remplacement de la clé principale", () => {
    ecrireConfigTuteur("c1", secours, "secours");
    ecrireConfigTuteur("c1", principale);
    effacerConfigTuteur("c1");
    expect(lireConfigTuteur("c1", "secours")).toEqual(secours);
  });
});
