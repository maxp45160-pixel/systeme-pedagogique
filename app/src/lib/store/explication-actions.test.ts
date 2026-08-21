import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Skill } from "@/lib/domain/types";

const mocks = vi.hoisted(() => ({
  ajouter: vi.fn(),
  dorsaleCompte: vi.fn(),
  nouvelId: vi.fn(),
  lireReferentiel: vi.fn(),
  capturerDocumentProduction: vi.fn(),
  cloreExerciceAtomiquement: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("./db", () => ({
  ajouter: mocks.ajouter,
  dorsaleCompte: mocks.dorsaleCompte,
  nouvelId: mocks.nouvelId,
}));
vi.mock("./referentiel", () => ({ lireReferentiel: mocks.lireReferentiel }));
vi.mock("./documents", () => ({
  capturerDocumentProduction: mocks.capturerDocumentProduction,
}));
vi.mock("./cloture-exercice", () => ({
  cloreExerciceAtomiquement: mocks.cloreExerciceAtomiquement,
}));

import { enregistrerExplicationAction } from "./explication-actions";

const skill = {
  code: "DEV-01",
  domaine: "developpement",
  intitule: "Comprendre les fonctions",
} as Skill;

describe("enregistrement Feynman", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    let compteur = 0;
    mocks.nouvelId.mockImplementation((prefixe: string) => `${prefixe}-${++compteur}`);
    mocks.dorsaleCompte.mockResolvedValue({ userId: "compte-1" });
    mocks.lireReferentiel.mockResolvedValue({ parCode: new Map([[skill.code, skill]]) });
    mocks.capturerDocumentProduction.mockResolvedValue({
      documentId: "preuve-exp-1",
      snapshotId: "preuve-exp-1-v1",
    });
  });

  it("passe par la clôture atomique au lieu d'écrire directement une observation", async () => {
    const resultat = await enregistrerExplicationAction({
      skillCode: skill.code,
      texteExplication: "Une fonction reçoit des données, exécute une règle et renvoie un résultat.",
      evaluation: {
        resultat: "reussi",
        scoreComprehension: 0.9,
        scoreJustification: 0.8,
        pointsCles: ["Entrée et sortie"],
        pointsManquants: [],
        feedbackFormatif: "Explication claire.",
        conseilSuivant: "Passer à un exemple.",
      },
    });

    expect(resultat.succes).toBe(true);
    expect(mocks.ajouter).toHaveBeenCalledTimes(2);
    expect(mocks.ajouter.mock.calls.map(([collection]) => collection)).toEqual([
      "exercises",
      "attempts",
    ]);
    expect(mocks.ajouter.mock.calls[0][1]).toEqual(expect.objectContaining({
      archive: true,
      competences: [skill.code],
    }));

    const [cloture] = mocks.cloreExerciceAtomiquement.mock.calls[0];
    expect(cloture.tentative.statut).toBe("terminee");
    expect(cloture.tentative.exerciseId).toMatch(/^feynman-/);
    expect(cloture.observations).toHaveLength(1);
    expect(cloture.observations[0].source).toEqual(expect.objectContaining({
      kind: "exercice",
      ref: cloture.tentative.exerciseId,
      document: { documentId: "preuve-exp-1", snapshotId: "preuve-exp-1-v1" },
    }));
    expect(cloture.seance.activites[0]).toEqual(expect.objectContaining({
      type: "exercice",
      ref: cloture.tentative.exerciseId,
    }));
  });
});
