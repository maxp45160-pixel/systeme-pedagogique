import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Exercise, LearningSession } from "@/lib/domain/types";

const mocks = vi.hoisted(() => ({
  ajouter: vi.fn(),
  dorsaleCompte: vi.fn(),
  lire: vi.fn(),
  modifier: vi.fn(),
  nouvelId: vi.fn(),
  cloreExerciceAtomiquement: vi.fn(),
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
vi.mock("./cloture-exercice", () => ({ cloreExerciceAtomiquement: mocks.cloreExerciceAtomiquement }));
vi.mock("@/lib/seed/exercises", () => ({ EXERCICES_DIAGNOSTIC: [] }));

import { annulerSeance, creerSeanceFocusExercice, terminerIntervention } from "./seance-actions";

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

describe("annulation d'une séance planifiée", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.dorsaleCompte.mockResolvedValue({});
  });

  it("conserve le fait abandonné sans créer d'observation", async () => {
    mocks.lire.mockResolvedValue([{
      id: "ses-planifiee",
      date: "2026-08-28T09:00:00.000Z",
      domaines: ["developpement"],
      skillCodes: ["DEV-01"],
      activites: [],
      genereAutomatiquement: false,
      statut: "planifiee",
      planifieePour: "2026-08-28T09:00:00.000Z",
    } satisfies LearningSession]);

    await expect(annulerSeance("ses-planifiee")).resolves.toBe("/seances");
    expect(mocks.modifier).toHaveBeenCalledWith(
      "sessions",
      "ses-planifiee",
      { statut: "abandonnee", renonceeLe: expect.any(String) },
      {},
    );
    expect(mocks.ajouter).not.toHaveBeenCalled();
  });
});

describe("clôture d'une intervention sans observation", () => {
  it("met à jour uniquement le statut canonique", async () => {
    vi.clearAllMocks();
    mocks.dorsaleCompte.mockResolvedValue({});
    const session = {
      id: "ses-multi",
      date: "2026-08-28T09:00:00.000Z",
      domaines: ["developpement"],
      skillCodes: ["DEV-01"],
      activites: [],
      genereAutomatiquement: false,
      statut: "en-cours",
      interventions: [{
        id: "i-read",
        type: "read",
        label: "Lire",
        source: { kind: "document", ref: "doc-1" },
        expectedEffect: "preparation",
      }],
    } as LearningSession;
    mocks.lire.mockResolvedValue([session]);
    mocks.modifier.mockResolvedValue(session);

    await expect(terminerIntervention("ses-multi", "i-read")).resolves.toContain("intervention=i-read");
    expect(mocks.modifier).toHaveBeenCalledWith(
      "sessions",
      "ses-multi",
      { interventions: [{ ...session.interventions![0], statut: "completed" }] },
      {},
    );
    expect(mocks.ajouter).not.toHaveBeenCalled();
  });

  it("clôture une intervention Feynman sans recréer de séance ni d'observation", async () => {
    vi.clearAllMocks();
    mocks.dorsaleCompte.mockResolvedValue({});
    const session = {
      id: "ses-feynman",
      date: "2026-08-28T09:00:00.000Z",
      domaines: ["developpement"],
      skillCodes: ["DEV-01"],
      activites: [],
      genereAutomatiquement: false,
      statut: "en-cours",
      interventions: [{
        id: "i-explain",
        type: "explain",
        label: "Expliquer les invariants",
        source: { kind: "course", ref: "cours-1" },
        targetSkillCodes: ["DEV-01"],
        expectedEffect: "preparation",
      }],
    } as LearningSession;
    mocks.lire.mockResolvedValue([session]);
    mocks.modifier.mockResolvedValue(session);

    await expect(terminerIntervention("ses-feynman", "i-explain"))
      .resolves.toContain("intervention=i-explain");
    expect(mocks.modifier).toHaveBeenCalledWith(
      "sessions",
      "ses-feynman",
      { interventions: [{ ...session.interventions![0], statut: "completed" }] },
      {},
    );
    expect(mocks.ajouter).not.toHaveBeenCalled();
    expect(mocks.cloreExerciceAtomiquement).not.toHaveBeenCalled();
  });
});
