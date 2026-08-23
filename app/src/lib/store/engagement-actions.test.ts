import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Engagement } from "@/lib/domain/engagement";

const mocks = vi.hoisted(() => ({
  ajouter: vi.fn(),
  dorsaleCompte: vi.fn(),
  lire: vi.fn(),
  lireReferentiel: vi.fn(),
  modifier: vi.fn(),
  nouvelId: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("./db", () => ({
  ajouter: mocks.ajouter,
  dorsaleCompte: mocks.dorsaleCompte,
  lire: mocks.lire,
  modifier: mocks.modifier,
  nouvelId: mocks.nouvelId,
}));
vi.mock("./referentiel", () => ({ lireReferentiel: mocks.lireReferentiel }));

import { cloreEngagement, creerEngagement, reporterEngagement } from "./engagement-actions";

const OUVERT: Engagement = {
  id: "eng-1",
  type: "examen",
  libelle: "Contrôle de stocks",
  echeanceLe: "2026-09-05",
  codes: ["LOG-01"],
};

const REFERENTIEL = {
  codesActifs: new Set(["LOG-01", "LOG-02"]),
};

describe("creerEngagement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.dorsaleCompte.mockResolvedValue({});
    mocks.lireReferentiel.mockResolvedValue(REFERENTIEL);
    mocks.nouvelId.mockReturnValue("eng-nouveau");
  });

  it("valide puis écrit l'engagement via ajouter", async () => {
    const engagement = await creerEngagement({
      type: "examen",
      libelle: " Contrôle de stocks ",
      echeanceLe: "2026-09-05",
      codes: ["LOG-01"],
    });

    expect(engagement.id).toBe("eng-nouveau");
    expect(engagement.libelle).toBe("Contrôle de stocks");
    expect(mocks.ajouter).toHaveBeenCalledTimes(1);
    expect(mocks.ajouter).toHaveBeenCalledWith("engagements", engagement, {});
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("refuse bruyamment un code hors référentiel du compte, sans rien écrire", async () => {
    await expect(
      creerEngagement({
        type: "rendu",
        libelle: "Dossier",
        echeanceLe: "2026-09-05",
        codes: ["ZZ-99"],
      }),
    ).rejects.toThrow(/inconnue\(s\) du référentiel : ZZ-99/);
    expect(mocks.ajouter).not.toHaveBeenCalled();
  });

  it("refuse un libellé vide sans toucher la base", async () => {
    await expect(
      creerEngagement({ type: "examen", libelle: "  ", echeanceLe: "2026-09-05" }),
    ).rejects.toThrow(/libellé/);
    expect(mocks.ajouter).not.toHaveBeenCalled();
  });
});

describe("cloreEngagement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.dorsaleCompte.mockResolvedValue({});
    mocks.lire.mockImplementation(async (nom: string) =>
      nom === "engagements" ? [OUVERT] : [],
    );
  });

  it("pose clotureLe + clotureType « passe » sur la ligne existante", async () => {
    await cloreEngagement("eng-1");

    expect(mocks.modifier).toHaveBeenCalledTimes(1);
    const [table, id, champs] = mocks.modifier.mock.calls[0];
    expect(table).toBe("engagements");
    expect(id).toBe("eng-1");
    expect(champs.clotureType).toBe("passe");
    expect(typeof champs.clotureLe).toBe("string");
    expect(mocks.ajouter).not.toHaveBeenCalled();
  });

  it("lève sur un engagement déjà clôturé, sans réécrire", async () => {
    mocks.lire.mockImplementation(async (nom: string) =>
      nom === "engagements"
        ? [{ ...OUVERT, clotureLe: "2026-08-22T10:00:00Z", clotureType: "passe" }]
        : [],
    );
    await expect(cloreEngagement("eng-1")).rejects.toThrow(/déjà clôturé/);
    expect(mocks.modifier).not.toHaveBeenCalled();
  });
});

describe("reporterEngagement — append-only", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.dorsaleCompte.mockResolvedValue({});
    mocks.lireReferentiel.mockResolvedValue(REFERENTIEL);
    mocks.lire.mockImplementation(async (nom: string) =>
      nom === "engagements" ? [OUVERT] : [],
    );
    mocks.nouvelId.mockReturnValue("eng-remplacant");
  });

  it("clôture l'ancien en « reporte » et crée un remplaçant à la nouvelle date", async () => {
    const remplacement = await reporterEngagement("eng-1", "2026-09-20");

    // L'ancien n'est que clôturé — son échéance n'est jamais réécrite.
    const [tableAncien, idAncien, champsAncien] = mocks.modifier.mock.calls[0];
    expect([tableAncien, idAncien]).toEqual(["engagements", "eng-1"]);
    expect(champsAncien.clotureType).toBe("reporte");
    expect(champsAncien.echeanceLe).toBeUndefined();

    // Le remplaçant porte le même sens, une nouvelle date, un nouvel id.
    expect(mocks.ajouter).toHaveBeenCalledTimes(1);
    expect(remplacement).toEqual({
      id: "eng-remplacant",
      type: "examen",
      libelle: "Contrôle de stocks",
      echeanceLe: "2026-09-20",
      codes: ["LOG-01"],
    });
    expect(mocks.revalidatePath).toHaveBeenCalled();
  });

  it("refuse une nouvelle date invalide avant toute écriture", async () => {
    await expect(reporterEngagement("eng-1", "31/12")).rejects.toThrow(/AAAA-MM-JJ/);
    expect(mocks.modifier).not.toHaveBeenCalled();
    expect(mocks.ajouter).not.toHaveBeenCalled();
  });

  it("refuse de reporter un engagement déjà clôturé", async () => {
    mocks.lire.mockImplementation(async (nom: string) =>
      nom === "engagements"
        ? [{ ...OUVERT, clotureLe: "2026-08-22T10:00:00Z", clotureType: "passe" }]
        : [],
    );
    await expect(reporterEngagement("eng-1", "2026-09-20")).rejects.toThrow(/clôturé/);
    expect(mocks.modifier).not.toHaveBeenCalled();
  });
});
