import { describe, expect, it } from "vitest";
import {
  calibrer,
  calibrerToutes,
  dimensionLaPlusFaible,
  verdictTentative,
  FRACTION_NON_TENTEE,
  FRACTION_TROP_FACILE,
} from "./calibration";
import { computeAllSkillStates } from "./skill-state";
import { recommander } from "./recommend";
import { REFERENTIEL_TEST, skillDeTest } from "@/lib/domain/referentiel.fixture";
import type { Difficulte, Dimension, Exercise, ExerciseAttempt } from "@/lib/domain/types";

/*
 * 3ᵉ maillon de la boucle (ADR-028). Les cas ci-dessous ne sont pas inventés :
 * ce sont les tentatives réellement enregistrées en production le 31/07/2026,
 * avec leurs valeurs exactes. C'est ce qui protège les deux seuils du module —
 * un seuil calé sur une intuition se déplace au premier désaccord, un seuil
 * calé sur des données observées demande de nouvelles données pour bouger.
 */

const MAINTENANT = new Date("2026-07-31T12:00:00.000Z");

function exercice(
  id: string,
  difficulte: Difficulte,
  dureeEstimeeMin: number,
  competences: string[],
  nbIndices = 3,
): Exercise {
  return {
    id,
    titre: `Exercice ${id}`,
    domaine: "developpement",
    type: "application",
    difficulte,
    competences,
    dureeEstimeeMin,
    enonce: "…",
    indices: Array.from({ length: nbIndices }, (_, i) => `indice ${i + 1}`),
    correction: "…",
    criteres: [],
    diagnostic: true,
    origine: "seed",
  };
}

let compteur = 0;
function tentative(options: {
  exerciseId: string;
  resultat: ExerciseAttempt["resultat"];
  indicesUtilises: number;
  dureeMin?: number;
  autoEvaluation?: Partial<Record<Dimension, number>>;
  jours?: number;
  statut?: ExerciseAttempt["statut"];
}): ExerciseAttempt {
  const debut = new Date(
    MAINTENANT.getTime() - (options.jours ?? 1) * 86_400_000,
  ).toISOString();
  return {
    id: `at-${++compteur}`,
    exerciseId: options.exerciseId,
    debut,
    fin: debut,
    dureeMin: options.dureeMin,
    indicesUtilises: options.indicesUtilises,
    reponse: "…",
    autoEvaluation: options.autoEvaluation ?? {},
    resultat: options.resultat,
    statut: options.statut ?? "terminee",
  };
}

/* ------------------------------------------------------------------ */

describe("verdictTentative — sur les tentatives réelles du 31/07/2026", () => {
  it("« réussi sans indice en 12 min sur 25 » ⇒ trop facile (diag-dev-05)", () => {
    const ex = exercice("diag-dev-05", 3, 25, ["DEV-05"]);
    const v = verdictTentative(
      tentative({ exerciseId: ex.id, resultat: "reussi", indicesUtilises: 0, dureeMin: 12 }),
      ex,
    );
    expect(v.signal).toBe("trop-facile");
    expect(v.raison).toContain("12 min sur 25");
  });

  it("« réussi sans indice en 32 min sur 35 » ⇒ calibré (diag-prod-03)", () => {
    const ex = exercice("diag-prod-03", 3, 35, ["DEV-01"]);
    const v = verdictTentative(
      tentative({ exerciseId: ex.id, resultat: "reussi", indicesUtilises: 0, dureeMin: 32 }),
      ex,
    );
    expect(v.signal).toBe("calibre");
  });

  it("« réussi sans indice en 61 min sur 35 » ⇒ calibré, pas trop facile (diag-ro-01)", () => {
    // Dépasser largement l'estimation est le signe d'un exercice qui a résisté :
    // le réussir sans aide reste une réussite pleine, pas un exercice trop bas.
    const ex = exercice("diag-ro-01", 3, 35, ["DEV-01"]);
    const v = verdictTentative(
      tentative({ exerciseId: ex.id, resultat: "reussi", indicesUtilises: 0, dureeMin: 61 }),
      ex,
    );
    expect(v.signal).toBe("calibre");
  });

  it("« échoué, 3 indices épuisés, 15 min sur 25 » ⇒ trop difficile (diag-dev-03)", () => {
    const ex = exercice("diag-dev-03", 2, 25, ["DEV-03"]);
    const v = verdictTentative(
      tentative({ exerciseId: ex.id, resultat: "echec", indicesUtilises: 3, dureeMin: 15 }),
      ex,
    );
    expect(v.signal).toBe("trop-difficile");
    expect(v.raison).toContain("malgré les 3 indices");
  });

  it("« échoué en 1 min sur 25, 3 indices » ⇒ NON TENTÉE, pas trop difficile (diag-algo-01)", () => {
    // Le cas qui a dicté la règle. Trois indices brûlés en une minute ne
    // ressemblent pas à un échec sur exercice trop dur : personne n'a essayé.
    // En conclure « trop difficile » serait exactement l'invention que le
    // protocole anti-hallucination interdit (§7).
    const ex = exercice("diag-algo-01", 2, 25, ["DEV-01"]);
    const v = verdictTentative(
      tentative({ exerciseId: ex.id, resultat: "echec", indicesUtilises: 3, dureeMin: 1 }),
      ex,
    );
    expect(v.signal).toBe("non-tentee");
    expect(v.raison).toContain("trop court pour conclure");
  });

  it("« échoué sans indice en 7 min sur 40 » ⇒ non tentée (diag-sysc-01)", () => {
    const ex = exercice("diag-sysc-01", 3, 40, ["DEV-01"]);
    const v = verdictTentative(
      tentative({ exerciseId: ex.id, resultat: "echec", indicesUtilises: 0, dureeMin: 7 }),
      ex,
    );
    expect(v.signal).toBe("non-tentee");
  });

  it("« échoué sans indice en 22 min sur 25 » ⇒ trop difficile, l'exercice a été tenté (diag-stat-02)", () => {
    const ex = exercice("diag-stat-02", 2, 25, ["DEV-01"]);
    const v = verdictTentative(
      tentative({ exerciseId: ex.id, resultat: "echec", indicesUtilises: 0, dureeMin: 22 }),
      ex,
    );
    expect(v.signal).toBe("trop-difficile");
  });

  it("sans durée enregistrée, conclut sur le résultat seul plutôt que de deviner", () => {
    const ex = exercice("ex-1", 3, 30, ["DEV-01"]);
    expect(
      verdictTentative(
        tentative({ exerciseId: ex.id, resultat: "reussi", indicesUtilises: 0 }),
        ex,
      ).signal,
    ).toBe("calibre");
  });

  it("une RÉUSSITE éclair reste une mesure — on ne réussit pas sans avoir fait", () => {
    // Le seuil « non tentée » ne s'applique jamais à une réussite : ce serait
    // jeter la donnée la plus informative du lot. Réussir un exercice de
    // difficulté 5 en 5 min sur 25 dit exactement ce qu'il faut savoir.
    const ex = exercice("ex-1", 5, 25, ["DEV-01"]);
    const v = verdictTentative(
      tentative({ exerciseId: ex.id, resultat: "reussi", indicesUtilises: 0, dureeMin: 5 }),
      ex,
    );
    expect(v.signal).toBe("trop-facile");
  });

  it("un « partiel » éclair, en revanche, ne conclut pas", () => {
    const ex = exercice("ex-1", 3, 40, ["DEV-01"]);
    expect(
      verdictTentative(
        tentative({ exerciseId: ex.id, resultat: "partiel", indicesUtilises: 0, dureeMin: 2 }),
        ex,
      ).signal,
    ).toBe("non-tentee");
  });

  it("les deux seuils encadrent bien les cas limites", () => {
    const ex = exercice("ex-1", 3, 100, ["DEV-01"]);
    const a = (dureeMin: number, resultat: ExerciseAttempt["resultat"]) =>
      verdictTentative(tentative({ exerciseId: ex.id, resultat, indicesUtilises: 0, dureeMin }), ex)
        .signal;

    expect(a(FRACTION_NON_TENTEE * 100 - 1, "echec")).toBe("non-tentee");
    expect(a(FRACTION_NON_TENTEE * 100, "echec")).toBe("trop-difficile");
    expect(a(FRACTION_TROP_FACILE * 100 - 1, "reussi")).toBe("trop-facile");
    expect(a(FRACTION_TROP_FACILE * 100, "reussi")).toBe("calibre");
  });
});

/* ------------------------------------------------------------------ */

describe("dimensionLaPlusFaible — l'axe que la difficulté ne capture pas", () => {
  it("localise l'échec sur la dimension réellement effondrée (diag-dev-03)", () => {
    // Valeurs réelles : comprehension 0.5, application 0, integration 0.
    // La compréhension tient, l'application non : proposer le même exercice
    // « en plus facile » raterait ce que la mesure dit.
    const faible = dimensionLaPlusFaible([
      tentative({
        exerciseId: "diag-dev-03",
        resultat: "echec",
        indicesUtilises: 3,
        autoEvaluation: { comprehension: 0.5, application: 0, integration: 0 },
      }),
    ]);
    expect(faible).not.toBeNull();
    // Deux dimensions à 0 : celle qui a le plus d'observations gagne ; ici
    // elles en ont autant, et le résultat doit rester l'une des deux.
    expect(["application", "integration"]).toContain(faible!.dimension);
    expect(faible!.moyenne).toBe(0);
    expect(faible!.observations).toBe(1);
  });

  it("privilégie la dimension la mieux étayée à valeur égale", () => {
    const faible = dimensionLaPlusFaible([
      tentative({ exerciseId: "a", resultat: "echec", indicesUtilises: 0, autoEvaluation: { application: 0, transfert: 0 } }),
      tentative({ exerciseId: "b", resultat: "echec", indicesUtilises: 0, autoEvaluation: { application: 0 } }),
    ]);
    expect(faible!.dimension).toBe("application");
    expect(faible!.observations).toBe(2);
  });

  it("ne désigne rien quand tout est maîtrisé — la moins bonne d'un lot excellent n'est pas un point faible", () => {
    expect(
      dimensionLaPlusFaible([
        tentative({
          exerciseId: "a",
          resultat: "reussi",
          indicesUtilises: 0,
          autoEvaluation: { comprehension: 1, application: 1 },
        }),
      ]),
    ).toBeNull();
  });

  it("ne désigne rien sans auto-évaluation", () => {
    expect(
      dimensionLaPlusFaible([
        tentative({ exerciseId: "a", resultat: "reussi", indicesUtilises: 0 }),
      ]),
    ).toBeNull();
  });
});

/* ------------------------------------------------------------------ */

describe("calibrer — la difficulté conseillée", () => {
  const DEV01 = REFERENTIEL_TEST.parCode.get("DEV-01")!;

  it("monte d'un cran après un exercice trop facile", () => {
    const ex = exercice("ex-1", 3, 25, ["DEV-01"]);
    const c = calibrer(DEV01, [ex], [
      tentative({ exerciseId: "ex-1", resultat: "reussi", indicesUtilises: 0, dureeMin: 10 }),
    ]);
    expect(c.signal).toBe("trop-facile");
    expect(c.difficulteConseillee).toBe(4);
  });

  it("descend d'un cran après un échec indices épuisés", () => {
    const ex = exercice("ex-1", 4, 30, ["DEV-01"]);
    const c = calibrer(DEV01, [ex], [
      tentative({ exerciseId: "ex-1", resultat: "echec", indicesUtilises: 3, dureeMin: 25 }),
    ]);
    expect(c.difficulteConseillee).toBe(3);
  });

  it("ne sort jamais de l'échelle 1–5", () => {
    const facile = exercice("ex-1", 5, 25, ["DEV-01"]);
    expect(
      calibrer(DEV01, [facile], [
        tentative({ exerciseId: "ex-1", resultat: "reussi", indicesUtilises: 0, dureeMin: 5 }),
      ]).difficulteConseillee,
    ).toBe(5);

    const dur = exercice("ex-2", 1, 25, ["DEV-01"]);
    expect(
      calibrer(DEV01, [dur], [
        tentative({ exerciseId: "ex-2", resultat: "echec", indicesUtilises: 3, dureeMin: 20 }),
      ]).difficulteConseillee,
    ).toBe(1);
  });

  it("ne conseille RIEN quand la seule tentative n'a pas été menée", () => {
    // La garantie centrale : l'absence de mesure exploitable n'est pas une
    // mesure. Le conseil est `null`, la réserve le dit, et l'appelant retombe
    // sur le niveau.
    const ex = exercice("ex-1", 3, 40, ["DEV-01"]);
    const c = calibrer(DEV01, [ex], [
      tentative({ exerciseId: "ex-1", resultat: "echec", indicesUtilises: 3, dureeMin: 2 }),
    ]);
    expect(c.difficulteConseillee).toBeNull();
    expect(c.verdicts).toHaveLength(1);
    expect(c.explication.reserves.join(" ")).toContain("abandonnées trop tôt");
  });

  it("ignore une tentative en cours — elle n'a pas de résultat", () => {
    const ex = exercice("ex-1", 3, 25, ["DEV-01"]);
    const c = calibrer(DEV01, [ex], [
      tentative({
        exerciseId: "ex-1",
        resultat: "partiel",
        indicesUtilises: 0,
        dureeMin: 5,
        statut: "en-cours",
      }),
    ]);
    expect(c.verdicts).toHaveLength(0);
    expect(c.difficulteConseillee).toBeNull();
  });

  it("se règle sur la tentative la plus récente exploitable, en sautant les abandons", () => {
    const facile = exercice("ex-ancien", 2, 25, ["DEV-01"]);
    const abandonne = exercice("ex-recent", 4, 40, ["DEV-01"]);
    const c = calibrer(DEV01, [facile, abandonne], [
      tentative({ exerciseId: "ex-ancien", resultat: "reussi", indicesUtilises: 0, dureeMin: 8, jours: 5 }),
      tentative({ exerciseId: "ex-recent", resultat: "echec", indicesUtilises: 3, dureeMin: 2, jours: 1 }),
    ]);
    expect(c.verdicts[0].signal).toBe("non-tentee");
    // L'abandon ne dit rien ; le dernier signal exploitable, si.
    expect(c.difficulteConseillee).toBe(3);
  });

  it("n'a rien à dire sur une compétence jamais travaillée en exercice", () => {
    const c = calibrer(DEV01, [], []);
    expect(c.difficulteConseillee).toBeNull();
    expect(c.dimensionFaible).toBeNull();
    expect(c.explication.reserves.join(" ")).toContain("Aucune tentative terminée");
  });

  it("ignore les exercices qui ne portent pas sur la compétence", () => {
    const autre = exercice("ex-1", 5, 25, ["DEV-09"]);
    expect(
      calibrer(DEV01, [autre], [
        tentative({ exerciseId: "ex-1", resultat: "reussi", indicesUtilises: 0, dureeMin: 5 }),
      ]).difficulteConseillee,
    ).toBeNull();
  });

  it("porte sa trace de calcul — aucune valeur sans source (P3)", () => {
    const ex = exercice("ex-1", 3, 25, ["DEV-01"]);
    const c = calibrer(DEV01, [ex], [
      tentative({
        exerciseId: "ex-1",
        resultat: "reussi",
        indicesUtilises: 0,
        dureeMin: 10,
        autoEvaluation: { application: 0.5, comprehension: 1 },
      }),
    ]);
    expect(c.explication.resume).toContain("trop facile");
    expect(c.explication.facteurs.length).toBeGreaterThan(0);
    expect(c.explication.facteurs.some((f) => f.valeur.includes("10 min sur 25"))).toBe(true);
    expect(c.explication.reserves.join(" ")).toContain("une seule auto-évaluation");
  });
});

/* ------------------------------------------------------------------ */

describe("le maillon est effectivement bouclé", () => {
  it("la calibration déplace la difficulté visée par la recommandation", () => {
    // C'est le test du 3ᵉ maillon lui-même : sans lui, `difficulteCible` ne
    // regardait que le niveau dérivé et proposait la même chose à qui vient
    // d'échouer et à qui vient de réussir sans effort.
    const skill = skillDeTest("DEV-01", "developpement", "fondamentaux", 1, 0);
    const ex = exercice("ex-1", 2, 25, ["DEV-01"]);
    const attempts = [
      tentative({ exerciseId: "ex-1", resultat: "reussi", indicesUtilises: 0, dureeMin: 8 }),
    ];
    const etats = computeAllSkillStates([skill], [], MAINTENANT);

    const sansCalibration = recommander(etats, [ex], attempts, 5)[0];
    const calibrations = calibrerToutes(etats, [ex], attempts);
    const avecCalibration = recommander(etats, [ex], attempts, 5, calibrations)[0];

    expect(sansCalibration.difficulteCible).toBe(2); // table par niveau
    expect(avecCalibration.difficulteCible).toBe(3); // dérivée de la tentative
    expect(avecCalibration.calibration?.signal).toBe("trop-facile");
  });

  it("sans tentative exploitable, la recommandation retombe sur le niveau", () => {
    const skill = skillDeTest("DEV-01", "developpement", "fondamentaux", 1, 0);
    const etats = computeAllSkillStates([skill], [], MAINTENANT);
    const calibrations = calibrerToutes(etats, [], []);
    const r = recommander(etats, [], [], 5, calibrations)[0];

    expect(r.calibration?.difficulteConseillee).toBeNull();
    expect(r.difficulteCible).toBe(2);
  });

  it("`calibrerToutes` couvre chaque compétence évaluée, y compris les vierges", () => {
    const etats = computeAllSkillStates(REFERENTIEL_TEST.actifs, [], MAINTENANT);
    const toutes = calibrerToutes(etats, [], []);
    expect(toutes.size).toBe(REFERENTIEL_TEST.actifs.length);
    for (const c of toutes.values()) expect(c.difficulteConseillee).toBeNull();
  });
});
