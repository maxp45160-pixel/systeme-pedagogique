import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ db: vi.fn(), eq: vi.fn(), in: vi.fn() }));
vi.mock("./db", () => ({ dorsaleCompte: m.db }));
vi.mock("./depot-actions", () => ({ lireContexteOrganisationDepotAction: vi.fn() }));
import { identifierRessourcesAssistantAction } from "./ressource-assistant-actions";
const vivant = "depot-11111111111111111111111111111111";
const ancien = "depot-22222222222222222222222222222222";
beforeEach(() => {
  vi.clearAllMocks();
  m.in.mockResolvedValue({ data: [{ id: vivant, titre: "Livret.pdf" }], error: null });
  m.eq.mockReturnValue({ in: m.in });
  m.db.mockResolvedValue({ userId: "compte-actif", supabase: { from: () => ({ select: () => ({ eq: m.eq }) }) } });
});
it("nomme les documents accessibles et distingue les références absentes dans le compte", async () => {
  expect(await identifierRessourcesAssistantAction([vivant, ancien])).toEqual([
    { id: vivant, titre: "Livret.pdf", introuvable: false }, { id: ancien, introuvable: true },
  ]);
  expect(m.eq).toHaveBeenCalledWith("user_id", "compte-actif");
  expect(m.in).toHaveBeenCalledWith("id", [vivant, ancien]);
});
it("ne confond pas une panne de lecture avec un document absent", async () => {
  m.in.mockResolvedValue({ data: null, error: { message: "réseau" } });
  await expect(identifierRessourcesAssistantAction([vivant])).rejects.toThrow("liste des documents");
});
it("refuse les références invalides avant l'accès aux données", async () => {
  await expect(identifierRessourcesAssistantAction(["invalide"])).rejects.toThrow("Sélection");
  expect(m.db).not.toHaveBeenCalled();
});
