import { describe, expect, it } from "vitest";
import { resumeCarriere } from "./carriere";
import { calculerActivite } from "./historique";
import type { ExerciseAttempt, LearningSession, SkillObservation } from "@/lib/domain/types";

const NOW = new Date("2026-08-16T12:00:00Z");

function observation(date: string): SkillObservation {
  return { id: `p-${date}`, skillCode: "LOG-01", date } as unknown as SkillObservation;
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
    const c = resumeCarriere({ sessions: [], tentatives: [], observations: [], now: NOW });
    expect(c.debut).toBeNull();
    expect(c.joursDepuisDebut).toBeNull();
  });

  it("compte zéro série — là le zéro est exact", () => {
    const c = resumeCarriere({ sessions: [], tentatives: [], observations: [], now: NOW });
    expect(c.meilleureSerie).toBe(0);
    expect(c.serieEnCours).toBe(0);
  });
});

describe("resumeCarriere — totaux", () => {
  it("retient l'observation la plus ancienne comme début", () => {
    const c = resumeCarriere({
      sessions: [],
      tentatives: [],
      observations: [observation("2026-08-14T10:00:00Z"), observation("2026-06-01T10:00:00Z"), observation("2026-07-02T10:00:00Z")],
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
      observations: [],
      now: NOW,
    });
    expect(c.seancesTotal).toBe(2);
    expect(c.minutesTotal).toBe(50);
  });

  it("ne compte pas une durée absente comme zéro travaillé, et n'invente rien", () => {
    const c = resumeCarriere({
      sessions: [seance({ statut: "terminee" })],
      tentatives: [],
      observations: [],
      now: NOW,
    });
    expect(c.seancesTotal).toBe(1);
    expect(c.minutesTotal).toBe(0);
  });

  it("ne compte comme exercice mené qu'une tentative terminée", () => {
    const c = resumeCarriere({
      sessions: [],
      tentatives: [tentative("terminee"), tentative("abandonnee"), tentative("en-cours"), tentative("terminee")],
      observations: [],
      now: NOW,
    });
    expect(c.exercicesMenes).toBe(2);
  });
});

describe("resumeCarriere — séries", () => {
  it("compte les jours distincts, pas les observations", () => {
    const c = resumeCarriere({
      sessions: [],
      tentatives: [],
      observations: [observation("2026-08-16T08:00:00Z"), observation("2026-08-16T19:00:00Z")],
      now: NOW,
    });
    expect(c.joursActifsTotal).toBe(1);
    expect(c.meilleureSerie).toBe(1);
  });

  it("retient la plus longue suite consécutive", () => {
    const c = resumeCarriere({
      sessions: [],
      tentatives: [],
      observations: [
        observation("2026-07-01T10:00:00Z"),
        observation("2026-07-02T10:00:00Z"),
        observation("2026-07-03T10:00:00Z"),
        // trou
        observation("2026-07-10T10:00:00Z"),
      ],
      now: NOW,
    });
    expect(c.meilleureSerie).toBe(3);
  });

  it("ne fait pas courir une série interrompue", () => {
    const c = resumeCarriere({
      sessions: [],
      tentatives: [],
      observations: [observation("2026-07-01T10:00:00Z"), observation("2026-07-02T10:00:00Z")],
      now: NOW,
    });
    expect(c.serieEnCours).toBe(0);
  });

  it("garde la série en cours quand la dernière observation date d'hier", () => {
    // Sinon la série tomberait à zéro chaque matin pour qui travaille le soir.
    const c = resumeCarriere({
      sessions: [],
      tentatives: [],
      observations: [observation("2026-08-14T21:00:00Z"), observation("2026-08-15T21:00:00Z")],
      now: NOW,
    });
    expect(c.serieEnCours).toBe(2);
  });

  it("garde la série en cours quand la dernière observation est du jour", () => {
    const c = resumeCarriere({
      sessions: [],
      tentatives: [],
      observations: [observation("2026-08-15T21:00:00Z"), observation("2026-08-16T09:00:00Z")],
      now: NOW,
    });
    expect(c.serieEnCours).toBe(2);
  });

  it("franchit un changement de mois sans casser la suite", () => {
    const c = resumeCarriere({
      sessions: [],
      tentatives: [],
      observations: [observation("2026-07-31T10:00:00Z"), observation("2026-08-01T10:00:00Z")],
      now: NOW,
    });
    expect(c.meilleureSerie).toBe(2);
  });
});

describe("resumeCarriere — le temps retenu lit la même reconstruction que la croissance", () => {
  /**
   * La friction du 25/08/2026 : « Temps travaillé » (carrière) sommait
   * `session.dureeMin` brut quand le bilan de croissance passait par
   * `tracesActivite` + plafonds d'ADR-071. Deux panneaux, deux chiffres pour
   * le même travail.
   */

  function tentativeReelle(
    id: string,
    statut: ExerciseAttempt["statut"],
    dureeMin: number,
    debut = "2026-08-10T09:00:00Z",
    fin = "2026-08-10T10:30:00Z",
  ): ExerciseAttempt {
    return { id, exerciseId: "ex-1", statut, dureeMin, debut, fin } as unknown as ExerciseAttempt;
  }

  const SEANCE_EXERCICE = seance({
    id: "ses-ex",
    statut: "terminee",
    activites: [{ type: "exercice", ref: "ex-1", libelle: "Exercice" }],
  });

  it("plafonne un abandon nocturne exactement comme la croissance le plafonne", () => {
    // Séance mono-exercice écrite au même geste qu'une tentative ouverte une
    // nuit : la séance porte 1015 min brutes, l'abandon ne retient que
    // l'estimation (20 min).
    const entrees = {
      sessions: [
        {
          ...SEANCE_EXERCICE,
          genereAutomatiquement: true,
          date: "2026-08-09T18:15:00Z",
          dureeMin: 1015,
        } as LearningSession,
      ],
      tentatives: [tentativeReelle("att-nuit", "abandonnee", 1015)],
      observations: [] as SkillObservation[],
      dureesEstimees: new Map([["ex-1", 20]]),
      now: NOW,
    };
    const carriere = resumeCarriere(entrees);
    expect(carriere.minutesTotal).toBe(20);

    // La même entrée lue par la reconstruction du bilan de croissance donne
    // exactement le même temps : un seul chiffre pour un seul travail.
    const activite = calculerActivite(
      [...entrees.sessions],
      NOW,
      [...entrees.tentatives],
      new Map(entrees.dureesEstimees),
    );
    expect(activite.minutesTotal).toBe(carriere.minutesTotal);
  });

  it("compte les tentatives menées à leur durée retenue, pas à la durée brute de la séance", () => {
    const carriere = resumeCarriere({
      sessions: [{ ...SEANCE_EXERCICE, dureeMin: 90 }],
      tentatives: [tentativeReelle("att-1", "terminee", 45)],
      observations: [],
      dureesEstimees: new Map([["ex-1", 60]]),
      now: NOW,
    });
    expect(carriere.minutesTotal).toBe(45);
    // Le comptage distinct des séances est préservé.
    expect(carriere.seancesTotal).toBe(1);
  });

  it("garde le repli historique des séances sans tentative (durée absente ≠ zéro inventé)", () => {
    const c = resumeCarriere({
      sessions: [seance({ statut: "terminee" })],
      tentatives: [],
      observations: [],
      dureesEstimees: new Map(),
      now: NOW,
    });
    expect(c.seancesTotal).toBe(1);
    expect(c.minutesTotal).toBe(0);
  });
});
