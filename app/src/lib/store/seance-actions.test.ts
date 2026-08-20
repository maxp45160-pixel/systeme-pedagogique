import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Exercise, LearningSession } from "@/lib/domain/types";

const mocks = vi.hoisted(() => ({
  ajouter: vi.fn(),
  dorsaleCompte: vi.fn(),
  lire: vi.fn(),
  modifier: vi.fn(),
  nouvelId: vi.fn(),
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("./db", () => ({
  ajouter: mocks.ajouter,
  dorsaleCompte: mocks.dorsaleCompte,
  lire: mocks.lire,
  modifier: mocks.modifier,
  nouvelId: mocks.nouvelId,
}));
vi.mock("./supabase-backend", () => ({ verifier: vi.fn() }));
vi.mock("@/lib/seed/exercises", () => ({ EXERCICES_DIAGNOSTIC: [] }));

import { creerSeanceFocusExercice } from "./seance-actions";

const EXERCICE: Exercise = {
  id: "ex-focus",
  titre: "Exercice focus",
  domaine: "developpement",
  type: "application",
  difficulte: 2,
  competences: ["DEV-01"],
  dureeEstimeeMin: 15,
  enonce: "Énoncé",
  indices: [],
  correction: "Correction",
  criteres: [],
  diagnostic: false,
  origine: "manuel",
};

const SEANCE_EXISTANTE = {
  id: "ses-existante",
  date: "2026-08-20T10:33:31.278Z",
  domaines: ["developpement"],
  skillCodes: ["DEV-01"],
  activites: [{ type: "exercice", ref: EXERCICE.id, libelle: EXERCICE.titre }],
  genereAutomatiquement: false,
  statut: "en-cours",
} as LearningSession;

describe("création d'une séance focus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.dorsaleCompte.mockResolvedValue({});
    mocks.nouvelId.mockReturnValue("ses-nouvelle");
  });

  it("réutilise la séance déjà ouverte quand le CTA est soumis de nouveau", async () => {
    mocks.lire.mockImplementation(async (collection: string) =>
      collection === "exercises" ? [EXERCICE] : [SEANCE_EXISTANTE],
    );

    await expect(creerSeanceFocusExercice(EXERCICE.id)).resolves.toBe(SEANCE_EXISTANTE.id);
    expect(mocks.ajouter).not.toHaveBeenCalled();
  });

  it("crée une séance quand aucune séance de cet exercice n'est ouverte", async () => {
    mocks.lire.mockImplementation(async (collection: string) =>
      collection === "exercises" ? [EXERCICE] : [],
    );

    await expect(creerSeanceFocusExercice(EXERCICE.id)).resolves.toBe("ses-nouvelle");
    expect(mocks.ajouter).toHaveBeenCalledTimes(1);
  });
});
