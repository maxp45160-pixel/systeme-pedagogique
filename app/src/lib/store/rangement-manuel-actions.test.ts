import { beforeEach, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  lireDepot: vi.fn(), lireDocument: vi.fn(), modifier: vi.fn(), synchroniser: vi.fn(), referentiel: vi.fn(), revalider: vi.fn(),
}));
vi.mock("./depot-documents", () => ({ lireDepotDocumentaire: m.lireDepot }));
vi.mock("./documents", () => ({ lireDocument: m.lireDocument, modifierDocument: m.modifier, resynchroniserLiensDocument: m.synchroniser }));
vi.mock("./referentiel", () => ({ lireReferentiel: m.referentiel }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalider }));

import { enregistrerRangementManuelSansAnalyseAction } from "./rangement-manuel-actions";

const version = "2026-09-24T09:00:00.000Z";
const entree = { documentId: "depot-abc", updatedAtAttendu: version, titre: "Probabilités", type: "cours", domaineId: "maths", codes: ["MAT-01"] };
const source = "---\nid: depot-abc\ndepot_version: 2\nrole: support\ntitle: Document initial\ntype: reference\n---\n# Document initial\n\nExemples de probabilités.\n";

beforeEach(() => {
  vi.resetAllMocks();
  m.lireDepot.mockResolvedValue({ id: "depot-abc", version: 2, modifieLe: version, titre: "Document initial", type: "reference", analyses: [], competencesLiees: [] });
  m.lireDocument.mockResolvedValue({ id: "depot-abc", contenuMd: source, frontmatter: { depot_version: "2" }, updatedAt: version });
  m.referentiel.mockResolvedValue({ domaines: [{ id: "maths", archive: false }], actifs: [{ code: "MAT-01" }] });
  m.modifier.mockResolvedValue({ updatedAt: "2026-09-24T09:01:00.000Z" });
  m.synchroniser.mockResolvedValue(undefined);
});

it("range un dépôt V2 sans analyse, sous CAS, en gardant sa note et sans analyse fictive", async () => {
  await enregistrerRangementManuelSansAnalyseAction(entree);
  expect(m.modifier).toHaveBeenCalledTimes(1);
  const [id, contenu, revision, attendu] = m.modifier.mock.calls[0] as [string, string, boolean, string];
  expect([id, revision, attendu]).toEqual(["depot-abc", false, version]);
  expect(contenu).toContain("Exemples de probabilités.");
  expect(contenu).toContain("domaine: maths");
  expect(contenu).toContain("rangement_origine: personne");
  expect(contenu).toContain("rangement_analyse_id:");
  expect(contenu).not.toMatch(/rangement_analyse_id: \S/);
  expect(contenu).toContain("- [[MAT-01]]");
  expect(m.synchroniser).not.toHaveBeenCalled(); // modifierDocument synchronise déjà l'index.
  expect(m.revalider).toHaveBeenCalledWith("/app");
});

it("accepte le rangement explicite quand une analyse ancienne a réussi et la dernière a échoué", async () => {
  m.lireDepot.mockResolvedValue({ id: "depot-abc", version: 2, modifieLe: version, analyses: [
    { id: "analyse-a", statut: "terminee", restitution: { version: 2, organisation: {} } },
    { id: "analyse-b", statut: "echec", restitution: null },
  ], competencesLiees: [] });
  await enregistrerRangementManuelSansAnalyseAction({ ...entree, domaineId: undefined, codes: [] });
  const contenu = m.modifier.mock.calls[0][1] as string;
  expect(contenu).toContain("rangement_statut: a-trier");
  expect(contenu).toContain("domaine:");
  expect(contenu).not.toMatch(/rangement_analyse_id: \S/);
});

it("reconnaît un choix déjà écrit après une réponse perdue et resynchronise les liens", async () => {
  await enregistrerRangementManuelSansAnalyseAction(entree);
  const contenu = m.modifier.mock.calls[0][1] as string;
  const empreinte = contenu.match(/^rangement_empreinte: (\S+)/m)?.[1];
  expect(empreinte).toBeTruthy();
  m.modifier.mockClear();
  m.synchroniser.mockClear();
  m.lireDepot.mockResolvedValue({ id: "depot-abc", version: 2, modifieLe: "2026-09-24T09:01:00.000Z", titre: "Probabilités", type: "cours", domaineId: "maths", rangementStatut: "rangee", analyses: [], competencesLiees: ["MAT-01"] });
  m.lireDocument.mockResolvedValue({ id: "depot-abc", contenuMd: contenu, updatedAt: "2026-09-24T09:01:00.000Z", frontmatter: { depot_version: "2", rangement_empreinte: empreinte, rangement_origine: "personne", rangement_analyse_id: "" } });
  await enregistrerRangementManuelSansAnalyseAction(entree);
  expect(m.modifier).not.toHaveBeenCalled();
  expect(m.synchroniser).toHaveBeenCalledWith("depot-abc");
});

it("ne prend pas une ancienne empreinte pour preuve si la section a été éditée ensuite", async () => {
  await enregistrerRangementManuelSansAnalyseAction(entree);
  const contenu = m.modifier.mock.calls[0][1] as string;
  const empreinte = contenu.match(/^rangement_empreinte: (\S+)/m)?.[1];
  m.modifier.mockClear();
  m.lireDepot.mockResolvedValue({ id: "depot-abc", version: 2, modifieLe: "2026-09-24T09:02:00.000Z", titre: "Probabilités", type: "cours", domaineId: "maths", rangementStatut: "rangee", analyses: [], competencesLiees: [] });
  m.lireDocument.mockResolvedValue({ id: "depot-abc", contenuMd: contenu, updatedAt: "2026-09-24T09:02:00.000Z", frontmatter: { depot_version: "2", rangement_empreinte: empreinte, rangement_origine: "personne", rangement_analyse_id: "" } });
  await expect(enregistrerRangementManuelSansAnalyseAction(entree)).rejects.toThrow("modifiée");
  expect(m.modifier).not.toHaveBeenCalled();
});

it("refuse les changements concurrents et les valeurs non fiables avant toute écriture", async () => {
  await expect(enregistrerRangementManuelSansAnalyseAction({ ...entree, updatedAtAttendu: "ancienne" })).rejects.toThrow("modifiée");
  await expect(enregistrerRangementManuelSansAnalyseAction({ ...entree, domaineId: "archive" })).rejects.toThrow("Domaine de rangement inconnu");
  await expect(enregistrerRangementManuelSansAnalyseAction({ ...entree, codes: ["INVENTE"] })).rejects.toThrow("Compétence de rangement inconnue");
  await expect(enregistrerRangementManuelSansAnalyseAction({ ...entree, codes: ["MAT-01", "MAT-01"] })).rejects.toThrow("répétées");
  expect(m.modifier).not.toHaveBeenCalled();
});

it("n'atteint pas la mutation si la ressource est étrangère ou V1", async () => {
  m.lireDepot.mockRejectedValueOnce(new Error("Dépôt introuvable."));
  await expect(enregistrerRangementManuelSansAnalyseAction(entree)).rejects.toThrow("introuvable");
  m.lireDepot.mockResolvedValueOnce({ version: 1 });
  await expect(enregistrerRangementManuelSansAnalyseAction(entree)).rejects.toThrow("compatible");
  expect(m.modifier).not.toHaveBeenCalled();
});
