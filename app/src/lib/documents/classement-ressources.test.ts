import { expect, it } from "vitest";
import { analysePourClassement, cheminDomaineClassement, MAX_COMPETENCES_LIEES_RESSOURCE, validerChoixClassementRessources } from "./classement-ressources";
import type { DepotDocumentaire } from "./depot";

const choix = { documentId: "doc", analyseId: "a", updatedAtAttendu: "v1", domaine: { mode: "existant", id: "math" }, codes: [], propositions: [] };
it("valide la frontière réseau et refuse codes répétés, indices fabriqués et documents doublés", () => {
  for (const brut of [null, [], [choix, choix], [{ ...choix, codes: ["X", "X"] }], [{ ...choix, propositions: [-1] }], [{ ...choix, domaine: null }]]) expect(() => validerChoixClassementRessources(brut)).toThrow();
});
it("exige un choix d'usage explicite et l'année d'un module", () => {
  for (const usage of [undefined, { type: "invente" }, { type: "indetermine", anneeAcademique: "2026" }, { type: "module" }, { type: "module", anneeAcademique: {} }]) expect(() => validerChoixClassementRessources([{ ...choix, domaine: { mode: "nouveau", nom: "Calcul", usage } }])).toThrow();
  expect(() => validerChoixClassementRessources([{ ...choix, domaine: { mode: "nouveau", nom: "Calcul", usage: { type: "continu" } } }])).toThrow("compétence");
});
it("accepte un domaine d'organisation sans compétence ni usage académique", () => {
  const entree = { ...choix, domaine: { mode: "nouveau", nom: "Calcul", usage: { type: "indetermine" } } };
  expect(validerChoixClassementRessources([entree])).toEqual([entree]);
});
it("accepte le volume maximal de réception et refuse le dépassement", () => {
  expect(validerChoixClassementRessources(Array.from({ length: 101 }, (_, i) => ({ ...choix, documentId: `d${i}` })))).toHaveLength(101);
  expect(() => validerChoixClassementRessources(Array.from({ length: 102 }, (_, i) => ({ ...choix, documentId: `d${i}` })))).toThrow();
});
it("ne reprend pas une synthèse antérieure à une nouvelle analyse inachevée", () => {
  const depot = { analyses: [{ id: "a", creeLe: "2026-09-14", statut: "terminee", restitution: {} }, { id: "b", creeLe: "2026-09-15", statut: "en-cours", restitution: null }] } as DepotDocumentaire;
  expect(() => analysePourClassement(depot, "a")).toThrow("changé");
});
it("affiche la parenté existante sans fabriquer de branche", () => {
  const commun = { prefixe: "MAT", description: "" };
  expect(cheminDomaineClassement("calcul", [{ ...commun, id: "math", nom: "Mathématiques" }, { ...commun, id: "calcul", nom: "Calcul", parentId: "math" }])).toBe("Mathématiques › Calcul");
});

it("conserve plus de 30 liens acquis avec les nouvelles propositions d'une tranche suivante", () => {
  const acquis = Array.from({ length: 45 }, (_, i) => `MAT-${i.toString().padStart(3, "0")}`).reverse();
  const avant = [...acquis];
  const propositions = Array.from({ length: 30 }, (_, i) => i);
  const [valide] = validerChoixClassementRessources([{ ...choix, codes: acquis, propositions }]);
  expect(valide.codes).toHaveLength(45);
  expect(new Set(valide.codes)).toEqual(new Set(acquis));
  expect(valide.propositions).toEqual(propositions);
  expect(acquis).toEqual(avant);
  // Après confirmation de cette tranche, tous ses liens restent recevables à la suivante.
  const cumules = [...valide.codes, ...Array.from({ length: 30 }, (_, i) => `PHY-${i}`)];
  expect(validerChoixClassementRessources([{ ...choix, analyseId: "suivante", codes: cumules, propositions: [0, 1] }])[0].codes).toHaveLength(75);
});

it("borne le cumul sans modifier la limite de propositions par analyse ni supprimer des liens", () => {
  const codes = Array.from({ length: MAX_COMPETENCES_LIEES_RESSOURCE }, (_, i) => `MAT-${i}`);
  expect(validerChoixClassementRessources([{ ...choix, codes }])[0].codes).toHaveLength(MAX_COMPETENCES_LIEES_RESSOURCE);
  expect(() => validerChoixClassementRessources([{ ...choix, codes, propositions: [0] }])).toThrow("Aucun lien");
  expect(() => validerChoixClassementRessources([{ ...choix, codes: [...codes, "AUT-01"] }])).toThrow();
  expect(() => validerChoixClassementRessources([{ ...choix, propositions: Array.from({ length: 31 }, (_, i) => i) }])).toThrow();
  expect(() => validerChoixClassementRessources([{ ...choix, propositions: [30] }])).toThrow();
  expect(codes).toHaveLength(MAX_COMPETENCES_LIEES_RESSOURCE);
});
