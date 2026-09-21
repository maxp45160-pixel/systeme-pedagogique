import { expect, it } from "vitest";
import { appliquerCorrectionsClassement, validerCorrectionsClassement } from "./corrections-classement";
import type { CompetenceProposeeDepot } from "./depot";
import { OBJET_MAX } from "@/lib/domain/atomicite";

const correction = { indice: 0, verbeAction: "calculer", objet: "une proportion" };
const proposition: Extract<CompetenceProposeeDepot, { mode: "nouvelle" }> = { mode: "nouvelle", intitule: "Calculer une valeur", verbeAction: "calculer", objet: "une valeur", precision: "ancienne précision", palier: "fondamentaux", importance: 0.5, domaine: { mode: "nouveau", nom: "Mathématiques" }, justification: "Exercice du cours", sources: [{ documentId: "doc", pieceId: "piece", page: 2, citation: "Calculer une proportion." }] };

it("normalise les corrections structurées et refuse toute modification de source ou de mesure", () => {
  expect(validerCorrectionsClassement([{ ...correction, verbeAction: " CALCULER ", objet: " une proportion ", precision: " " }])).toEqual([correction]);
  for (const extra of [{ sources: [] }, { palier: "avance" }, { importance: 1 }, { code: "FABRIQUE" }, { intitule: "titre libre" }]) {
    expect(() => validerCorrectionsClassement([{ ...correction, ...extra }])).toThrow("seuls");
  }
});

it("refuse indices doublés, structure invalide et contrôles cachés", () => {
  for (const brut of [[correction, correction], [{ ...correction, indice: -1 }], [{ ...correction, indice: 0.5 }], [{ ...correction, verbeAction: "comprendre" }], [{ ...correction, objet: "" }], [{ ...correction, objet: "a".repeat(OBJET_MAX + 1) }], [{ ...correction, objet: "une\nproportion" }], [{ ...correction, precision: null }]]) {
    expect(() => validerCorrectionsClassement(brut)).toThrow();
  }
});

it("corrige le titre sans modifier l'original, la citation, le domaine ni la pondération", () => {
  const original = structuredClone(proposition);
  const [corrigee] = appliquerCorrectionsClassement([proposition], [correction]);
  expect(corrigee).toMatchObject({ intitule: "Calculer une proportion", sources: original.sources, palier: original.palier, importance: original.importance, domaine: original.domaine });
  expect(corrigee).toHaveProperty("precision", undefined);
  expect(proposition).toEqual(original);
});

it("refuse de corriger un indice absent ou une compétence existante", () => {
  expect(() => appliquerCorrectionsClassement([], [correction])).toThrow("proposition nouvelle");
  expect(() => appliquerCorrectionsClassement([{ mode: "existante", code: "MAT-1", justification: "", sources: [] }], [correction])).toThrow("proposition nouvelle");
});
