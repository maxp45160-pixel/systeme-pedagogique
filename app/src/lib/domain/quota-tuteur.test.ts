import { describe, expect, it } from "vitest";
import { moisCourant, soldeQuota } from "./quota-tuteur";

/**
 * La règle de période, tenue des deux côtés.
 *
 * `consommer_quota_tuteur` la porte en SQL (`date_trunc('month', NOW())`), et
 * l'affichage la reporte ici. C'est la seule règle du quota qui existe en deux
 * exemplaires ; ces tests sont ce qui empêche les deux de diverger.
 */
describe("moisCourant", () => {
  it("rend le premier jour du mois, au format que PostgreSQL rend pour une DATE", () => {
    expect(moisCourant(new Date("2026-08-24T22:13:00Z"))).toBe("2026-08-01");
  });

  it("garde deux chiffres pour les mois d'un seul caractère", () => {
    expect(moisCourant(new Date("2026-01-31T23:59:59Z"))).toBe("2026-01-01");
    expect(moisCourant(new Date("2026-12-01T00:00:00Z"))).toBe("2026-12-01");
  });
});

describe("soldeQuota", () => {
  const now = new Date("2026-08-24T10:00:00Z");

  it("déduit les générations du mois en cours", () => {
    expect(
      soldeQuota({ quotaMensuel: 150, quotaPeriode: "2026-08-01", quotaAppels: 12 }, now),
    ).toEqual({ plafond: 150, restant: 138 });
  });

  it("ignore une période périmée : le compteur est déjà reparti en base", () => {
    /*
     * Sans cette règle, un compte inactif depuis deux mois lirait « 0 restant »
     * jusqu'à sa prochaine génération — un blocage affiché pour un quota qui,
     * côté SQL, se remet à zéro au premier appel qui constate le changement de
     * mois.
     */
    expect(
      soldeQuota({ quotaMensuel: 150, quotaPeriode: "2026-06-01", quotaAppels: 150 }, now),
    ).toEqual({ plafond: 150, restant: 150 });
  });

  it("traite l'absence de période comme un mois neuf", () => {
    expect(
      soldeQuota({ quotaMensuel: 150, quotaPeriode: null, quotaAppels: 0 }, now),
    ).toEqual({ plafond: 150, restant: 150 });
  });

  it("ne descend jamais sous zéro", () => {
    expect(
      soldeQuota({ quotaMensuel: 10, quotaPeriode: "2026-08-01", quotaAppels: 42 }, now).restant,
    ).toBe(0);
  });

  it("rend zéro restant quand un administrateur a fermé la clé serveur pour ce compte", () => {
    expect(
      soldeQuota({ quotaMensuel: 0, quotaPeriode: null, quotaAppels: 0 }, now),
    ).toEqual({ plafond: 0, restant: 0 });
  });
});
