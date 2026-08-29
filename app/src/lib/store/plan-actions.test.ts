import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionCandidate } from "@/lib/engine/action-candidate";
import type { PlanPropose } from "@/lib/engine/planification-temporelle";

const mocks = vi.hoisted(() => ({
  dorsaleCompte: vi.fn(),
  lire: vi.fn(),
  lireReferentiel: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  revalidatePath: vi.fn(),
  verifier: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("./db", () => ({ dorsaleCompte: mocks.dorsaleCompte, lire: mocks.lire }));
vi.mock("./referentiel", () => ({ lireReferentiel: mocks.lireReferentiel }));
vi.mock("./supabase-backend", () => ({ verifier: mocks.verifier }));

import { accepterPlan, refuserPropositionPlan } from "./plan-actions";

const candidate: ActionCandidate = {
  candidateId: "c-1",
  source: "existing-activity",
  target: { skillCodes: ["DEV-01"], engagementIds: [] },
  intervention: "resolve",
  expectedEffect: "measurement",
  title: "Résoudre",
  durationMinutes: 30,
  reasons: ["besoin déclaré"],
  constraints: [],
  reservations: [],
};

const plan: PlanPropose = {
  slots: [{
    candidate,
    plannedFor: "2026-08-28T09:00:00.000Z",
    endsAt: "2026-08-28T09:30:00.000Z",
    durationMinutes: 30,
    intervention: "resolve",
    expectedEffect: "measurement",
    reasons: [],
    constraints: [],
    reservations: [],
  }],
  availability: [{ startsAt: "2026-08-28T08:00:00.000Z", endsAt: "2026-08-28T12:00:00.000Z", sourceRef: "agenda:test" }],
  readiness: [],
  constraints: [],
  reservations: [],
};

const referentiel = {
  skills: [{ code: "DEV-01", domaine: "developpement", active: true, archive: false }],
  domaines: [{ id: "developpement", archive: false }],
};

describe("frontière serveur d'acceptation de plan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.dorsaleCompte.mockResolvedValue({
      userId: "compte-1",
      supabase: { rpc: mocks.rpc, from: mocks.from },
    });
    mocks.lireReferentiel.mockResolvedValue(referentiel);
    mocks.lire.mockResolvedValue([]);
    mocks.verifier.mockImplementation((contexte: string, erreur: { message?: string } | null) => {
      if (erreur) throw new Error(`Supabase (${contexte}) : ${erreur.message ?? "erreur"}`);
    });
    mocks.rpc.mockResolvedValue({
      data: {
        acceptedSessionIds: ["plan:proposition-1:c-1"],
        adjustedSessionIds: [],
        ignoredCandidateIds: [],
      },
      error: null,
    });
    mocks.from.mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    });
  });

  it("revalide le référentiel du compte puis appelle une seule RPC sans stocker le plan", async () => {
    const resultat = await accepterPlan(plan, {
      requestId: "request-1",
      propositionRef: "proposition-1",
      acceptedCandidateIds: ["c-1"],
      ignoredCandidateIds: [],
    });

    expect(resultat.acceptedSessionIds).toEqual(["plan:proposition-1:c-1"]);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    const [nom, args] = mocks.rpc.mock.calls[0];
    expect(nom).toBe("accepter_plan");
    expect(args.p_request_id).toBe("request-1");
    expect(args.p_payload).not.toHaveProperty("slots");
    expect(args.p_payload).not.toHaveProperty("readiness");
    expect(args.p_payload.accepted[0].origineProposition).toEqual({
      propositionRef: "proposition-1",
      candidateId: "c-1",
      source: "existing-activity",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("ne fait aucune écriture si une compétence n'est plus active", async () => {
    mocks.lireReferentiel.mockResolvedValue({
      skills: [{ code: "DEV-01", domaine: "developpement", active: false, archive: false }],
      domaines: [{ id: "developpement", archive: false }],
    });

    await expect(accepterPlan(plan, {
      requestId: "request-1",
      propositionRef: "proposition-1",
      acceptedCandidateIds: ["c-1"],
      ignoredCandidateIds: [],
    })).rejects.toThrow(/compétence/);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("ne franchit pas la frontière si le compte n'est pas authentifié", async () => {
    mocks.dorsaleCompte.mockRejectedValue(new Error("Compte absent"));

    await expect(accepterPlan(plan, {
      requestId: "request-1",
      propositionRef: "proposition-1",
      acceptedCandidateIds: ["c-1"],
      ignoredCandidateIds: [],
    })).rejects.toThrow("Compte absent");
    expect(mocks.lireReferentiel).not.toHaveBeenCalled();
    expect(mocks.lire).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("laisse les candidates ignorées hors des séances transmises", async () => {
    const planDeux = {
      ...plan,
      slots: [
        plan.slots[0],
        { ...plan.slots[0], candidate: { ...candidate, candidateId: "c-2" }, plannedFor: "2026-08-28T10:00:00.000Z", endsAt: "2026-08-28T10:30:00.000Z" },
      ],
    } satisfies PlanPropose;
    await accepterPlan(planDeux, {
      requestId: "request-1",
      propositionRef: "proposition-1",
      acceptedCandidateIds: ["c-1"],
      ignoredCandidateIds: ["c-2"],
    });
    const payload = mocks.rpc.mock.calls[0][1].p_payload;
    expect(payload.accepted).toHaveLength(1);
    expect(payload.accepted[0].origineProposition.candidateId).toBe("c-1");
    expect(payload.ignoredCandidateIds).toEqual(["c-2"]);
  });

  it("préserve l'idempotence côté RPC et ne passe jamais par ajouter/modifier", async () => {
    const choix = {
      requestId: "request-1",
      propositionRef: "proposition-1",
      acceptedCandidateIds: ["c-1"],
      ignoredCandidateIds: [],
    } as const;
    await accepterPlan(plan, choix);
    await accepterPlan(plan, choix);
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    expect(mocks.rpc.mock.calls[0]).toEqual(mocks.rpc.mock.calls[1]);
  });

  it("transmet les déplacements et annulations dans le même lot atomique", async () => {
    const sessions = [
      {
        id: "ses-move",
        date: "2026-08-28T08:00:00.000Z",
        domaines: ["developpement"],
        skillCodes: ["DEV-01"],
        activites: [],
        dureeMin: 30,
        genereAutomatiquement: false,
        statut: "planifiee",
        planifieePour: "2026-08-28T08:00:00.000Z",
      },
      {
        id: "ses-cancel",
        date: "2026-08-28T08:30:00.000Z",
        domaines: ["developpement"],
        skillCodes: ["DEV-01"],
        activites: [],
        genereAutomatiquement: false,
        statut: "planifiee",
        planifieePour: "2026-08-28T08:30:00.000Z",
      },
    ];
    mocks.lire.mockImplementation(async (nom: string) => nom === "sessions" ? sessions : []);
    mocks.rpc.mockResolvedValue({
      data: {
        acceptedSessionIds: ["plan:proposition-1:c-1"],
        adjustedSessionIds: ["ses-cancel", "ses-move"],
        ignoredCandidateIds: [],
      },
      error: null,
    });

    await accepterPlan(plan, {
      requestId: "request-1",
      propositionRef: "proposition-1",
      acceptedCandidateIds: ["c-1"],
      ignoredCandidateIds: [],
      adjustments: [
        { sessionId: "ses-cancel", action: "cancel" },
        { sessionId: "ses-move", action: "move", plannedFor: "2026-08-28T11:00:00.000Z" },
      ],
    });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc.mock.calls[0][1].p_payload.adjustments).toEqual([
      { sessionId: "ses-cancel", action: "cancel" },
      { sessionId: "ses-move", action: "move", plannedFor: "2026-08-28T11:00:00.000Z" },
    ]);
  });

  it("transmet un raccourcissement explicite dans le même lot", async () => {
    const session = {
      id: "ses-short",
      date: "2026-08-28T08:00:00.000Z",
      planifieePour: "2026-08-28T08:00:00.000Z",
      dureeMin: 30,
      domaines: ["developpement"],
      skillCodes: ["DEV-01"],
      activites: [],
      genereAutomatiquement: false,
      statut: "planifiee",
    };
    mocks.lire.mockImplementation(async (nom: string) => nom === "sessions" ? [session] : []);
    await accepterPlan(plan, {
      requestId: "request-short",
      propositionRef: "proposition-1",
      acceptedCandidateIds: ["c-1"],
      ignoredCandidateIds: [],
      adjustments: [{ sessionId: "ses-short", action: "shorten", durationMinutes: 15 }],
    });
    expect(mocks.rpc.mock.calls[0][1].p_payload.adjustments).toEqual([{
      sessionId: "ses-short",
      action: "shorten",
      plannedFor: "2026-08-28T08:00:00.000Z",
      durationMinutes: 15,
    }]);
  });

  it("ne fabrique aucune écriture si la transaction RPC est refusée", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "conflit", code: "40001" } });
    await expect(accepterPlan(plan, {
      requestId: "request-1",
      propositionRef: "proposition-1",
      acceptedCandidateIds: ["c-1"],
      ignoredCandidateIds: [],
    })).rejects.toThrow(/conflit/);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it("mémorise le refus entier avec un identifiant déterministe et tolère son rejeu", async () => {
    const insert = vi.fn()
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { code: "23505", message: "duplicate key" } });
    mocks.from.mockReturnValue({ insert });

    await refuserPropositionPlan("plan-ab12");
    await refuserPropositionPlan("plan-ab12");

    expect(mocks.from).toHaveBeenCalledWith("refus_recommandations");
    expect(insert).toHaveBeenNthCalledWith(1, {
      id: "plan-refus:plan-ab12",
      user_id: "compte-1",
      code: null,
      exercice_id: null,
      proposition_ref: "plan-ab12",
      date: expect.any(String),
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("refuse une référence vide avant toute écriture", async () => {
    await expect(refuserPropositionPlan(" ")).rejects.toThrow(/invalide/);
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
