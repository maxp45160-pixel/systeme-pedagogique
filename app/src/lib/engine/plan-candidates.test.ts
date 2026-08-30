import { describe, expect, it } from "vitest";
import type { Engagement } from "@/lib/domain/engagement";
import type { ExerciseAttempt, LearningSession, SkillState } from "@/lib/domain/types";
import type { ActionCandidate } from "./action-candidate";
import type { Recommandation } from "./recommend";
import { composerCandidatsPlan } from "./plan-candidates";
import { planifierTemps } from "./planification-temporelle";

const ACTIVE_CODES = new Set(["DEV-01", "DEV-02", "MATH-01", "PHY-01"]);

function state(code: string, observed = false): SkillState {
  return {
    skill: {
      code,
      intitule: code,
      domaine: "developpement",
      palier: "fondamentaux",
      prerequis: [],
      importance: 1,
      ordre: 0,
      active: true,
      archive: false,
      origine: "utilisateur",
    },
    niveau: observed ? 2 : null,
    score: observed ? 2 : null,
    confiance: observed ? "moyenne" : "nulle",
    robustesse: observed ? 1 : null,
    dimensions: {} as SkillState["dimensions"],
    observations: observed ? [{ id: `obs:${code}` } as SkillState["observations"][number]] : [],
    contextesTestes: [],
    derniereObservation: observed ? "2026-08-28T08:00:00.000Z" : null,
    joursDepuisDerniereObservation: observed ? 1 : null,
    contradictions: [],
    prochaineEtape: observed ? "consolider" : "diagnostiquer",
    explication: { resume: "", facteurs: [], nombreObservations: observed ? 1 : 0, reserves: [] },
    statut: observed ? "evalue" : "non-evalue",
  };
}

function engagement(id: string, code: string, echeanceLe: string): Engagement {
  return { id, type: "examen", libelle: id, echeanceLe, codes: [code] };
}

function recommendation(id: string, code: string): Recommandation {
  return {
    etat: state(code),
    valeur: 10,
    facteurs: [],
    raison: "Recommandation historique",
    exercice: {
      id,
      titre: `Exercice ${id}`,
      competences: [code],
      dureeEstimeeMin: 20,
      diagnostic: false,
    } as Recommandation["exercice"],
    difficulteCible: 2,
    dureeEstimeeMin: 20,
    calibration: null,
  };
}

function candidate(id: string, code: string, overrides: Partial<ActionCandidate> = {}): ActionCandidate {
  return {
    candidateId: id,
    source: "course-protocol",
    target: { skillCodes: [code], engagementIds: [] },
    intervention: "resolve",
    expectedEffect: "measurement",
    title: id,
    durationMinutes: 20,
    reasons: ["Cours actif"],
    constraints: [],
    reservations: [],
    courseProtocolOrigin: {
      courseDocumentId: "cours-1",
      sourceAttachmentId: "pdf-1",
      domainId: "developpement",
      dimension: "application",
      instruction: "Consigne relue.",
    },
    ...overrides,
  };
}

function session(overrides: Partial<LearningSession> = {}): LearningSession {
  return {
    id: "session-1",
    date: "2026-08-28T08:00:00.000Z",
    domaines: ["developpement"],
    skillCodes: ["DEV-01"],
    activites: [],
    genereAutomatiquement: false,
    statut: "terminee",
    ...overrides,
  };
}

function attempt(overrides: Partial<ExerciseAttempt> = {}): ExerciseAttempt {
  return {
    id: "attempt-1",
    exerciseId: "diag-1",
    debut: "2026-08-28T08:00:00.000Z",
    fin: "2026-08-28T08:20:00.000Z",
    dureeMin: 20,
    indicesUtilises: 0,
    reponse: "réponse",
    evaluation: {},
    resultat: "reussi",
    statut: "terminee",
    ...overrides,
  };
}

describe("composition des producteurs de candidats", () => {
  it("ne laisse entrer que les compétences du référentiel actif", () => {
    const result = composerCandidatsPlan({
      recommandations: [recommendation("ex-1", "DEV-01"), recommendation("ex-2", "INVENTE-99")],
      sessions: [],
      codesCompetenceActifs: ACTIVE_CODES,
    });

    expect(result.candidates.map((item) => item.target.skillCodes)).toEqual([["DEV-01"]]);
    expect(result.reservations.join(" ")).toContain("hors référentiel actif");
  });

  it("met en réserve un besoin déclaré sans compétence plutôt que de créer une séance vide", () => {
    const result = composerCandidatsPlan({
      recommandations: [],
      sessions: [session({
        id: "besoin-sans-code",
        besoinDeclare: {
          codesVises: [],
          tempsDisponibleMin: 20,
          declareLe: "2026-08-28T07:00:00.000Z",
        },
      })],
      codesCompetenceActifs: ACTIVE_CODES,
    });

    expect(result.candidates).toEqual([]);
    expect(result.reservations.join(" ")).toContain("aucune compétence visée");
  });

  it("déduit des identifiants stables et fusionne les provenances équivalentes", () => {
    const besoin = session({
      id: "besoin-1",
      besoinDeclare: {
        intention: "Réviser les bases",
        codesVises: ["DEV-01"],
        tempsDisponibleMin: 20,
        declareLe: "2026-08-28T07:00:00.000Z",
      },
    });
    const input = {
      recommandations: [recommendation("ex-1", "DEV-01")],
      sessions: [besoin],
      engagements: [engagement("e-1", "DEV-01", "2026-09-02")],
      etats: [state("DEV-01", true)],
      codesCompetenceActifs: ACTIVE_CODES,
    };

    const first = composerCandidatsPlan(input);
    const second = composerCandidatsPlan({ ...input, recommandations: [...input.recommandations] });
    expect(first).toEqual(second);
    expect(first.candidates).toHaveLength(1);
    expect(first.candidates[0]).toMatchObject({
      candidateId: "declared-need:besoin-1",
      source: "declared-need",
      target: { skillCodes: ["DEV-01"], engagementIds: ["e-1"] },
    });
    expect(first.candidates[0].reasons).toContain("Recommandation historique");
  });

  it("écarte une séance active et le diagnostic terminé sans inventer de mesure", () => {
    const result = composerCandidatsPlan({
      recommandations: [recommendation("ex-1", "DEV-01")],
      sessions: [session({
        statut: "en-cours",
        activites: [{ type: "exercice", ref: "ex-1", libelle: "Exercice ex-1" }],
      })],
      candidatsProtocole: [candidate("course-1", "DEV-02")],
      codesCompetenceActifs: ACTIVE_CODES,
    });
    expect(result.candidates.map((item) => item.candidateId)).toEqual(["course-1"]);

    const courseSession = session({
      statut: "planifiee",
      blueprint: {
        dureeCibleMin: 20,
        nombreExercices: 1,
        portee: { type: "mono", domaine: "developpement" },
        cibles: [],
        origine: {
          genre: "protocole-cours",
          ficheId: "cours-1",
          pieceId: "pdf-1",
          titre: "Cours déjà planifié",
          dimension: "application",
        },
      },
    });
    const courseAlreadyPlanned = composerCandidatsPlan({
      recommandations: [],
      sessions: [courseSession],
      candidatsProtocole: [candidate("course-already-planned", "DEV-01", {
        title: "Cours déjà planifié",
      })],
      codesCompetenceActifs: ACTIVE_CODES,
    });
    expect(courseAlreadyPlanned.candidates).toEqual([]);
    expect(courseAlreadyPlanned.reservations.join(" ")).toContain("déjà planifiée");

    const diagnostic = recommendation("diag-1", "DEV-01");
    diagnostic.exercice!.diagnostic = true;
    const apresDiagnostic = composerCandidatsPlan({
      recommandations: [diagnostic],
      sessions: [],
      tentatives: [attempt()],
      codesCompetenceActifs: ACTIVE_CODES,
    });
    expect(apresDiagnostic.candidates).toEqual([]);
    expect(apresDiagnostic.reservations.join(" ")).toContain("diagnostic déjà terminé");
  });

  it("arbitre échéance proche, besoin déclaré, cours actif et recommandation historique", () => {
    const result = composerCandidatsPlan({
      recommandations: [recommendation("historique", "DEV-01")],
      sessions: [session({
        id: "besoin-1",
        besoinDeclare: {
          codesVises: ["MATH-01"],
          tempsDisponibleMin: 20,
          declareLe: "2026-08-28T07:00:00.000Z",
        },
      })],
      engagements: [
        engagement("e-proche", "PHY-01", "2026-08-29"),
        engagement("e-besoin", "MATH-01", "2026-09-02"),
      ],
      etats: [state("MATH-01", true), state("DEV-01"), state("PHY-01")],
      candidatsProtocole: [candidate("cours-actif", "PHY-01")],
      codesCompetenceActifs: ACTIVE_CODES,
    });
    const plan = planifierTemps({
      now: "2026-08-28T08:00:00.000Z",
      engagements: [
        engagement("e-proche", "PHY-01", "2026-08-29"),
        engagement("e-besoin", "MATH-01", "2026-09-02"),
      ],
      availability: [{
        startsAt: "2026-08-28T08:00:00.000Z",
        endsAt: "2026-08-28T09:20:00.000Z",
        sourceRef: "disponibilite:test",
      }],
      skillStates: [state("MATH-01"), state("DEV-01"), state("PHY-01")],
      candidates: result.candidates,
      candidateReservations: result.reservations,
      refusObserved: [],
      acceptedSessions: [],
    });

    expect(plan.slots.map((slot) => slot.candidate.candidateId)).toEqual([
      "cours-actif",
      "declared-need:besoin-1",
      "legacy-exercise:historique",
    ]);
    expect(plan.slots[0]?.candidate.courseProtocolOrigin).toMatchObject({
      courseDocumentId: "cours-1",
      sourceAttachmentId: "pdf-1",
    });
    expect(plan.slots[0]?.candidate.source).toBe("course-protocol");
    expect(plan.slots[0]?.candidate.target.engagementIds).toEqual(["e-proche"]);
  });
});
