import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ lire: vi.fn(), supprimer: vi.fn(), revalider: vi.fn() }));
vi.mock("./depot-documents", () => ({ lireDepotDocumentaire: m.lire, creerDepotDocumentaire: vi.fn(), ajouterCorrectionDepot: vi.fn() }));
vi.mock("./documents", () => ({ supprimerDocument: m.supprimer }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalider }));
import { supprimerDepotAction } from "./depot-actions";
beforeEach(() => { vi.resetAllMocks(); });
it("vérifie le dépôt du compte puis réutilise la suppression documentaire", async () => {
  await supprimerDepotAction("depot-1");
  expect(m.lire).toHaveBeenCalledWith("depot-1");
  expect(m.lire.mock.invocationCallOrder[0]).toBeLessThan(m.supprimer.mock.invocationCallOrder[0]);
  expect(m.supprimer).toHaveBeenCalledWith("depot-1");
  expect(m.revalider).toHaveBeenCalledWith("/app");
  expect(m.revalider).toHaveBeenCalledWith("/atelier");
});
it("ne supprime rien quand le contrôle du compte ou du dépôt échoue", async () => {
  m.lire.mockRejectedValue(new Error("Dépôt introuvable"));
  await expect(supprimerDepotAction("autre-compte")).rejects.toThrow("introuvable");
  expect(m.supprimer).not.toHaveBeenCalled();
});
it("conserve le refus des documents avec une version figée", async () => {
  m.supprimer.mockRejectedValue(new Error("version figée"));
  await expect(supprimerDepotAction("depot-1")).rejects.toThrow("version figée");
  expect(m.revalider).not.toHaveBeenCalled();
});
