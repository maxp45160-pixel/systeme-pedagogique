import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ env: vi.fn() }));
vi.mock("./env-requete", () => ({ envTuteur: m.env }));
import { appelerQwen } from "./qwen-appel";
import { QWEN_MODELE, QWEN_URL, coutQwen } from "./qwen-config";
import { configVersEnv } from "./cle-client";
import { moteurQwen } from "./moteurs/qwen";
import { comprendreAccueil } from "./accueil-tour";
const config = { fournisseur: "qwen" as const, cle: "sk-test-uniquement-factice", urlBase: QWEN_URL, modele: QWEN_MODELE };
beforeEach(() => { vi.resetAllMocks(); vi.stubGlobal("fetch", vi.fn()); m.env.mockResolvedValue({ ok: true, env: {} }); });
it("bloque un changement de région ou de modèle avant l'appel", () => {
  expect(configVersEnv({ ...config, modele: "modele-plus-cher" }).ok).toBe(false);
  expect(configVersEnv({ ...config, urlBase: "https://autre.aliyuncs.com/v1" }).ok).toBe(false);
  expect(configVersEnv(config).ok).toBe(true);
});
it("réserve dans envTuteur avant le réseau et interdit le raisonnement non borné", async () => {
  vi.mocked(fetch).mockResolvedValue(Response.json({ choices: [{ finish_reason: "stop", message: { content: "bonjour" } }] }));
  await appelerQwen(config, { messages: [] }, 3000, 1000);
  expect(m.env.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(fetch).mock.invocationCallOrder[0]);
  const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
  expect(body).toMatchObject({ model: QWEN_MODELE, enable_thinking: false, max_tokens: 1000 });
});
it("ne fait aucun appel réseau lorsque le budget est refusé", async () => {
  m.env.mockResolvedValue({ ok: false, reponse: Response.json({ message: "Budget épuisé" }) });
  await expect(appelerQwen(config, {}, 3000, 1000)).rejects.toThrow("Budget épuisé");
  expect(fetch).not.toHaveBeenCalled();
});
it("ne réessaie pas une erreur fournisseur et ne dévoile pas son corps brut", async () => {
  vi.mocked(fetch).mockResolvedValue(new Response("secret fournisseur", { status: 400 }));
  await expect(appelerQwen(config, {}, 3000, 1000)).rejects.toThrow("HTTP 400");
  expect(fetch).toHaveBeenCalledTimes(1);
});
it("refuse une réponse tronquée avant toute proposition", async () => {
  vi.mocked(fetch).mockResolvedValue(Response.json({ choices: [{ finish_reason: "length", message: { content: "partiel" } }] }));
  const envoyer = vi.fn();
  await moteurQwen(config.cle).repondre({ systemeStable: "test", systemeProfil: "", messages: [], outils: [], envoyer });
  expect(envoyer.mock.calls.some(([event]) => event === "erreur")).toBe(true);
  expect(envoyer.mock.calls.some(([event]) => event === "texte" || event === "proposition" || event === "fin")).toBe(false);
});
it("explique le refus de facturation Qwen dans l’accueil sans exposer le message fournisseur", async () => {
  vi.mocked(fetch).mockResolvedValue(Response.json({ error: { code: "AccessDenied.Unpurchased", message: "secret fournisseur" } }, { status: 403 }));
  await expect(comprendreAccueil(moteurQwen(config.cle), [{ role: "user", content: "test" }], new AbortController().signal)).rejects.toThrow("informations de facturation");
  expect(fetch).toHaveBeenCalledTimes(1);
});
it("borne le volume avant toute dépense et réserve sorties et contexte", () => {
  expect(coutQwen(3000, 1000)).toBe(8000);
  expect(() => coutQwen(120001, 1000)).toThrow();
  expect(() => coutQwen(1000, 8193)).toThrow();
});
