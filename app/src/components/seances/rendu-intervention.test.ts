import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { RenduIntervention } from "./rendu-intervention";
import { renduPourIntervention } from "@/lib/domain/intervention-rendus";
import { INTERVENTION_TYPES, type InterventionType } from "@/lib/domain/intervention-seance";
import type { Exercise } from "@/lib/domain/types";

vi.mock("@/components/exercices/vue-exercice", () => ({
  VueExercice: () => createElement("div", null, "Exercice intégré"),
}));
vi.mock("@/components/tuteur/tiroir-tuteur", () => ({
  TiroirTuteur: ({ libelle }: { libelle?: string }) => createElement("button", null, libelle),
}));

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

function executionPour(type: InterventionType) {
  const intervention = {
    id: `i-${type}`,
    type,
    label: `Geste ${type}`,
    estimatedDurationMinutes: 15,
    source: { kind: "document" as const, ref: "doc-1" },
    expectedEffect: type === "ask-for-help"
      ? "support" as const
      : type === "read" || type === "synthesize" || type === "produce" || type === "explain" || type === "recall"
        ? "preparation" as const
        : "measurement" as const,
    targetSkillCodes: ["DEV-01"],
  };
  return {
    intervention,
    rendu: renduPourIntervention(intervention),
    statut: "a-faire" as const,
  };
}

const exercice = {
  id: "ex-1",
  titre: "Exercice intégré",
  domaine: "developpement",
  type: "application",
  difficulte: 1,
  competences: ["DEV-01"],
  dureeEstimeeMin: 15,
  enonce: "Énoncé",
  indices: [],
  correction: "Correction",
  criteres: [],
  diagnostic: false,
  origine: "manuel",
} as Exercise;

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
      sourceHref: "/atelier?document=doc-1&retour=%2Fseances%3Fsession%3Ds-1",
      sourceLabel: "le document",
    }));
    expect(html).toContain("Lire");
    expect(html).toContain("≈ 15 min");
    expect(html).toContain("Document source");
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

  it("offre une restitution de mémoire sans la transformer en observation", () => {
    const item = {
      ...execution("read"),
      intervention: {
        ...execution("read").intervention,
        id: "i-recall",
        type: "recall" as const,
        label: "Rappeler le cours",
        source: { kind: "document" as const, ref: "doc-1" },
      },
      rendu: renduPourIntervention({ type: "recall" }),
    };
    const html = renderToStaticMarkup(createElement(RenduIntervention, {
      execution: item,
      seanceId: "s-1",
      plein: false,
      seancePeutTerminer: false,
      compteId: "u-1",
      codesCompetences: [],
      domainesExistants: [],
      competencesModale: [],
      calibragesModale: {},
      sourceHref: "/atelier?document=doc-1&retour=%2Fseances%3Fsession%3Ds-1",
      sourceLabel: "le document source",
    }));
    expect(html).toContain("Votre restitution de mémoire");
    expect(html).toContain("Cette restitution reste dans cette page");
    expect(html).toContain("Ouvrir le document source");
    expect(html).toContain("Déclarer l&#x27;intervention terminée");
  });

  it.each(INTERVENTION_TYPES)("déroule %s dans son parcours dédié", (type) => {
    const item = executionPour(type);
    const html = renderToStaticMarkup(createElement(RenduIntervention, {
      execution: item,
      seanceId: "s-1",
      plein: false,
      exercice: type === "resolve" || type === "diagnose" ? exercice : undefined,
      seancePeutTerminer: false,
      compteId: "u-1",
      codesCompetences: ["DEV-01"],
      domainesExistants: [],
      competencesModale: [],
      calibragesModale: {},
      sourceHref: "/atelier?document=doc-1&retour=%2Fseances%3Fsession%3Ds-1",
      sourceLabel: "le document source",
    }));
    expect(html).toContain(item.rendu.label.replaceAll("'", "&#x27;"));
    if (type === "resolve" || type === "diagnose") {
      expect(html).toContain("Exercice intégré");
    } else if (type === "explain") {
      expect(html).toContain("Ouvrir l&#x27;espace Feynman");
      expect(html).toContain("session=s-1");
      expect(html).toContain("intervention=i-explain");
    } else if (type === "recall") {
      expect(html).toContain("Votre restitution de mémoire");
      expect(html).toContain("Ouvrir le document source");
    } else if (type === "ask-for-help") {
      expect(html).toContain("Ouvrir le tuteur");
    } else {
      expect(html).toContain("Ouvrir le document source");
      expect(html).toContain("Déclarer l&#x27;intervention terminée");
    }
  });
});
