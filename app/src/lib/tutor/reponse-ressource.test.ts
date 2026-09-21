import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ charger: vi.fn(), verifier: vi.fn(), preparer: vi.fn(), executer: vi.fn(), lire: vi.fn(), comprendre: vi.fn(), moteur: vi.fn() }));
vi.mock("@/lib/store/dialogue-ressource", () => ({ chargerDialogueRessource: m.charger, verifierOperationRessource: m.verifier, preparerOperationRessource: m.preparer, executerOperationRessource: m.executer }));
vi.mock("@/lib/store/ressource-assistant-actions", () => ({ lireRessourceAssistantAction: m.lire }));
vi.mock("./dialogue-ressource", () => ({ comprendreRessource: m.comprendre }));
vi.mock("./reponse-flux", async (original) => ({ ...await original<typeof import("./reponse-flux")>(), resoudreMoteur: m.moteur }));
import { repondreRessource } from "./reponse-ressource";
import type { EnvoiAccueil } from "./accueil-tour";
const cible = { id: `depot-${"a".repeat(32)}`, version: "v1" };
const envoi: EnvoiAccueil = { tourId: "12345678-1234-4123-8123-123456789012", messages: [{ role: "user", content: "Renomme ce cours" }], verifier: false };
const requete = (origin = "http://localhost:3000") => new Request("http://localhost:3000/api/assistant", { method: "POST", headers: { origin } });
beforeEach(() => {
  vi.resetAllMocks(); m.charger.mockResolvedValue({ depot: { modifieLe: "v1" }, contexte: {} });
  m.moteur.mockResolvedValue({ ok: true, moteur: {} }); m.executer.mockResolvedValue("Correction enregistrée");
});
it("refuse une autre origine avant toute lecture ou dépense", async () => {
  expect((await repondreRessource(requete("http://autre.test"), envoi, cible)).status).toBe(403);
  expect(m.charger).not.toHaveBeenCalled(); expect(m.moteur).not.toHaveBeenCalled();
});
it("refuse une version périmée avant de solliciter le modèle", async () => {
  expect((await repondreRessource(requete(), envoi, { ...cible, version: "v0" })).status).toBe(409);
  expect(m.moteur).not.toHaveBeenCalled(); expect(m.preparer).not.toHaveBeenCalled();
});
it("reprend une commande persistée sans nouvelle interprétation ni dépense IA", async () => {
  m.verifier.mockReturnValue({ terminee: false });
  const texte = await (await repondreRessource(requete(), envoi, cible)).text();
  expect(texte).toContain("Correction enregistrée"); expect(m.executer).toHaveBeenCalledTimes(1);
  expect(m.moteur).not.toHaveBeenCalled(); expect(m.comprendre).not.toHaveBeenCalled();
});
it("vérifie le reçu et les liens en lecture seule", async () => {
  m.verifier.mockReturnValue({ terminee: true, recu: "Enregistré" }); m.lire.mockResolvedValue({ liensVerifies: false });
  expect(await (await repondreRessource(requete(), { ...envoi, verifier: true }, cible)).json()).toEqual({ message: null });
  m.lire.mockResolvedValue({ liensVerifies: true });
  expect(await (await repondreRessource(requete(), { ...envoi, verifier: true }, cible)).json()).toEqual({ message: "Enregistré" });
  expect(m.executer).not.toHaveBeenCalled(); expect(m.moteur).not.toHaveBeenCalled();
});
it("une clarification annonce explicitement l'absence de modification", async () => {
  m.comprendre.mockResolvedValue({ action: "repondre", reponse: "Quel titre ?" });
  expect(await (await repondreRessource(requete(), envoi, cible)).text()).toContain("Aucune modification effectuée");
  expect(m.preparer).not.toHaveBeenCalled(); expect(m.executer).not.toHaveBeenCalled();
});
it("persiste la commande avant de relire et appliquer ses effets", async () => {
  m.comprendre.mockResolvedValue({ action: "corriger" });
  await (await repondreRessource(requete(), envoi, cible)).text();
  expect(m.charger).toHaveBeenCalledTimes(2);
  expect(m.preparer.mock.invocationCallOrder[0]).toBeLessThan(m.executer.mock.invocationCallOrder[0]);
});

it("retrouve une déclaration terminée sans consulter ni réparer les liens", async () => {
  m.verifier.mockReturnValue({ terminee: true, choix: { action: "declarer" }, recu: "J’ai conservé vos mots." });
  expect(await (await repondreRessource(requete(), { ...envoi, verifier: true }, cible)).json()).toEqual({ message: "J’ai conservé vos mots." });
  expect(m.lire).not.toHaveBeenCalled(); expect(m.executer).not.toHaveBeenCalled(); expect(m.moteur).not.toHaveBeenCalled();
});

it("émet uniquement le reçu serveur après persistance d'une déclaration", async () => {
  m.comprendre.mockResolvedValue({ action: "declarer", reponse: "Fausse promesse du modèle" });
  m.executer.mockResolvedValue("J’ai conservé votre intention dans vos mots.");
  const texte = await (await repondreRessource(requete(), envoi, cible)).text();
  expect(texte).toContain("J’ai conservé votre intention"); expect(texte).not.toContain("Fausse promesse");
  expect(m.preparer.mock.invocationCallOrder[0]).toBeLessThan(m.executer.mock.invocationCallOrder[0]);
});
