import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { RenduIntervention } from "./rendu-intervention";
import { renduPourIntervention } from "@/lib/domain/intervention-rendus";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
}));

function execution(type: "read" | "synthesize") {
  const intervention = {
    id: `i-${type}`,
    type,
    label: type === "read" ? "Lire le support" : "Synthétiser le support",
    estimatedDurationMinutes: 15,
    source: { kind: "document" as const, ref: "doc-1" },
    expectedEffect: "preparation" as const,
  };
  return {
    intervention,
    rendu: renduPourIntervention(intervention),
    statut: "a-faire" as "a-faire" | "terminee",
  };
}

describe("rendu multi-interventions", () => {
  it("affiche le contrat de métadonnées et le chemin documentaire", () => {
    const html = renderToStaticMarkup(createElement(RenduIntervention, {
      execution: execution("read"),
      seanceId: "s-1",
      plein: false,
      exercice: undefined,
      seancePeutTerminer: false,
      compteId: "u-1",
      codesCompetences: [],
      domainesExistants: [],
      competencesModale: [],
      calibragesModale: {},
    }));
    expect(html).toContain("Lire");
    expect(html).toContain("≈ 15 min");
    expect(html).toContain("Document · doc-1");
    expect(html).toContain("Préparation");
    expect(html).toContain("Ouvrir le document");
    expect(html).toContain("Déclarer l&#x27;intervention terminée");
  });

  it("dit explicitement qu'une préparation terminée ne produit pas de mesure", () => {
    const item = execution("synthesize");
    item.statut = "terminee";
    const html = renderToStaticMarkup(createElement(RenduIntervention, {
      execution: item,
      seanceId: "s-1",
      plein: false,
      seancePeutTerminer: true,
      compteId: "u-1",
      codesCompetences: [],
      domainesExistants: [],
      competencesModale: [],
      calibragesModale: {},
    }));
    expect(html).toContain("aucune nouvelle mesure n&#x27;a été produite");
  });
});
