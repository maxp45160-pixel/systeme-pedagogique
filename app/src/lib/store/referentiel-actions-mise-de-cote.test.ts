import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Referentiel, Skill } from "@/lib/domain/types";

const mocks = vi.hoisted(() => ({
  dorsaleCompte: vi.fn(),
  lireReferentiel: vi.fn(),
  revalidatePath: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("./db", () => ({ dorsaleCompte: mocks.dorsaleCompte }));
vi.mock("./supabase-backend", () => ({ verifier: vi.fn() }));
vi.mock("./referentiel", () => ({ lireReferentiel: mocks.lireReferentiel }));

import { mettreDeCoteCompetence, reprendreCompetence } from "./referentiel-actions";

function skill(options: Partial<Skill> = {}): Skill {
  return {
    code: "LOG-01",
    domaine: "logistique",
    intitule: "Calculer un stock de sécurité",
    palier: "fondamentaux",
    prerequis: [],
    importance: 0.5,
    ordre: 0,
    active: true,
    archive: false,
    origine: "tuteur",
    ...options,
  } as Skill;
}

function referentiel(s: Skill): Referentiel {
  return {
    domaines: [],
    skills: [s],
    actifs: s.active && !s.archive ? [s] : [],
    parCode: new Map([[s.code, s]]),
    codesActifs: new Set(s.active && !s.archive ? [s.code] : []),
    domainesParId: new Map([
      ["logistique", { id: "logistique", version: 4 } as never],
    ]),
  } as unknown as Referentiel;
}

/** La commande envoyée à la RPC lors du dernier appel. */
function commandeEnvoyee() {
  return mocks.rpc.mock.calls.at(-1)?.[1]?.p_commande;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rpc.mockResolvedValue({ data: {}, error: null });
  mocks.dorsaleCompte.mockResolvedValue({
    supabase: { rpc: mocks.rpc },
    userId: "compte-1",
  });
});

describe("mettreDeCoteCompetence", () => {
  it("archive, et ne passe jamais par un retrait de révision", () => {
    /*
     * Le défaut du 24/08/2026 : la mise de côté passait par `reviser_domaine`
     * avec un retrait, dont l'heuristique SQL SUPPRIME la ligne quand rien ne
     * dépend de la compétence — soit exactement le cas d'une dormance. Ce test
     * est ce qui empêche d'y revenir.
     */
    mocks.lireReferentiel.mockResolvedValue(referentiel(skill()));

    return mettreDeCoteCompetence("LOG-01").then(() => {
      expect(commandeEnvoyee()).toEqual({
        type: "archiver_competence",
        domaineId: "logistique",
        code: "LOG-01",
      });
    });
  });

  it("ne fait rien si elle est déjà de côté", async () => {
    mocks.lireReferentiel.mockResolvedValue(referentiel(skill({ archive: true, active: false })));
    await mettreDeCoteCompetence("LOG-01");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("refuse un code inconnu plutôt que d'envoyer une commande vide", async () => {
    mocks.lireReferentiel.mockResolvedValue(referentiel(skill()));
    await expect(mettreDeCoteCompetence("LOG-99")).rejects.toThrow("Compétence inconnue");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

describe("reprendreCompetence", () => {
  it("désarchive depuis le domaine qui gouverne la compétence", async () => {
    mocks.lireReferentiel.mockResolvedValue(referentiel(skill({ archive: true, active: false })));
    await reprendreCompetence("LOG-01");
    expect(commandeEnvoyee()).toEqual({
      type: "desarchiver_competence",
      domaineId: "logistique",
      code: "LOG-01",
    });
  });

  it("ne fait rien sur une compétence qui n'est pas de côté", async () => {
    mocks.lireReferentiel.mockResolvedValue(referentiel(skill()));
    await reprendreCompetence("LOG-01");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("porte la version attendue du domaine — la reprise reste une commande gouvernée", async () => {
    mocks.lireReferentiel.mockResolvedValue(referentiel(skill({ archive: true, active: false })));
    await reprendreCompetence("LOG-01");
    expect(mocks.rpc.mock.calls.at(-1)?.[1]?.p_expected_version).toBe(4);
  });
});
