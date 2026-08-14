import { describe, expect, it } from "vitest";
import {
  analyserJournal,
  analyserLigneJournal,
  ligneCompetenceSeance,
  ligneExerciceSeance,
} from "./journal-seance";

describe("lignes de journal de séance", () => {
  it("relit ce qu'elle a écrit pour un exercice", () => {
    const ligne = ligneExerciceSeance("ex-1", "Calculer un stock de sécurité");
    expect(analyserLigneJournal(ligne)).toEqual({
      genre: "exercice",
      cible: "ex-1",
      libelle: "Calculer un stock de sécurité",
      texte: ligne,
    });
  });

  it("relit ce qu'elle a écrit pour une compétence", () => {
    const ligne = ligneCompetenceSeance("LOG-1");
    expect(analyserLigneJournal(ligne)).toMatchObject({ genre: "competence", cible: "LOG-1" });
  });

  /*
   * Un identifiant ne dit pas ce qu'il désigne. Sans préfixe, l'affichage
   * devrait deviner — et se tromperait le jour où un code de compétence
   * ressemble à un identifiant d'exercice.
   */
  it("distingue exercice et compétence par le préfixe, pas par la forme de la cible", () => {
    expect(analyserLigneJournal(ligneExerciceSeance("LOG-1", "Piège")).genre).toBe("exercice");
    expect(analyserLigneJournal(ligneCompetenceSeance("ex-1")).genre).toBe("competence");
  });

  it("retombe sur le libellé de la cible quand le titre manque", () => {
    expect(analyserLigneJournal("- Exercice : [[ex-2]]")).toMatchObject({
      genre: "exercice",
      cible: "ex-2",
      libelle: "ex-2",
    });
  });

  /* Ce qu'on ne comprend pas est rendu tel quel, jamais écarté. */
  it("garde une ligne écrite à la main", () => {
    expect(analyserLigneJournal("Séance interrompue à mi-parcours.")).toEqual({
      genre: "texte",
      texte: "Séance interrompue à mi-parcours.",
    });
  });

  it("tolère les espaces surnuméraires", () => {
    expect(analyserLigneJournal("-  Exercice :   [[ex-3]]  —  Titre  ")).toMatchObject({
      genre: "exercice",
      cible: "ex-3",
      libelle: "Titre",
    });
  });
});

describe("journal complet", () => {
  it("ignore les lignes vides et conserve l'ordre", () => {
    const journal = analyserJournal(
      [
        ligneExerciceSeance("ex-1", "Premier"),
        "",
        ligneCompetenceSeance("LOG-1"),
        "   ",
        "Une remarque.",
      ].join("\n"),
    );
    expect(journal.map(({ genre }) => genre)).toEqual(["exercice", "competence", "texte"]);
  });

  it("rend un journal vide pour une section vide", () => {
    expect(analyserJournal("")).toEqual([]);
  });
});
