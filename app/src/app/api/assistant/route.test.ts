import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ pilote: vi.fn(), lireParId: vi.fn(), creer: vi.fn(), resoudre: vi.fn(), comprendre: vi.fn() }));
vi.mock("@/lib/store/depot-budget", () => ({ estPiloteDepot: m.pilote }));
vi.mock("@/lib/store/db", () => ({ dorsaleCompte: async () => ({ userId: "compte-a" }), lireParId: m.lireParId }));
vi.mock("@/lib/store/engagement-actions", () => ({ creerEngagement: m.creer }));
vi.mock("@/lib/tutor/accueil-tour", async (original) => ({ ...await original<object>(), comprendreAccueil: m.comprendre }));
vi.mock("@/lib/tutor/reponse-flux", () => ({
  resoudreMoteur: m.resoudre,
  repondreParFluxSse: (_request: Request, executer: (envoyer: (e: string, d: unknown) => void, signal: AbortSignal) => Promise<void>, erreur?: () => string) => {
    const promise = (async () => {
      const evenements: unknown[] = [];
      try { await executer((e, d) => evenements.push({ e, d }), new AbortController().signal); }
      catch { evenements.push({ e: "erreur", d: erreur?.() }); }
      return evenements;
    })();
    return promise.then((events) => Response.json(events));
  },
}));
import { POST } from "./route";
const corps = { tourId: "11111111-1111-4111-8111-111111111111", messages: [{ role: "user", content: "Contrôle de probabilités le 18 septembre 2026" }] };
const e = { id: "eng", type: "examen", libelle: "probabilités", echeanceLe: "2026-09-18", codes: [] };
const request = (extra = {}) => new Request("http://localhost/api/assistant", { method: "POST", body: JSON.stringify({ ...corps, ...extra }) });
describe("route assistant : seule l'écriture réelle produit le reçu", () => {
  beforeEach(() => { vi.resetAllMocks(); m.pilote.mockResolvedValue(true); m.lireParId.mockResolvedValue(null); m.resoudre.mockResolvedValue({ ok: true, moteur: {} }); });
  it("refuse hors pilote avant tout accès métier ou fournisseur", async () => {
    m.pilote.mockResolvedValue(false);
    expect((await POST(request())).status).toBe(403);
    expect(m.lireParId).not.toHaveBeenCalled(); expect(m.resoudre).not.toHaveBeenCalled();
  });
  it("récupère après interruption sans quota, IA ni nouvelle écriture", async () => {
    m.lireParId.mockResolvedValue(e);
    expect((await (await POST(request({ verifier: true }))).json()).message).toContain("18/09/2026");
    expect(m.resoudre).not.toHaveBeenCalled(); expect(m.creer).not.toHaveBeenCalled();
  });
  it("un rejeu réussi ne rappelle pas le fournisseur", async () => {
    m.lireParId.mockResolvedValue(e);
    expect(await (await POST(request())).text()).toContain("Échéance enregistrée");
    expect(m.resoudre).not.toHaveBeenCalled();
  });
  it("une question ou clarification n'écrit rien", async () => {
    m.comprendre.mockResolvedValue({ action: "repondre", reponse: "Quelle date complète ?" });
    expect(await (await POST(request())).text()).toContain("Aucune échéance enregistrée");
    expect(m.creer).not.toHaveBeenCalled();
  });
  it("écrit avec une clé de rejeu et rend uniquement le reçu du serveur", async () => {
    m.comprendre.mockResolvedValue({ action: "examen", ...e, reponse: "Tout est planifié" }); m.creer.mockResolvedValue(e);
    const texte = await (await POST(request())).text();
    expect(m.creer).toHaveBeenCalledWith({ type: "examen", libelle: "probabilités", echeanceLe: "2026-09-18" }, expect.stringMatching(/^[a-f0-9-]{36}:[a-f0-9]{64}$/));
    expect(texte).toContain("Échéance enregistrée"); expect(texte).not.toContain("Tout est planifié");
  });
  it("une erreur ne produit aucun reçu ni événement fin", async () => {
    m.comprendre.mockResolvedValue({ action: "examen", ...e }); m.creer.mockRejectedValue(new Error("panne"));
    const events = await (await POST(request())).json();
    expect(events.at(-1).e).toBe("erreur"); expect(events.some((x: { e: string }) => x.e === "fin" || x.e === "texte")).toBe(false);
  });
});
