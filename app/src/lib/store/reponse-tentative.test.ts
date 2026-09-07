import { beforeEach, describe, expect, it, vi } from "vitest";
import { ecrireReponseEnCours } from "./reponse-tentative";

vi.mock("./db", () => ({ dorsaleCompte: vi.fn() }));

describe("réponse d'origine après clôture", () => {
  const requete = {
    update: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(), maybeSingle: vi.fn(),
  };
  const from = vi.fn(() => requete);
  const dorsale = { supabase: { from }, userId: "compte-1" } as never;
  beforeEach(() => vi.clearAllMocks());

  it("conditionne atomiquement chaque sauvegarde au compte et à une tentative encore ouverte", async () => {
    requete.maybeSingle.mockResolvedValue({ data: { id: "att-1" }, error: null });
    await ecrireReponseEnCours("att-1", "Ma dernière réponse", dorsale);
    expect(from).toHaveBeenCalledWith("attempts");
    expect(requete.update).toHaveBeenCalledWith({ reponse: "Ma dernière réponse" });
    expect(requete.eq.mock.calls).toEqual([["user_id", "compte-1"], ["id", "att-1"], ["statut", "en-cours"]]);
  });

  it("refuse une sauvegarde arrivée après clôture ou visant un autre compte", async () => {
    requete.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(ecrireReponseEnCours("att-1", "Réponse recopiée du corrigé", dorsale)).rejects.toThrow("réponse d'origine");
  });

  it("ne prétend pas avoir sauvegardé lorsque la base refuse l'écriture", async () => {
    requete.maybeSingle.mockResolvedValue({ data: null, error: { message: "indisponible" } });
    await expect(ecrireReponseEnCours("att-1", "Réponse", dorsale)).rejects.toThrow();
  });
});
