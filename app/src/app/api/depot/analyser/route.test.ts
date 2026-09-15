import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ analyser: vi.fn(), preparer: vi.fn(), organiser: vi.fn() }));
vi.mock("@/lib/store/depot-analyse", () => ({ analyserDepot: m.analyser, preparerAnalyseDepot: m.preparer }));
vi.mock("@/lib/store/dialogue-ressource", () => ({ completerRessourceAnalysee: m.organiser }));
import { GET, POST } from "./route";

const url = "http://localhost/api/depot/analyser";
function requete(body: object, origin = "http://localhost") {
  return new Request(url, { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
const demande = { documentId: "doc", empreinte: "e", maximum: 20, consentement: true, organiser: true };
beforeEach(() => {
  vi.resetAllMocks();
  m.analyser.mockResolvedValue({ id: "doc", analyses: [{ id: "a", empreinte: "e", statut: "terminee", creeLe: "2026-09-13", restitution: { version: 2, organisation: {} } }] });
  m.organiser.mockResolvedValue({ depot: { id: "doc", rangementStatut: "rangee" }, aPreciser: [] });
});
it("la préparation ne lance ni analyse ni rangement", async () => {
  m.preparer.mockResolvedValue({ disponible: true });
  expect((await GET(new Request(`${url}?documentId=doc`))).status).toBe(200);
  expect(m.analyser).not.toHaveBeenCalled(); expect(m.organiser).not.toHaveBeenCalled();
});
it("refuse la transmission sans consentement explicite ou depuis une autre origine", async () => {
  expect((await POST(requete({ ...demande, consentement: false }))).status).toBe(400);
  expect((await POST(requete(demande, "http://autre"))).status).toBe(403);
  expect(m.analyser).not.toHaveBeenCalled(); expect(m.organiser).not.toHaveBeenCalled();
});
it("analyse puis range la restitution effectivement terminée, sans revue intermédiaire", async () => {
  const r = await POST(requete(demande));
  expect(r.status).toBe(200);
  expect(m.organiser).toHaveBeenCalledWith("doc", "a");
  expect(m.analyser.mock.invocationCallOrder[0]).toBeLessThan(m.organiser.mock.invocationCallOrder[0]);
  expect(await r.json()).toMatchObject({ depot: { rangementStatut: "rangee" } });
});
it("un échec ou un traitement concurrent ne déclenche pas le rangement", async () => {
  for (const statut of ["echec", "interrompue", "en-cours"]) {
    m.analyser.mockResolvedValue({ id: "doc", analyses: [{ id: "a", empreinte: "e", statut, creeLe: "2026-09-13", restitution: null }] });
    expect((await POST(requete(demande))).status).toBe(200);
  }
  expect(m.organiser).not.toHaveBeenCalled();
});
it("n'utilise pas une analyse antérieure quand une autre est devenue la plus récente", async () => {
  m.analyser.mockResolvedValue({ id: "doc", analyses: [
    { id: "a", empreinte: "e", statut: "terminee", creeLe: "2026-09-12", restitution: { version: 2, organisation: {} } },
    { id: "b", empreinte: "autre", statut: "terminee", creeLe: "2026-09-13", restitution: { version: 2, organisation: {} } },
  ] });
  await POST(requete(demande)); expect(m.organiser).not.toHaveBeenCalled();
});
it("ne transforme pas un échec d'écriture en reçu de réussite", async () => {
  m.organiser.mockRejectedValue(new Error("Document modifié ailleurs"));
  const r = await POST(requete(demande));
  expect(r.status).toBe(400); expect(await r.json()).toEqual({ message: "Document modifié ailleurs" });
  expect(m.analyser).toHaveBeenCalledTimes(1);
});
it("la reprise payante exige le drapeau explicite et l'ancien parcours reste inchangé", async () => {
  const r = await POST(requete({ ...demande, organiser: false, reprise: true }));
  expect(m.analyser).toHaveBeenCalledWith("doc", "e", 20, true, expect.any(AbortSignal));
  expect(m.organiser).not.toHaveBeenCalled(); expect(await r.json()).toHaveProperty("analyses");
});
