import { afterEach, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ lire: vi.fn() }));
vi.mock("@/lib/store/ressource-assistant-actions", () => ({ lireRessourceAssistantAction: m.lire, identifierRessourcesAssistantAction: vi.fn() }));
vi.mock("./modale-ressources", () => ({ ActionsRelectureRessources: () => null, RelectureRessources: () => null }));
import { autorisationCorrespond, lectureAProposer, preparerLigne, preparationsChargees, selectionAnalyseAutomatique } from "./ressources-conversation";

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

it("prépare le complément par GET sur l'analyse choisie, sans transmettre les documents au modèle",async()=>{
  const ressource={depot:{titre:"Livret",analyses:[{id:"ancienne",statut:"terminee",restitution:{version:2}}]}};
  m.lire.mockResolvedValue(ressource);
  const fetch=vi.fn().mockResolvedValue(Response.json({disponible:true,syntheseDe:"ancienne",analyseExistante:null}));
  vi.stubGlobal("fetch",fetch);
  const ligne=await preparerLigne("livret",null,undefined,"ancienne");
  expect(fetch).toHaveBeenCalledTimes(1);expect(fetch.mock.calls[0]).toHaveLength(1);
  expect(fetch.mock.calls[0][0]).toContain("syntheseDe=ancienne");
  expect(ligne).toMatchObject({ressource,selectionnee:true,preparation:{syntheseDe:"ancienne"}});
});

it("ne sélectionne pas un consentement de complément provenant d'une autre lecture",async()=>{
  const ressource={depot:{titre:"Livret",analyses:[]}};
  m.lire.mockResolvedValue(ressource);
  vi.stubGlobal("fetch",vi.fn().mockResolvedValue(Response.json({disponible:true,syntheseDe:"autre"})));
  expect(await preparerLigne("livret",null,undefined,"ancienne")).toMatchObject({ressource,selectionnee:false,erreur:expect.any(String)});
});

it("conserve le nom et l'analyse disponibles si la préparation réseau échoue", async () => {
  const ressource = { depot: { titre: "Livret de calcul", analyses: [{ statut: "terminee", restitution: { version: 2 } }] } };
  m.lire.mockResolvedValue(ressource);
  const fetch = vi.fn().mockRejectedValue(new Error("Réseau indisponible"));
  vi.stubGlobal("fetch", fetch);
  const ligne = await preparerLigne("livret", null);
  expect(ligne.ressource).toBe(ressource);
  expect(ligne.selectionnee).toBe(false);
  expect(ligne.erreur).toContain("résultats déjà obtenus restent affichés");
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0]).toHaveLength(1); // GET uniquement, aucune analyse payante.
});

it("n'invite pas à analyser ou actualiser un document confirmé introuvable", () => {
  expect(lectureAProposer({ id: "ancien-lien", introuvable: true, selectionnee: false })).toBe(false);
});

it("conserve aussi l'analyse lorsque la préparation renvoie une erreur HTTP", async () => {
  const ressource = { depot: { titre: "Notes de cours", analyses: [] } };
  m.lire.mockResolvedValue(ressource);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({}, { status: 503 })));
  expect(await preparerLigne("notes", null)).toMatchObject({ ressource, selectionnee: false, erreur: expect.any(String) });
});

it("affiche la ressource avant la fin de la préparation d'une nouvelle analyse", async () => {
  const ressource = { depot: { titre: "Livret de calcul", analyses: [] } };
  m.lire.mockResolvedValue(ressource);
  let terminer!: (reponse: Response) => void;
  const attente = new Promise<Response>((resolve) => { terminer = resolve; });
  vi.stubGlobal("fetch", vi.fn(() => attente));
  const afficher = vi.fn();
  const lecture = preparerLigne("livret", null, afficher);
  await Promise.resolve();
  expect(afficher).toHaveBeenCalledWith(ressource);
  expect(preparationsChargees([{ id: "livret", selectionnee: false }])).toBe(false);
  terminer(Response.json({}, { status: 503 }));
  await lecture;
});

it("attend le devis puis ne lance automatiquement que des dépôts neufs autorisés", async () => {
  m.lire.mockResolvedValue({ depot: { analyses: [] } });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ disponible: true, coutMaximumMicroEuros: 100, budgetRestantMicroEuros: 500, analyseExistante: null })));
  const ligne = await preparerLigne("neuf", null);
  expect(preparationsChargees([{ ...ligne, preparation: undefined }])).toBe(false);
  expect(preparationsChargees([ligne])).toBe(true);
  expect(selectionAnalyseAutomatique([ligne])).toEqual([ligne]);
  expect(autorisationCorrespond([ligne], { fournisseur: "mistral", coutMaximum: 100 })).toBe(true);
  expect(autorisationCorrespond([ligne, ligne], { fournisseur: "mistral", coutMaximum: 199 })).toBe(false);
  expect(autorisationCorrespond([ligne], { fournisseur: "qwen", coutMaximum: 100 })).toBe(false);
  expect(selectionAnalyseAutomatique([{ ...ligne, preparation: { ...ligne.preparation!, syntheseDe: "ancienne" } }])).toEqual([]);
});

it.each(["terminee", "echec", "interrompue", "en-cours"])("ne relance pas automatiquement une analyse historique %s", async (statut) => {
  m.lire.mockResolvedValue({ depot: { analyses: [{ id: "historique", statut, creeLe: "2026-09-16" }] } });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ disponible: true, analyseExistante: null })));
  expect(selectionAnalyseAutomatique([await preparerLigne("historique", null)])).toEqual([]);
});

it("prépare la reprise de synthèse échouée à partir du dernier résultat conservé, uniquement par GET", async () => {
  m.lire.mockResolvedValue({ depot: { analyses: [
    { id: "ancien-resultat", statut: "terminee", creeLe: "2026-09-15", restitution: { version: 2 } },
    { id: "complement-echoue", statut: "echec", creeLe: "2026-09-16" },
  ] } });
  const fetch = vi.fn().mockResolvedValue(Response.json({ disponible: true, syntheseDe: "ancien-resultat" }));
  vi.stubGlobal("fetch", fetch);
  const ligne = await preparerLigne("livret", null);
  expect(fetch.mock.calls[0]).toHaveLength(1);
  expect(fetch.mock.calls[0][0]).toContain("syntheseDe=ancien-resultat");
  expect(ligne.selectionnee).toBe(true);
  expect(selectionAnalyseAutomatique([ligne])).toEqual([]);
});
