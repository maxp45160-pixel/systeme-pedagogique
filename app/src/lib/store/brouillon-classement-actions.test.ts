import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ depot: vi.fn(), document: vi.fn(), modifier: vi.fn(), referentiel: vi.fn() }));
vi.mock("./depot-documents", () => ({ lireDepotDocumentaire: m.depot }));
vi.mock("./documents", () => ({ lireDocument: m.document, modifierDocument: m.modifier }));
vi.mock("./referentiel", () => ({ lireReferentiel: m.referentiel }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { enregistrerBrouillonClassementAction } from "./brouillon-classement-actions";
import { lireBrouillonClassement, type EntreeBrouillonClassement } from "@/lib/documents/brouillon-classement";
import { parserFrontMatter } from "@/lib/documents/markdown";

const entree: EntreeBrouillonClassement = { documentId: "doc", analyseId: "a", updatedAtAttendu: "v1", domaine: { mode: "nouveau", nom: "Mathématiques" }, codes: [], propositions: [0] };
let md: string;
let version: number;
beforeEach(() => {
  vi.resetAllMocks(); version = 1;
  md = "---\ntitle: Livret\nrole: support\ndepot_version: 2\n---\n# Livret\n\nTexte original.";
  m.depot.mockImplementation(async () => ({ id: "doc", version: 2, modifieLe: `v${version}`, brouillonClassement: lireBrouillonClassement(parserFrontMatter(md).frontMatter.classement_brouillon), analyses: [{ id: "a", statut: "terminee", creeLe: "2026-09-15", restitution: { version: 2, organisation: { domaine: { mode: "existant", id: "logistique" }, competences: [{ mode: "nouvelle", intitule: "Calculer une proportion" }] } } }] }));
  m.document.mockImplementation(async () => ({ contenuMd: md, updatedAt: `v${version}`, frontmatter: parserFrontMatter(md).frontMatter }));
  m.referentiel.mockResolvedValue({ domaines: [{ id: "logistique", archive: false }, { id: "archive", archive: true }], actifs: [{ code: "MAT-01" }] });
  m.modifier.mockImplementation(async (_id, contenu, _capture, attendue) => { if (attendue !== `v${version}`) throw new Error("Conflit de version"); md = contenu; version++; return { updatedAt: `v${version}` }; });
});

it("enregistre un brouillon humain puis relit sa version sans modifier analyse ni classement", async () => {
  const retour = await enregistrerBrouillonClassementAction(entree);
  expect(retour.modifieLe).toBe("v2");
  expect(retour.brouillonClassement).toMatchObject({ analyseId: "a", domaine: { mode: "nouveau", nom: "Mathématiques" }, origine: "personne" });
  expect(retour.analyses[0].restitution).toMatchObject({ organisation: { domaine: { id: "logistique" } } });
  const f = parserFrontMatter(md).frontMatter;
  expect(f.domaine).toBeUndefined(); expect(f.classement_confirmation).toBeUndefined(); expect(f.rangement_revu_le).toBeUndefined();
  expect(md).toContain("Texte original.");
  expect(m.modifier).toHaveBeenCalledWith("doc", expect.any(String), false, "v1");
});
it("reprend une réponse perdue sans réécrire le même brouillon", async () => {
  await enregistrerBrouillonClassementAction(entree);
  expect((await enregistrerBrouillonClassementAction(entree)).modifieLe).toBe("v2");
  expect(m.modifier).toHaveBeenCalledTimes(1);
});
it("refuse un autre compte via le lecteur et ne touche aucune écriture", async () => {
  m.depot.mockRejectedValueOnce(new Error("Dépôt introuvable"));
  await expect(enregistrerBrouillonClassementAction(entree)).rejects.toThrow("introuvable");
  expect(m.modifier).not.toHaveBeenCalled();
});
it("refuse les références archivées et propositions absentes", async () => {
  for (const v of [{ ...entree, domaine: { mode: "existant" as const, id: "archive" } }, { ...entree, domaine: { mode: "nouveau" as const, nom: "Maths", parentId: "archive" } }, { ...entree, codes: ["INCONNU"] }, { ...entree, propositions: [5] }]) await expect(enregistrerBrouillonClassementAction(v)).rejects.toThrow();
  expect(m.modifier).not.toHaveBeenCalled();
});
it("refuse une version périmée et une analyse remplacée", async () => {
  await expect(enregistrerBrouillonClassementAction({ ...entree, updatedAtAttendu: "ancienne" })).rejects.toThrow("modifiée");
  await expect(enregistrerBrouillonClassementAction({ ...entree, analyseId: "ancienne" })).rejects.toThrow("analyse");
  expect(m.modifier).not.toHaveBeenCalled();
});
it("deux brouillons différents de la même version ne peuvent pas s'écraser", async () => {
  const modifier = m.modifier.getMockImplementation()!;
  let arrivees = 0; let liberer!: () => void;
  const barriere = new Promise<void>((resolve) => { liberer = resolve; });
  m.modifier.mockImplementation(async (...args) => { arrivees++; if (arrivees === 2) liberer(); await barriere; return modifier(...args); });
  const r = await Promise.allSettled([enregistrerBrouillonClassementAction(entree), enregistrerBrouillonClassementAction({ ...entree, domaine: null })]);
  expect(r.map((v) => v.status).sort()).toEqual(["fulfilled", "rejected"]);
  expect(version).toBe(2);
});
it("revérifie l'analyse après les validations du référentiel et avant l'écriture", async () => {
  const depot = await m.depot();
  m.depot.mockResolvedValueOnce(depot).mockResolvedValueOnce({ ...depot, analyses: [...depot.analyses, { id: "nouvelle", creeLe: "2026-09-16", statut: "en-cours", restitution: null }] });
  await expect(enregistrerBrouillonClassementAction(entree)).rejects.toThrow("analyse");
  expect(m.modifier).not.toHaveBeenCalled();
});
