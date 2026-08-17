import { describe, expect, it } from "vitest";

import {
  documentEnLectureSeule,
  estDocumentPreuve,
  estFicheExercice,
} from "./nature-document";

describe("nature d'un document", () => {
  it("reconnaît une preuve par son type comme par son identifiant", () => {
    expect(estDocumentPreuve({ id: "note-libre", type: "preuve" })).toBe(true);
    expect(estDocumentPreuve({ id: "preuve-tentative-1" })).toBe(true);
    expect(estDocumentPreuve({ id: "note-libre", type: "note" })).toBe(false);
  });

  it("reconnaît une fiche d'exercice par son type comme par son identifiant", () => {
    expect(estFicheExercice({ id: "note-libre", type: "exercice" })).toBe(true);
    /* `idFicheExercice` écrit `exercice-<id>` : la fiche se reconnaît sans front matter. */
    expect(estFicheExercice({ id: "exercice-flux" })).toBe(true);
    expect(estFicheExercice({ id: "note-flux", type: "note" })).toBe(false);
  });

  it("verrouille ce qui est dérivé d'une source en base, et rien d'autre", () => {
    expect(documentEnLectureSeule({ id: "preuve-tentative-1" })).toBe(true);
    expect(documentEnLectureSeule({ id: "exercice-flux", type: "exercice" })).toBe(true);
    /* Une note reste modifiable : c'est le seul texte dont le corpus est la source. */
    expect(documentEnLectureSeule({ id: "note-log-01", type: "note" })).toBe(false);
    expect(documentEnLectureSeule({ id: "cours-stock", type: "cours" })).toBe(false);
  });
});
