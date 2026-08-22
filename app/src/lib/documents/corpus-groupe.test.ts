import { describe, expect, it } from "vitest";

import { rangementDomaine, rangementRessource } from "./rangement-atelier";
import { CLE_SANS_DOMAINE, regrouperFichesParDomaine } from "./corpus-groupe";
import type { FicheCorpus } from "./corpus-groupe";

function fiche(titre: string, options: Partial<FicheCorpus> = {}): FicheCorpus {
  return {
    titre,
    rangement: options.rangement ?? rangementRessource([]),
    ...options,
  };
}

describe("regroupement du corpus par domaine", () => {
  const nomsDomaines: Record<string, string> = { algebre: "Algèbre", logistique: "Logistique" };
  const parametres = {
    estFicheCorpus: () => true,
    domaineDe: (element: FicheCorpus) =>
      element.rangement.zone === "domaine"
        ? element.rangement.domaineId ?? null
        : element.domaineId ?? null,
    nomDuDomaine: (id: string) => nomsDomaines[id] ?? null,
  };

  it("réunit les fiches d'un même domaine sous une entête nommée", () => {
    const groupes = regrouperFichesParDomaine([
      fiche("Matrices utiles"),
      fiche("Chapitre 3", { rangement: rangementDomaine("algebre") }),
      fiche("Résumé stocks", { domaineId: "logistique" }),
    ], parametres);

    expect(groupes).toHaveLength(3);
    expect(groupes.map((g) => g.nom)).toEqual(["Algèbre", "Logistique", null]);
    expect(groupes[0].elements.map((f) => f.titre)).toEqual(["Chapitre 3"]);
    expect(groupes[2].cle).toBe(CLE_SANS_DOMAINE);
  });

  it("assemble plusieurs fiches du même domaine et les trie par titre", () => {
    const groupes = regrouperFichesParDomaine([
      fiche("Zeta"),
      fiche("Alpha"),
      fiche("Milieu"),
    ], {
      ...parametres,
      domaineDe: () => "algebre",
    });

    expect(groupes).toHaveLength(1);
    expect(groupes[0].elements.map((f) => f.titre)).toEqual(["Alpha", "Milieu", "Zeta"]);
  });

  it("ignore les fiches que estFicheCorpus écarte", () => {
    const groupes = regrouperFichesParDomaine(
      [
        fiche("Note support", { domaineId: "algebre" }),
        fiche("Exercice", { domaineId: "algebre" }),
      ],
      {
        ...parametres,
        estFicheCorpus: (element) => element.titre.startsWith("Note"),
      },
    );

    expect(groupes).toHaveLength(1);
    expect(groupes[0].elements.map((f) => f.titre)).toEqual(["Note support"]);
  });

  it("classe en dernier les fiches dont le domaine est inconnu du référentiel", () => {
    const groupes = regrouperFichesParDomaine(
      [
        fiche("Orpheline"),
        fiche("Rangée", { domaineId: "logistique" }),
      ],
      parametres,
    );

    expect(groupes[groupes.length - 1].elements.map((f) => f.titre)).toEqual(["Orpheline"]);
    expect(groupes[groupes.length - 1].nom).toBeNull();
  });

  it("ne regroupe rien quand aucune fiche n'est concernée", () => {
    expect(regrouperFichesParDomaine([], parametres)).toEqual([]);
  });
});
