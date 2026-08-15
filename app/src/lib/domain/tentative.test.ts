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

import { DUREE_ESTIMEE_MAX } from "./exercice";
import {
  dureeRetenue,
  motifBlocageBilan,
  motifRefusTerminerExercice,
  reponseSuffisante,
} from "./tentative";

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

/*
 * `dureeRetenue` — ADR-071.
 *
 * `dureeMin` est du temps d'HORLOGE. Le 15/08/2026, `att-mst5fis8-rfsu6` portait
 * 1015 minutes pour un exercice ouvert la veille au soir et abandonné le matin.
 * Deux plafonds, parce que la question n'est pas la même : un abandon n'écrit
 * aucune preuve, une tentative menée en écrit une et sa durée sert de référence.
 */
describe("dureeRetenue", () => {
  const ESTIMEE = 20;

  it("plafonne un abandon à la durée estimée", () => {
    expect(dureeRetenue({ statut: "abandonnee", dureeMin: 1015 }, ESTIMEE)).toBe(20);
  });

  it("laisse un abandon bref tel quel — 5 minutes restent 5 minutes", () => {
    expect(dureeRetenue({ statut: "abandonnee", dureeMin: 5 }, ESTIMEE)).toBe(5);
  });

  it("ne rogne pas une tentative menée plus longue que l'estimation", () => {
    // `diag-ro-01` : 61 min sur 35 estimées, et c'est un fait exact dont
    // `dureeDeReference` a besoin (ADR-045).
    expect(dureeRetenue({ statut: "terminee", dureeMin: 61 }, 35)).toBe(61);
  });

  it("applique quand même le garde-fou général à une tentative menée", () => {
    expect(dureeRetenue({ statut: "terminee", dureeMin: 1015 }, ESTIMEE)).toBe(DUREE_ESTIMEE_MAX);
  });

  it("sans exercice résolvable, retombe sur le garde-fou général", () => {
    expect(dureeRetenue({ statut: "abandonnee", dureeMin: 1015 })).toBe(DUREE_ESTIMEE_MAX);
  });

  it("ignore une estimation inexploitable plutôt que de plafonner à zéro", () => {
    // Plafonner à 0 fabriquerait une absence de travail : exactement ce que P2
    // interdit, à l'envers.
    expect(dureeRetenue({ statut: "abandonnee", dureeMin: 30 }, 0)).toBe(30);
  });

  it("ne fabrique rien à partir d'une durée absente ou invalide", () => {
    expect(dureeRetenue({ statut: "abandonnee", dureeMin: undefined }, ESTIMEE)).toBeUndefined();
    expect(dureeRetenue({ statut: "terminee", dureeMin: 0 }, ESTIMEE)).toBeUndefined();
    expect(dureeRetenue({ statut: "terminee", dureeMin: Number.NaN }, ESTIMEE)).toBeUndefined();
  });
});
