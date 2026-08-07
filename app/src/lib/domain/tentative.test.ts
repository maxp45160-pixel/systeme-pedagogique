/**
 * Ce que ces tests protègent.
 *
 * `reponseSuffisante` est la condition d'ouverture du bilan, donc la condition
 * d'écriture d'une preuve. Deux risques symétriques :
 *
 * - trop laxiste — une chaîne d'espaces rouvrirait le parcours d'avant, où une
 *   preuve s'écrivait sans qu'aucune trace ne la justifie ;
 * - trop strict — un seuil de longueur inventé refuserait une réponse d'un mot
 *   qui est parfois la bonne réponse (un résultat de calcul), et un seuil posé
 *   sans données se déplace au premier désaccord (ADR-028).
 */

import { describe, expect, it } from "vitest";

import { motifBlocageBilan, reponseSuffisante } from "./tentative";

describe("reponseSuffisante", () => {
  it("refuse une réponse vide", () => {
    expect(reponseSuffisante("")).toBe(false);
  });

  it("refuse une réponse faite d'espaces et de sauts de ligne", () => {
    // Le brouillon est enregistré par un clic explicite : un champ « nettoyé »
    // puis enregistré ne doit pas rouvrir le bilan.
    expect(reponseSuffisante("   \n\t  \r\n ")).toBe(false);
  });

  it("refuse une réponse absente — présumer suffisant serait l'inverse de la règle", () => {
    expect(reponseSuffisante(null)).toBe(false);
    expect(reponseSuffisante(undefined)).toBe(false);
  });

  it("accepte une réponse d'un seul mot — aucun seuil n'est inventé", () => {
    // « 42 » est une réponse complète à un exercice de calcul. Poser un
    // minimum de caractères ici serait un seuil sans données (CLAUDE.md §8).
    expect(reponseSuffisante("42")).toBe(true);
  });

  it("accepte une réponse entourée d'espaces", () => {
    expect(reponseSuffisante("  la tournée B  ")).toBe(true);
  });
});

describe("motifBlocageBilan", () => {
  it("ne rend aucun motif quand la réponse suffit", () => {
    expect(motifBlocageBilan("une démarche")).toBeNull();
  });

  it("nomme le bouton à cliquer, pas seulement l'intention", () => {
    /*
     * `zone-reponse.tsx` exige un « Enregistrer le brouillon » explicite : le
     * texte à l'écran ne suffit pas, c'est ce que la base porte qui compte.
     * Un message qui dirait seulement « rédige ta réponse » enverrait
     * l'utilisateur regarder un champ qu'il a déjà rempli.
     */
    const motif = motifBlocageBilan("");
    expect(motif).toContain("Enregistrer le brouillon");
  });
});
