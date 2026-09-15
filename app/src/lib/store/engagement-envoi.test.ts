import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ ajouter: vi.fn(), lireParId: vi.fn(), dorsaleCompte: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidatePath }));
vi.mock("./db", () => ({ ...m, nouvelId: vi.fn(), lire: vi.fn(), modifier: vi.fn() }));
vi.mock("./referentiel", () => ({ lireReferentiel: async () => ({ codesActifs: new Set(), domaines: [] }) }));
import { creerEngagement } from "./engagement-actions";
import { idEngagementEnvoi } from "./engagement-cle";

const cle = `11111111-1111-4111-8111-111111111111:${"a".repeat(64)}`;
const entree = { type: "examen", libelle: "Probabilités", echeanceLe: "2026-09-18" };
describe("échéance : idempotence et isolation de l'envoi", () => {
  beforeEach(() => { vi.resetAllMocks(); m.dorsaleCompte.mockResolvedValue({ userId: "compte-a" }); m.lireParId.mockResolvedValue(null); });
  it("crée avec une identité stable et aucune autre donnée", async () => {
    const e = await creerEngagement(entree, cle);
    expect(e.id).toBe(idEngagementEnvoi("compte-a", cle));
    expect(m.ajouter).toHaveBeenCalledExactlyOnceWith("engagements", e, { userId: "compte-a" });
    expect(e.codes).toEqual([]);
  });
  it("renvoie l'écriture déjà réussie sans la répéter", async () => {
    const existant = { id: "existant", ...entree, codes: [] };
    m.lireParId.mockResolvedValue(existant);
    expect(await creerEngagement(entree, cle)).toEqual(existant);
    expect(m.ajouter).not.toHaveBeenCalled();
  });
  it("récupère le gagnant après collision concurrente ou réponse perdue", async () => {
    const existant = { id: "existant", ...entree, codes: [] };
    m.lireParId.mockResolvedValueOnce(null).mockResolvedValueOnce(existant);
    m.ajouter.mockRejectedValue(new Error("collision"));
    expect(await creerEngagement(entree, cle)).toEqual(existant);
  });
  it("ne transforme pas une panne d'écriture en succès", async () => {
    m.ajouter.mockRejectedValue(new Error("panne"));
    await expect(creerEngagement(entree, cle)).rejects.toThrow("panne");
  });
  it("isole la même clé par compte et refuse une clé invalide", async () => {
    expect(idEngagementEnvoi("compte-a", cle)).not.toBe(idEngagementEnvoi("compte-b", cle));
    await expect(creerEngagement(entree, "invalide")).rejects.toThrow("invalide");
    expect(m.ajouter).not.toHaveBeenCalled();
  });
});
