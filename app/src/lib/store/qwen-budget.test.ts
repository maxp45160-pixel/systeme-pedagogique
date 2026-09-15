import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ compte: vi.fn(), rpc: vi.fn() }));
vi.mock("./depot-budget", () => ({ comptePiloteDepot: m.compte }));
import { reserverQwen } from "./qwen-budget";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
  m.compte.mockResolvedValue({ userId: "compte", supabase: { rpc: m.rpc } });
  m.rpc.mockResolvedValue({ error: null });
});
it("réserve avec la session personnelle sans clé privilégiée ni identité fournie", async () => {
  await reserverQwen("operation", 1000, 100);
  expect(m.rpc).toHaveBeenCalledWith("qwen_reserver_compte", { p_operation: "operation", p_entree: 1000, p_sortie: 100 });
});
it("ne masque pas un refus du plafond", async () => {
  m.rpc.mockResolvedValue({ error: { message: "Budget Qwen de 5 $ épuisé" } });
  await expect(reserverQwen("operation", 1000, 100)).rejects.toThrow("épuisée");
});
