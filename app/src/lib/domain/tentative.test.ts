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

import { motifBlocageBilan, motifRefusTerminerExercice, reponseSuffisante } from "./tentative";

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

describe("motifRefusTerminerExercice", () => {
  const avant = {
    id: "att-1",
    statut: "en-cours",
    exerciseId: "ex-1",
    reponse: "ma démarche",
  } as const;
  const soumission = { exerciseId: "ex-1", dureeMin: 12 };

  it("refuse une tentative déjà clôturée — on ne rejoue pas une soumission", () => {
    /*
     * `terminerExercice` est une Server Function publique : rejouer la
     * soumission réécrirait une seconde preuve pour la même tentative (audit
     * §2.1). Le statut doit donc être vérifié, pas présumé.
     */
    const motif = motifRefusTerminerExercice({ ...avant, statut: "terminee" }, soumission);
    expect(motif).toBeTruthy();
    expect(motif).toContain("clôturée");
  });

  it("refuse un couple tentative/exercice incohérent — la preuve suivrait le mauvais exercice", () => {
    const motif = motifRefusTerminerExercice(avant, { ...soumission, exerciseId: "ex-2" });
    expect(motif).toBeTruthy();
    expect(motif).toContain("ne correspond pas");
  });

  it("refuse une durée non finie ou non positive — elle alimente `tentativeMenee`", () => {
    expect(motifRefusTerminerExercice(avant, { ...soumission, dureeMin: 0 })).toBeTruthy();
    expect(motifRefusTerminerExercice(avant, { ...soumission, dureeMin: -4 })).toBeTruthy();
    // `NaN` (venue d'un champ inexploitable) ne doit pas passer non plus.
    expect(motifRefusTerminerExercice(avant, { ...soumission, dureeMin: Number.NaN })).toBeTruthy();
  });

  it("refuse une réponse absente — l'ouverture du bilan reste verrouillée", () => {
    const motif = motifRefusTerminerExercice({ ...avant, reponse: "   " }, soumission);
    expect(motif).toContain("Enregistrer le brouillon");
  });

  it("accepte une soumission cohérente", () => {
    expect(motifRefusTerminerExercice(avant, soumission)).toBeNull();
  });
});
