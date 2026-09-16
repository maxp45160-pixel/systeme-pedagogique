import { expect, it } from "vitest";
import { analysePourClassement, cheminDomaineClassement, validerChoixClassementRessources } from "./classement-ressources";
import type { DepotDocumentaire } from "./depot";

const choix = { documentId: "doc", analyseId: "a", updatedAtAttendu: "v1", domaine: { mode: "existant", id: "math" }, codes: [], propositions: [] };
it("valide la frontière réseau et refuse codes répétés, indices fabriqués et documents doublés", () => {
  for (const brut of [null, [], [choix, choix], [{ ...choix, codes: ["X", "X"] }], [{ ...choix, propositions: [-1] }], [{ ...choix, domaine: null }]]) expect(() => validerChoixClassementRessources(brut)).toThrow();
});
it("exige un usage réellement déclaré et l'année d'un module", () => {
  for (const usage of [{ type: "indetermine" }, { type: "module" }, { type: "module", anneeAcademique: {} }]) expect(() => validerChoixClassementRessources([{ ...choix, domaine: { mode: "nouveau", nom: "Calcul", usage } }])).toThrow();
  expect(() => validerChoixClassementRessources([{ ...choix, domaine: { mode: "nouveau", nom: "Calcul", usage: { type: "continu" } } }])).toThrow("compétence");
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
