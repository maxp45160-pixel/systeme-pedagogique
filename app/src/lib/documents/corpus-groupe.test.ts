import { describe, expect, it } from "vitest";

import { rangementDomaine, rangementRessource } from "./rangement-atelier";
import { CLE_SANS_DOMAINE, domaineAffichageCorpus, regrouperFichesParDomaine, separerGroupesNommes } from "./corpus-groupe";
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

describe("domaine de lecture et conservation des résultats", () => {
  it("suit le domaine explicite, sa correction puis son retrait sans modifier la fiche", () => {
    const element = fiche("Cours", { domaineId: "organisation", rangement: rangementRessource(["B-1"]) });
    const avant = structuredClone(element);
    const competences = { "B-1": "algebre" };
    expect(domaineAffichageCorpus(element, competences)).toBe("organisation");
    expect(element).toEqual(avant);
    expect(domaineAffichageCorpus({ ...element, domaineId: "corrige" }, competences)).toBe("corrige");
    expect(domaineAffichageCorpus({ ...element, domaineId: undefined }, competences)).toBe("algebre");
    expect(domaineAffichageCorpus(fiche("Sans compétence", { domaineId: "organisation" }), {})).toBe("organisation");
    expect(domaineAffichageCorpus(fiche("Sans domaine"), {})).toBeNull();
    expect(domaineAffichageCorpus(fiche("Projection", { rangement: rangementDomaine("algebre") }), {})).toBe("algebre");
  });

  it("ne remplace pas un domaine déclaré inconnu par celui d'une compétence", () => {
    expect(domaineAffichageCorpus(fiche("Cours", {
      domaineId: "supprime", rangement: rangementRessource(["B-1"]),
    }), { "B-1": "algebre" })).toBe("supprime");
  });

  it("conserve tous les groupes inconnus et les éléments hors corpus dans leur ordre", () => {
    const elements = [
      fiche("Z inconnue", { domaineId: "inconnu-1" }),
      fiche("Cours connu", { domaineId: "algebre" }),
      fiche("A inconnue", { domaineId: "inconnu-2" }),
      fiche("Sans domaine"), fiche("Hors corpus"),
    ];
    const avant = structuredClone(elements);
    const groupes = regrouperFichesParDomaine(elements, {
      estFicheCorpus: (element) => element.titre !== "Hors corpus",
      domaineDe: (element) => domaineAffichageCorpus(element, {}),
      nomDuDomaine: (id) => id === "algebre" ? "Algèbre" : null,
    });
    const resultat = separerGroupesNommes(elements, groupes);
    expect(resultat.groupes.map((groupe) => groupe.nom)).toEqual(["Algèbre"]);
    expect(resultat.autres).toEqual([elements[0], elements[2], elements[3], elements[4]]);
    expect([...resultat.groupes.flatMap((groupe) => groupe.elements), ...resultat.autres]).toHaveLength(elements.length);
    expect(elements).toEqual(avant);
  });
});
