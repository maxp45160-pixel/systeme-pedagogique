import { describe, expect, it } from "vitest";
import { resoudreSegmentsFilAriane, type ElementIdentifiablePourFilAriane } from "./fil-ariane";

describe("resoudreSegmentsFilAriane", () => {
  const elementsMock: ElementIdentifiablePourFilAriane[] = [
    {
      id: "domaine:dom-arch",
      type: "domaine",
      domaineId: "dom-arch",
      titre: "Architecture logicielle",
      vuePedagogique: { kind: "domaine", nom: "Architecture logicielle" },
    },
    {
      id: "domaine:dom-maths",
      type: "domaine",
      domaineId: "dom-maths",
      titre: "Mathématiques",
      vuePedagogique: { kind: "domaine", nom: "Mathématiques" },
    },
  ];

  it("résout proprement les segments pour un thème transversal (clic sur Thèmes)", () => {
    const resultat = resoudreSegmentsFilAriane({
      dossier: "Transversal/Thèmes",
      titreCourant: "Loi de Conway et ses applications en architecture logicielle",
      elements: elementsMock,
    });

    expect(resultat.titreCourant).toBe("Loi de Conway et ses applications en architecture logicielle");
    expect(resultat.segments).toEqual([
      {
        libelle: "Transversal",
        cheminCumule: "Transversal",
        cible: { type: "element", idOuChemin: "transversal" },
      },
      {
        libelle: "Thèmes",
        cheminCumule: "Transversal/Thèmes",
        cible: { type: "dossier", idOuChemin: "Transversal/Thèmes" },
      },
    ]);
  });

  it("résout les segments pour une compétence nichée dans un domaine et sous-dossier de palier", () => {
    const resultat = resoudreSegmentsFilAriane({
      dossier: "Domaines/Architecture logicielle/Compétences/Débutant",
      titreCourant: "LOG-01",
      elements: elementsMock,
    });

    expect(resultat.titreCourant).toBe("LOG-01");
    expect(resultat.segments).toEqual([
      {
        libelle: "Domaines",
        cheminCumule: "Domaines",
        cible: { type: "element", idOuChemin: "domaines" },
      },
      {
        libelle: "Architecture logicielle",
        cheminCumule: "Domaines/Architecture logicielle",
        cible: { type: "element", idOuChemin: "domaine:dom-arch" },
      },
      {
        libelle: "Compétences",
        cheminCumule: "Domaines/Architecture logicielle/Compétences",
        cible: { type: "dossier", idOuChemin: "Domaines/Architecture logicielle/Compétences" },
      },
      {
        libelle: "Débutant",
        cheminCumule: "Domaines/Architecture logicielle/Compétences/Débutant",
        cible: { type: "dossier", idOuChemin: "Domaines/Architecture logicielle/Compétences/Débutant" },
      },
    ]);
  });

  it("résout les segments pour la vue d'un domaine d'apprentissage", () => {
    const resultat = resoudreSegmentsFilAriane({
      dossier: "Domaines",
      titreCourant: "Architecture logicielle",
      elements: elementsMock,
    });

    expect(resultat.titreCourant).toBe("Architecture logicielle");
    expect(resultat.segments).toEqual([
      {
        libelle: "Domaines",
        cheminCumule: "Domaines",
        cible: { type: "element", idOuChemin: "domaines" },
      },
    ]);
  });

  it("résout les segments pour un domaine archivé", () => {
    const resultat = resoudreSegmentsFilAriane({
      dossier: "Domaines archivés",
      titreCourant: "Ancien Domaine",
      elements: elementsMock,
    });

    expect(resultat.titreCourant).toBe("Ancien Domaine");
    expect(resultat.segments).toEqual([
      {
        libelle: "Domaines archivés",
        cheminCumule: "Domaines archivés",
        cible: { type: "element", idOuChemin: "domaines-archives" },
      },
    ]);
  });

  it("résout les segments pour une note de support transversale", () => {
    const resultat = resoudreSegmentsFilAriane({
      dossier: "Transversal/Notes de support/Outils",
      titreCourant: "Guide Docker",
      elements: elementsMock,
    });

    expect(resultat.titreCourant).toBe("Guide Docker");
    expect(resultat.segments).toEqual([
      {
        libelle: "Transversal",
        cheminCumule: "Transversal",
        cible: { type: "element", idOuChemin: "transversal" },
      },
      {
        libelle: "Notes de support",
        cheminCumule: "Transversal/Notes de support",
        cible: { type: "dossier", idOuChemin: "Transversal/Notes de support" },
      },
      {
        libelle: "Outils",
        cheminCumule: "Transversal/Notes de support/Outils",
        cible: { type: "dossier", idOuChemin: "Transversal/Notes de support/Outils" },
      },
    ]);
  });

  it("gère un dossier vide ou racine sans erreur", () => {
    const resultat = resoudreSegmentsFilAriane({
      dossier: "",
      titreCourant: "Document isolé",
      elements: elementsMock,
    });

    expect(resultat.titreCourant).toBe("Document isolé");
    expect(resultat.segments).toEqual([]);
  });
});
