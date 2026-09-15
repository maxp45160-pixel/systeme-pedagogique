import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ organiser: vi.fn(), contexte: vi.fn(), document: vi.fn(), modifier: vi.fn(), synchroniser: vi.fn(), creer: vi.fn(), taguer: vi.fn(), referentiel: vi.fn() }));
vi.mock("./depot-actions", () => ({ organiserRessourceAssistantAction: m.organiser, lireContexteOrganisationDepotAction: m.contexte }));
vi.mock("./documents", () => ({ lireDocument: m.document, modifierDocument: m.modifier, resynchroniserLiensDocument: m.synchroniser }));
vi.mock("./referentiel-actions", () => ({ creerBranche: m.creer, taguerCompetences: m.taguer }));
vi.mock("./referentiel", () => ({ lireReferentiel: m.referentiel }));
import { completerRessourceAnalysee, chargerDialogueRessource, preparerOperationRessource, executerOperationRessource, verifierOperationRessource, verifierChoixRessource } from "./dialogue-ressource";
import { parserFrontMatter } from "@/lib/documents/markdown";
import type { ChoixRessource } from "@/lib/tutor/dialogue-ressource";

const cle = "a".repeat(64);
const vide: ChoixRessource = { action: "repondre", reponse: "Précisez", champ: "", valeur: "", codes: [], propositions: [], usage: "", annee: "", citationUsage: "" };
let md: string; let version: number;
let skills: { code: string; intitule: string; domaine: string; archive?: boolean }[];
let domaineNouveau: boolean;
beforeEach(() => {
  vi.resetAllMocks(); version = 1; skills = []; domaineNouveau = false;
  md = "---\ntitle: Original\ntype: cours\nrole: support\n---\n# Original\n\nTexte original conservé.";
  const domaines = [{ id: "math", nom: "Maths", prefixe: "MAT", description: "Maths" }];
  m.referentiel.mockImplementation(async () => ({ domaines, actifs: skills.filter((s) => !s.archive), parCode: new Map(skills.map((s) => [s.code, s])) }));
  m.document.mockImplementation(async () => ({ contenuMd: md, frontmatter: parserFrontMatter(md).frontMatter }));
  m.contexte.mockImplementation(async () => ({
    referentiel: { compteId: "compte", domaines, competences: skills },
    ressources: [{ id: "doc", version: 2, titre: String(parserFrontMatter(md).frontMatter.title), type: "cours", domaineId: domaineNouveau ? undefined : "math", modifieLe: `v${version}`, competencesLiees: [],
      analyses: [{ id: "analyse", statut: "terminee", creeLe: "2026-09-13", restitution: { version: 2, organisation: { titreSuggere: "Probabilités", typeSuggere: "cours", domaine: { mode: "nouveau", nom: "Physique", description: "Physique" }, competences: [{ mode: "nouvelle", intitule: "Calculer une probabilité", palier: "fondamentaux", importance: 0.5, domaine: domaineNouveau ? { mode: "nouveau", nom: "Physique" } : { mode: "existant", id: "math" } }] } } }],
    }],
  }));
  m.modifier.mockImplementation(async (_id, contenu, _snapshot, attendue) => { if (attendue !== `v${version}`) throw new Error("Conflit de version"); md = contenu; version++; });
  m.creer.mockImplementation(async () => { skills.push({ code: "MAT-01", intitule: "Calculer une probabilité", domaine: "math" }); return { domaineId: "math", codes: ["MAT-01"] }; });
});
it("refuse les nouveaux codes et les propositions absentes avant de préparer une écriture", async () => {
  const charge = await chargerDialogueRessource("doc");
  expect(() => verifierChoixRessource({ ...vide, action: "creer", propositions: ["99"] }, charge, [])).toThrow("sourcée");
  expect(() => verifierChoixRessource({ ...vide, action: "corriger", champ: "ajouter-liens", codes: ["FAUX"] }, charge, [])).toThrow("disponibles");
  expect(m.modifier).not.toHaveBeenCalled(); expect(m.creer).not.toHaveBeenCalled();
});
it("ne déduit pas l'usage d'un nouveau domaine et exige une citation déclarée", async () => {
  domaineNouveau = true; const charge = await chargerDialogueRessource("doc");
  expect(() => verifierChoixRessource({ ...vide, action: "creer", propositions: ["0"], usage: "continu", citationUsage: "progression continue" }, charge, [])).toThrow("usage");
  expect(() => verifierChoixRessource({ ...vide, action: "creer", propositions: ["0"], usage: "module", citationUsage: "module" }, charge, [{ role: "user", content: "module" }])).toThrow("année");
});
it("corrige le titre exact, garde le contenu et ne touche pas aux compétences", async () => {
  const charge = await chargerDialogueRessource("doc");
  await preparerOperationRessource(charge, cle, { ...vide, action: "corriger", champ: "titre", valeur: "Probabilités" }, [{ role: "user", content: "Renomme en Probabilités" }]);
  expect(m.creer).not.toHaveBeenCalled();
  const resultat = await executerOperationRessource(await chargerDialogueRessource("doc"), cle);
  expect(resultat).toContain("Correction enregistrée"); expect(md).toContain("title: Probabilités"); expect(md).toContain("Texte original conservé.");
  expect(m.creer).not.toHaveBeenCalled(); expect(m.taguer).not.toHaveBeenCalled();
});
it("reprend après la création mais avant le rangement sans recréer la compétence", async () => {
  await preparerOperationRessource(await chargerDialogueRessource("doc"), cle, { ...vide, action: "creer", propositions: ["0"] }, []);
  m.modifier.mockRejectedValueOnce(new Error("Connexion interrompue"));
  await expect(executerOperationRessource(await chargerDialogueRessource("doc"), cle)).rejects.toThrow("interrompue");
  expect(skills).toHaveLength(1);
  await executerOperationRessource(await chargerDialogueRessource("doc"), cle);
  expect(m.creer).toHaveBeenCalledTimes(1); expect(md).toContain("[[MAT-01]]");
  expect(verifierOperationRessource(await chargerDialogueRessource("doc"), cle)?.terminee).toBe(true);
});
it("répare les liens après une réponse perdue sans réécrire ni recréer", async () => {
  await preparerOperationRessource(await chargerDialogueRessource("doc"), cle, { ...vide, action: "creer", propositions: ["0"] }, []);
  m.synchroniser.mockRejectedValueOnce(new Error("Index indisponible"));
  await expect(executerOperationRessource(await chargerDialogueRessource("doc"), cle)).rejects.toThrow("Index indisponible");
  const nombre = m.modifier.mock.calls.length;
  await executerOperationRessource(await chargerDialogueRessource("doc"), cle);
  expect(m.modifier).toHaveBeenCalledTimes(nombre); expect(m.creer).toHaveBeenCalledTimes(1);
});
it("ne ressuscite pas une compétence archivée lors d'une reprise", async () => {
  await preparerOperationRessource(await chargerDialogueRessource("doc"), cle, { ...vide, action: "creer", propositions: ["0"] }, []);
  skills.push({ code: "MAT-01", intitule: "Calculer une probabilité", domaine: "math", archive: true });
  await expect(executerOperationRessource(await chargerDialogueRessource("doc"), cle)).rejects.toThrow("archivée");
  expect(m.creer).not.toHaveBeenCalled();
});
it("ne remplace pas une correction effectuée entre deux tentatives", async () => {
  await preparerOperationRessource(await chargerDialogueRessource("doc"), cle, { ...vide, action: "corriger", champ: "titre", valeur: "Titre demandé" }, [{ role: "user", content: "Titre demandé" }]);
  md = md.replace("title: Original", "title: Autre correction"); version++;
  await expect(executerOperationRessource(await chargerDialogueRessource("doc"), cle)).rejects.toThrow("modifiée");
  expect(md).toContain("title: Autre correction");
});

it("crée les nouveautés sourcées du domaine existant dans la même organisation", async () => {
  await completerRessourceAnalysee("doc", "analyse");
  expect(m.creer).toHaveBeenCalledTimes(1);
  expect(md).toContain("[[MAT-01]]");
  expect(md).toContain("rangement_origine: assistant");
  await completerRessourceAnalysee("doc", "analyse");
  expect(m.creer).toHaveBeenCalledTimes(1);
});
it("laisse un domaine inconnu à préciser sans création automatique", async () => {
  domaineNouveau = true;
  await completerRessourceAnalysee("doc", "analyse");
  expect(m.creer).not.toHaveBeenCalled(); expect(m.modifier).not.toHaveBeenCalled();
  expect(m.organiser).toHaveBeenCalledWith("doc", "analyse");
});

it("réutilise et lie un homonyme unique présent dans un autre domaine", async () => {
  skills.push({ code: "AUT-01", intitule: "Calculer une probabilité", domaine: "autre" });
  await completerRessourceAnalysee("doc", "analyse");
  expect(m.creer).not.toHaveBeenCalled();
  expect(m.taguer).toHaveBeenCalledWith("math", ["AUT-01"], true);
  expect(md).toContain("[[AUT-01]]");
});
it("choisit un préfixe alphabétique disponible pour un nouveau domaine", async () => {
  domaineNouveau = true;
  const r = await m.referentiel();
  r.domaines.push({ id: "autre", nom: "Autre domaine", prefixe: "PHYS", description: "Autre" });
  await preparerOperationRessource(await chargerDialogueRessource("doc"), cle, { ...vide, action: "creer", propositions: ["0"], usage: "continu", citationUsage: "progression continue" }, [{ role: "user", content: "progression continue" }]);
  await executerOperationRessource(await chargerDialogueRessource("doc"), cle);
  const soumission = m.creer.mock.calls[0][0];
  expect(soumission.prefixe).toMatch(/^[A-Z]{2,5}$/);
  expect(soumission.prefixe).not.toBe("PHYS");
  expect(soumission.usage).toEqual({ type: "continu" });
});
