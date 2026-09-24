import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { DonneesSeance } from "./concepteur-seance";
import type { LearningSession } from "@/lib/domain/types";
import { jourDeLaSeance } from "@/lib/domain/pages-cahier";

vi.mock("@/lib/store/actions", () => ({ ajouterNoteSession: vi.fn() }));
vi.mock("@/components/seances/concepteur-seance", () => ({ ConcepteurSeance: () => null }));
vi.mock("@/components/intention/bouton-intention", () => ({ RappelNouveauBesoin: () => null }));

import { CahierSeances, LigneCahier } from "./cahier-seances";

const donnees = { exercices: [], tentatives: [] } as unknown as DonneesSeance;
const seance: LearningSession = {
  id: "ses-travail-doc-1",
  date: "2026-09-24T15:42:00.000Z",
  domaines: [],
  skillCodes: [],
  activites: [],
  interventions: [{
    id: "intervention-1",
    type: "synthesize",
    label: "Synthétiser « Notes de logique »",
    source: { kind: "document", ref: "depot-logique" },
    expectedEffect: "preparation",
    statut: "completed",
  }],
  notePersonnelle: "J’ai rapproché les deux démonstrations.",
  genereAutomatiquement: false,
  statut: "terminee",
};

describe("Cahier des travaux documentaires", () => {
  it("montre le geste et la fiche liée sans présenter zéro exercice", () => {
    const html = renderToStaticMarkup(createElement(LigneCahier, { seance, donnees }));
    expect(html).toContain("Travail sur ressources");
    expect(html).toContain("1 ressource");
    expect(html).toContain("Synthétiser « Notes de logique »");
    expect(html).toContain("/atelier?document=depot-logique");
    expect(html).toContain("sans évaluation des compétences");
    expect(html).not.toContain("0 exercice");
    expect(html).not.toContain("Voir le détail de la séance");
  });

  it("retrouve la séance par le libellé de l'intervention", () => {
    const trouve = renderToStaticMarkup(createElement(CahierSeances, {
      seances: [seance], donnees, recherche: "logique",
    }));
    expect(trouve).toContain("Synthétiser « Notes de logique »");
    const absent = renderToStaticMarkup(createElement(CahierSeances, {
      seances: [seance], donnees, recherche: "thermodynamique",
    }));
    expect(absent).toContain("Aucun résultat");
    expect(absent).not.toContain("Synthétiser « Notes de logique »");
  });

  it("range un instant proche de minuit selon le jour local du Cahier", () => {
    vi.stubEnv("TZ", "Europe/Paris");
    try {
      const tardive = { ...seance, date: "2026-09-24T22:30:00.000Z" };
      expect(jourDeLaSeance(tardive)).toBe("2026-09-25");
      const html = renderToStaticMarkup(createElement(CahierSeances, { seances: [tardive], donnees }));
      expect(html).toContain("25 sept");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("ne présente pas une intervention abandonnée comme du travail accompli", () => {
    const abandonnee: LearningSession = {
      ...seance,
      statut: "abandonnee",
      interventions: [{ ...seance.interventions![0], statut: "abandoned" }],
    };
    const html = renderToStaticMarkup(createElement(LigneCahier, { seance: abandonnee, donnees }));
    expect(html).toContain("Séance documentaire");
    expect(html).toContain("Ressources de la séance");
    expect(html).not.toContain("Ressources travaillées");
  });

  it("conserve le détail des autres séances documentaires qui peuvent porter un contrat de preuve", () => {
    const avecCible: LearningSession = { ...seance, skillCodes: ["MAT-01"] };
    const html = renderToStaticMarkup(createElement(LigneCahier, { seance: avecCible, donnees }));
    expect(html).toContain("Séance documentaire");
    expect(html).toContain("Voir le détail de la séance");
    expect(html).not.toContain("Travail déclaré, sans évaluation");
  });
});
