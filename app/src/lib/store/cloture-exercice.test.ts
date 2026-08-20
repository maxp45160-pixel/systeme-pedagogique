import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LearningSession, SkillObservation } from "@/lib/domain/types";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("./db", () => ({ dorsaleCompte: vi.fn() }));

import { cloreExerciceAtomiquement } from "./cloture-exercice";

const observation: SkillObservation = {
  id: "obs-1",
  skillCode: "DEV-01",
  date: "2026-08-20T12:00:00.000Z",
  type: "code",
  niveauObservation: "A",
  autonomie: "A3",
  qualite: "moyenne",
  resultat: "reussi",
  contexte: "Exercice",
  dimensions: { application: 0.8 },
  source: {
    kind: "exercice",
    ref: "ex-1",
    trace: { kind: "tentative", ref: "att-1" },
  },
};

const seance: LearningSession = {
  id: "ses-1",
  date: observation.date,
  dureeMin: 15,
  domaines: ["developpement"],
  skillCodes: ["DEV-01"],
  activites: [{ type: "exercice", ref: "ex-1", libelle: "Exercice" }],
  genereAutomatiquement: true,
};

describe("clôture transactionnelle d'un exercice", () => {
  const dorsale = { supabase: { rpc: mocks.rpc } } as never;

  beforeEach(() => vi.clearAllMocks());

  it("transmet la tentative exacte, ses observations et la séance dans un seul appel", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        appliquee: true,
        tentativeId: "att-1",
        observations: 1,
        seanceId: "ses-1",
        seanceCreee: true,
      },
      error: null,
    });

    await cloreExerciceAtomiquement({
      tentative: {
        id: "att-1",
        exerciseId: "ex-1",
        fin: observation.date,
        dureeMin: 15,
        statut: "terminee",
        resultat: "reussi",
        evaluation: { application: 0.8 },
      },
      observations: [observation],
      seance,
      seanceIdContexte: "ses-composee",
    }, dorsale);

    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("clore_exercice", {
      p_tentative: expect.objectContaining({ id: "att-1", exerciseId: "ex-1" }),
      p_observations: [observation],
      p_seance: seance,
      p_seance_id_contexte: "ses-composee",
    });
  });

  it("marque explicitement la séance hôte requise lors d'un abandon de séance", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        appliquee: true,
        tentativeId: "att-1",
        observations: 0,
        seanceId: "ses-composee",
        seanceCreee: false,
      },
      error: null,
    });

    await cloreExerciceAtomiquement({
      tentative: {
        id: "att-1",
        exerciseId: "ex-1",
        fin: observation.date,
        dureeMin: 2,
        statut: "abandonnee",
      },
      observations: [],
      seance: { ...seance, dureeMin: 2 },
      seanceIdContexte: "ses-composee",
      seanceHoteRequise: true,
    }, dorsale);

    expect(mocks.rpc).toHaveBeenCalledWith("clore_exercice", expect.objectContaining({
      p_tentative: expect.objectContaining({ seanceHoteRequise: true }),
      p_seance_id_contexte: "ses-composee",
    }));
  });

  it("refuse une réponse RPC invalide au lieu de supposer une réussite", async () => {
    mocks.rpc.mockResolvedValue({ data: { appliquee: "oui" }, error: null });

    await expect(cloreExerciceAtomiquement({
      tentative: {
        id: "att-1",
        exerciseId: "ex-1",
        fin: observation.date,
        dureeMin: 2,
        statut: "abandonnee",
      },
      observations: [],
      seance: { ...seance, dureeMin: 2 },
    }, dorsale)).rejects.toThrow(/clore_exercice/);
  });

  it("propage une erreur PostgreSQL sans repli", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: "23514", message: "Cette tentative est déjà close." },
    });

    await expect(cloreExerciceAtomiquement({
      tentative: {
        id: "att-1",
        exerciseId: "ex-1",
        fin: observation.date,
        dureeMin: 2,
        statut: "abandonnee",
      },
      observations: [],
      seance: { ...seance, dureeMin: 2 },
    }, dorsale)).rejects.toThrow(/23514/);
  });
});
