import { describe, it, expect } from "vitest";
import { cleTour } from "./onboarding-context";

describe("cleTour & isolation par compte", () => {
  const compte1 = "user-abc-123";
  const compte2 = "user-xyz-789";
  const tourId = "dashboard_v1";

  it("génère une clé préfixée et suffixée par l'identifiant du compte", () => {
    const cle = cleTour(tourId, compte1);
    expect(cle).toBe(`systeme-pedagogique:tour:${tourId}:${compte1}`);
  });

  it("isole strictement les clés entre deux comptes distincts pour un même tour", () => {
    const cleCompte1 = cleTour(tourId, compte1);
    const cleCompte2 = cleTour(tourId, compte2);

    expect(cleCompte1).not.toBe(cleCompte2);
    expect(cleCompte1.endsWith(compte1)).toBe(true);
    expect(cleCompte2.endsWith(compte2)).toBe(true);
  });

  it("différencie deux tours distincts pour un même compte", () => {
    const tourA = cleTour("tour_a", compte1);
    const tourB = cleTour("tour_b", compte1);

    expect(tourA).not.toBe(tourB);
  });

  it("permet de cibler et purger les clés de tours associées à un compte lors d'un reset", () => {
    const compte = "user-test-reset";
    const cles = [
      cleTour("demarrer_v2", compte),
      cleTour("dashboard_v1", compte),
      `systeme-pedagogique:cle-tuteur:${compte}`,
      `graphe:reglages:${compte}`,
      `systeme-pedagogique:tour:dashboard_v1:autre-compte`,
    ];

    const filtreSuppression = (k: string) =>
      k.includes(compte) && k !== `systeme-pedagogique:cle-tuteur:${compte}`;

    const supprimees = cles.filter(filtreSuppression);

    expect(supprimees).toContain(cleTour("demarrer_v2", compte));
    expect(supprimees).toContain(cleTour("dashboard_v1", compte));
    expect(supprimees).toContain(`graphe:reglages:${compte}`);
    expect(supprimees).not.toContain(`systeme-pedagogique:cle-tuteur:${compte}`);
    expect(supprimees).not.toContain(`systeme-pedagogique:tour:dashboard_v1:autre-compte`);
  });
});

