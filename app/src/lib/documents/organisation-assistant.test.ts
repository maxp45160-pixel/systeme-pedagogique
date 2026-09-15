import { expect, it } from "vitest";
import { organiserDepuisReferentiel } from "./organisation-assistant";
import type { DepotDocumentaire, PropositionOrganisationRessource } from "./depot";
import type { ContexteOrganisationDepot } from "./organisation-depot";
import { appliquerRangementDepot } from "./organisation-depot";
import { sansSections } from "./sections-markdown";

const contexte: ContexteOrganisationDepot = { compteId: "compte", domaines: [{ id: "math", nom: "Mathématiques", prefixe: "MAT", description: "" }], competences: [{ code: "MAT-01", intitule: "Calculer une probabilité", domaine: "math", domaineNom: "Mathématiques" }] };
const source = { justification: "Mention explicite", sources: [{ documentId: "doc", citation: "probabilité" }] };
const organisation: PropositionOrganisationRessource = { ...source, titreSuggere: "Probabilités", typeSuggere: "cours", domaine: { ...source, mode: "existant", id: "math" }, competences: [{ ...source, mode: "existante", code: "MAT-01" }] };
function depot(proposition = organisation): DepotDocumentaire {
  return { id: "doc", version: 2, titre: "Original", type: "reference", note: "probabilité", creeLe: "2026-09-13", modifieLe: "v1", competencesLiees: [], pieces: [], corrections: [], analyses: [{ id: "a", documentId: "doc", empreinte: "e", statut: "terminee", pages: [], couvertures: [], erreur: null, creeLe: "2026-09-13", modifieLe: "2026-09-13", restitution: { version: 2, modele: "test", creeLe: "2026-09-13", elements: [], couvertures: [], organisation: proposition } }] };
}
it("range avec les références existantes sans fabriquer de compétence ou de niveau", () => {
  expect(organiserDepuisReferentiel(depot(), contexte)).toEqual({ rangement: { titre: "Probabilités", type: "cours", domaineId: "math", codes: ["MAT-01"], analyseId: "a", aTrier: false }, aPreciser: [] });
});
it("réutilise un homonyme uniquement si son domaine correspond sans ambiguïté", () => {
  const nouveau = depot({ ...organisation, competences: [{ ...source, mode: "nouvelle", intitule: "Calculer une probabilité", verbeAction: "calculer", objet: "une probabilité", palier: "fondamentaux", importance: 0.5, domaine: { mode: "existant", id: "math" } }] });
  expect(organiserDepuisReferentiel(nouveau, contexte).rangement?.codes).toEqual(["MAT-01"]);
  const ambigu = { ...contexte, competences: [...contexte.competences, { ...contexte.competences[0], code: "AUT-01", domaine: "autre" }] };
  expect(organiserDepuisReferentiel(nouveau, ambigu).rangement?.codes).toEqual([]);
  expect(organiserDepuisReferentiel(nouveau, ambigu).aPreciser).not.toEqual([]);
});
it("laisse une nouveauté à préciser tout en conservant les liens justifiés", () => {
  const d = depot({ ...organisation, domaine: { ...source, mode: "nouveau", nom: "Statistique", description: "Statistique" } });
  const resultat = organiserDepuisReferentiel(d, contexte);
  expect(resultat.rangement).toMatchObject({ aTrier: true, codes: ["MAT-01"], domaineId: undefined });
  expect(resultat.aPreciser.join(" ")).toContain("Statistique");
});
it("ne reprend ni ne remplace un choix humain, même après une autre analyse", () => {
  const d = { ...depot(), titre: "Mon titre", rangementRevuLe: "hier", rangementAnalyseId: "ancienne", rangementOrigine: "personne" as const, rangementStatut: "a-trier" as const };
  expect(organiserDepuisReferentiel(d, contexte)).toEqual({ rangement: null, aPreciser: [] });
});
it("retrouve les réserves d'un rangement automatique partiel sans le réécrire", () => {
  const d = { ...depot({ ...organisation, domaine: { ...source, mode: "nouveau", nom: "Statistique", description: "Statistique" } }), rangementRevuLe: "hier", rangementAnalyseId: "a", rangementOrigine: "assistant" as const, rangementStatut: "a-trier" as const };
  expect(organiserDepuisReferentiel(d, contexte).rangement).toBeNull();
  expect(organiserDepuisReferentiel(d, contexte).aPreciser.join(" ")).toContain("Statistique");
});
it("n'écrit rien à partir d'une analyse échouée ou d'un dépôt historique", () => {
  const d = depot(); d.analyses[0].statut = "echec";
  expect(organiserDepuisReferentiel(d, contexte).rangement).toBeNull();
  expect(organiserDepuisReferentiel({ ...depot(), version: 1 }, contexte).rangement).toBeNull();
});
it("un code disparu n'est pas remplacé par un code inventé", () => {
  const r = organiserDepuisReferentiel(depot(), { ...contexte, competences: [] });
  expect(r.rangement?.codes).toEqual([]); expect(r.rangement?.aTrier).toBe(true);
});
it("le rangement ne transforme pas ses liens en nouvelle matière documentaire", () => {
  const md = "# Source\n\nprobabilité\n\n## Notes personnelles\n\nÀ revoir.";
  const range = appliquerRangementDepot(md, { titre: "Source", type: "cours", codes: ["MAT-01"], analyseId: "a" }, "date", "empreinte");
  expect(sansSections(range, ["Compétences liées"])).not.toContain("[[MAT-01]]");
  expect(sansSections(range, ["Compétences liées"])).toContain("## Notes personnelles\n\nÀ revoir.");
});
