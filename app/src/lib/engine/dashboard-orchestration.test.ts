import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Engagement } from "@/lib/domain/engagement";
import type { LearningSession, SkillObservation, SkillState } from "@/lib/domain/types";
import { TableauBordOrchestration } from "@/components/dashboard/tableau-bord-orchestration";
import {
  construireVueTableauBordOrchestration,
} from "./dashboard-orchestration";
import { reordonnerEntrees } from "@/components/dashboard/tableau-bord-orchestration";

const NOW = new Date("2026-08-28T10:00:00.000Z");

function state(code = "THERMO-01", options: Partial<SkillState> = {}): SkillState {
  return {
    skill: {
      code,
      intitule: "Entropie et irréversibilités",
      domaine: "thermodynamique",
      palier: "fondamentaux",
      prerequis: [],
      importance: 0.5,
      ordre: 0,
      active: true,
      archive: false,
      origine: "utilisateur",
    },
    niveau: null,
    score: null,
    confiance: "nulle",
    robustesse: null,
    dimensions: {} as SkillState["dimensions"],
    observations: [],
    contextesTestes: [],
    derniereObservation: null,
    joursDepuisDerniereObservation: null,
    contradictions: [],
    prochaineEtape: "diagnostiquer",
    explication: { resume: "", facteurs: [], nombreObservations: 0, reserves: [] },
    statut: "non-evalue",
    ...options,
  };
}

function engagement(codes = ["THERMO-01"]): Engagement {
  return {
    id: "exam-1",
    type: "examen",
    libelle: "Examen de thermodynamique",
    echeanceLe: "2026-09-12T09:00:00.000Z",
    codes,
  };
}

function session(id: string, plannedFor: string): LearningSession {
  return {
    id,
    date: plannedFor,
    domaines: ["thermodynamique"],
    skillCodes: ["THERMO-01"],
    activites: [],
    interventions: [{
      id: `${id}-diagnose`,
      type: "diagnose",
      label: "Vérifier les bases en thermodynamique",
      estimatedDurationMinutes: 25,
      source: { kind: "engagement", ref: "exam-1" },
      targetSkillCodes: ["THERMO-01"],
      expectedEffect: "measurement",
    }],
    genereAutomatiquement: false,
    statut: "planifiee",
    planifieePour: plannedFor,
  };
}

function observation(): SkillObservation {
  return {
    id: "proof-1",
    skillCode: "THERMO-01",
    date: "2026-08-26T09:00:00.000Z",
    type: "exercice",
    niveauObservation: "B",
    autonomie: "A2",
    qualite: "moyenne",
    resultat: "reussi",
    contexte: "Premier principe — QCM",
    dimensions: {},
    source: { kind: "exercice", ref: "exercise-1" },
  };
}

function view(overrides: Partial<Parameters<typeof construireVueTableauBordOrchestration>[0]> = {}) {
  return construireVueTableauBordOrchestration({
    now: NOW,
    sessions: [],
    engagements: [],
    skillStates: [state()],
    recommendations: [],
    ...overrides,
  });
}

describe("tableau de bord orchestration — rendu et interaction", () => {
  it("garde une invitation courte sans séance acceptée", () => {
    const result = view();
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].label).toContain("Temps disponible");
    expect(result.entries[0].label).not.toContain("%");
  });

  it("rend une séance acceptée aujourd'hui et la suite séparément", () => {
    const result = view({
      sessions: [session("today", "2026-08-28T14:30:00.000Z"), session("later", "2026-08-29T18:00:00.000Z")],
    });
    expect(result.entries[0]).toMatchObject({ type: "diagnose", effect: "measurement" });
    expect(result.entries[0].timeLabel).toMatch(/:30$/);
    expect(result.weekEntries[0].sessionId).toBe("later");
    expect(result.acceptedWeekCount).toBe(2);
  });

  it("fait remonter une séance déjà en cours comme action courante", () => {
    const result = view({
      sessions: [{ ...session("active", "2026-08-28T08:30:00.000Z"), statut: "en-cours" }, session("later", "2026-08-28T18:00:00.000Z")],
    });
    expect(result.entries[0]).toMatchObject({ sessionId: "active", state: "current" });
  });

  it("expose l'absence de preuve sans la transformer en niveau", () => {
    const result = view({ engagements: [engagement()] });
    expect(result.deadline).toMatchObject({ state: "a-eclaircir", evidenceCount: 0 });
    expect(result.deadline?.unknowns).toContain("Entropie et irréversibilités");
    expect(result.deadline?.proofs).toEqual([]);
  });

  it("relit les preuves récentes dans l'échéance sans score", () => {
    const result = view({
      engagements: [engagement()],
      skillStates: [state("THERMO-01", { niveau: 3, observations: [observation()] })],
    });
    expect(result.deadline).toMatchObject({ state: "en-bonne-voie", evidenceCount: 1 });
    expect(result.deadline?.proofs[0].label).toBe("Premier principe — QCM");
    expect(JSON.stringify(result)).not.toContain("%");
  });

  it("réordonne au clavier via les commandes explicites", () => {
    const entries = view({ sessions: [session("a", "2026-08-28T14:30:00.000Z"), session("b", "2026-08-28T18:00:00.000Z")] }).entries;
    const reordered = reordonnerEntrees(entries, "b:b-diagnose", "up");
    expect(reordered.map((entry) => entry.sessionId)).toEqual(["b", "a"]);
  });

  it("rend la hiérarchie journée / échéance / semaine et des commandes accessibles", () => {
    const markup = renderToStaticMarkup(createElement(TableauBordOrchestration, { view: view({ engagements: [engagement()] }) }));
    expect(markup).toContain("Votre journée");
    expect(markup).toContain("Examen de thermodynamique");
    expect(markup).toContain("Voir la suite de la semaine");
    expect(markup).toContain("Changer l");
    expect(markup).toContain("Jours de la semaine");
  });

  it("garde une déclaration d'échéance accessible quand aucune n'est présente", () => {
    const markup = renderToStaticMarkup(createElement(TableauBordOrchestration, { view: view() }));
    expect(markup).toContain("Déclarer une échéance");
    expect(markup).toContain("Voir les séances");
  });

  it("expose une entrée unique vers la revue groupée quand un diff est fourni", () => {
    const markup = renderToStaticMarkup(createElement(TableauBordOrchestration, {
      view: view(),
      revision: {
        diff: { changes: [], silentCandidateIds: [], conflicts: [], constraints: [], reservations: [] },
        onAppliquer: () => undefined,
        onModifier: () => undefined,
        onGarder: () => undefined,
      },
    }));
    expect(markup).toContain("Revoir les changements");
  });
});
