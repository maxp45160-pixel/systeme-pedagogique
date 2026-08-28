import { describe, expect, it } from "vitest";
import type { Engagement } from "@/lib/domain/engagement";
import type { LearningSession, SkillState } from "@/lib/domain/types";
import {
  actionCandidateDepuisActionRecommandee,
  actionCandidateDepuisRecommandation,
  type ActionCandidate,
} from "./action-candidate";
import { planifierTemps, type PlanificateurTemporelInput } from "./planification-temporelle";
import type { Recommandation } from "./recommend";

const NOW = "2026-08-28T08:00:00.000Z";

function engagement(id: string, echeanceLe: string, codes: string[] = ["DEV-01"]): Engagement {
  return {
    id,
    type: "examen",
    libelle: `Échéance ${id}`,
    echeanceLe,
    codes,
  };
}

function state(
  code = "DEV-01",
  options: Partial<SkillState> = {},
): SkillState {
  return {
    skill: {
      code,
      intitule: code,
      domaine: "developpement",
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

function candidate(
  candidateId: string,
  overrides: Partial<ActionCandidate> = {},
): ActionCandidate {
  return {
    candidateId,
    source: "existing-activity",
    target: { skillCodes: ["DEV-01"], engagementIds: [] },
    intervention: "resolve",
    expectedEffect: "measurement",
    title: candidateId,
    durationMinutes: 30,
    reasons: [],
    constraints: [],
    reservations: [],
    ...overrides,
  };
}

function input(overrides: Partial<PlanificateurTemporelInput> = {}): PlanificateurTemporelInput {
  return {
    now: NOW,
    engagements: [],
    availability: [{ startsAt: NOW, endsAt: "2026-08-28T10:00:00.000Z", sourceRef: "agenda:matin" }],
    skillStates: [state()],
    candidates: [candidate("c-1")],
    refusObserved: [],
    acceptedSessions: [],
    ...overrides,
  };
}

function session(overrides: Partial<LearningSession> = {}): LearningSession {
  return {
    id: "ses-acceptee",
    date: "2026-08-28T08:30:00.000Z",
    domaines: ["developpement"],
    skillCodes: ["DEV-01"],
    activites: [],
    genereAutomatiquement: false,
    statut: "planifiee",
    planifieePour: "2026-08-28T08:30:00.000Z",
    blueprint: {
      dureeCibleMin: 60,
      nombreExercices: 0,
      portee: { type: "mono", domaine: "developpement" },
      cibles: [],
    },
    ...overrides,
  };
}

describe("planifierTemps — v0 pur et déterministe", () => {
  it("produit le même plan pour la même entrée", () => {
    const entree = input({
      engagements: [engagement("e-1", "2026-09-02")],
      candidates: [candidate("b"), candidate("a")],
    });
    expect(planifierTemps(entree)).toEqual(planifierTemps(entree));
  });

  it("ne fabrique aucun créneau sans disponibilité", () => {
    const plan = planifierTemps(input({ availability: [] }));
    expect(plan.slots).toEqual([]);
    expect(plan.constraints).toContain("aucune disponibilité déclarée exploitable");
  });

  it("protège la durée de créneau déclarée sans la confondre avec le réel", () => {
    const plan = planifierTemps(input({
      availability: [{ startsAt: "2026-08-28T08:30:00.000Z", endsAt: "2026-08-28T12:00:00.000Z", sourceRef: "agenda:matin" }],
      acceptedSessions: [session({ dureePlanifieeMin: 15, blueprint: undefined })],
    }));
    expect(plan.slots[0]?.plannedFor).toBe("2026-08-28T08:45:00.000Z");
  });

  it("ne planifie pas dans une disponibilité déjà passée", () => {
    const plan = planifierTemps(input({
      availability: [{
        startsAt: "2026-08-27T08:00:00.000Z",
        endsAt: "2026-08-27T10:00:00.000Z",
        sourceRef: "agenda:hier",
      }],
    }));
    expect(plan.slots).toEqual([]);
    expect(plan.reservations.join(" ")).toContain("déjà passé");
  });

  it("propose un diagnostic quand une échéance manque de preuve", () => {
    const plan = planifierTemps(input({
      engagements: [engagement("e-1", "2026-09-01")],
      candidates: [
        candidate("resolve", { target: { skillCodes: ["DEV-01"], engagementIds: ["e-1"] } }),
        candidate("diagnose", {
          intervention: "diagnose",
          target: { skillCodes: ["DEV-01"], engagementIds: ["e-1"] },
          expectedEffect: "preparation",
        }),
      ],
    }));
    expect(plan.slots[0].candidate.candidateId).toBe("diagnose");
    expect(plan.readiness[0].state).toBe("a-eclaircir");
  });

  it("départage deux échéances concurrentes par date puis identifiant", () => {
    const plan = planifierTemps(input({
      engagements: [
        engagement("e-loin", "2026-09-10", ["DEV-02"]),
        engagement("e-proche", "2026-09-01", ["DEV-01"]),
      ],
      skillStates: [state("DEV-01"), state("DEV-02")],
      candidates: [
        candidate("loin", { target: { skillCodes: ["DEV-02"], engagementIds: ["e-loin"] } }),
        candidate("proche", { target: { skillCodes: ["DEV-01"], engagementIds: ["e-proche"] } }),
      ],
    }));
    expect(plan.slots.map((slot) => slot.candidate.candidateId)).toEqual(["proche", "loin"]);
  });

  it("préserve un besoin continu lorsque la capacité le permet", () => {
    const plan = planifierTemps(input({
      candidates: [candidate("continu", { source: "declared-need" })],
    }));
    expect(plan.slots[0].candidate.source).toBe("declared-need");
    expect(plan.slots[0].reasons).toContain("besoin continu conservé quand la capacité le permet");
  });

  it("protège une séance acceptée et signale le conflit impossible", () => {
    const plan = planifierTemps(input({
      availability: [{
        startsAt: "2026-08-28T08:30:00.000Z",
        endsAt: "2026-08-28T09:30:00.000Z",
        sourceRef: "agenda:matin",
      }],
      acceptedSessions: [session()],
    }));
    expect(plan.slots).toEqual([]);
    expect(plan.constraints).toContain("séance acceptée protégée : ses-acceptee");
    expect(plan.reservations.join(" ")).toMatch(/aucun créneau compatible/);
  });

  it("respecte un refus observé sans pénaliser les autres candidates", () => {
    const plan = planifierTemps(input({
      candidates: [candidate("refuse"), candidate("autre")],
      refusObserved: [{
        candidateId: "refuse",
        skillCode: "DEV-01",
        observedAt: "2026-08-27T10:00:00.000Z",
        sourceRef: "refus:1",
      }],
    }));
    expect(plan.slots.map((slot) => slot.candidate.candidateId)).toEqual(["autre"]);
    expect(plan.reservations.join(" ")).toContain("refusée");
  });

  it("ignore un refus historique expiré selon l'instant fourni", () => {
    const plan = planifierTemps(input({
      refusObserved: [{
        candidateId: "c-1",
        observedAt: "2026-08-01T10:00:00.000Z",
        expiresAt: "2026-08-08T10:00:00.000Z",
        sourceRef: "refus:ancien",
      }],
    }));
    expect(plan.slots).toHaveLength(1);
  });

  it("ignore une séance manquée sans créer de pénalité", () => {
    const plan = planifierTemps(input({
      acceptedSessions: [session({ statut: "abandonnee" })],
    }));
    expect(plan.slots).toHaveLength(1);
    expect(plan.constraints.join(" ")).not.toMatch(/pénalité|échec/);
    expect(plan.reservations.join(" ")).not.toMatch(/pénalité|échec/);
  });

  it("recalcule la préparation après une nouvelle preuve", () => {
    const avant = planifierTemps(input({ engagements: [engagement("e-1", "2026-09-01")] }));
    const apres = planifierTemps(input({
      engagements: [engagement("e-1", "2026-09-01")],
      skillStates: [state("DEV-01", {
        niveau: 3,
        statut: "evalue",
        observations: [{ id: "obs-1" } as SkillState["observations"][number]],
      })],
    }));
    expect(avant.readiness[0].state).toBe("a-eclaircir");
    expect(apres.readiness[0].state).toBe("en-bonne-voie");
  });

  it("distingue niveau non estimable, renforcement et prêt qualitatif", () => {
    const pourCode = (code: string, id: string) => engagement(id, "2026-09-01", [code]);
    const plan = planifierTemps(input({
      engagements: [
        pourCode("non-evalue", "e-non"),
        pourCode("renforcer", "e-renforcer"),
        pourCode("pret", "e-pret"),
      ],
      skillStates: [
        state("non-evalue", { observations: [], niveau: null }),
        state("renforcer", {
          observations: [{ id: "obs-renforcer" } as SkillState["observations"][number]],
          niveau: null,
        }),
        state("pret", {
          observations: [{ id: "obs-pret" } as SkillState["observations"][number]],
          niveau: 5,
        }),
      ],
    }));
    expect(plan.readiness.map((item) => item.state)).toEqual([
      "a-eclaircir",
      "pret-d-apres-les-preuves-disponibles",
      "a-renforcer",
    ]);
  });

  it("ne modifie aucune entrée et n'effectue aucune écriture", () => {
    const entree = input();
    const copie = structuredClone(entree);
    const plan = planifierTemps(entree);
    expect(entree).toEqual(copie);
    expect(plan).not.toHaveProperty("persist");
  });
});

describe("adaptation des recommandations historiques", () => {
  it("adapte une recommandation d'exercice sans relancer recommander", () => {
    const recommandation = {
      etat: { skill: { code: "DEV-01" } },
      valeur: 1,
      facteurs: [{ libelle: "preuve absente", contribution: 1, phrase: "preuve absente" }],
      raison: "compétence à travailler",
      exercice: { id: "ex-1", titre: "Résoudre", competences: ["DEV-01"], dureeEstimeeMin: 30 },
      difficulteCible: 2,
      dureeEstimeeMin: 30,
      calibration: null,
    } as unknown as Recommandation;
    expect(actionCandidateDepuisRecommandation(recommandation)).toMatchObject({
      candidateId: "legacy-exercise:ex-1",
      intervention: "resolve",
      expectedEffect: "measurement",
    });
  });

  it("exige l'effet absent de recommendLearningAction au point d'adaptation", () => {
    const action = {
      candidateId: "a-1",
      source: "activite" as const,
      activityId: "act-1",
      title: "Lire",
      family: "explorer" as const,
      target: { skillCodes: ["DEV-01"], goalIds: [] },
      durationMinutes: 20,
      segmented: false,
      workspace: "exploration-guidee" as const,
      proposedMode: { focus: "epure" as const, guidance: "guide" as const, toolPower: "essentiels" as const },
      factors: [],
      constraints: [],
      reservations: [],
    };
    expect(actionCandidateDepuisActionRecommandee(action, { expectedEffect: "preparation" }).intervention)
      .toBe("read");
  });
});
