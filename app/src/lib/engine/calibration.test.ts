import { describe, expect, it } from "vitest";
import {
  calibrer,
  calibrerToutes,
  dimensionLaPlusFaible,
  dureeDeReference,
  tentativeMenee,
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
  evaluation?: Partial<Record<Dimension, number>>;
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
    evaluation: options.evaluation ?? {},
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
        evaluation: { comprehension: 0.5, application: 0, integration: 0 },
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
      tentative({ exerciseId: "a", resultat: "echec", indicesUtilises: 0, evaluation: { application: 0, transfert: 0 } }),
      tentative({ exerciseId: "b", resultat: "echec", indicesUtilises: 0, evaluation: { application: 0 } }),
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
          evaluation: { comprehension: 1, application: 1 },
        }),
      ]),
    ).toBeNull();
  });

  it("ne désigne rien sans évaluation", () => {
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

  /*
   * ADR-045 — un verdict isolé ne déplace plus la difficulté.
   *
   * Ces trois cas disaient l'inverse jusqu'au 09/08/2026 : une seule réussite
   * rapide montait d'un cran. Mesuré sur les 46 tentatives réelles, cela
   * classait `trop-facile` 7 réussites sur 10, et l'effet était cumulatif —
   * la difficulté conseillée ne lisait que le dernier verdict exploitable.
   */
  it("ne monte PAS sur un seul « trop facile », et dit pourquoi", () => {
    const ex = exercice("ex-1", 3, 25, ["DEV-01"]);
    const c = calibrer(DEV01, [ex], [
      tentative({ exerciseId: "ex-1", resultat: "reussi", indicesUtilises: 0, dureeMin: 10 }),
    ]);
    expect(c.signal).toBe("trop-facile");
    // Le conseil reste celui de l'exercice exploitable : maintenu, pas absent.
    expect(c.difficulteConseillee).toBe(3);
    expect(c.explication.reserves.join(" ")).toContain("Un seul verdict va dans ce sens");
  });

  it("monte d'un cran quand DEUX verdicts concordent", () => {
    const a = exercice("ex-a", 3, 25, ["DEV-01"]);
    const b = exercice("ex-b", 3, 25, ["DEV-01"]);
    const c = calibrer(DEV01, [a, b], [
      tentative({ exerciseId: "ex-a", resultat: "reussi", indicesUtilises: 0, dureeMin: 8, jours: 4 }),
      tentative({ exerciseId: "ex-b", resultat: "reussi", indicesUtilises: 0, dureeMin: 9, jours: 1 }),
    ]);
    expect(c.difficulteConseillee).toBe(4);
    expect(c.explication.reserves.join(" ")).not.toContain("Un seul verdict");
  });

  it("descend d'un cran quand deux échecs indices épuisés concordent", () => {
    const a = exercice("ex-a", 4, 30, ["DEV-01"]);
    const b = exercice("ex-b", 4, 30, ["DEV-01"]);
    const c = calibrer(DEV01, [a, b], [
      tentative({ exerciseId: "ex-a", resultat: "echec", indicesUtilises: 3, dureeMin: 22, jours: 4 }),
      tentative({ exerciseId: "ex-b", resultat: "echec", indicesUtilises: 3, dureeMin: 25, jours: 1 }),
    ]);
    expect(c.difficulteConseillee).toBe(3);
  });

  it("le verdict le plus récent commande le SENS, pas seulement le nombre", () => {
    // Deux « trop facile » anciens ne doivent pas l'emporter sur un
    // « trop difficile » d'hier : sinon la calibration suivrait un passé révolu.
    const a = exercice("ex-a", 3, 25, ["DEV-01"]);
    const b = exercice("ex-b", 3, 25, ["DEV-01"]);
    const recent = exercice("ex-c", 3, 30, ["DEV-01"]);
    const c = calibrer(DEV01, [a, b, recent], [
      tentative({ exerciseId: "ex-a", resultat: "reussi", indicesUtilises: 0, dureeMin: 8, jours: 6 }),
      tentative({ exerciseId: "ex-b", resultat: "reussi", indicesUtilises: 0, dureeMin: 9, jours: 4 }),
      tentative({ exerciseId: "ex-c", resultat: "echec", indicesUtilises: 3, dureeMin: 28, jours: 1 }),
    ]);
    expect(c.signal).toBe("trop-difficile");
    // Seul de son avis : la difficulté ne descend pas non plus.
    expect(c.difficulteConseillee).toBe(3);
  });

  it("ne sort jamais de l'échelle 1–5", () => {
    const f1 = exercice("ex-1", 5, 25, ["DEV-01"]);
    const f2 = exercice("ex-2", 5, 25, ["DEV-01"]);
    expect(
      calibrer(DEV01, [f1, f2], [
        tentative({ exerciseId: "ex-1", resultat: "reussi", indicesUtilises: 0, dureeMin: 5, jours: 4 }),
        tentative({ exerciseId: "ex-2", resultat: "reussi", indicesUtilises: 0, dureeMin: 6, jours: 1 }),
      ]).difficulteConseillee,
    ).toBe(5);

    const d1 = exercice("ex-3", 1, 25, ["DEV-01"]);
    const d2 = exercice("ex-4", 1, 25, ["DEV-01"]);
    expect(
      calibrer(DEV01, [d1, d2], [
        tentative({ exerciseId: "ex-3", resultat: "echec", indicesUtilises: 3, dureeMin: 20, jours: 4 }),
        tentative({ exerciseId: "ex-4", resultat: "echec", indicesUtilises: 3, dureeMin: 22, jours: 1 }),
      ]).difficulteConseillee,
    ).toBe(1);
  });

  /*
   * Régression du 02/08/2026 — la difficulté venue de la dorsale.
   *
   * `exercises.difficulte` était déclarée TEXT et `ligneVersEntite` ne coerce
   * pas : un exercice relu depuis la base portait `"1"`. L'addition devenait
   * une concaténation, et le module conseillait 5 là où il fallait 1 — ce qui
   * partait ensuite dans `difficulteCible` ET dans le contexte du tuteur, qui
   * générait en conséquence. Aucun des tests existants ne pouvait le voir :
   * ils passent tous des `Difficulte` déjà typées.
   *
   * La colonne est désormais INTEGER, mais ces cas restent : ils épinglent le
   * contrat du moteur face à une entrée mal typée, quelle qu'en soit l'origine.
   */
  describe("face à une difficulté mal typée venue de la dorsale", () => {
    const chaine = (v: string) => v as unknown as Difficulte;

    it("lit « 1 » comme 1 — le cas exact de ex-msahkhoy-maqnm (partiel 17 min sur 25)", () => {
      const ex = exercice("ex-1", chaine("1"), 25, ["DEV-01"]);
      const c = calibrer(DEV01, [ex], [
        tentative({ exerciseId: "ex-1", resultat: "partiel", indicesUtilises: 2, dureeMin: 17 }),
      ]);
      expect(c.signal).toBe("calibre");
      expect(c.difficulteConseillee).toBe(1);
      expect(c.difficulteConseillee).not.toBe(5);
    });

    it("ne produit jamais NaN sur la branche « trop difficile »", () => {
      const ex = exercice("ex-1", chaine("1"), 30, ["DEV-01"]);
      const c = calibrer(DEV01, [ex], [
        tentative({ exerciseId: "ex-1", resultat: "echec", indicesUtilises: 3, dureeMin: 25 }),
      ]);
      expect(c.difficulteConseillee).toBe(1);
      expect(Number.isNaN(c.difficulteConseillee)).toBe(false);
    });

    it("ne conseille RIEN si la valeur n'est pas un nombre, et le dit", () => {
      const ex = exercice("ex-1", chaine("facile"), 25, ["DEV-01"]);
      const c = calibrer(DEV01, [ex], [
        tentative({ exerciseId: "ex-1", resultat: "partiel", indicesUtilises: 1, dureeMin: 20 }),
      ]);
      expect(c.difficulteConseillee).toBeNull();
      expect(c.explication.reserves.join(" ")).toContain("n'est pas un nombre exploitable");
      // Le verdict reste affiché : il explique pourquoi il n'y a pas de conseil.
      expect(c.verdicts).toHaveLength(1);
    });
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
    // L'abandon ne dit rien ; le dernier signal exploitable, si — mais il est
    // seul de son avis, donc il fixe la difficulté sans la déplacer (ADR-045).
    expect(c.signal).toBe("trop-facile");
    expect(c.difficulteConseillee).toBe(2);
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
        evaluation: { application: 0.5, comprehension: 1 },
      }),
    ]);
    expect(c.explication.resume).toContain("trop facile");
    expect(c.explication.facteurs.length).toBeGreaterThan(0);
    expect(c.explication.facteurs.some((f) => f.valeur.includes("10 min sur 25"))).toBe(true);
    expect(c.explication.reserves.join(" ")).toContain("une seule évaluation");
  });
});

/* ------------------------------------------------------------------ */

/*
 * ADR-045 — la durée de référence.
 *
 * Constat du 09/08/2026, sur les 46 tentatives réellement enregistrées : la
 * durée effectivement passée sur une réussite valait **0,48 fois** la durée que
 * le tuteur avait estimée. Le moteur s'en servait pourtant comme d'un
 * instrument gradué, et concluait « trop facile » sur 7 réussites sur 10.
 */
describe("dureeDeReference — le réel prime sur l'estimation", () => {
  const DEV01 = REFERENTIEL_TEST.parCode.get("DEV-01")!;

  it("retombe sur l'estimation tant qu'il n'y a qu'une observation", () => {
    const ex = exercice("ex-1", 3, 30, ["DEV-01"]);
    const r = dureeDeReference(ex, [
      tentative({ exerciseId: "ex-1", resultat: "reussi", indicesUtilises: 0, dureeMin: 12 }),
    ]);
    expect(r).toEqual({ minutes: 30, source: "estimee", observations: 0 });
  });

  it("prend la médiane des durées observées dès la deuxième tentative", () => {
    const ex = exercice("ex-1", 3, 30, ["DEV-01"]);
    const r = dureeDeReference(ex, [
      tentative({ exerciseId: "ex-1", resultat: "reussi", indicesUtilises: 0, dureeMin: 12, jours: 4 }),
      tentative({ exerciseId: "ex-1", resultat: "partiel", indicesUtilises: 1, dureeMin: 18, jours: 1 }),
    ]);
    expect(r).toEqual({ minutes: 15, source: "observee", observations: 2 });
  });

  it("la médiane, pas la moyenne : une séance écourtée ne tire pas la référence", () => {
    const ex = exercice("ex-1", 3, 30, ["DEV-01"]);
    const r = dureeDeReference(ex, [
      tentative({ exerciseId: "ex-1", resultat: "partiel", indicesUtilises: 1, dureeMin: 2, jours: 5 }),
      tentative({ exerciseId: "ex-1", resultat: "reussi", indicesUtilises: 0, dureeMin: 20, jours: 3 }),
      tentative({ exerciseId: "ex-1", resultat: "partiel", indicesUtilises: 2, dureeMin: 22, jours: 1 }),
    ]);
    // Moyenne : 14,7 — médiane : 20. La séance de 2 min ne redéfinit pas
    // l'exercice ; elle reste un point, pas la référence.
    expect(r.minutes).toBe(20);
    expect(r.source).toBe("observee");
  });

  it("ignore les tentatives d'un autre exercice, en cours, ou sans durée", () => {
    const ex = exercice("ex-1", 3, 30, ["DEV-01"]);
    const r = dureeDeReference(ex, [
      tentative({ exerciseId: "ex-1", resultat: "reussi", indicesUtilises: 0, dureeMin: 12 }),
      tentative({ exerciseId: "ex-AUTRE", resultat: "reussi", indicesUtilises: 0, dureeMin: 90 }),
      tentative({ exerciseId: "ex-1", resultat: "partiel", indicesUtilises: 0, dureeMin: 5, statut: "en-cours" }),
      tentative({ exerciseId: "ex-1", resultat: "partiel", indicesUtilises: 0 }),
    ]);
    // Une seule durée exploitable reste : sous le minimum, donc l'estimation.
    expect(r.source).toBe("estimee");
  });

  it("le cas réel : 7 réussites sur 10 étaient « trop faciles » contre l'estimation", () => {
    /*
     * L'estimation dit 30 min ; l'exercice se fait en réalité autour de 14.
     * Contre l'estimation, 14/30 = 0,47 < 0,6 ⇒ « trop facile », à tort.
     * Contre le réel, 14/14 = 1 ⇒ « calibré ». C'est tout le lot 3.
     */
    const ex = exercice("ex-1", 3, 30, ["DEV-01"]);
    const attempts = [
      tentative({ exerciseId: "ex-1", resultat: "reussi", indicesUtilises: 0, dureeMin: 13, jours: 5 }),
      tentative({ exerciseId: "ex-1", resultat: "reussi", indicesUtilises: 0, dureeMin: 15, jours: 1 }),
    ];

    const contreEstimation = verdictTentative(attempts[1], ex);
    expect(contreEstimation.signal).toBe("trop-facile");

    const contreReel = verdictTentative(attempts[1], ex, dureeDeReference(ex, attempts));
    expect(contreReel.signal).toBe("calibre");
    // La source voyage avec la valeur : la phrase dit d'où vient le repère (P3).
    expect(contreReel.raison).toContain("médiane de 2 tentatives");

    // Et de bout en bout, la difficulté ne bouge plus.
    expect(calibrer(DEV01, [ex], attempts).difficulteConseillee).toBe(3);
  });

  it("un exercice vraiment expédié reste détecté, référence observée comprise", () => {
    // 20 min habituellement, fait en 5 : 0,25 < 0,6. Le garde-fou n'est pas
    // désarmé, il est recalé.
    const ex = exercice("ex-1", 3, 60, ["DEV-01"]);
    const attempts = [
      tentative({ exerciseId: "ex-1", resultat: "partiel", indicesUtilises: 1, dureeMin: 20, jours: 6 }),
      tentative({ exerciseId: "ex-1", resultat: "partiel", indicesUtilises: 1, dureeMin: 20, jours: 4 }),
      tentative({ exerciseId: "ex-1", resultat: "reussi", indicesUtilises: 0, dureeMin: 5, jours: 1 }),
    ];
    const v = verdictTentative(attempts[2], ex, dureeDeReference(ex, attempts));
    expect(v.signal).toBe("trop-facile");
  });

  it("tentativeMenee garde l'estimation — ADR-030 n'est pas desserré", () => {
    /*
     * La règle de l'observation ne change pas de repère. Elle tranche le plus
     * souvent au PREMIER passage, quand aucune observation n'existe, et rien
     * dans les données du 09/08 ne la met en cause : une seule réussite sous
     * 25 %. La desserrer d'un côté est ce que CLAUDE.md interdit.
     */
    const ex = exercice("ex-1", 3, 40, ["DEV-01"]);
    expect(tentativeMenee({ resultat: "echec", dureeMin: 5 }, ex)).toBe(false);
    expect(tentativeMenee({ resultat: "echec", dureeMin: 15 }, ex)).toBe(true);
  });
});

/* ------------------------------------------------------------------ */

describe("le maillon est effectivement bouclé", () => {
  it("la calibration déplace la difficulté visée par la recommandation", () => {
    // C'est le test du 3ᵉ maillon lui-même : sans lui, `difficulteCible` ne
    // regardait que le niveau dérivé et proposait la même chose à qui vient
    // d'échouer et à qui vient de réussir sans effort.
    const skill = skillDeTest("DEV-01", "developpement", "fondamentaux", 1, 0);
    // Deux tentatives, pas une : depuis ADR-045 un verdict isolé ne déplace
    // plus rien. Le maillon se démontre donc avec la confirmation qu'il exige.
    const exercices = [exercice("ex-1", 2, 25, ["DEV-01"]), exercice("ex-2", 2, 25, ["DEV-01"])];
    const attempts = [
      tentative({ exerciseId: "ex-1", resultat: "reussi", indicesUtilises: 0, dureeMin: 8, jours: 4 }),
      tentative({ exerciseId: "ex-2", resultat: "reussi", indicesUtilises: 0, dureeMin: 9, jours: 1 }),
    ];
    const etats = computeAllSkillStates([skill], [], MAINTENANT);

    const sansCalibration = recommander(etats, exercices, attempts, 5)[0];
    const calibrations = calibrerToutes(etats, exercices, attempts);
    const avecCalibration = recommander(etats, exercices, attempts, 5, calibrations)[0];

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

/*
 * `tentativeMenee` — la règle partagée avec l'écriture de l'observation.
 *
 * Elle gouvernait la calibration de la difficulté depuis ADR-028 et rien
 * d'autre. Le 01/08/2026, la boucle a tourné en entier pour la première fois
 * et l'a montré : deux exercices générés par le tuteur, abandonnés en 1 minute
 * sur 20 et 25 estimées, ont produit des observations à toutes dimensions nulles.
 * DEV-01 est tombé de 2,7 à 2,3 sur un exercice que personne n'avait fait.
 *
 * Ces cas-là sont donc, eux aussi, des tentatives réelles.
 */
describe("tentativeMenee — aucune observation sur une tentative qui n'a pas eu lieu", () => {
  it("1 min sur 20 estimées, échec ⇒ non menée (ex-msahsloc, DEV-01, 01/08/2026)", () => {
    const ex = exercice("ex-msahsloc-w2cwx", 1, 20, ["DEV-01"], 1);
    expect(tentativeMenee({ resultat: "echec", dureeMin: 1 }, ex)).toBe(false);
  });

  it("1 min sur 25 estimées, échec ⇒ non menée (ex-msahkhoy, DEV-03/DEV-04)", () => {
    const ex = exercice("ex-msahkhoy-maqnm", 1, 25, ["DEV-03", "DEV-04"], 3);
    expect(tentativeMenee({ resultat: "echec", dureeMin: 1 }, ex)).toBe(false);
  });

  it("une réussite éclair reste une tentative menée : on ne réussit pas sans faire", () => {
    const ex = exercice("diag-dev-01", 1, 20, ["DEV-01"], 3);
    expect(tentativeMenee({ resultat: "reussi", dureeMin: 1 }, ex)).toBe(true);
  });

  it("20 min sur 20 estimées, partiel ⇒ menée (diag-dev-01, 30/07/2026)", () => {
    const ex = exercice("diag-dev-01", 1, 20, ["DEV-01"], 3);
    expect(tentativeMenee({ resultat: "partiel", dureeMin: 20 }, ex)).toBe(true);
  });

  it("15 min sur 25 estimées, échec ⇒ menée : un vrai échec se mesure (diag-dev-03)", () => {
    const ex = exercice("diag-dev-03", 2, 25, ["DEV-03"], 3);
    expect(tentativeMenee({ resultat: "echec", dureeMin: 15 }, ex)).toBe(true);
  });

  it("pile au seuil, la tentative compte", () => {
    const ex = exercice("x", 2, 20, ["DEV-01"], 3);
    expect(tentativeMenee({ resultat: "echec", dureeMin: 20 * FRACTION_NON_TENTEE }, ex)).toBe(true);
  });

  it("sans durée mesurable, on n'accuse pas la tentative de ne pas avoir eu lieu", () => {
    const ex = exercice("x", 2, 20, ["DEV-01"], 3);
    expect(tentativeMenee({ resultat: "echec", dureeMin: undefined }, ex)).toBe(true);
    expect(tentativeMenee({ resultat: "echec", dureeMin: 1 }, { dureeEstimeeMin: 0 })).toBe(true);
  });

  /*
   * Le lien entre les deux chemins. Si quelqu'un desserre l'un sans l'autre,
   * ce test tombe — c'est tout son objet.
   */
  it("dit exactement la même chose que le verdict de calibration", () => {
    const ex = exercice("x", 2, 20, ["DEV-01"], 3);
    for (const resultat of ["reussi", "partiel", "echec"] as const) {
      for (const dureeMin of [1, 4, 5, 6, 12, 20, 40]) {
        const t = tentative({ exerciseId: "x", resultat, indicesUtilises: 0, dureeMin });
        expect(verdictTentative(t, ex).signal === "non-tentee").toBe(!tentativeMenee(t, ex));
      }
    }
  });
});
