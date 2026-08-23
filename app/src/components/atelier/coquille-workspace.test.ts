import { describe, expect, it, vi } from "vitest";
import { sortieWorkspace } from "./coquille-workspace";

vi.mock("server-only", () => ({}));

describe("sortieWorkspace", () => {
  it("retourne la sortie par défaut vers l'Atelier quand aucun retour n'est fourni", () => {
    expect(sortieWorkspace()).toEqual({
      href: "/atelier",
      libelle: "Retour à mes cours",
    });
    expect(sortieWorkspace(undefined)).toEqual({
      href: "/atelier",
      libelle: "Retour à mes cours",
    });
    expect(sortieWorkspace("")).toEqual({
      href: "/atelier",
      libelle: "Retour à mes cours",
    });
  });

  it("retourne un libellé cohérent pour le Bureau quand l'URL de retour vient de /seances", () => {
    expect(sortieWorkspace("/seances")).toEqual({
      href: "/seances",
      libelle: "Retour aux séances",
    });
    expect(sortieWorkspace("/seances?jour=2026-08-16")).toEqual({
      href: "/seances?jour=2026-08-16",
      libelle: "Retour aux séances",
    });
    expect(sortieWorkspace("/seances?q=simulateur")).toEqual({
      href: "/seances?q=simulateur",
      libelle: "Retour aux séances",
    });
  });

  it("retourne un libellé cohérent pour le tableau de bord quand l'URL est /", () => {
    expect(sortieWorkspace("/")).toEqual({
      href: "/",
      libelle: "Retourner au tableau de bord",
    });
    expect(sortieWorkspace("/?instant=1")).toEqual({
      href: "/?instant=1",
      libelle: "Retourner au tableau de bord",
    });
  });

  it("retourne un libellé générique pour toute autre URL de retour", () => {
    expect(sortieWorkspace("/progression")).toEqual({
      href: "/progression",
      libelle: "Retour",
    });
  });
});
