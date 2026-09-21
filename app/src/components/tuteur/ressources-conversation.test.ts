import { afterEach, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const m = vi.hoisted(() => ({ lire: vi.fn(), rattacher: vi.fn() }));
vi.mock("@/lib/store/delegation-classement-actions", () => ({ rattacherDomaineDelegueAction: m.rattacher }));
vi.mock("@/lib/store/ressource-assistant-actions", () => ({ lireRessourceAssistantAction: m.lire, identifierRessourcesAssistantAction: vi.fn() }));
vi.mock("./modale-ressources", () => ({ ActionsRelectureRessources: () => null, RelectureRessources: () => null }));
import { autorisationCorrespond, preparerLigne, preparationsChargees, selectionAnalyseAutomatique, rattacherApresPremiereLecture, etatLectureSuivante, selectionReprise, descriptionLecture, syntheseAReprendre, SectionsNonAnalysees } from "./ressources-conversation";

it("rattache après la première lecture seulement, jamais en réouvrant ou en reprenant une analyse historique", async () => {
  type Ligne = Parameters<typeof rattacherApresPremiereLecture>[0];
  const avant = { id: "doc", selectionnee: false, ressource: { depot: { analyses: [] } } } as unknown as Ligne;
  const apres = { ...avant, ressource: { depot: { analyses: [{ id: "a" }], modifieLe: "v2" } } } as unknown as Ligne;
  m.rattacher.mockResolvedValue({ statut: "rattache", ressource: { ...apres.ressource!.depot, domaineId: "math" } });
  expect((await rattacherApresPremiereLecture(avant, apres, "a")).ressource?.depot.domaineId).toBe("math");
  expect(m.rattacher).toHaveBeenCalledWith("doc", "a", "v2");
  await rattacherApresPremiereLecture(apres, apres, "a");
  expect(m.rattacher).toHaveBeenCalledTimes(1);
});

it("une réponse de classement perdue garde la lecture et ne relance pas l'IA", async () => {
  type Ligne = Parameters<typeof rattacherApresPremiereLecture>[0];
  const avant = { id: "doc", selectionnee: false, ressource: { depot: { analyses: [] } } } as unknown as Ligne;
  const apres = { ...avant, ressource: { depot: { analyses: [{ id: "a" }], modifieLe: "v2" } } } as unknown as Ligne;
  m.rattacher.mockRejectedValue(new Error("Réponse perdue"));
  m.lire.mockRejectedValueOnce(new Error("Lecture indisponible"));
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  const resultat = await rattacherApresPremiereLecture(avant, apres, "a");
  expect(resultat.ressource).toBe(apres.ressource);
  expect(resultat.erreurClassement).toContain("Relisez l’état enregistré");
  expect(fetch).not.toHaveBeenCalled();
});

it("relit la réservation après une réponse perdue sans relancer l’analyse", async () => {
  type Ligne = Parameters<typeof rattacherApresPremiereLecture>[0];
  const avant = { id: "doc", selectionnee: false, ressource: { depot: { analyses: [] } } } as unknown as Ligne;
  const apres = { ...avant, ressource: { depot: { analyses: [{ id: "a" }], modifieLe: "v2" } } } as unknown as Ligne;
  const enregistree = { depot: { ...apres.ressource!.depot, creationDomaineDeleguee: { statut: "reservee", nom: "Science" } } };
  m.rattacher.mockRejectedValueOnce(new Error("Réponse perdue"));
  m.lire.mockResolvedValueOnce(enregistree);
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  const resultat = await rattacherApresPremiereLecture(avant, apres, "a");
  expect(resultat.ressource).toBe(enregistree);
  expect(m.lire).toHaveBeenCalledWith("doc");
  expect(fetch).not.toHaveBeenCalled();
});

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

it("exclut un document confirmé introuvable même si une préparation précédente était disponible", async () => {
  m.lire.mockResolvedValue({ depot: { analyses: [] } });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ disponible: true, analyseExistante: null })));
  const ligne = await preparerLigne("ancien-lien", null);
  expect(selectionAnalyseAutomatique([ligne])).toEqual([ligne]);
  expect(selectionAnalyseAutomatique([{ ...ligne, introuvable: true }])).toEqual([]);
});

it("prépare les pages suivantes d'un résultat conservé sans les sélectionner pour une analyse automatique", async () => {
  const ressource = { depot: { analyses: [{ id: "historique", statut: "terminee", creeLe: "2026-09-16", restitution: { version: 2 } }] } };
  m.lire.mockResolvedValue(ressource);
  const tranches = [{ pieceId: "pdf", nom: "Livret.pdf", pages: [21, 22], totalPages: 22 }];
  const fetch = vi.fn()
    .mockResolvedValueOnce(Response.json({ disponible: true, analyseExistante: null, tranches }))
    .mockResolvedValueOnce(Response.json({ disponible: false, analyseExistante: null, tranches: [] }));
  vi.stubGlobal("fetch", fetch);
  const ligne = await preparerLigne("livret", null);
  expect(ligne).toMatchObject({ ressource, selectionnee: true, preparation: { tranches } });
  expect(selectionAnalyseAutomatique([ligne])).toEqual([]);
  expect(await preparerLigne("livret", null)).toMatchObject({ ressource, selectionnee: false });
  expect(fetch).toHaveBeenCalledTimes(2);
  for (const appel of fetch.mock.calls) expect(appel).toHaveLength(1); // Préparation GET, aucune analyse payante.
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

function ligneSuivante() {
  return { id: "livret", selectionnee: true, ressource: { depot: {
    titre: "Livret", analyses: [{ id: "premiere", statut: "terminee", creeLe: "2026-09-19", restitution: { version: 2 } }],
    rangementAnalyseId: "premiere", rangementOrigine: "personne",
  } }, preparation: { disponible: true, analyseExistante: null, pagesRestantes: 0, coutMaximumMicroEuros: 123456,
    tranches: [{ pieceId: "p", nom: "Livret.pdf", totalPages: 22, pages: [21, 22] }],
  } } as unknown as Parameters<typeof etatLectureSuivante>[0];
}

it("la suite exige un choix humain confirmé et ne rejoint ni lancement automatique ni reprise", () => {
  const ligne = ligneSuivante();
  expect(etatLectureSuivante(ligne)).toBe("disponible"); // pagesRestantes=0 : deux pages sont encore préparées.
  expect(selectionAnalyseAutomatique([ligne])).toEqual([]);
  expect(selectionReprise([ligne])).toEqual([]);
  for (const modification of [{ rangementOrigine: "assistant" }, { rangementAnalyseId: "autre" }, { brouillonClassement: { analyseId: "premiere" } }]) {
    const changee = { ...ligne, ressource: { ...ligne.ressource!, depot: { ...ligne.ressource!.depot, ...modification } } } as typeof ligne;
    expect(etatLectureSuivante(changee)).toBe("a-confirmer");
  }
});

it("n'offre jamais comme suite une réussite existante, synthèse ou tranche vide", () => {
  const ligne = ligneSuivante();
  for (const modification of [{ analyseExistante: { statut: "terminee" } }, { syntheseDe: "premiere" }, { tranches: [] }]) {
    expect(etatLectureSuivante({ ...ligne, preparation: { ...ligne.preparation!, ...modification } } as typeof ligne)).toBe("absente");
  }
  expect(etatLectureSuivante({ ...ligne, preparation: { ...ligne.preparation!, disponible: false } })).toBe("indisponible");
  expect(etatLectureSuivante({ ...ligne, preparation: { ...ligne.preparation!, coutMaximumMicroEuros: NaN } })).toBe("indisponible");
});

it("présente les pages ou sections exactes, le fournisseur et le plafond sans arrondi minorant", () => {
  const preparation = ligneSuivante().preparation!;
  expect(descriptionLecture(preparation)).toBe("Mistral · Livret.pdf : pages 21, 22 · au maximum 0.123456 €.");
  expect(descriptionLecture({ ...preparation, fournisseur: "qwen", coutMaximumMicroDollars: 123457,
    tranches: [{ ...preparation.tranches[0], nom: "Livre.epub", unite: "section" }],
  })).toBe("Qwen · Livre.epub : sections 21, 22 · au maximum 0.123457 $.");
});

it("après échec de la tranche suivante, reprend les pages manquantes et jamais la synthèse précédente", () => {
  const ligne = ligneSuivante();
  ligne.ressource!.depot.analyses[0].couvertures = [{ pieceId: "p", nom: "Livret.pdf", totalPages: 22, pagesLues: Array.from({ length: 20 }, (_, i) => i + 1) }];
  ligne.ressource!.depot.analyses.push({ ...ligne.ressource!.depot.analyses[0], id: "suivante", creeLe: "2026-09-20", statut: "echec", restitution: null });
  expect(syntheseAReprendre(ligne.ressource!)).toBeUndefined();
  expect(etatLectureSuivante(ligne)).toBe("absente");
  expect(selectionReprise([ligne])).toEqual([ligne]);
});

it("annonce les sections sans texte avant la lecture et les conserve visibles après épuisement", () => {
  const preparation = { ...ligneSuivante().preparation!, sectionsNonAnalysees: [{ pieceId: "p", nom: "Livre.epub", sections: [
    { chemin: "OPS/planches/figure.xhtml", titre: "Planche des vecteurs", limites: ["Illustration non analysée."] },
  ] }] };
  const avant = renderToStaticMarkup(createElement(SectionsNonAnalysees, { preparation }));
  const apres = renderToStaticMarkup(createElement(SectionsNonAnalysees, { preparation: { ...preparation, disponible: false, tranches: [], pagesRestantes: 0 } }));
  expect(apres).toBe(avant);
  for (const texte of ["Sections non analysées", "Livre.epub", "Planche des vecteurs", "OPS/planches/figure.xhtml", "Illustration non analysée.", "n’ont pas été analysés"]) expect(apres).toContain(texte);
  expect(apres).not.toContain("<button");
  expect(descriptionLecture(preparation)).toContain("1 section(s) sans texte restent non analysées");
  expect(preparation.tranches[0].pages).toEqual([21, 22]);
});

it("n'affiche aucune exclusion fictive quand toutes les sections ont du texte", () => {
  expect(renderToStaticMarkup(createElement(SectionsNonAnalysees, { preparation: ligneSuivante().preparation! }))).toBe("");
});
