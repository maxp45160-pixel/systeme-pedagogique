import { describe, expect, it } from "vitest";
import { resumeCarriere } from "./carriere";
import type { ExerciseAttempt, LearningSession, SkillEvidence } from "@/lib/domain/types";

const NOW = new Date("2026-08-16T12:00:00Z");

function preuve(date: string): SkillEvidence {
  return { id: `p-${date}`, skillCode: "LOG-01", date } as unknown as SkillEvidence;
}

function seance(surcharge: Partial<LearningSession> = {}): LearningSession {
  return {
    id: "ses-1",
    date: "2026-08-10T09:00:00Z",
    domaines: [],
    skillCodes: [],
    activites: [],
    genereAutomatiquement: false,
    ...surcharge,
  } as LearningSession;
}

function tentative(statut: ExerciseAttempt["statut"]): ExerciseAttempt {
  return { id: `att-${statut}`, statut } as unknown as ExerciseAttempt;
}

describe("resumeCarriere — une carrière qui n'a pas commencé", () => {
  it("ne fabrique ni date de début ni durée", () => {
    const c = resumeCarriere({ sessions: [], tentatives: [], preuves: [], now: NOW });
    expect(c.debut).toBeNull();
    expect(c.joursDepuisDebut).toBeNull();
  });

  it("compte zéro série — là le zéro est exact", () => {
    const c = resumeCarriere({ sessions: [], tentatives: [], preuves: [], now: NOW });
    expect(c.meilleureSerie).toBe(0);
    expect(c.serieEnCours).toBe(0);
  });
});

describe("resumeCarriere — totaux", () => {
  it("retient la preuve la plus ancienne comme début", () => {
    const c = resumeCarriere({
      sessions: [],
      tentatives: [],
      preuves: [preuve("2026-08-14T10:00:00Z"), preuve("2026-06-01T10:00:00Z"), preuve("2026-07-02T10:00:00Z")],
      now: NOW,
    });
    expect(c.debut).toBe("2026-06-01T10:00:00Z");
    expect(c.joursDepuisDebut).toBeGreaterThan(70);
  });

  it("ne compte pas une séance seulement planifiée", () => {
    const c = resumeCarriere({
      sessions: [
        seance({ id: "a", statut: "terminee", dureeMin: 30 }),
        seance({ id: "b", statut: "planifiee", dureeMin: 90 }),
        seance({ id: "c", statut: "en-cours", dureeMin: 20 }),
      ],
      tentatives: [],
      preuves: [],
      now: NOW,
    });
    expect(c.seancesTotal).toBe(2);
    expect(c.minutesTotal).toBe(50);
  });

  it("ne compte pas une durée absente comme zéro travaillé, et n'invente rien", () => {
    const c = resumeCarriere({
      sessions: [seance({ statut: "terminee" })],
      tentatives: [],
      preuves: [],
      now: NOW,
    });
    expect(c.seancesTotal).toBe(1);
    expect(c.minutesTotal).toBe(0);
  });

  it("ne compte comme exercice mené qu'une tentative terminée", () => {
    const c = resumeCarriere({
      sessions: [],
      tentatives: [tentative("terminee"), tentative("abandonnee"), tentative("en-cours"), tentative("terminee")],
      preuves: [],
      now: NOW,
    });
    expect(c.exercicesMenes).toBe(2);
  });
});

describe("resumeCarriere — séries", () => {
  it("compte les jours distincts, pas les preuves", () => {
    const c = resumeCarriere({
      sessions: [],
      tentatives: [],
      preuves: [preuve("2026-08-16T08:00:00Z"), preuve("2026-08-16T19:00:00Z")],
      now: NOW,
    });
    expect(c.joursActifsTotal).toBe(1);
    expect(c.meilleureSerie).toBe(1);
  });

  it("retient la plus longue suite consécutive", () => {
    const c = resumeCarriere({
      sessions: [],
      tentatives: [],
      preuves: [
        preuve("2026-07-01T10:00:00Z"),
        preuve("2026-07-02T10:00:00Z"),
        preuve("2026-07-03T10:00:00Z"),
        // trou
        preuve("2026-07-10T10:00:00Z"),
      ],
      now: NOW,
    });
    expect(c.meilleureSerie).toBe(3);
  });

  it("ne fait pas courir une série interrompue", () => {
    const c = resumeCarriere({
      sessions: [],
      tentatives: [],
      preuves: [preuve("2026-07-01T10:00:00Z"), preuve("2026-07-02T10:00:00Z")],
      now: NOW,
    });
    expect(c.serieEnCours).toBe(0);
  });

  it("garde la série en cours quand la dernière preuve date d'hier", () => {
    // Sinon la série tomberait à zéro chaque matin pour qui travaille le soir.
    const c = resumeCarriere({
      sessions: [],
      tentatives: [],
      preuves: [preuve("2026-08-14T21:00:00Z"), preuve("2026-08-15T21:00:00Z")],
      now: NOW,
    });
    expect(c.serieEnCours).toBe(2);
  });

  it("garde la série en cours quand la dernière preuve est du jour", () => {
    const c = resumeCarriere({
      sessions: [],
      tentatives: [],
      preuves: [preuve("2026-08-15T21:00:00Z"), preuve("2026-08-16T09:00:00Z")],
      now: NOW,
    });
    expect(c.serieEnCours).toBe(2);
  });

  it("franchit un changement de mois sans casser la suite", () => {
    const c = resumeCarriere({
      sessions: [],
      tentatives: [],
      preuves: [preuve("2026-07-31T10:00:00Z"), preuve("2026-08-01T10:00:00Z")],
      now: NOW,
    });
    expect(c.meilleureSerie).toBe(2);
  });
});
