import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ contexte: vi.fn(), document: vi.fn(), modifier: vi.fn(), dorsale: vi.fn(), referentielComplet: vi.fn(), rpc: vi.fn(), recu: vi.fn() }));
vi.mock("./depot-actions", () => ({ lireContexteOrganisationDepotAction: m.contexte }));
vi.mock("./documents", () => ({ lireDocument: m.document, modifierDocument: m.modifier }));
vi.mock("./db", () => ({ dorsaleCompte: m.dorsale }));
vi.mock("./referentiel", () => ({ lireReferentiel: m.referentielComplet }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { annulerRattachementDelegueAction, rattacherDomaineDelegueAction } from "./delegation-classement-actions";
import { definirChampsFrontMatter, parserFrontMatter } from "@/lib/documents/markdown";
import { lireCreationDomaineDeleguee } from "@/lib/documents/creation-domaine-deleguee";
import { assemblerReferentiel } from "@/lib/domain/referentiel-compte";
import type { Domaine } from "@/lib/domain/types";
import type { DepotDocumentaire } from "@/lib/documents/depot";
import type { ContexteOrganisationDepot } from "@/lib/documents/organisation-depot";

let md: string;
let version: number;
let depot: DepotDocumentaire;
let referentiel: ContexteOrganisationDepot;
let domaines: Domaine[];
let recus: Map<string, { domaine_id: string; type: string; origine: string }>;
let compte: string;
function lireRessource(): DepotDocumentaire {
  const f = parserFrontMatter(md).frontMatter;
  return { ...depot, creationDomaineDeleguee: lireCreationDomaineDeleguee(f.classement_creation_deleguee), modifieLe: `v${version}`, domaineId: f.domaine ? f.domaine as string : undefined, rangementOrigine: f.rangement_origine as DepotDocumentaire["rangementOrigine"], rangementAnalyseId: f.rangement_analyse_id as string | undefined, rangementRevuLe: f.rangement_revu_le as string | undefined, rangementStatut: f.rangement_statut as DepotDocumentaire["rangementStatut"] };
}
beforeEach(() => {
  vi.resetAllMocks(); version = 1; domaines = []; recus = new Map(); compte = "compte";
  m.dorsale.mockImplementation(async () => ({ userId: compte, supabase: { rpc: m.rpc, from: () => {
    let cle = ""; let user = "";
    const q = { select: () => q, eq: (champ: string, valeur: string) => { if (champ === "request_id") cle = valeur; if (champ === "user_id") user = valeur; return q; }, maybeSingle: () => m.recu(user, cle) }; return q;
  } } }));
  m.recu.mockImplementation(async (user, cle) => ({ data: recus.get(`${user}:${cle}`) ?? null, error: null }));
  m.referentielComplet.mockImplementation(async () => assemblerReferentiel(structuredClone(domaines), []));
  m.rpc.mockImplementation(async (_nom, args) => {
    const d = args.p_commande.domaine;
    // La RPC réelle sérialise puis rejoue le reçu pour un request_id identique.
    if (recus.has(`${compte}:${args.p_request_id}`)) return { data: { domaineId: d.id }, error: null };
    recus.set(`${compte}:${args.p_request_id}`, { domaine_id: d.id, type: "creer_domaine", origine: "tuteur" });
    domaines.push({ ...d, version: 1, archive: false });
    referentiel.domaines.push(d);
    return { data: { domaineId: d.id }, error: null };
  });
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

function nouveauSujet() {
  referentiel.domaines = [];
  const restitution = depot.analyses[0].restitution!;
  if (restitution.version === 2) restitution.organisation.domaine = { mode: "nouveau", nom: "Astronomie", description: "Étudier les étoiles", justification: "Les étoiles", sources: [{ documentId: "doc", citation: "Les étoiles" }] };
}
it("réserve avant de créer un domaine vide attribué au tuteur puis rattache sans modifier la source", async () => {
  nouveauSujet(); const avant = parserFrontMatter(md);
  const rpc = m.rpc.getMockImplementation()!;
  m.rpc.mockImplementationOnce(async (...args) => {
    expect(lireRessource().creationDomaineDeleguee).toMatchObject({ statut: "reservee", analyseId: "a", domaineId: "astronomie" });
    expect(version).toBe(2);
    return rpc(...args);
  });
  const resultat = await rattacher();
  expect(resultat).toMatchObject({ statut: "rattache", ressource: { domaineId: "astronomie", creationDomaineDeleguee: { statut: "cree" } } });
  expect(m.rpc.mock.calls[0][1]).toMatchObject({ p_origine: "tuteur", p_request_id: expect.stringMatching(/^delegation:[a-f0-9]{64}:domaine$/), p_commande: { type: "creer_domaine", competences: [], domaine: { origine: "tuteur" } } });
  expect(m.rpc.mock.calls[0][1].p_commande).not.toHaveProperty("usage");
  expect(parserFrontMatter(md).corps).toBe(avant.corps);
  expect(parserFrontMatter(md).frontMatter).toMatchObject(avant.frontMatter);
  expect(resultat.ressource.competencesLiees).toEqual([]);
  expect((await rattacher()).statut).toBe("rattache");
  expect(m.rpc).toHaveBeenCalledTimes(1);
});
it("retrouve la création SQL après réponse perdue et ne la rejoue pas", async () => {
  nouveauSujet(); const rpc = m.rpc.getMockImplementation()!;
  m.rpc.mockImplementationOnce(async (...args) => { await rpc(...args); throw new Error("Réponse perdue"); });
  expect((await rattacher()).statut).toBe("rattache");
  expect(m.rpc).toHaveBeenCalledTimes(1);
});
it("rend une création partielle reprenable explicitement sans recréer le domaine", async () => {
  nouveauSujet(); const modifier = m.modifier.getMockImplementation()!;
  m.modifier.mockImplementationOnce(modifier).mockRejectedValueOnce(new Error("Lien indisponible"));
  await expect(rattacher()).rejects.toThrow("domaine a été créé");
  expect(lireRessource()).toMatchObject({ domaineId: undefined, creationDomaineDeleguee: { statut: "reservee" } });
  expect((await rattacherDomaineDelegueAction("doc", "a", "v2")).statut).toBe("rattache");
  expect(m.rpc).toHaveBeenCalledTimes(1);
  expect(domaines).toHaveLength(1);
});
it("la migration distante absente conserve une réservation relisible et n'effectue aucun contournement", async () => {
  nouveauSujet(); m.rpc.mockResolvedValueOnce({ error: { message: "Une compétence est requise" }, data: null });
  await expect(rattacher()).rejects.toThrow("création de ce domaine n'a pas abouti");
  expect(lireRessource().creationDomaineDeleguee?.statut).toBe("reservee");
  expect(lireRessource().domaineId).toBeUndefined();
  expect(m.rpc).toHaveBeenCalledTimes(1);
  expect(domaines).toHaveLength(0);
});
it("les collisions avec un domaine archivé ou un préfixe réservé bloquent avant tout effet", async () => {
  nouveauSujet();
  for (const changement of [{ id: "astronomie", nom: "Autre", prefixe: "AUT" }, { id: "autre", nom: " astronomie ", prefixe: "AUT" }, { id: "autre", nom: "Autre", prefixe: "ASTR" }]) {
    domaines = [{ ...changement, description: "", origine: "utilisateur", archive: true, version: 1, ordre: 0 }];
    await expect(rattacher()).rejects.toThrow(/déjà|utilisé/);
  }
  expect(m.rpc).not.toHaveBeenCalled(); expect(m.modifier).not.toHaveBeenCalled();
});
it("un CAS refusé à la réservation interdit la création", async () => {
  nouveauSujet(); m.modifier.mockRejectedValueOnce(new Error("Conflit de version"));
  await expect(rattacher()).rejects.toThrow("Conflit de version");
  expect(m.rpc).not.toHaveBeenCalled();
});
it("un choix humain après la réservation arrête la création", async () => {
  nouveauSujet(); const modifier = m.modifier.getMockImplementation()!;
  m.modifier.mockImplementationOnce(async (...args) => {
    await modifier(...args); md = definirChampsFrontMatter(md, { rangement_origine: "personne", rangement_statut: "a-trier" }); version++;
  });
  expect((await rattacher()).statut).toBe("preserve");
  expect(m.rpc).not.toHaveBeenCalled();
});
it("un choix humain après la création n'est pas écrasé par le rattachement ni par sa reprise", async () => {
  nouveauSujet(); const rpc = m.rpc.getMockImplementation()!;
  m.rpc.mockImplementationOnce(async (...args) => {
    const r = await rpc(...args); md = definirChampsFrontMatter(md, { domaine: "physique", rangement_origine: "personne" }); version++; return r;
  });
  expect(await rattacher()).toMatchObject({ statut: "preserve", raison: expect.stringContaining("a été créé ; votre choix actuel est conservé") });
  expect((await rattacherDomaineDelegueAction("doc", "a", "v3")).ressource.domaineId).toBe("physique");
  expect(m.rpc).toHaveBeenCalledTimes(1); expect(m.modifier).toHaveBeenCalledTimes(1);
});
it("ne reprend pas une réservation dont l'analyse a été modifiée", async () => {
  nouveauSujet(); m.rpc.mockRejectedValueOnce(new Error("Hors ligne"));
  await expect(rattacher()).rejects.toThrow("Hors ligne");
  depot.analyses[0].restitution!.elements.push({ id: "nouveau", nature: "sujet", texte: "Changement", sources: [] });
  await expect(rattacherDomaineDelegueAction("doc", "a", "v2")).rejects.toThrow("analyse a changé");
  expect(m.rpc).toHaveBeenCalledTimes(1);
});
it("isole la clé par compte et refuse un compte changé avant création", async () => {
  nouveauSujet(); compte = "autre";
  await expect(rattacher()).rejects.toThrow("compte courant a changé");
  expect(m.rpc).not.toHaveBeenCalled();
});
it("retire le domaine créé après réanalyse et ne le recrée jamais après ce refus", async () => {
  nouveauSujet(); await rattacher();
  depot.analyses.push({ ...depot.analyses[0], id: "b", creeLe: "2026-09-17" });
  expect((await annulerRattachementDelegueAction("doc", "a", "v3")).ressource.domaineId).toBeUndefined();
  expect((await rattacherDomaineDelegueAction("doc", "a", "v4")).statut).toBe("preserve");
  expect(domaines).toHaveLength(1); expect(m.rpc).toHaveBeenCalledTimes(1);
});
it("une réponse perdue après réservation ou après lien final se reprend sans second domaine", async () => {
  nouveauSujet(); const modifier = m.modifier.getMockImplementation()!;
  m.modifier.mockImplementation(async (...args) => { await modifier(...args); throw new Error("Réponse perdue"); });
  expect((await rattacher()).statut).toBe("rattache");
  expect(m.modifier).toHaveBeenCalledTimes(2); expect(m.rpc).toHaveBeenCalledTimes(1);
});
it("une réanalyse après réservation interrompt la création et une réanalyse après SQL interrompt le lien", async () => {
  nouveauSujet(); const modifier = m.modifier.getMockImplementation()!;
  m.modifier.mockImplementationOnce(async (...args) => {
    const resultat = await modifier(...args); depot.analyses.push({ ...depot.analyses[0], id: "b", statut: "en-cours" }); return resultat;
  });
  expect((await rattacher()).statut).toBe("a-controler"); expect(m.rpc).not.toHaveBeenCalled();
  depot.analyses.pop();
  const rpc = m.rpc.getMockImplementation()!;
  m.rpc.mockImplementationOnce(async (...args) => {
    const resultat = await rpc(...args); depot.analyses.push({ ...depot.analyses[0], id: "b", statut: "en-cours" }); return resultat;
  });
  expect(await rattacherDomaineDelegueAction("doc", "a", "v2")).toMatchObject({ statut: "a-controler", raison: expect.stringContaining("a été créé"), ressource: { domaineId: undefined } });
  expect(m.modifier).toHaveBeenCalledTimes(1); expect(domaines).toHaveLength(1);
});
it("le CAS final conserve le nouveau choix humain arrivé après la dernière lecture", async () => {
  nouveauSujet(); const modifier = m.modifier.getMockImplementation()!;
  m.modifier.mockImplementationOnce(modifier).mockImplementationOnce(async (...args) => {
    md = definirChampsFrontMatter(md, { domaine: "physique", rangement_origine: "personne" }); version++;
    return modifier(...args);
  });
  expect(await rattacher()).toMatchObject({ statut: "preserve", raison: expect.stringContaining("a été créé"), ressource: { domaineId: "physique" } });
  expect(domaines).toHaveLength(1);
});
it("ne crée ni ne rattache sur un reçu SQL étranger ou illisible", async () => {
  nouveauSujet();
  m.recu.mockResolvedValueOnce({ data: { domaine_id: "astronomie", type: "creer_domaine", origine: "utilisateur" }, error: null });
  await expect(rattacher()).rejects.toThrow("reçu de création ne correspond pas");
  m.recu.mockResolvedValueOnce({ data: null, error: { message: "Indisponible" } });
  await expect(rattacher()).rejects.toThrow("doit être vérifiée");
  expect(m.rpc).not.toHaveBeenCalled(); expect(m.modifier).not.toHaveBeenCalled();
});
it("ne rattache pas le domaine créé puis archivé avant le lien", async () => {
  nouveauSujet(); const rpc = m.rpc.getMockImplementation()!;
  m.rpc.mockImplementationOnce(async (...args) => { const resultat = await rpc(...args); domaines[0].archive = true; referentiel.domaines = []; return resultat; });
  expect(await rattacher()).toMatchObject({ statut: "a-controler", raison: expect.stringContaining("archivé"), ressource: { domaineId: undefined } });
  expect(m.modifier).toHaveBeenCalledTimes(1); expect(m.rpc).toHaveBeenCalledTimes(1);
});
it("deux appels concurrents utilisent la même identité de création et ne créent qu'un domaine", async () => {
  nouveauSujet();
  const resultats = await Promise.allSettled([rattacher(), rattacher()]);
  expect(resultats.some((r) => r.status === "fulfilled" && r.value.statut === "rattache")).toBe(true);
  expect(domaines).toHaveLength(1); expect(recus.size).toBe(1);
  expect(new Set(m.rpc.mock.calls.map((appel) => appel[1].p_request_id)).size).toBe(1);
  expect(lireRessource().domaineId).toBe("astronomie");
});
it("la même source et analyse dans un autre compte reçoivent une autre identité de commande", async () => {
  nouveauSujet(); await rattacher(); const premiereCle = lireRessource().creationDomaineDeleguee!.cle;
  compte = "second"; referentiel = { compteId: "second", domaines: [], competences: [] }; domaines = [];
  md = "---\ntitle: Original\ndepot_version: 2\n---\nUne équation.\n"; version = 1;
  await rattacher();
  expect(lireRessource().creationDomaineDeleguee!.cle).not.toBe(premiereCle);
  expect(recus.size).toBe(2); expect(domaines).toHaveLength(1);
});
