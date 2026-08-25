import { describe, expect, it } from "vitest";
import { cleJourFuseau } from "./dates";

/**
 * La friction du 25/08/2026 : le jour initial de `/seances` venait de
 * `cleJour(ctx.now)` — les getters locaux du SERVEUR, en UTC en production.
 * Autour de minuit en Europe/Paris (23 h UTC en été, 0 h en hiver), l'onglet
 * Séances ouvrait donc sur la veille.
 *
 * Ces tests fixent la frontière : un même instant UTC produit deux jours
 * civils selon le fuseau, et le basculement tombe exactement là où il doit.
 * `cleJourFuseau` est la forme testable de ce que fait le navigateur quand
 * `CahierInteractif` recoupe le jour dans l'horloge locale au montage.
 */
describe("cleJourFuseau — le jour civil dépend du fuseau autour de minuit", () => {
  it("été : 22 h 30 UTC est encore le même jour à Paris (minuit à 00 h 30 UTC)", () => {
    // Août = heure d'été européenne (UTC+2). 2026-08-24T22:30Z → 25/08 00:30 locale ?
    // Non : 22:30 + 2 h = 00:30 du 25. Le même instant vu d'UTC est le 24.
    const instant = "2026-08-24T22:30:00Z";
    expect(cleJourFuseau(instant, "UTC")).toBe("2026-08-24");
    expect(cleJourFuseau(instant, "Europe/Paris")).toBe("2026-08-25");
  });

  it("été : juste avant 22 h UTC, serveur et Paris sont d'accord", () => {
    const instant = "2026-08-24T21:59:59Z";
    expect(cleJourFuseau(instant, "UTC")).toBe("2026-08-24");
    expect(cleJourFuseau(instant, "Europe/Paris")).toBe("2026-08-24");
  });

  it("hiver : la frontière glisse à minuit UTC (UTC+1)", () => {
    // Décembre = heure d'hiver européenne (UTC+1). Minuit UTC = 01:00 à Paris.
    const avant = "2026-12-24T23:59:59Z";
    const apres = "2026-12-25T00:00:01Z";
    expect(cleJourFuseau(avant, "UTC")).toBe("2026-12-24");
    expect(cleJourFuseau(avant, "Europe/Paris")).toBe("2026-12-25");
    expect(cleJourFuseau(apres, "UTC")).toBe("2026-12-25");
    expect(cleJourFuseau(apres, "Europe/Paris")).toBe("2026-12-25");
  });

  it("accepte une Date comme une chaîne ISO", () => {
    const date = new Date("2026-08-24T23:30:00Z");
    expect(cleJourFuseau(date, "Europe/Paris")).toBe(
      cleJourFuseau("2026-08-24T23:30:00Z", "Europe/Paris"),
    );
  });
});
