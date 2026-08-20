import { describe, expect, it } from "vitest";
import { extraireEcheanceBesoin } from "./echeance-besoin";

describe("extraireEcheanceBesoin", () => {
  const maintenant = new Date("2026-08-20T12:00:00.000Z");

  it("traduit une semaine écrite dans un besoin", () => {
    expect(extraireEcheanceBesoin("J'ai un contrôle à réviser dans une semaine", maintenant))
      .toBe("2026-08-27");
  });

  it("accepte une date explicite", () => {
    expect(extraireEcheanceBesoin("Réviser pour le 28/08", maintenant)).toBe("2026-08-28");
  });

  it("ne fabrique pas d'échéance quand le besoin n'en contient pas", () => {
    expect(extraireEcheanceBesoin("Je veux comprendre les coûts", maintenant)).toBeUndefined();
  });
});
