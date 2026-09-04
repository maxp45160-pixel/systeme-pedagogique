import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Referentiel } from "@/lib/domain/types";

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

import { supprimerDomaineArchive } from "./referentiel-actions";

function referentiel(archive: boolean): Referentiel {
  return {
    domaines: [],
    skills: [],
    actifs: [],
    parCode: new Map(),
    codesActifs: new Set(),
    domainesParId: new Map([
      ["analyse", { id: "analyse", version: 7, archive } as never],
    ]),
  } as unknown as Referentiel;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rpc.mockResolvedValue({
    data: { domaineId: "analyse", version: null, domaineSupprime: true },
    error: null,
  });
  mocks.dorsaleCompte.mockResolvedValue({
    supabase: { rpc: mocks.rpc },
    userId: "compte-1",
  });
});

describe("supprimerDomaineArchive", () => {
  it("appelle la commande dédiée avec la version relue", async () => {
    mocks.lireReferentiel.mockResolvedValue(referentiel(true));

    await expect(supprimerDomaineArchive("analyse")).resolves.toMatchObject({ ok: true });

    expect(mocks.rpc).toHaveBeenCalledWith(
      "supprimer_domaine_archive",
      expect.objectContaining({
        p_expected_version: 7,
        p_domaine_id: "analyse",
        p_request_id: expect.any(String),
      }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("refuse un domaine encore actif avant tout appel SQL", async () => {
    mocks.lireReferentiel.mockResolvedValue(referentiel(false));

    await expect(supprimerDomaineArchive("analyse")).resolves.toEqual({
      ok: false,
      erreur: "Mettez d’abord ce domaine de côté avant de le supprimer.",
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("refuse un identifiant absent du référentiel du compte", async () => {
    mocks.lireReferentiel.mockResolvedValue(referentiel(true));

    await expect(supprimerDomaineArchive("inconnu")).resolves.toEqual({
      ok: false,
      erreur: "Ce domaine n’existe plus dans votre référentiel.",
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("renvoie au client la raison sûre d'un refus de dépendance", async () => {
    mocks.lireReferentiel.mockResolvedValue(referentiel(true));
    mocks.rpc.mockResolvedValue({
      data: null,
      error: {
        code: "P0001",
        message: "Ce domaine ne peut pas être supprimé : des documents ou liens.",
      },
    });

    await expect(supprimerDomaineArchive("analyse")).resolves.toEqual({
      ok: false,
      erreur: "Ce domaine ne peut pas être supprimé : des documents ou liens.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
