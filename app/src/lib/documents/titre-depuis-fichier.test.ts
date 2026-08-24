import { describe, expect, it } from "vitest";
import { titreDepuisNomFichier } from "./titre-depuis-fichier";

describe("titreDepuisNomFichier", () => {
  it("dérive un titre lisible d'un nom de fichier à séparateurs", () => {
    expect(titreDepuisNomFichier("cours_chapitre-3_matrices.pdf")).toBe(
      "Cours chapitre 3 matrices",
    );
  });

  it("conserve un nom déjà lisible et retire seulement l'extension", () => {
    expect(titreDepuisNomFichier("Logistique industrielle.pdf")).toBe(
      "Logistique industrielle",
    );
  });

  it("retire la dernière extension seulement", () => {
    expect(titreDepuisNomFichier("archive.cours.final.PDF")).toBe(
      "Archive.cours.final",
    );
  });

  it("repli sur un titre sobre quand le nom ne dit rien", () => {
    expect(titreDepuisNomFichier(".pdf")).toBe("Cours sans titre");
    expect(titreDepuisNomFichier("   .pdf")).toBe("Cours sans titre");
    expect(titreDepuisNomFichier("")).toBe("Cours sans titre");
  });
});
