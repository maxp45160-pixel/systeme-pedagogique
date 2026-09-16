import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ contexte: vi.fn(), document: vi.fn(), modifier: vi.fn() }));
vi.mock("./depot-actions", () => ({ lireContexteOrganisationDepotAction: m.contexte }));
vi.mock("./documents", () => ({ lireDocument: m.document, modifierDocument: m.modifier }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { annulerRattachementDelegueAction, rattacherDomaineDelegueAction } from "./delegation-classement-actions";
import { definirChampsFrontMatter, parserFrontMatter } from "@/lib/documents/markdown";
import type { DepotDocumentaire } from "@/lib/documents/depot";
import type { ContexteOrganisationDepot } from "@/lib/documents/organisation-depot";

let md: string;
let version: number;
let depot: DepotDocumentaire;
let referentiel: ContexteOrganisationDepot;
function lireRessource(): DepotDocumentaire {
  const f = parserFrontMatter(md).frontMatter;
  return { ...depot, modifieLe: `v${version}`, domaineId: f.domaine ? f.domaine as string : undefined, rangementOrigine: f.rangement_origine as DepotDocumentaire["rangementOrigine"], rangementAnalyseId: f.rangement_analyse_id as string | undefined, rangementRevuLe: f.rangement_revu_le as string | undefined, rangementStatut: f.rangement_statut as DepotDocumentaire["rangementStatut"] };
}
beforeEach(() => {
  vi.resetAllMocks(); version = 1;
  md = "---\ntitle: Original\nrole: support\ndepot_version: 2\nsource_relative_path: cours/source.txt\n---\n# Original\n\nUne équation.\n\n## Notes personnelles\n\nNe pas changer.\n";
  depot = { id: "doc", version: 2, titre: "Original", type: "support", note: "Une équation", creeLe: "2026-09-16", modifieLe: "v1", pieces: [], competencesLiees: [], corrections: [], analyses: [{ id: "a", documentId: "doc", empreinte: "source", statut: "terminee", pages: [], couvertures: [], erreur: null, creeLe: "2026-09-16", modifieLe: "2026-09-16", restitution: { version: 2, modele: "modele", creeLe: "2026-09-16", elements: [], couvertures: [], organisation: { titreSuggere: "Titre suggéré", typeSuggere: "cours", justification: "Une équation", sources: [{ documentId: "doc", citation: "Une équation" }], domaine: { mode: "existant", id: "maths", justification: "Une équation", sources: [{ documentId: "doc", citation: "Une équation" }] }, competences: [{ mode: "existante", code: "MAT-01", justification: "Équation", sources: [{ documentId: "doc", citation: "Une équation" }] }] } } }] };
  referentiel = { compteId: "compte", domaines: [{ id: "maths", nom: "Mathématiques", prefixe: "MAT", description: "" }], competences: [] };
  m.contexte.mockImplementation(async () => ({ ressources: [lireRessource()], referentiel: structuredClone(referentiel) }));
  m.document.mockImplementation(async () => ({ contenuMd: md, updatedAt: `v${version}`, frontmatter: parserFrontMatter(md).frontMatter }));
  m.modifier.mockImplementation(async (_id, contenu, _capture, attendue) => {
    if (attendue !== `v${version}`) throw new Error("Conflit de version");
    md = contenu; version++; return { updatedAt: `v${version}` };
  });
});
const rattacher = () => rattacherDomaineDelegueAction("doc", "a", "v1");

it("rattache seulement le domaine et sa trace ; préserve corps, titre, type et propositions", async () => {
  const avant = parserFrontMatter(md); const analyses = structuredClone(depot.analyses);
  const resultat = await rattacher();
  expect(resultat).toMatchObject({ statut: "rattache", ressource: { domaineId: "maths", modifieLe: "v2", rangementOrigine: "assistant", rangementAnalyseId: "a", rangementStatut: "rangee", competencesLiees: [] } });
  const apres = parserFrontMatter(md);
  expect(apres.corps).toBe(avant.corps);
  expect(apres.frontMatter).toEqual({ ...avant.frontMatter, domaine: "maths", rangement_origine: "assistant", rangement_analyse_id: "a", rangement_revu_le: expect.any(String), rangement_statut: "rangee" });
  expect(resultat.ressource.analyses).toEqual(analyses);
  expect(m.modifier).toHaveBeenCalledExactlyOnceWith("doc", expect.any(String), false, "v1");
});
it("rejoue une réponse perdue sans seconde écriture, même avec l'ancienne version", async () => {
  await rattacher();
  expect((await rattacher()).statut).toBe("rattache");
  expect(m.modifier).toHaveBeenCalledTimes(1);
});
it("relit après une sauvegarde suivie d'erreur et reprend sans réécriture", async () => {
  const modifier = m.modifier.getMockImplementation()!;
  m.modifier.mockImplementationOnce(async (...args) => { await modifier(...args); throw new Error("Réponse perdue après écriture"); });
  expect((await rattacher()).ressource.modifieLe).toBe("v2");
  expect((await rattacher()).statut).toBe("rattache");
  expect(m.modifier).toHaveBeenCalledTimes(1);
});
it("rend l'échec réel quand aucune écriture n'a abouti", async () => {
  m.modifier.mockRejectedValueOnce(new Error("Écriture indisponible"));
  await expect(rattacher()).rejects.toThrow("Écriture indisponible");
  expect(version).toBe(1);
  expect(m.modifier).toHaveBeenCalledTimes(1);
});
it("préserve une correction humaine après le rattachement", async () => {
  await rattacher();
  md = definirChampsFrontMatter(md, { domaine: "physique", rangement_origine: "personne" }); version++;
  expect((await rattacher()).statut).toBe("preserve");
  expect(parserFrontMatter(md).frontMatter.domaine).toBe("physique");
  expect(m.modifier).toHaveBeenCalledTimes(1);
});
it("préserve une confirmation ou un brouillon humain pendant la validation", async () => {
  const lire = m.contexte.getMockImplementation()!;
  m.contexte.mockImplementationOnce(lire).mockImplementationOnce(async () => {
    md = definirChampsFrontMatter(md, { classement_confirmation: "confirmation en cours" }); version++;
    return lire();
  });
  expect((await rattacher()).statut).toBe("preserve");
  expect(m.modifier).not.toHaveBeenCalled();
});
it("refuse droits insuffisants et ressources absentes sans tenter d'écrire", async () => {
  m.contexte.mockRejectedValueOnce(new Error("Dépôt introuvable"));
  await expect(rattacher()).rejects.toThrow("introuvable");
  m.contexte.mockResolvedValueOnce({ ressources: [], referentiel });
  await expect(rattacher()).rejects.toThrow("introuvable");
  m.document.mockRejectedValueOnce(new Error("Lecture refusée"));
  await expect(rattacher()).rejects.toThrow("Lecture refusée");
  expect(m.modifier).not.toHaveBeenCalled();
});
it("refuse version périmée ou incohérente avant tout effet", async () => {
  await expect(rattacherDomaineDelegueAction("doc", "a", "ancienne")).rejects.toThrow("modifiée");
  m.document.mockResolvedValueOnce({ contenuMd: md, updatedAt: "autre", frontmatter: {} });
  await expect(rattacher()).rejects.toThrow("changé pendant");
  expect(m.modifier).not.toHaveBeenCalled();
});
it("revérifie analyse, corrections et domaine vivant juste avant effet", async () => {
  const lire = m.contexte.getMockImplementation()!;
  const premiere = await lire();
  for (const changement of [
    () => { depot.analyses.push({ ...depot.analyses[0], id: "nouvelle", statut: "en-cours" }); },
    () => { depot.corrections.push({ id: "c", elementId: null, texte: "Erreur", creeLe: "maintenant" }); },
    () => { referentiel.domaines = []; },
  ]) {
    depot = structuredClone(premiere.ressources[0]); referentiel = structuredClone(premiere.referentiel);
    m.contexte.mockImplementationOnce(async () => structuredClone(premiere)).mockImplementationOnce(async () => { changement(); return lire(); });
    expect((await rattacher()).statut).not.toBe("rattache");
  }
  expect(m.modifier).not.toHaveBeenCalled();
});
it("la concurrence après relecture reste protégée par le CAS sans écraser le geste humain", async () => {
  const modifier = m.modifier.getMockImplementation()!;
  m.modifier.mockImplementationOnce(async (...args) => {
    md = definirChampsFrontMatter(md, { domaine: "physique", rangement_origine: "personne" }); version++;
    return modifier(...args);
  });
  await expect(rattacher()).rejects.toThrow("Conflit de version");
  expect(parserFrontMatter(md).frontMatter.domaine).toBe("physique");
  expect(m.modifier).toHaveBeenCalledTimes(1);
});

it("retire le seul rattachement assistant et conserve original, trace et propositions", async () => {
  await rattacher();
  const avant = parserFrontMatter(md);
  const resultat = await annulerRattachementDelegueAction("doc", "a", "v2");
  expect(resultat).toMatchObject({ statut: "preserve", ressource: { domaineId: undefined, rangementOrigine: "personne", rangementStatut: "a-trier", rangementAnalyseId: "a", modifieLe: "v3" } });
  const apres = parserFrontMatter(md);
  expect(apres.corps).toBe(avant.corps);
  expect(apres.frontMatter).toEqual({ ...avant.frontMatter, domaine: "", rangement_origine: "personne", rangement_statut: "a-trier" });
  expect(resultat.ressource.analyses).toEqual(depot.analyses);
  expect(m.modifier).toHaveBeenLastCalledWith("doc", expect.any(String), false, "v2");
});
it("conserve le refus après réouverture et réanalyse sans rattachement automatique", async () => {
  await rattacher();
  await annulerRattachementDelegueAction("doc", "a", "v2");
  expect((await rattacherDomaineDelegueAction("doc", "a", "v3")).statut).toBe("preserve");
  depot.analyses.push({ ...depot.analyses[0], id: "b", creeLe: "2026-09-17" });
  expect((await rattacherDomaineDelegueAction("doc", "b", "v3")).statut).toBe("preserve");
  expect(lireRessource().domaineId).toBeUndefined();
  expect(m.modifier).toHaveBeenCalledTimes(2);
});
it("reprend le retrait après sauvegarde suivie d'erreur puis rejeu sans nouvel effet", async () => {
  await rattacher();
  const modifier = m.modifier.getMockImplementation()!;
  m.modifier.mockImplementationOnce(async (...args) => { await modifier(...args); throw new Error("Réponse perdue après retrait"); });
  expect((await annulerRattachementDelegueAction("doc", "a", "v2")).ressource.rangementStatut).toBe("a-trier");
  expect((await annulerRattachementDelegueAction("doc", "a", "v2")).raison).toContain("retiré");
  expect(m.modifier).toHaveBeenCalledTimes(2);
});
it("permet de retirer le rattachement inchangé de l'analyse d'origine après une réanalyse", async () => {
  await rattacher();
  depot.analyses.push({ ...depot.analyses[0], id: "b", creeLe: "2026-09-17", statut: "en-cours" });
  const resultat = await annulerRattachementDelegueAction("doc", "a", "v2");
  expect(resultat.ressource.domaineId).toBeUndefined();
  expect(resultat.ressource.rangementAnalyseId).toBe("a");
  expect(resultat.ressource.rangementOrigine).toBe("personne");
  expect(m.modifier).toHaveBeenCalledTimes(2);
});
it("ne retire pas un rattachement repris par un choix humain", async () => {
  await rattacher();
  md = definirChampsFrontMatter(md, { rangement_origine: "personne" }); version++;
  expect((await annulerRattachementDelegueAction("doc", "a", "v3")).ressource.domaineId).toBe("maths");
  expect(m.modifier).toHaveBeenCalledTimes(1);
});
it("refuse un retrait périmé et préserve une correction concurrente relue avant effet", async () => {
  await rattacher();
  await expect(annulerRattachementDelegueAction("doc", "a", "v1")).rejects.toThrow("modifiée");
  const lire = m.contexte.getMockImplementation()!;
  m.contexte.mockImplementationOnce(lire).mockImplementationOnce(async () => {
    depot.corrections.push({ id: "c", elementId: null, texte: "Ne pas changer", creeLe: "maintenant" });
    return lire();
  });
  const resultat = await annulerRattachementDelegueAction("doc", "a", "v2");
  expect(resultat.ressource.domaineId).toBe("maths");
  expect(resultat.ressource.corrections).toHaveLength(1);
  expect(m.modifier).toHaveBeenCalledTimes(1);
});
it("le CAS du retrait protège le domaine corrigé après la dernière relecture", async () => {
  await rattacher();
  const modifier = m.modifier.getMockImplementation()!;
  m.modifier.mockImplementationOnce(async (...args) => {
    md = definirChampsFrontMatter(md, { domaine: "physique", rangement_origine: "personne" }); version++;
    return modifier(...args);
  });
  await expect(annulerRattachementDelegueAction("doc", "a", "v2")).rejects.toThrow("Conflit de version");
  expect(lireRessource().domaineId).toBe("physique");
  expect(m.modifier).toHaveBeenCalledTimes(2);
});
