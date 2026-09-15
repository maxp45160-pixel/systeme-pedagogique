import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ lire: vi.fn(), supprimer: vi.fn(), revalider: vi.fn(),document:vi.fn(),modifier:vi.fn(),referentiel:vi.fn(), synchroniser: vi.fn(), dorsale: vi.fn() }));
vi.mock("./depot-documents", () => ({ lireDepotDocumentaire: m.lire, creerDepotDocumentaire: vi.fn(),creerRessourceDocumentaire:vi.fn(), ajouterCorrectionDepot: vi.fn() }));
vi.mock("./documents", () => ({ supprimerDocument: m.supprimer,lireDocument:m.document,modifierDocument:m.modifier, resynchroniserLiensDocument: m.synchroniser }));
vi.mock("./referentiel",()=>({lireReferentiel:m.referentiel}));
vi.mock("./db",()=>({dorsaleCompte:m.dorsale}));
vi.mock("next/cache", () => ({ revalidatePath: m.revalider }));
import { organiserRessourceAssistantAction, rangerRessourceDepotAction, supprimerDepotAction } from "./depot-actions";
beforeEach(() => { vi.resetAllMocks(); });
it("vérifie le dépôt du compte puis réutilise la suppression documentaire", async () => {
  await supprimerDepotAction("depot-1");
  expect(m.lire).toHaveBeenCalledWith("depot-1");
  expect(m.lire.mock.invocationCallOrder[0]).toBeLessThan(m.supprimer.mock.invocationCallOrder[0]);
  expect(m.supprimer).toHaveBeenCalledWith("depot-1");
  expect(m.revalider).toHaveBeenCalledWith("/app");
  expect(m.revalider).toHaveBeenCalledWith("/atelier");
});

function preparerAutomatique() {
  const depot = { id: "doc", version: 2, titre: "Original", type: "reference", modifieLe: "v1", competencesLiees: [], analyses: [{ id: "analyse", statut: "terminee", creeLe: "2026-09-13", restitution: { version: 2, organisation: { titreSuggere: "Probabilités", typeSuggere: "cours", domaine: { mode: "existant", id: "math" }, competences: [{ mode: "existante", code: "MAT-01" }] } } }] };
  m.lire.mockResolvedValue(depot);
  m.dorsale.mockResolvedValue({ userId: "compte" });
  m.referentiel.mockResolvedValue({ domaines: [{ id: "math", nom: "Mathématiques", prefixe: "MAT", description: "" }], domainesParId: new Map(), actifs: [{ code: "MAT-01", intitule: "Calculer une probabilité", domaine: "math" }] });
  m.document.mockResolvedValue({ contenuMd: "---\ntitle: Original\ntype: reference\nrole: support\n---\n# Original\n", frontmatter: {} });
  return depot;
}
it("le chemin autonome dérive le rangement du serveur sans simuler une revue humaine", async () => {
  preparerAutomatique();
  await organiserRessourceAssistantAction("doc", "analyse");
  expect(m.modifier).toHaveBeenCalledWith("doc", expect.stringContaining("rangement_origine: assistant"), false, "v1");
  expect(m.modifier.mock.calls[0][1]).toContain("- [[MAT-01]]");
  expect(m.modifier.mock.calls[0][1]).not.toContain("referentiel_revu_le");
});
it("un rejeu après un rangement ne réécrit pas la fiche et répare l'index", async () => {
  const depot = preparerAutomatique();
  m.lire.mockResolvedValue({ ...depot, rangementRevuLe: "hier", rangementAnalyseId: "analyse" });
  await organiserRessourceAssistantAction("doc", "analyse");
  expect(m.modifier).not.toHaveBeenCalled();
  expect(m.synchroniser).toHaveBeenCalledWith("doc");
});
it("ne confirme pas un rangement si la réparation de ses liens échoue", async () => {
  const depot = preparerAutomatique();
  m.lire.mockResolvedValue({ ...depot, rangementRevuLe: "hier", rangementAnalyseId: "analyse" });
  m.synchroniser.mockRejectedValue(new Error("Index indisponible"));
  await expect(organiserRessourceAssistantAction("doc", "analyse")).rejects.toThrow("Index indisponible");
});
it("refuse une ancienne analyse et transmet le conflit de version sans écrasement", async () => {
  preparerAutomatique();
  await expect(organiserRessourceAssistantAction("doc", "ancienne")).rejects.toThrow("changé");
  expect(m.modifier).not.toHaveBeenCalled();
  m.modifier.mockRejectedValue(new Error("Document modifié ailleurs"));
  await expect(organiserRessourceAssistantAction("doc", "analyse")).rejects.toThrow("modifié ailleurs");
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

it("interdit le rangement avant la revue distincte du référentiel",async()=>{
  m.lire.mockResolvedValue({version:2,referentielAnalyseId:undefined,analyses:[{id:"analyse-2",creeLe:"2026-09-09T10:00:00Z",restitution:{version:2,organisation:{}}}]});
  await expect(rangerRessourceDepotAction("doc",{titre:"Cours",type:"cours",codes:[],analyseId:"analyse-2"},"version-1")).rejects.toThrow("Relisez d'abord");
  expect(m.modifier).not.toHaveBeenCalled();
});

it("valide les codes actifs et écrit le rangement avec contrôle de version",async()=>{
  const depot={version:2,referentielAnalyseId:"analyse-2",rangementAnalyseId:undefined,analyses:[{id:"analyse-2",creeLe:"2026-09-09T10:00:00Z",restitution:{version:2,organisation:{}}}]};
  m.lire.mockResolvedValue(depot);
  m.referentiel.mockResolvedValue({domaines:[{id:"philo",archive:false}],actifs:[{code:"PHI-01"}]});
  m.document.mockResolvedValue({contenuMd:"---\ntitle: Ancien\ntype: reference\nrole: support\n---\n\n# Ancien\n",frontmatter:{}});
  await rangerRessourceDepotAction("doc",{titre:"Cours",type:"cours",domaineId:"philo",codes:["PHI-01"],analyseId:"analyse-2"},"version-1");
  expect(m.modifier).toHaveBeenCalledWith("doc",expect.stringContaining("- [[PHI-01]]"),false,"version-1");
  expect(m.modifier.mock.calls[0][1]).toContain("rangement_statut: rangee");
});
