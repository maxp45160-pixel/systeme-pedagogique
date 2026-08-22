import { describe, expect, it } from "vitest";
import {
  compterTentatives,
  modeRetraitExercice,
  usageExercice,
  motifRefusEditionCompetences,
  motifRefusExercice,
  DIFFICULTE_MAX,
  DIFFICULTE_MIN,
  DUREE_ESTIMEE_MAX,
  DUREE_ESTIMEE_MIN,
  type ContenuExercice,
} from "./exercice";
import type { ExerciseAttempt } from "./types";

/*
 * Cycle de vie d'un exercice — calque d'ADR-027 (02/08/2026).
 *
 * Ces cas protègent la même garantie que `modeRetrait` pour les compétences :
 * ce qui ne porte aucune trace s'efface, ce qui en porte s'archive, et le geste
 * est DÉRIVÉ, jamais offert au choix.
 */

let n = 0;
function tent(
  exerciseId: string,
  options: {
    resultat?: ExerciseAttempt["resultat"];
    statut?: ExerciseAttempt["statut"];
  } = {},
): ExerciseAttempt {
  return {
    id: `at-${++n}`,
    exerciseId,
    debut: "2026-08-01T10:00:00.000Z",
    fin: "2026-08-01T10:30:00.000Z",
    dureeMin: 30,
    indicesUtilises: 0,
    reponse: "…",
    evaluation: {},
    resultat: options.resultat ?? "partiel",
    statut: options.statut ?? "terminee",
  };
}

describe("compterTentatives", () => {
  it("compte les abandons aussi : ils figurent au journal", () => {
    // Contrairement à la calibration, qui les écarte parce qu'ils ne MESURENT
    // rien. Ici la question n'est pas « qu'a-t-on mesuré ? » mais « reste-t-il
    // une trace ? » — et une entrée de journal cite l'exercice par son titre.
    const tentatives = [
      tent("ex-1", { statut: "abandonnee" }),
      tent("ex-1", { statut: "en-cours" }),
      tent("ex-2"),
    ];
    expect(compterTentatives("ex-1", tentatives)).toBe(2);
    expect(compterTentatives("ex-2", tentatives)).toBe(1);
    expect(compterTentatives("ex-3", tentatives)).toBe(0);
  });
});

describe("modeRetraitExercice — ADR-035, calque d'ADR-027", () => {
  it("supprime franchement un exercice sans aucune tentative", () => {
    expect(modeRetraitExercice(0)).toBe("suppression");
  });

  it("archive dès la première tentative, quelle qu'elle soit", () => {
    // Une tentative abandonnée suffit : elle figure au journal et cite
    // l'exercice par son titre. L'effacer laisserait une entrée qui ne résout
    // plus (idée de `compterTentatives`).
    expect(modeRetraitExercice(1)).toBe("archivage");
    expect(modeRetraitExercice(12)).toBe("archivage");
  });
});

describe("usageExercice", () => {
  it("« à faire » sans aucune tentative", () => {
    expect(usageExercice("ex-1", [])).toBe("a-faire");
  });

  it("« en cours » prime sur tout le reste", () => {
    const tentatives = [
      tent("ex-1", { resultat: "reussi" }),
      tent("ex-1", { statut: "en-cours" }),
    ];
    expect(usageExercice("ex-1", tentatives)).toBe("en-cours");
  });

  it("« acquis » dès une réussite terminée, même ancienne", () => {
    const tentatives = [
      tent("ex-1", { resultat: "reussi" }),
      tent("ex-1", { resultat: "echec" }),
    ];
    expect(usageExercice("ex-1", tentatives)).toBe("acquis");
  });

  it("« travaillé » quand des tentatives terminées existent sans réussite", () => {
    expect(usageExercice("ex-1", [tent("ex-1", { resultat: "echec" })])).toBe("travaille");
  });

  it("un abandon seul ne fait pas sortir de « à faire »", () => {
    expect(usageExercice("ex-1", [tent("ex-1", { statut: "abandonnee" })])).toBe("a-faire");
  });
});

/* ------------------------------------------------------------------ */
/* Validation du contenu — une règle, une autorité (ADR-047)           */
/* ------------------------------------------------------------------ */

/*
 * `creerExercice` portait ces règles en ligne. `modifierExercice` allait devoir
 * les reprendre : deux copies, dont la seconde aurait pu être plus permissive
 * sans que rien ne le signale — on aurait pu faire entrer par l'édition ce que
 * la création refuse. C'est la forme du défaut qu'ADR-044 a corrigé pour les
 * retraits et l'audit §2.8 pour l'activation.
 */
function contenu(surcharge: Partial<ContenuExercice> = {}): ContenuExercice {
  return {
    titre: "Calcul du stock de sécurité",
    difficulte: 3,
    dureeEstimeeMin: 30,
    competences: ["LOG-10"],
    enonce: "Une référence consomme 120 unités par semaine…",
    correction: "z × σ × √L.",
    criteres: [{ dimension: "application", libelle: "Sait appliquer la formule" }],
    ...surcharge,
  };
}

describe("motifRefusExercice", () => {
  it("accepte un contenu complet", () => {
    expect(motifRefusExercice(contenu())).toBeNull();
  });

  it("refuse les champs vides, y compris remplis d'espaces", () => {
    expect(motifRefusExercice(contenu({ titre: "   " }))).toContain("titre");
    expect(motifRefusExercice(contenu({ enonce: "" }))).toContain("énoncé");
    expect(motifRefusExercice(contenu({ correction: "  " }))).toContain("correction");
  });

  it("refuse un exercice sans compétence ni critère — il ne mesurerait rien", () => {
    expect(motifRefusExercice(contenu({ competences: [] }))).toContain("compétence");
    expect(motifRefusExercice(contenu({ criteres: [] }))).toContain("critère");
  });

  /*
   * Les deux nombres dont le moteur se sert comme d'une règle. La difficulté
   * amorce `difficulteConseillee` ; la durée est ce à quoi `tentativeMenee`
   * compare une tentative pour décider si une observation s'écrit. Les laisser
   * entrer sans contrôle, c'est le défaut du 02/08/2026 (colonne TEXT) déplacé
   * d'un cran.
   */
  it("borne la difficulté sur l'échelle du domaine", () => {
    expect(motifRefusExercice(contenu({ difficulte: DIFFICULTE_MIN }))).toBeNull();
    expect(motifRefusExercice(contenu({ difficulte: DIFFICULTE_MAX }))).toBeNull();
    expect(motifRefusExercice(contenu({ difficulte: 0 }))).toContain("Difficulté");
    expect(motifRefusExercice(contenu({ difficulte: 6 }))).toContain("Difficulté");
    expect(motifRefusExercice(contenu({ difficulte: 2.5 }))).toContain("Difficulté");
    expect(motifRefusExercice(contenu({ difficulte: Number.NaN }))).toContain("Difficulté");
  });

  it("borne la durée sur celle du schéma de l'outil, pas plus large", () => {
    expect(motifRefusExercice(contenu({ dureeEstimeeMin: DUREE_ESTIMEE_MIN }))).toBeNull();
    expect(motifRefusExercice(contenu({ dureeEstimeeMin: DUREE_ESTIMEE_MAX }))).toBeNull();
    expect(motifRefusExercice(contenu({ dureeEstimeeMin: 0 }))).toContain("Durée");
    expect(
      motifRefusExercice(contenu({ dureeEstimeeMin: DUREE_ESTIMEE_MAX + 1 })),
    ).toContain("Durée");
    // La conversion plafonnait autrefois à 480, soit le double du schéma : ce
    // qui entrait en base pouvait dépasser ce que le tuteur avait le droit de
    // proposer.
    expect(motifRefusExercice(contenu({ dureeEstimeeMin: 480 }))).toContain("Durée");
  });
});

/*
 * Les compétences visées ne se modifient pas à l'édition (ADR-047). La règle
 * doit être tenue côté serveur, pas seulement par l'écran : `modifierExercice`
 * est une Server Function, donc un point d'entrée public — « l'interface peut
 * être contournée, pas la règle ».
 */
describe("motifRefusEditionCompetences", () => {
  it("accepte des compétences inchangées, quel que soit leur ordre", () => {
    expect(motifRefusEditionCompetences(["LOG-10"], ["LOG-10"])).toBeNull();
    expect(motifRefusEditionCompetences(["LOG-10", "DEV-01"], ["DEV-01", "LOG-10"])).toBeNull();
  });

  it("refuse d'ajouter, de retirer ou de substituer une compétence", () => {
    expect(motifRefusEditionCompetences(["LOG-10"], ["LOG-10", "DEV-01"])).toContain(
      "ne se modifient pas",
    );
    expect(motifRefusEditionCompetences(["LOG-10", "DEV-01"], ["LOG-10"])).toContain(
      "ne se modifient pas",
    );
    expect(motifRefusEditionCompetences(["LOG-10"], ["DEV-01"])).toContain(
      "ne se modifient pas",
    );
  });
});
