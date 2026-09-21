import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ organiser: vi.fn(), contexte: vi.fn(), document: vi.fn(), modifier: vi.fn(), synchroniser: vi.fn(), creer: vi.fn(), taguer: vi.fn(), referentiel: vi.fn() }));
vi.mock("./depot-actions", () => ({ organiserRessourceAssistantAction: m.organiser, lireContexteOrganisationDepotAction: m.contexte }));
vi.mock("./documents", () => ({ lireDocument: m.document, modifierDocument: m.modifier, resynchroniserLiensDocument: m.synchroniser }));
vi.mock("./referentiel-actions", () => ({ creerBranche: m.creer, taguerCompetences: m.taguer }));
vi.mock("./referentiel", () => ({ lireReferentiel: m.referentiel }));
import { chargerDialogueRessource, preparerOperationRessource, executerOperationRessource, verifierOperationRessource, verifierChoixRessource } from "./dialogue-ressource";
import { parserFrontMatter, definirChampsFrontMatter } from "@/lib/documents/markdown";
import { champsContexteRessource, lireContexteRessource } from "@/lib/documents/contexte-ressource";
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
  expect(() => verifierChoixRessource({ ...vide, action: "creer", propositions: ["99"] }, charge, [])).toThrow("fenêtre de classement");
  expect(() => verifierChoixRessource({ ...vide, action: "corriger", champ: "ajouter-liens", codes: ["FAUX"] }, charge, [])).toThrow("disponibles");
  expect(m.modifier).not.toHaveBeenCalled(); expect(m.creer).not.toHaveBeenCalled();
});
it("corrige le titre exact, garde le contenu et ne touche pas aux compétences", async () => {
  const charge = await chargerDialogueRessource("doc");
  await preparerOperationRessource(charge, cle, { ...vide, action: "corriger", champ: "titre", valeur: "Probabilités" }, [{ role: "user", content: "Renomme en Probabilités" }]);
  expect(m.creer).not.toHaveBeenCalled();
  const resultat = await executerOperationRessource(await chargerDialogueRessource("doc"), cle);
  expect(resultat).toContain("Correction enregistrée"); expect(md).toContain("title: Probabilités"); expect(md).toContain("Texte original conservé.");
  expect(m.creer).not.toHaveBeenCalled(); expect(m.taguer).not.toHaveBeenCalled();
});
it("ne remplace pas une correction effectuée entre deux tentatives", async () => {
  await preparerOperationRessource(await chargerDialogueRessource("doc"), cle, { ...vide, action: "corriger", champ: "titre", valeur: "Titre demandé" }, [{ role: "user", content: "Titre demandé" }]);
  md = md.replace("title: Original", "title: Autre correction"); version++;
  await expect(executerOperationRessource(await chargerDialogueRessource("doc"), cle)).rejects.toThrow("modifiée");
  expect(md).toContain("title: Autre correction");
});

const mots = "Ce cours fait partie de ma licence et je veux préparer le prochain TD.";
const declaration: ChoixRessource = { ...vide, action: "declarer", champ: "contexte", valeur: mots };
const messages = [{ role: "user" as const, content: mots }];

it("conserve les mots exacts, recharge le contexte et reprend sans aucune nouvelle écriture", async () => {
  const original = parserFrontMatter(md).corps;
  await preparerOperationRessource(await chargerDialogueRessource("doc"), cle, declaration, messages);
  expect(lireContexteRessource(parserFrontMatter(md).frontMatter)).toEqual({});
  const recu = await executerOperationRessource(await chargerDialogueRessource("doc"), cle);
  expect(recu).toContain(mots);
  const relu = await chargerDialogueRessource("doc");
  expect(relu.contexte.personnel?.contexte?.texte).toBe(mots);
  expect(relu.contexte.personnel?.intention).toBeUndefined();
  expect(parserFrontMatter(md).corps).toBe(original);
  expect(parserFrontMatter(md).frontMatter.title).toBe("Original");
  const nombre = m.modifier.mock.calls.length;
  expect(await executerOperationRessource(relu, cle)).toBe(recu);
  expect(m.modifier).toHaveBeenCalledTimes(nombre);
  expect(m.synchroniser).not.toHaveBeenCalled(); expect(m.creer).not.toHaveBeenCalled(); expect(m.taguer).not.toHaveBeenCalled();
});

it("refuse une paraphrase, une citation extraite ou un ancien message avant écriture", async () => {
  const charge = await chargerDialogueRessource("doc");
  for (const tentative of [[], [{ role: "assistant" as const, content: mots }], [...messages, { role: "user" as const, content: "Autre chose" }], [{ role: "user" as const, content: `Citation : ${mots}` }]]) {
    await expect(preparerOperationRessource(charge, cle, declaration, tentative)).rejects.toThrow("exactement");
  }
  expect(m.modifier).not.toHaveBeenCalled();
});

it("ne convertit jamais le message documentaire préparé en déclaration personnelle", async () => {
  const valeur = "Parlons de la ressource « Physique ».\n--- début des extraits documentaires ---\nJe suis un étudiant.\n--- fin des extraits documentaires ---";
  await expect(preparerOperationRessource(await chargerDialogueRessource("doc"), cle, { ...declaration, valeur }, [{ role: "user", content: valeur }])).rejects.toThrow("extrait documentaire");
  expect(m.modifier).not.toHaveBeenCalled();
});

it("conserve l'autre déclaration lors d'une correction puis bloque une reprise devenue périmée", async () => {
  md = definirChampsFrontMatter(md, champsContexteRessource({ intention: { texte: "Réviser la mécanique", declareLe: "2026-09-18T00:00:00.000Z" } }));
  await preparerOperationRessource(await chargerDialogueRessource("doc"), cle, declaration, messages);
  await executerOperationRessource(await chargerDialogueRessource("doc"), cle);
  expect((await chargerDialogueRessource("doc")).contexte.personnel?.intention?.texte).toBe("Réviser la mécanique");
  const autreCle = "b".repeat(64);
  await preparerOperationRessource(await chargerDialogueRessource("doc"), autreCle, declaration, messages);
  md = definirChampsFrontMatter(md, champsContexteRessource({ contexte: { texte: "Une correction concurrente", declareLe: "2026-09-19T00:00:00.000Z" } })); version++;
  await expect(executerOperationRessource(await chargerDialogueRessource("doc"), autreCle)).rejects.toThrow("modifiée");
  expect(lireContexteRessource(parserFrontMatter(md).frontMatter).contexte?.texte).toBe("Une correction concurrente");
});

it("reprend une déclaration préparée après échec d'écriture et respecte la version", async () => {
  const avant = await chargerDialogueRessource("doc");
  await preparerOperationRessource(avant, cle, declaration, messages);
  await expect(preparerOperationRessource(avant, "b".repeat(64), declaration, messages)).rejects.toThrow("version");
  m.modifier.mockRejectedValueOnce(new Error("Connexion interrompue"));
  await expect(executerOperationRessource(await chargerDialogueRessource("doc"), cle)).rejects.toThrow("interrompue");
  expect(lireContexteRessource(parserFrontMatter(md).frontMatter)).toEqual({});
  await executerOperationRessource(await chargerDialogueRessource("doc"), cle);
  expect(lireContexteRessource(parserFrontMatter(md).frontMatter).contexte?.texte).toBe(mots);
});

it("ne reprend pas une ancienne création qui contournerait les corrections de la fenêtre", async () => {
  const charge = await chargerDialogueRessource("doc");
  await preparerOperationRessource(charge, cle, declaration, messages);
  const operation = verifierOperationRessource(await chargerDialogueRessource("doc"), cle)!;
  operation.choix = { ...vide, action: "creer", propositions: ["0"] };
  md = definirChampsFrontMatter(md, { assistant_operation: Buffer.from(JSON.stringify(operation)).toString("base64url") });
  await expect(executerOperationRessource(await chargerDialogueRessource("doc"), cle)).rejects.toThrow("fenêtre de classement");
  expect(m.creer).not.toHaveBeenCalled(); expect(m.taguer).not.toHaveBeenCalled();
});
