import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { EntreesCahier } from "./bureau";
import type { LearningSession } from "@/lib/domain/types";
import { SeancesAVenir } from "./seances-a-venir";
import { vueInitialeDepuisParametres } from "./cahier-interactif";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

function session(overrides: Partial<LearningSession> = {}): LearningSession {
  return {
    id: "ses-clavier",
    date: "2026-08-28T09:00:00.000Z",
    domaines: ["developpement"],
    skillCodes: ["DEV-01"],
    activites: [],
    genereAutomatiquement: false,
    statut: "planifiee",
    planifieePour: "2026-08-28T09:00:00.000Z",
    dureePlanifieeMin: 30,
    interventions: [{
      id: "int-clavier",
      type: "resolve",
      label: "Résoudre un cas",
      source: { kind: "exercise", ref: "ex-1" },
      expectedEffect: "measurement",
    }],
    ...overrides,
  };
}

describe("sélection de vue de /seances", () => {
  it("ouvre À venir par défaut et conserve les liens historiques explicites", () => {
    expect(vueInitialeDepuisParametres({})).toBe("avenir");
    expect(vueInitialeDepuisParametres({ vueDemandee: "cahier" })).toBe("cahier");
    expect(vueInitialeDepuisParametres({ recherche: "thermo" })).toBe("cahier");
    expect(vueInitialeDepuisParametres({ jourExplicite: true })).toBe("bureau");
    expect(vueInitialeDepuisParametres({ vueDemandee: "bureau" })).toBe("bureau");
  });

  it("rend des contrôles natifs navigables au clavier et conserve le lien profond", () => {
    const seance = session();
    const entrees = {
      seances: [seance],
      tentatives: [],
      donnees: { domaines: [] } as unknown as EntreesCahier["donnees"],
      notes: [],
    } satisfies EntreesCahier;
    const html = renderToStaticMarkup(
      createElement(SeancesAVenir, {
        entrees,
        compteId: "compte-test",
        onOuvrirHistorique: () => undefined,
      }),
    );

    expect(html).toContain('data-testid="seances-a-venir"');
    expect(html).toContain("Déplacer");
    expect(html).toContain("Annuler");
    expect(html).toContain("/seances?session=ses-clavier");
    expect(html).toContain("Préparer autre chose");
    expect(html).toContain("aria-expanded=\"false\"");
    expect(html).toContain("<button");
    expect(html).toContain("<a");
  });
});
