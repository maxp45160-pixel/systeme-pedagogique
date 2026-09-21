import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ dorsale: vi.fn(), document: vi.fn() }));
vi.mock("./depot-budget", () => ({ comptePiloteDepot: m.dorsale }));
vi.mock("./documents", () => ({ lireDocument: m.document, creerDocument: vi.fn() }));
vi.mock("./document-attachments", () => ({ lirePiecesJointes: async () => [] }));
import { lireDepotDocumentaire } from "./depot-documents";
import { encoderBrouillonClassement } from "@/lib/documents/brouillon-classement";
import { definirChampsFrontMatter, parserFrontMatter } from "@/lib/documents/markdown";

beforeEach(() => {
  vi.resetAllMocks();
  m.dorsale.mockResolvedValue({ userId: "compte", supabase: { from: () => {
    const query = { select: () => query, eq: () => query, order: async () => ({ data: [], error: null }) }; return query;
  } } });
});
it("expose le brouillon réellement conservé tout en gardant sa source analyse et la note originale", async () => {
  const brouillon = { analyseId: "analyse-originale", domaine: { mode: "nouveau" as const, nom: "Mathématiques" }, codes: [], propositions: [], origine: "personne" as const, modifieLe: "2026-09-15T22:10:00Z" };
  const contenuMd = definirChampsFrontMatter("---\ntitle: Livret\nrole: support\ndepot_version: 2\n---\n# Livret\n\nTexte original.", { classement_brouillon: encoderBrouillonClassement(brouillon) });
  m.document.mockResolvedValue({ contenuMd, frontmatter: parserFrontMatter(contenuMd).frontMatter, titre: "Livret", type: "cours", createdAt: "2026-09-15T20:00:00Z", updatedAt: "2026-09-15T22:10:00.123456+00:00" });
  const depot = await lireDepotDocumentaire("doc");
  expect(depot.brouillonClassement).toEqual(brouillon);
  expect(depot.modifieLe).toBe("2026-09-15T22:10:00.123456+00:00");
  expect(depot.domaineId).toBeUndefined();
  expect(depot.note).toBe("Texte original.");
  expect(depot.analyses).toEqual([]);
});
it("ne transforme pas un brouillon illisible en retour silencieux à une proposition modèle", async () => {
  m.document.mockResolvedValue({ contenuMd: "---\ndepot_version: 2\n---\n# Livret", frontmatter: { depot_version: 2, classement_brouillon: "%zz" } });
  await expect(lireDepotDocumentaire("doc")).rejects.toThrow("pas été remplacé");
});

const correction = { indice: 0, verbeAction: "calculer", objet: "une proportion" };
const recu = (overrides = {}) => Buffer.from(JSON.stringify({ cle: "a".repeat(64), base: "b".repeat(64), analyseId: "analyse-originale", terminee: true, corrections: [correction], ...overrides })).toString("base64url");

it("expose les corrections confirmées après effacement du brouillon sans réécrire les sources", async () => {
  const contenuMd = definirChampsFrontMatter("---\ntitle: Livret\nrole: support\ndepot_version: 2\n---\n# Livret\n\nTexte original.", { classement_brouillon: "", classement_confirmation: recu() });
  m.document.mockResolvedValue({ contenuMd, frontmatter: parserFrontMatter(contenuMd).frontMatter });
  const depot = await lireDepotDocumentaire("doc");
  expect(depot.brouillonClassement).toBeUndefined();
  expect(depot.correctionsClassement).toEqual({ analyseId: "analyse-originale", corrections: [correction] });
  expect(depot.note).toBe("Texte original.");
  expect(depot.analyses).toEqual([]);
});

it.each([{ terminee: false }, { corrections: undefined }])("n'expose pas comme confirmée une correction interrompue ou absente", async (overrides) => {
  m.document.mockResolvedValue({ contenuMd: "---\ndepot_version: 2\n---\n# Livret", frontmatter: { depot_version: 2, classement_confirmation: recu(overrides) } });
  expect((await lireDepotDocumentaire("doc")).correctionsClassement).toBeUndefined();
});

it.each([recu({ corrections: [{ ...correction, verbeAction: "comprendre" }] }), recu({ corrections: [{ ...correction, sources: [] }] }), recu({ analyseId: "" }), "%zz"])("refuse un reçu humain altéré au lieu de revenir au modèle", async (confirmation) => {
  m.document.mockResolvedValue({ contenuMd: "---\ndepot_version: 2\n---\n# Livret", frontmatter: { depot_version: 2, classement_confirmation: confirmation } });
  await expect(lireDepotDocumentaire("doc")).rejects.toThrow("corrections humaines");
});
