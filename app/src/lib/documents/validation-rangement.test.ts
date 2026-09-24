import { expect, it } from "vitest";
import { MAX_COMPETENCES_LIEES_RESSOURCE } from "./classement-ressources";
import { validerRangementActif } from "./validation-rangement";

it("accepte les liens accumulés au fil des lectures et refuse seulement la limite technique", () => {
  const competences = Array.from({ length: MAX_COMPETENCES_LIEES_RESSOURCE + 1 }, (_, i) => ({ code: `MAT-${i}` }));
  const entree = { titre: "Cours", type: "cours", analyseId: "analyse", domaineId: "math", codes: competences.slice(0, 31).map((c) => c.code) };
  const domaines = [{ id: "math" }];

  expect(() => validerRangementActif(entree, domaines, competences)).not.toThrow();
  expect(() => validerRangementActif({ ...entree, codes: competences.slice(0, MAX_COMPETENCES_LIEES_RESSOURCE).map((c) => c.code) }, domaines, competences)).not.toThrow();
  expect(() => validerRangementActif({ ...entree, codes: competences.map((c) => c.code) }, domaines, competences)).toThrow("Trop de compétences");
});
