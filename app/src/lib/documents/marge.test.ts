import { describe, expect, it } from "vitest";
import {
  ajouterLigneMarge,
  analyserMarge,
  basculerLigneMarge,
  documentMargeInitial,
  ecrireMarge,
  LIGNE_MARGE_MAX,
  motifRefusLigneMarge,
  retirerLigneMarge,
  SECTION_MARGE,
} from "./marge";

/*
 * La propriété qui compte ici, et qui céderait en silence : **le document
 * n'appartient pas à la marge**. Il est ouvrable dans l'Atelier, éditable à la
 * main, et peut porter des sections que personne n'a prévues. Une réécriture
 * qui les emporterait ferait disparaître du texte écrit par la personne, sans
 * qu'aucune erreur ne le signale.
 */

const AVEC_SECTION_ETRANGERE = [
  "---",
  "type: note",
  "id: marge-du-cahier",
  "---",
  "",
  "# Marge du cahier",
  "",
  "## Marge",
  "",
  "- [ ] revoir les conversions <!-- 2026-08-16 -->",
  "",
  "## Notes à moi",
  "",
  "Un paragraphe écrit à la main.",
  "",
].join("\n");

describe("analyserMarge", () => {
  it("lit texte, état et date", () => {
    const lignes = analyserMarge(AVEC_SECTION_ETRANGERE);
    expect(lignes).toEqual([
      { texte: "revoir les conversions", faite: false, notee: "2026-08-16" },
    ]);
  });

  it("accepte une ligne écrite à la main sans date, sans en inventer une", () => {
    const doc = ecrireMarge(documentMargeInitial("2026-08-16"), []).replace(
      `## ${SECTION_MARGE}`,
      `## ${SECTION_MARGE}\n\n- [x] noté à la main`,
    );
    expect(analyserMarge(doc)).toEqual([{ texte: "noté à la main", faite: true }]);
  });

  it("ignore ce qui n'est pas une ligne de marge plutôt que de le deviner", () => {
    const doc = documentMargeInitial().replace(
      `## ${SECTION_MARGE}`,
      `## ${SECTION_MARGE}\n\nUne phrase libre, pas une puce.\n- [ ]   `,
    );
    expect(analyserMarge(doc)).toEqual([]);
  });

  it("ne lit pas les puces d'une autre section", () => {
    const doc = AVEC_SECTION_ETRANGERE.replace(
      "Un paragraphe écrit à la main.",
      "- [ ] ceci n'est pas dans la marge",
    );
    expect(analyserMarge(doc).map((l) => l.texte)).toEqual(["revoir les conversions"]);
  });
});

describe("ecrireMarge", () => {
  it("n'emporte pas ce qu'elle n'a pas écrit", () => {
    const suivant = ecrireMarge(AVEC_SECTION_ETRANGERE, [
      { texte: "revoir les conversions", faite: true, notee: "2026-08-16" },
    ]);
    expect(suivant).toContain("## Notes à moi");
    expect(suivant).toContain("Un paragraphe écrit à la main.");
    expect(suivant).toContain("type: note");
    expect(suivant).toContain("- [x] revoir les conversions <!-- 2026-08-16 -->");
  });

  it("fait un aller-retour sans perte", () => {
    const lignes = [
      { texte: "je bloque sur Little", faite: false, notee: "2026-08-15" },
      { texte: "revoir les unités", faite: true, notee: "2026-08-16" },
    ];
    expect(analyserMarge(ecrireMarge(documentMargeInitial(), lignes))).toEqual(lignes);
  });
});

describe("ajouterLigneMarge", () => {
  it("normalise les espaces et date la ligne", () => {
    expect(ajouterLigneMarge([], "  revoir   les  unités ", "2026-08-16")).toEqual([
      { texte: "revoir les unités", faite: false, notee: "2026-08-16" },
    ]);
  });

  it("ne ré-empile pas une préoccupation déjà notée et non traitée", () => {
    // Une double soumission, ou la même phrase notée deux fois dans la journée,
    // doit converger — sinon la marge se remplit de copies.
    const une = ajouterLigneMarge([], "revoir les unités", "2026-08-16");
    expect(ajouterLigneMarge(une, "revoir les unités", "2026-08-16")).toHaveLength(1);
  });

  it("laisse revenir une phrase déjà traitée : le problème se repose", () => {
    const traitee = [{ texte: "revoir les unités", faite: true, notee: "2026-08-01" }];
    expect(ajouterLigneMarge(traitee, "revoir les unités", "2026-08-16")).toHaveLength(2);
  });
});

describe("motifRefusLigneMarge", () => {
  it("refuse le vide et le trop long", () => {
    expect(motifRefusLigneMarge("   ")).toContain("vide");
    expect(motifRefusLigneMarge("a".repeat(LIGNE_MARGE_MAX + 1))).toContain("trop longue");
    expect(motifRefusLigneMarge("a".repeat(LIGNE_MARGE_MAX))).toBeNull();
  });
});

describe("basculer et retirer", () => {
  const lignes = [
    { texte: "a", faite: false, notee: "2026-08-16" },
    { texte: "b", faite: true, notee: "2026-08-16" },
  ];

  it("bascule l'état d'une seule ligne", () => {
    expect(basculerLigneMarge(lignes, 0).map((l) => l.faite)).toEqual([true, true]);
    expect(basculerLigneMarge(lignes, 1).map((l) => l.faite)).toEqual([false, false]);
  });

  it("ignore un index hors bornes plutôt que de lever", () => {
    // La liste a pu bouger entre l'affichage et le clic. Une marge n'est pas un
    // endroit où l'on veut voir une erreur.
    expect(basculerLigneMarge(lignes, 9)).toEqual(lignes);
    expect(retirerLigneMarge(lignes, 9)).toEqual(lignes);
  });

  it("retire la bonne ligne", () => {
    expect(retirerLigneMarge(lignes, 0).map((l) => l.texte)).toEqual(["b"]);
  });
});
