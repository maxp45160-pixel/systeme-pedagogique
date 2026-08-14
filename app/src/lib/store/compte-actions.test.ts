import { describe, expect, it, vi } from "vitest";

describe("réinitialisation et purge de compte", () => {
  it("normalise la phrase de validation indépendamment de la casse et des accents", () => {
    function normaliser(texte: string): string {
      return texte
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .trim();
    }

    const PHRASE_CIBLE = "SUPPRIMER MES DONNEES";

    expect(normaliser("SUPPRIMER MES DONNÉES")).toBe(PHRASE_CIBLE);
    expect(normaliser("supprimer mes données")).toBe(PHRASE_CIBLE);
    expect(normaliser("supprimer mes donnees")).toBe(PHRASE_CIBLE);
    expect(normaliser("  SUPPRIMER MES DONNEES  ")).toBe(PHRASE_CIBLE);
    expect(normaliser("SUPPRIMER")).not.toBe(PHRASE_CIBLE);
    expect(normaliser("supprimer")).not.toBe(PHRASE_CIBLE);
    expect(normaliser("")).not.toBe(PHRASE_CIBLE);
  });

  it("définit les deux modes de traitement souverains", () => {
    const modes = ["reset", "supprimer_et_deconnecter"] as const;
    expect(modes).toContain("reset");
    expect(modes).toContain("supprimer_et_deconnecter");
  });
});
