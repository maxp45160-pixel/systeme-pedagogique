import { describe, expect, it } from "vitest";
import {
  LONGUEUR_MINIMALE_MOT_DE_PASSE,
  validerRedefinition,
} from "./reinitialisation-mot-de-passe";

describe("validerRedefinition", () => {
  it("accepte une redéfinition conforme", () => {
    const verdict = validerRedefinition("un-passe-solide-2026", "un-passe-solide-2026");
    expect(verdict).toEqual({
      valide: true,
      motDePasse: "un-passe-solide-2026",
    });
  });

  it("refuse un mot de passe sous la longueur minimale", () => {
    const verdict = validerRedefinition("court", "court");
    expect(verdict).toEqual({
      valide: false,
      erreurMotDePasse: `${LONGUEUR_MINIMALE_MOT_DE_PASSE} caractères minimum.`,
      erreurConfirmation: undefined,
    });
  });

  it("refuse une confirmation qui diffère, même avec un mot de passe valide", () => {
    const verdict = validerRedefinition("un-passe-solide-2026", "autre-chose-2026");
    expect(verdict.valide).toBe(false);
    if (!verdict.valide) {
      expect(verdict.erreurMotDePasse).toBeUndefined();
      expect(verdict.erreurConfirmation).toMatch(/concordent/);
    }
  });

  it("signale d'abord la longueur : la concordance n'est pas jugée sur un mot de passe déjà refusé", () => {
    const verdict = validerRedefinition("court", "pas-daccord");
    expect(verdict.valide).toBe(false);
    if (!verdict.valide) {
      expect(verdict.erreurMotDePasse).toBeDefined();
      expect(verdict.erreurConfirmation).toBeUndefined();
    }
  });
});
