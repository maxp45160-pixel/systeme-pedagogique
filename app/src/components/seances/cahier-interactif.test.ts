import { describe, expect, it, vi } from "vitest";
import { vueInitialeDepuisParametres } from "./cahier-interactif";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

describe("sélection de vue de /seances", () => {
  it("ouvre À venir par défaut et conserve les liens historiques explicites", () => {
    expect(vueInitialeDepuisParametres({})).toBe("avenir");
    expect(vueInitialeDepuisParametres({ vueDemandee: "cahier" })).toBe("cahier");
    expect(vueInitialeDepuisParametres({ recherche: "thermo" })).toBe("cahier");
    expect(vueInitialeDepuisParametres({ jourExplicite: true })).toBe("bureau");
    expect(vueInitialeDepuisParametres({ vueDemandee: "bureau" })).toBe("bureau");
  });

});
