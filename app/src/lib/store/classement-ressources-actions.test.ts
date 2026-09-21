import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ depot: vi.fn(), document: vi.fn(), modifier: vi.fn(), synchroniser: vi.fn(), referentiel: vi.fn(), creer: vi.fn(), deplacer: vi.fn(), taguer: vi.fn(), dorsale: vi.fn(), rpc: vi.fn() }));
vi.mock("./depot-documents", () => ({ lireDepotDocumentaire: m.depot }));
vi.mock("./documents", () => ({ lireDocument: m.document, modifierDocument: m.modifier, resynchroniserLiensDocument: m.synchroniser }));
vi.mock("./referentiel", () => ({ lireReferentiel: m.referentiel }));
vi.mock("./referentiel-actions", () => ({ creerBranche: m.creer, deplacerDomaine: m.deplacer, taguerCompetences: m.taguer }));
vi.mock("./db", () => ({ dorsaleCompte: m.dorsale }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { confirmerClassementRessourcesAction, lireClassementRessourcesAction } from "./classement-ressources-actions";
import { definirChampsFrontMatter, parserFrontMatter } from "@/lib/documents/markdown";
import { encoderBrouillonClassement } from "@/lib/documents/brouillon-classement";
import { referentielDe, domaineDeTest, skillDeTest } from "@/lib/domain/referentiel.fixture";
import type { Domaine, Skill } from "@/lib/domain/types";
import type { ChoixClassementRessource } from "@/lib/documents/classement-ressources";

let domaines: Domaine[];
let skills: Skill[];
let docs: Map<string, { md: string; version: number }>;
let recus: Map<string, { domaine_id: string; type: string }>;
let panneApresCreation: boolean;
let compteur: number;
const choix = (id = "doc"): ChoixClassementRessource => ({ documentId: id, analyseId: "a", updatedAtAttendu: "v1", domaine: { mode: "existant", id: "math" }, codes: [], propositions: [0] });
const nouveau = (id = "doc"): ChoixClassementRessource => ({ ...choix(id), domaine: { mode: "nouveau", nom: "Calcul", parentId: "math", usage: { type: "continu" } } });
function ajouterCompetence(domaine: string, intitule: string) {
  const code = `MAT-${++compteur}`;
  skills.push(skillDeTest(code, domaine, "fondamentaux", 0.5, 0, [], { intitule }));
  return code;
}

const correctionTitre = { indice: 0, verbeAction: "calculer", objet: "une proportion" };

it("crée l'intitulé corrigé, garde sa déclaration et reprend sans doubler ni modifier l'analyse", async () => {
  const c = { ...choix(), corrections: [correctionTitre] };
  expect((await confirmerClassementRessourcesAction([c])).resultats[0].statut).toBe("confirmee");
  expect(skills.map((s) => s.intitule)).toEqual(["Calculer une proportion"]);
  const recu = JSON.parse(Buffer.from(String(parserFrontMatter(docs.get("doc")!.md).frontMatter.classement_confirmation), "base64url").toString("utf8"));
  expect(recu.corrections).toEqual([correctionTitre]);
  expect((await m.depot("doc")).analyses[0].restitution.organisation.competences[0].intitule).toBe("Calculer une probabilité");
  const ecritures = m.modifier.mock.calls.length;
  expect((await confirmerClassementRessourcesAction([c])).resultats[0].statut).toBe("confirmee");
  expect(m.creer).toHaveBeenCalledTimes(1);
  expect(m.modifier).toHaveBeenCalledTimes(ecritures);
  await expect(confirmerClassementRessourcesAction([{ ...c, corrections: [{ ...correctionTitre, objet: "une remise" }] }])).rejects.toThrow("modifiée");
});

it("reprend le titre corrigé après création dont la réponse est perdue", async () => {
  const creer = m.creer.getMockImplementation()!;
  m.creer.mockImplementationOnce(async (...args) => { await creer(...args); throw new Error("Réponse perdue"); });
  const c = { ...choix(), corrections: [correctionTitre] };
  expect((await confirmerClassementRessourcesAction([c])).resultats[0].statut).toBe("echec");
  expect((await confirmerClassementRessourcesAction([c])).resultats[0].statut).toBe("confirmee");
  expect(skills.map((s) => s.intitule)).toEqual(["Calculer une proportion"]);
  expect(m.creer).toHaveBeenCalledTimes(1);
});

it("prévalide les corrections de tout le lot avant effets", async () => {
  await expect(confirmerClassementRessourcesAction([choix(), { ...choix("doc2"), corrections: [{ ...correctionTitre, indice: 9 }] }])).rejects.toThrow("proposition nouvelle");
  await expect(confirmerClassementRessourcesAction([{ ...choix(), corrections: [{ ...correctionTitre, verbeAction: "comprendre" }] }])).rejects.toThrow("invalide");
  expect(m.modifier).not.toHaveBeenCalled(); expect(m.creer).not.toHaveBeenCalled(); expect(m.rpc).not.toHaveBeenCalled();
});

it("refuse des intitulés sélectionnés rendus identiques par une correction", async () => {
  const lire = m.depot.getMockImplementation()!;
  m.depot.mockImplementation(async (...args) => {
    const depot = await lire(...args);
    depot.analyses[0].restitution.organisation.competences.push({ ...depot.analyses[0].restitution.organisation.competences[0], intitule: "Calculer une proportion" });
    return depot;
  });
  await expect(confirmerClassementRessourcesAction([{ ...choix(), propositions: [0, 1], corrections: [correctionTitre] }])).rejects.toThrow("même intitulé");
  expect(m.modifier).not.toHaveBeenCalled(); expect(m.creer).not.toHaveBeenCalled();
});

it("refuse les doublons canoniques Unicode avant tout effet", async () => {
  const lire = m.depot.getMockImplementation()!;
  m.depot.mockImplementation(async (...args) => {
    const depot = await lire(...args);
    depot.analyses[0].restitution.organisation.competences.push({ ...depot.analyses[0].restitution.organisation.competences[0] });
    return depot;
  });
  const corrections = [{ ...correctionTitre, objet: "une accélération" }, { ...correctionTitre, indice: 1, objet: "une acce\u0301le\u0301ration" }];
  await expect(confirmerClassementRessourcesAction([{ ...choix(), propositions: [0, 1], corrections }])).rejects.toThrow("même intitulé");
  expect(m.modifier).not.toHaveBeenCalled(); expect(m.creer).not.toHaveBeenCalled(); expect(m.rpc).not.toHaveBeenCalled();
});

it("refuse une collision corrigée avec une archive et réutilise un homonyme actif unique", async () => {
  const code = ajouterCompetence("math", "Calculer une proportion");
  skills[0].archive = true;
  const c = { ...choix(), corrections: [correctionTitre] };
  await expect(confirmerClassementRessourcesAction([c])).rejects.toThrow("archivée");
  expect(m.modifier).not.toHaveBeenCalled();
  skills[0].archive = false;
  expect((await confirmerClassementRessourcesAction([c])).resultats[0].statut).toBe("confirmee");
  expect(m.creer).not.toHaveBeenCalled();
  expect(m.taguer).toHaveBeenCalledWith("math", [code], true);
});
beforeEach(() => {
  vi.resetAllMocks(); compteur = 0; panneApresCreation = false;
  domaines = [domaineDeTest("math", "Mathématiques", "MAT", 0)]; skills = []; recus = new Map();
  docs = new Map(["doc", "doc2"].map((id) => [id, { version: 1, md: "---\ntitle: Livret\ntype: cours\nrole: support\n---\n# Livret\n\nOriginal conservé." }]));
  m.referentiel.mockImplementation(async () => referentielDe(skills, domaines));
  m.document.mockImplementation(async (id) => { const d = docs.get(id)!; return { contenuMd: d.md, frontmatter: parserFrontMatter(d.md).frontMatter, updatedAt: `v${d.version}` }; });
  m.depot.mockImplementation(async (id) => {
    const d = docs.get(id)!; const f = parserFrontMatter(d.md).frontMatter;
    return { id, version: 2, titre: "Livret", type: "cours", modifieLe: `v${d.version}`, domaineId: f.domaine || undefined, competencesLiees: [...d.md.matchAll(/\[\[(MAT-\d+)\]\]/g)].map((a) => a[1]), analyses: [{ id: "a", creeLe: "2026-09-15", statut: "terminee", restitution: { version: 2, organisation: { competences: [{ mode: "nouvelle", intitule: "Calculer une probabilité", palier: "fondamentaux", importance: 0.5, domaine: { mode: "existant", id: "logistique" } }] } } }] };
  });
  m.modifier.mockImplementation(async (id, md, _capture, version) => { const d = docs.get(id)!; if (`v${d.version}` !== version) throw new Error("Conflit de version"); d.md = md; d.version++; return { updatedAt: `v${d.version}` }; });
  m.creer.mockImplementation(async (s) => { const cible = domaines.find((d) => d.nom === s.domaine)!; const codes = s.competences.map((p: { intitule: string }) => ajouterCompetence(cible.id, p.intitule)); return { domaineId: cible.id, domaineCree: false, codes }; });
  m.deplacer.mockImplementation(async (id, parentId) => { domaines.find((d) => d.id === id)!.parentId = parentId; });
  m.rpc.mockImplementation(async (_nom, args) => {
    const recu = recus.get(args.p_request_id); if (recu) return { data: { domaineId: recu.domaine_id }, error: null };
    const cmd = args.p_commande;
    domaines.push({ ...domaineDeTest(cmd.domaine.id, cmd.domaine.nom, cmd.domaine.prefixe, domaines.length), usage: cmd.usage });
    for (const p of cmd.competences) ajouterCompetence(cmd.domaine.id, p.intitule);
    recus.set(args.p_request_id, { domaine_id: cmd.domaine.id, type: "creer_domaine" });
    if (panneApresCreation) { panneApresCreation = false; throw new Error("Réponse perdue après commit"); }
    return { data: { domaineId: cmd.domaine.id }, error: null };
  });
  m.dorsale.mockImplementation(async () => ({ userId: "compte", supabase: { rpc: m.rpc, from: () => {
    let requestId = "";
    const query = { select: () => query, eq: (k: string, v: string) => { if (k === "request_id") requestId = v; return query; }, maybeSingle: async () => ({ data: recus.get(requestId) ?? null, error: null }) };
    return query;
  } } }));
});

it("la lecture propose sans créer ni taguer et expose les parents", async () => {
  domaines.push({ ...domaineDeTest("calcul", "Calcul", "CAL", 1), parentId: "math" });
  expect((await lireClassementRessourcesAction(["doc"])).referentiel.domaines[1].parentId).toBe("math");
  expect(m.modifier).not.toHaveBeenCalled(); expect(m.creer).not.toHaveBeenCalled(); expect(m.rpc).not.toHaveBeenCalled();
});
it("confirme un premier domaine d'organisation sans compétence ni usage fabriqué", async () => {
  domaines = [];
  const c: ChoixClassementRessource = { ...choix(), propositions: [], domaine: { mode: "nouveau", nom: "Calcul", usage: { type: "indetermine" } } };
  expect((await confirmerClassementRessourcesAction([c])).resultats[0].statut).toBe("confirmee");
  const commande = m.rpc.mock.calls[0][1].p_commande;
  expect(commande).toMatchObject({ type: "creer_domaine", domaine: { origine: "utilisateur" }, competences: [] });
  expect(commande).not.toHaveProperty("usage");
  expect(commande).not.toHaveProperty("rattachementsExistants");
  expect(domaines).toHaveLength(1);
  expect(skills).toHaveLength(0);
  expect(m.taguer).not.toHaveBeenCalled();
  expect(parserFrontMatter(docs.get("doc")!.md).frontMatter.domaine).toBe("calcul");
  expect(docs.get("doc")!.md).toContain("Original conservé.");
});
it("retrouve un domaine d'organisation vide après perte de réponse sans le recréer", async () => {
  domaines = [];
  const c: ChoixClassementRessource = { ...choix(), propositions: [], domaine: { mode: "nouveau", nom: "Calcul", usage: { type: "indetermine" } } };
  panneApresCreation = true;
  expect((await confirmerClassementRessourcesAction([c])).resultats[0].statut).toBe("echec");
  expect((await confirmerClassementRessourcesAction([c])).resultats[0].statut).toBe("confirmee");
  expect(m.rpc).toHaveBeenCalledTimes(1);
  expect(domaines).toHaveLength(1);
  expect(skills).toHaveLength(0);
});
it("prévalide tout le lot : un code absent dans la seconde ressource bloque tout effet", async () => {
  await expect(confirmerClassementRessourcesAction([choix(), { ...choix("doc2"), codes: ["FAUX"] }])).rejects.toThrow("absente");
  expect(m.modifier).not.toHaveBeenCalled(); expect(m.creer).not.toHaveBeenCalled();
});
it("crée dans le domaine choisi et ignore le domaine erroné proposé par l'IA", async () => {
  const r = await confirmerClassementRessourcesAction([choix()]);
  expect(r.resultats[0].statut).toBe("confirmee"); expect(skills[0].domaine).toBe("math");
  expect(docs.get("doc")!.md).toContain("Original conservé."); expect(m.taguer).toHaveBeenCalledWith("math", ["MAT-1"], true);
});
it("réexécuter la même confirmation ne recrée ni ne réécrit", async () => {
  await confirmerClassementRessourcesAction([choix()]); const nombre = m.modifier.mock.calls.length;
  expect((await confirmerClassementRessourcesAction([choix()])).resultats[0].statut).toBe("confirmee");
  expect(m.creer).toHaveBeenCalledTimes(1); expect(m.modifier).toHaveBeenCalledTimes(nombre);
});
it("deux ressources du même lot partagent un nouveau domaine et sa parenté", async () => {
  const r = await confirmerClassementRessourcesAction([nouveau(), nouveau("doc2")]);
  expect(r.resultats.map((a) => a.statut)).toEqual(["confirmee", "confirmee"]);
  expect(m.rpc).toHaveBeenCalledTimes(1); expect(domaines.find((d) => d.id === "calcul")?.parentId).toBe("math");
  expect(skills).toHaveLength(1);
});
it("refuse des usages différents du même nouveau domaine avant effet", async () => {
  await expect(confirmerClassementRessourcesAction([nouveau(), { ...nouveau("doc2"), domaine: { mode: "nouveau", nom: "Calcul", usage: { type: "module", anneeAcademique: "2026" } } }])).rejects.toThrow("différents");
  expect(m.modifier).not.toHaveBeenCalled();
});
it("reprend après un commit de création dont la réponse est perdue grâce au reçu SQL", async () => {
  panneApresCreation = true;
  expect((await confirmerClassementRessourcesAction([nouveau()])).resultats[0].statut).toBe("echec");
  expect(domaines).toHaveLength(2);
  expect((await confirmerClassementRessourcesAction([nouveau()])).resultats[0].statut).toBe("confirmee");
  expect(domaines).toHaveLength(2); expect(skills).toHaveLength(1); expect(m.rpc).toHaveBeenCalledTimes(1);
});
it("refuse une version périmée et une proposition absente avant toute écriture", async () => {
  await expect(confirmerClassementRessourcesAction([{ ...choix(), updatedAtAttendu: "ancienne" }])).rejects.toThrow("modifiée");
  await expect(confirmerClassementRessourcesAction([{ ...choix(), propositions: [9] }])).rejects.toThrow("proposition");
  expect(m.modifier).not.toHaveBeenCalled();
});
it("conserve le succès partiel puis reprend le lot complet sans doubler la création", async () => {
  const modifier = m.modifier.getMockImplementation()!; let panne = true;
  m.modifier.mockImplementation(async (...args) => { if (args[0] === "doc2" && panne) { panne = false; throw new Error("Réseau interrompu"); } return modifier(...args); });
  expect((await confirmerClassementRessourcesAction([nouveau(), nouveau("doc2")])).resultats.map((r) => r.statut)).toEqual(["confirmee", "echec"]);
  expect((await confirmerClassementRessourcesAction([nouveau(), nouveau("doc2")])).resultats.map((r) => r.statut)).toEqual(["confirmee", "confirmee"]);
  expect(m.rpc).toHaveBeenCalledTimes(1);
});

it("deux confirmations concurrentes sont départagées avant création par la version de la fiche", async () => {
  const modifier = m.modifier.getMockImplementation()!;
  let arrivees = 0;
  let liberer!: () => void;
  const barriere = new Promise<void>((resolve) => { liberer = resolve; });
  m.modifier.mockImplementation(async (...args) => {
    if (args[3] === "v1") { arrivees++; if (arrivees === 2) liberer(); await barriere; }
    return modifier(...args);
  });
  const resultats = await Promise.all([confirmerClassementRessourcesAction([choix()]), confirmerClassementRessourcesAction([choix()])]);
  expect(resultats.map((r) => r.resultats[0].statut).sort()).toEqual(["confirmee", "echec"]);
  expect(m.creer).toHaveBeenCalledTimes(1); expect(skills).toHaveLength(1);
  expect((await confirmerClassementRessourcesAction([choix()])).resultats[0].statut).toBe("confirmee");
});

it("un nom de domaine refusé par le référentiel est détecté avant la réservation de la fiche", async () => {
  const c = nouveau(); c.domaine = { mode: "nouveau", nom: "ab", usage: { type: "module", anneeAcademique: "2026" } };
  await expect(confirmerClassementRessourcesAction([c])).rejects.toThrow("3 caractères");
  expect(m.modifier).not.toHaveBeenCalled(); expect(m.rpc).not.toHaveBeenCalled();
});

it("ne recrée pas une compétence si sa création réussit mais la réponse se perd", async () => {
  const creer = m.creer.getMockImplementation()!;
  m.creer.mockImplementationOnce(async (...args) => { await creer(...args); throw new Error("Réponse perdue"); });
  expect((await confirmerClassementRessourcesAction([choix()])).resultats[0].statut).toBe("echec");
  expect((await confirmerClassementRessourcesAction([choix()])).resultats[0].statut).toBe("confirmee");
  expect(m.creer).toHaveBeenCalledTimes(1); expect(skills).toHaveLength(1);
});

it("ne remplace pas une correction humaine effectuée après une confirmation interrompue", async () => {
  m.creer.mockRejectedValueOnce(new Error("Interruption"));
  await confirmerClassementRessourcesAction([choix()]);
  const d = docs.get("doc")!; d.md = d.md.replace("role: support", "role: support\ndomaine: autre"); d.version++;
  await expect(confirmerClassementRessourcesAction([choix()])).rejects.toThrow("corrigé");
  expect(m.creer).toHaveBeenCalledTimes(1);
});

it("deux reprises concurrentes d'une confirmation interrompue réclament aussi sa version avant création", async () => {
  m.creer.mockRejectedValueOnce(new Error("Interruption avant effet"));
  expect((await confirmerClassementRessourcesAction([choix()])).resultats[0].statut).toBe("echec");
  expect(skills).toHaveLength(0);
  const version = `v${docs.get("doc")!.version}`;
  const modifier = m.modifier.getMockImplementation()!;
  let arrivees = 0;
  let liberer!: () => void;
  const barriere = new Promise<void>((resolve) => { liberer = resolve; });
  m.modifier.mockImplementation(async (...args) => {
    if (args[3] === version) { arrivees++; if (arrivees === 2) liberer(); await barriere; }
    return modifier(...args);
  });
  const resultats = await Promise.all([confirmerClassementRessourcesAction([choix()]), confirmerClassementRessourcesAction([choix()])]);
  expect(resultats.map((r) => r.resultats[0].statut).sort()).toEqual(["confirmee", "echec"]);
  expect(m.creer).toHaveBeenCalledTimes(2); // premier échec sans effet puis unique création.
  expect(skills).toHaveLength(1);
  expect((await confirmerClassementRessourcesAction([choix()])).resultats[0].statut).toBe("confirmee");
});

it("efface le brouillon seulement avec le classement effectivement confirmé", async () => {
  const d = docs.get("doc")!;
  const brouillon = encoderBrouillonClassement({ analyseId: "a", domaine: { mode: "existant", id: "math" }, codes: [], propositions: [0], origine: "personne", modifieLe: "2026-09-15T22:10:00Z" });
  d.md = d.md.replace("role: support", `role: support\nclassement_brouillon: ${brouillon}`);
  expect((await confirmerClassementRessourcesAction([choix()])).resultats[0].statut).toBe("confirmee");
  expect(parserFrontMatter(d.md).frontMatter.classement_brouillon).toBe("");
  expect(parserFrontMatter(d.md).frontMatter.domaine).toBe("math");
});

it("préserve un nouveau brouillon humain lors de la reprise d'une confirmation interrompue", async () => {
  const c = { ...choix(), propositions: [] };
  const modifier = m.modifier.getMockImplementation()!;
  let appels = 0;
  m.modifier.mockImplementation(async (...args) => {
    if (++appels === 2) throw new Error("Interruption avant le rangement final");
    return modifier(...args);
  });
  expect((await confirmerClassementRessourcesAction([c])).resultats[0].statut).toBe("echec");
  const d = docs.get("doc")!;
  const brouillon = encoderBrouillonClassement({ analyseId: "a", domaine: { mode: "nouveau", nom: "Physique", usage: { type: "indetermine" } }, codes: [], propositions: [], origine: "personne", modifieLe: "2026-09-17T00:00:00Z" });
  d.md = definirChampsFrontMatter(d.md, { classement_brouillon: brouillon });
  d.version++;
  const contenuHumain = d.md;
  const ecrituresAvantReprise = m.modifier.mock.calls.length;

  await expect(confirmerClassementRessourcesAction([c])).rejects.toThrow();
  expect(d.md).toBe(contenuHumain);
  expect(m.modifier).toHaveBeenCalledTimes(ecrituresAvantReprise);
});

it("refuse de reprendre depuis un Markdown plus ancien que la version du dépôt", async () => {
  const c = { ...choix(), propositions: [] };
  const modifier = m.modifier.getMockImplementation()!;
  let appels = 0;
  m.modifier.mockImplementation(async (...args) => {
    if (++appels === 2) throw new Error("Interruption avant le rangement final");
    return modifier(...args);
  });
  expect((await confirmerClassementRessourcesAction([c])).resultats[0].statut).toBe("echec");
  const d = docs.get("doc")!;
  const ancienneLecture = { contenuMd: d.md, frontmatter: parserFrontMatter(d.md).frontMatter, updatedAt: `v${d.version}` };
  d.md += "\n\nCorrection humaine du contenu à conserver.";
  d.version++;
  const contenuHumain = d.md;
  m.document.mockResolvedValue(ancienneLecture);
  const ecrituresAvantReprise = m.modifier.mock.calls.length;

  await expect(confirmerClassementRessourcesAction([c])).rejects.toThrow();
  expect(d.md).toBe(contenuHumain);
  expect(m.modifier).toHaveBeenCalledTimes(ecrituresAvantReprise);
});

it("le rejeu d'une confirmation terminée ne consomme pas un nouveau brouillon humain", async () => {
  const c = { ...choix(), propositions: [] };
  expect((await confirmerClassementRessourcesAction([c])).resultats[0].statut).toBe("confirmee");
  const d = docs.get("doc")!;
  const brouillon = encoderBrouillonClassement({ analyseId: "a", domaine: { mode: "nouveau", nom: "Physique", usage: { type: "indetermine" } }, codes: [], propositions: [], origine: "personne", modifieLe: "2026-09-17T00:00:00Z" });
  d.md = definirChampsFrontMatter(d.md, { classement_brouillon: brouillon });
  d.version++;
  const contenuHumain = d.md;
  const ecrituresAvantReprise = m.modifier.mock.calls.length;

  expect((await confirmerClassementRessourcesAction([c])).resultats[0].statut).toBe("confirmee");
  expect(d.md).toBe(contenuHumain);
  expect(m.modifier).toHaveBeenCalledTimes(ecrituresAvantReprise);
});

function interrompreAvantRangementFinal() {
  const modifier = m.modifier.getMockImplementation()!;
  let appels = 0;
  m.modifier.mockImplementation(async (...args) => {
    if (++appels === 2) throw new Error("Interruption avant le rangement final");
    return modifier(...args);
  });
}

const brouillonMath = () => encoderBrouillonClassement({ analyseId: "a", domaine: { mode: "existant", id: "math" }, codes: [], propositions: [], origine: "personne", modifieLe: "2026-09-17T00:00:00Z" });

it("reprend une confirmation interrompue avec son brouillon initial inchangé", async () => {
  const c = { ...choix(), propositions: [] };
  const d = docs.get("doc")!;
  d.md = definirChampsFrontMatter(d.md, { classement_brouillon: brouillonMath() });
  interrompreAvantRangementFinal();
  expect((await confirmerClassementRessourcesAction([c])).resultats[0].statut).toBe("echec");
  expect(parserFrontMatter(d.md).frontMatter.classement_brouillon).toBe(brouillonMath());

  expect((await confirmerClassementRessourcesAction([c])).resultats[0].statut).toBe("confirmee");
  expect(parserFrontMatter(d.md).frontMatter).toMatchObject({ domaine: "math", classement_brouillon: "", rangement_origine: "personne" });
});

it.each([false, true])("reprend un reçu historique seulement sans choix humain à préserver (choix présent : %s)", async (avecChoixHumain) => {
  const c = { ...choix(), propositions: [] };
  interrompreAvantRangementFinal();
  expect((await confirmerClassementRessourcesAction([c])).resultats[0].statut).toBe("echec");
  const d = docs.get("doc")!;
  const recu = JSON.parse(Buffer.from(String(parserFrontMatter(d.md).frontMatter.classement_confirmation), "base64url").toString("utf8"));
  delete recu.choixPrealable; // Format réellement écrit avant cette correction.
  d.md = definirChampsFrontMatter(d.md, {
    classement_confirmation: Buffer.from(JSON.stringify(recu)).toString("base64url"),
    ...(avecChoixHumain ? { classement_brouillon: brouillonMath() } : {}),
  });
  d.version++;
  const contenuAvantReprise = d.md;
  const ecrituresAvantReprise = m.modifier.mock.calls.length;

  if (avecChoixHumain) {
    await expect(confirmerClassementRessourcesAction([c])).rejects.toThrow("choix");
    expect(d.md).toBe(contenuAvantReprise);
    expect(m.modifier).toHaveBeenCalledTimes(ecrituresAvantReprise);
    // Une nouvelle confirmation explicite de la version courante reste possible.
    expect((await confirmerClassementRessourcesAction([{ ...c, updatedAtAttendu: `v${d.version}` }])).resultats[0].statut).toBe("confirmee");
  } else {
    expect((await confirmerClassementRessourcesAction([c])).resultats[0].statut).toBe("confirmee");
  }
  expect(parserFrontMatter(d.md).frontMatter.domaine).toBe("math");
});

it("préserve un retrait humain après interruption même si domaine et compétences restent identiques", async () => {
  const c = { ...choix(), propositions: [] };
  interrompreAvantRangementFinal();
  expect((await confirmerClassementRessourcesAction([c])).resultats[0].statut).toBe("echec");
  const d = docs.get("doc")!;
  d.md = definirChampsFrontMatter(d.md, {
    rangement_origine: "personne", rangement_statut: "a-trier",
    rangement_analyse_id: "a", rangement_revu_le: "2026-09-17T00:00:00Z",
  });
  d.version++;
  const contenuHumain = d.md;
  const ecrituresAvantReprise = m.modifier.mock.calls.length;

  await expect(confirmerClassementRessourcesAction([c])).rejects.toThrow("choix");
  expect(d.md).toBe(contenuHumain);
  expect(m.modifier).toHaveBeenCalledTimes(ecrituresAvantReprise);
});
