import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { RecommendedLearningAction, RecommendationFactor } from "@/lib/domain/adaptive-learning";
import type { Referentiel } from "@/lib/domain/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/store/actions", () => ({ refuserRecommandation: vi.fn(), creerExercice: vi.fn() }));
vi.mock("@/lib/store/seance-actions", () => ({ demarrerExerciceEnFocus: vi.fn(), planifierExerciceRecommande: vi.fn(), creerSeanceFocusExercice: vi.fn() }));

import { CarteProchaineAction } from "./prochaine-action";

const referentiel: Referentiel = { domaines: [], skills: [], actifs: [], parCode: new Map(), codesActifs: new Set(), domainesParId: new Map() };
const facteurs: RecommendationFactor[] = [
  { kind: "sequencement", label: "Un ordre possible parmi les activités." },
  { kind: "ressource-documentaire", label: "Ce cours est disponible pour commencer à travailler." },
];
const activite: RecommendedLearningAction = {
  candidateId: "ressource:livret", source: "activite", activityId: "ressource:livret", title: "Lire et structurer le cours", family: "entrainer",
  target: { skillCodes: [], goalIds: [], label: "Livret" }, durationMinutes: 30, segmented: false, workspace: "exercice-trois-actes",
  proposedMode: { focus: "equilibre", guidance: "equilibre", toolPower: "standards" }, factors: facteurs, constraints: [], reservations: [],
};
const props = { recommandations: [], referentiel, now: new Date("2026-09-15T12:00:00Z"), compteId: "qa", competencesGeneration: [], calibragesGeneration: {} };

describe("carte de prochaine action documentaire", () => {
  it("identifie une ressource, explique son choix et revient au tableau de bord après travail", () => {
    const html = renderToStaticMarkup(createElement(CarteProchaineAction, { ...props, activite, facteursInstant: facteurs }));
    expect(html).toContain("Étudier une ressource");
    expect(html).toContain("Travailler sur cette ressource");
    expect(html).toContain('data-nature="ressource"');
    const sousLeTitre = html.slice(html.indexOf("</h2>")).split("</p>")[0];
    expect(sousLeTitre).toContain(facteurs[1].label);
    expect(sousLeTitre).not.toContain(facteurs[0].label);
    expect(html).toContain("/atelier?note=livret&amp;retour=%2Fapp%3Fclassique%3D1");
    expect(html).not.toContain("Compétences ciblées");
  });

  it("explique un créneau sans proposition sans affirmer que tout est terminé", () => {
    const html = renderToStaticMarkup(createElement(CarteProchaineAction, props));
    expect(html).toContain("Pas encore de prochaine activité pour ce créneau");
    expect(html).toContain("ajuster le temps disponible");
    expect(html).not.toContain("Vous avez fait le tour");
    expect(html).toContain('href="/seances"');
  });
});
