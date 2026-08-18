/**
 * Ce que ces tests protègent.
 *
 * C'est le module qui juge le moteur. Trois façons de le rendre menteur, et
 * elles sont toutes silencieuses :
 *
 * - **afficher un nombre sous le seuil.** Un score de Brier sur trois
 *   observations a une décimale et aucune signification. C'est le défaut que ce
 *   produit combat depuis P2 ;
 * - **compter une prédiction non résolue comme fausse.** Une recommandation
 *   ignorée ferait alors chuter la métrique, et on mesurerait l'assiduité de la
 *   personne au lieu de la justesse du moteur ;
 * - **résoudre contre une tentative abandonnée.** Une durée de 1 minute sur 30
 *   annoncées dirait « le moteur surestime d'un facteur 30 » alors que
 *   l'exercice n'a pas été fait — exactement la faute qu'ADR-030 a corrigée sur
 *   le chemin des preuves.
 */

import { describe, expect, it } from "vitest";

import type { Exercise, ExerciseAttempt, SkillEvidence } from "@/lib/domain/types";
import {
  evaluerMoteur,
  mediane,
  resoudreDurees,
  resoudreRetentions,
  resoudreReussites,
  SEUIL_BRIER,
  SEUIL_DUREE,
  type DecisionInscrite,
  type PredictionInscrite,
} from "./auto-evaluation";

const EMISSION = "2026-08-01T09:00:00.000Z";

const EXERCICES = new Map<string, Pick<Exercise, "dureeEstimeeMin">>([
  ["ex-1", { dureeEstimeeMin: 30 }],
]);

function prediction(
  options: Partial<PredictionInscrite> & { type: PredictionInscrite["type"] },
): PredictionInscrite {
  return {
    id: `p-${Math.random().toString(36).slice(2)}`,
    emiseLe: EMISSION,
    cibleCode: "LOG-01",
    cibleRef: "ex-1",
    valeur: 0.6,
    horizonLe: null,
    modeleVersion: "prediction-1",
    entrees: {},
    ...options,
  };
}

function tentative(options: Partial<ExerciseAttempt> = {}): ExerciseAttempt {
  return {
    id: `t-${Math.random().toString(36).slice(2)}`,
    exerciseId: "ex-1",
    debut: "2026-08-02T09:00:00.000Z",
    fin: "2026-08-02T09:20:00.000Z",
    dureeMin: 20,
    indicesUtilises: 0,
    reponse: "r",
    evaluation: {},
    resultat: "reussi",
    statut: "terminee",
    ...options,
  } as ExerciseAttempt;
}

function preuve(options: Partial<SkillEvidence> = {}): SkillEvidence {
  return {
    id: `e-${Math.random().toString(36).slice(2)}`,
    skillCode: "LOG-01",
    date: "2026-08-20T09:00:00.000Z",
    type: "exercice",
    niveauPreuve: "A",
    autonomie: "A3",
    qualite: "moyenne",
    resultat: "reussi",
    contexte: "C",
    dimensions: {},
    source: { kind: "exercice", ref: "ex-1" },
    ...options,
  } as SkillEvidence;
}

/* ------------------------------------------------------------------ */

describe("résolution — ce qui tranche une prédiction", () => {
  it("ignore une tentative ANTÉRIEURE à l'émission", () => {
    // Sinon le moteur serait crédité d'avoir prédit le passé.
    const resolutions = resoudreReussites(
      [prediction({ type: "reussite" })],
      [tentative({ debut: "2026-07-20T09:00:00.000Z" })],
      EXERCICES,
    );
    expect(resolutions).toHaveLength(0);
  });

  it("ne retient que la PREMIÈRE tentative postérieure", () => {
    const resolutions = resoudreReussites(
      [prediction({ type: "reussite" })],
      [
        tentative({ id: "t-2", debut: "2026-08-05T09:00:00.000Z", resultat: "echec" }),
        tentative({ id: "t-1", debut: "2026-08-02T09:00:00.000Z", resultat: "reussi" }),
      ],
      EXERCICES,
    );
    expect(resolutions).toHaveLength(1);
    expect(resolutions[0].source.ref).toBe("t-1");
    expect(resolutions[0].observe).toBe(1);
  });

  it("écarte une tentative abandonnée — 1 minute sur 30 ne tranche rien", () => {
    // Le défaut d'ADR-030, transposé : sans ce filtre, l'erreur de durée dirait
    // que le moteur surestime d'un facteur 30.
    const resolutions = resoudreDurees(
      [prediction({ type: "duree", valeur: 30 })],
      [tentative({ dureeMin: 1, resultat: "echec" })],
      EXERCICES,
    );
    expect(resolutions).toHaveLength(0);
  });

  it("garde une réussite éclair — on ne réussit pas sans avoir fait", () => {
    const resolutions = resoudreDurees(
      [prediction({ type: "duree", valeur: 30 })],
      [tentative({ dureeMin: 3, resultat: "reussi" })],
      EXERCICES,
    );
    expect(resolutions).toHaveLength(1);
    expect(resolutions[0].observe).toBe(3);
  });

  it("compte un partiel comme un échec, comme ADR-054 pour la recommandation", () => {
    const resolutions = resoudreReussites(
      [prediction({ type: "reussite" })],
      [tentative({ resultat: "partiel" })],
      EXERCICES,
    );
    expect(resolutions[0].observe).toBe(0);
  });

  it("ne résout la rétention qu'avec une preuve postérieure à l'horizon", () => {
    const p = prediction({
      type: "retention",
      cibleRef: null,
      horizonLe: "2026-08-15T00:00:00.000Z",
    });
    expect(resoudreRetentions([p], [preuve({ date: "2026-08-10T09:00:00.000Z" })]))
      .toHaveLength(0);
    const apres = resoudreRetentions([p], [preuve({ date: "2026-08-20T09:00:00.000Z" })]);
    expect(apres).toHaveLength(1);
    expect(apres[0].observe).toBe(1);
  });

  it("compte un échec après l'horizon comme une rétention manquée", () => {
    const p = prediction({
      type: "retention",
      cibleRef: null,
      horizonLe: "2026-08-15T00:00:00.000Z",
    });
    const resolutions = resoudreRetentions([p], [preuve({ resultat: "echec" })]);
    expect(resolutions[0].observe).toBe(0);
  });
});

describe("mediane", () => {
  it("prend le milieu, et la moyenne des deux milieux sur un effectif pair", () => {
    expect(mediane([3, 1, 2])).toBe(2);
    expect(mediane([1, 2, 3, 4])).toBe(2.5);
    expect(mediane([])).toBe(0);
  });
});

describe("evaluerMoteur — la règle du seuil", () => {
  const vide = {
    predictions: [],
    decisions: [],
    tentatives: [],
    preuves: [],
    exercicesParId: EXERCICES,
  };

  it("ne rend AUCUN nombre sur une base vide, et dit pourquoi", () => {
    const metriques = evaluerMoteur(vide);
    expect(metriques).toHaveLength(4);
    for (const m of metriques) {
      expect(m.valeur).toBeNull();
      expect(m.n).toBe(0);
      expect(m.lecture).toContain("Données insuffisantes");
    }
  });

  it("reste à null juste sous le seuil, et bascule juste au-dessus", () => {
    const construire = (nombre: number) => {
      const predictions: PredictionInscrite[] = [];
      const tentatives: ExerciseAttempt[] = [];
      for (let i = 0; i < nombre; i++) {
        const exerciseId = `ex-${i}`;
        predictions.push(
          prediction({ type: "duree", cibleRef: exerciseId, valeur: 30 }),
        );
        tentatives.push(tentative({ exerciseId, dureeMin: 15 }));
      }
      return {
        ...vide,
        predictions,
        tentatives,
        exercicesParId: new Map(
          tentatives.map((t) => [t.exerciseId, { dureeEstimeeMin: 30 }]),
        ),
      };
    };

    const sous = evaluerMoteur(construire(SEUIL_DUREE - 1)).find(
      (m) => m.nom === "erreur-duree",
    )!;
    expect(sous.valeur).toBeNull();
    expect(sous.n).toBe(SEUIL_DUREE - 1);

    const au = evaluerMoteur(construire(SEUIL_DUREE)).find(
      (m) => m.nom === "erreur-duree",
    )!;
    expect(au.valeur).not.toBeNull();
    expect(au.n).toBe(SEUIL_DUREE);
  });

  it("fait ressortir le biais d'ADR-045 : le réel vaut la moitié de l'annoncé", () => {
    const predictions: PredictionInscrite[] = [];
    const tentatives: ExerciseAttempt[] = [];
    for (let i = 0; i < SEUIL_DUREE; i++) {
      const exerciseId = `ex-${i}`;
      predictions.push(prediction({ type: "duree", cibleRef: exerciseId, valeur: 30 }));
      // 0,48 × 30 ≈ 14 min, la mesure réelle du 09/08/2026.
      tentatives.push(tentative({ exerciseId, dureeMin: 14 }));
    }
    const m = evaluerMoteur({
      ...vide,
      predictions,
      tentatives,
      exercicesParId: new Map(
        tentatives.map((t) => [t.exerciseId, { dureeEstimeeMin: 30 }]),
      ),
    }).find((m) => m.nom === "erreur-duree")!;

    expect(m.valeur).toBeCloseTo(14 / 30, 5);
    expect(m.lecture).toContain("SURESTIME");
    expect(m.reference).toBe(1);
  });

  it("compte les prédictions non résolues en attente, jamais comme des échecs", () => {
    const m = evaluerMoteur({
      ...vide,
      predictions: [
        prediction({ type: "reussite" }),
        prediction({ type: "reussite" }),
        prediction({ type: "reussite" }),
      ],
      tentatives: [],
    }).find((m) => m.nom === "brier-reussite")!;

    expect(m.n).toBe(0);
    expect(m.enAttente).toBe(3);
    expect(m.valeur).toBeNull();
  });

  it("compare le score de Brier à la ligne de base, sans quoi il ne veut rien dire", () => {
    // Un phénomène qui arrive 9 fois sur 10 : prédire toujours 0,9 donne un
    // Brier de 0,09. Un modèle qui prédit 0,6 fait moins bien — et doit le dire.
    const predictions: PredictionInscrite[] = [];
    const tentatives: ExerciseAttempt[] = [];
    for (let i = 0; i < SEUIL_BRIER; i++) {
      const exerciseId = `ex-${i}`;
      predictions.push(
        prediction({ type: "reussite", cibleRef: exerciseId, valeur: 0.6 }),
      );
      tentatives.push(
        tentative({ exerciseId, resultat: i % 10 === 0 ? "echec" : "reussi" }),
      );
    }
    const m = evaluerMoteur({
      ...vide,
      predictions,
      tentatives,
      exercicesParId: new Map(
        tentatives.map((t) => [t.exerciseId, { dureeEstimeeMin: 30 }]),
      ),
    }).find((m) => m.nom === "brier-reussite")!;

    expect(m.valeur).not.toBeNull();
    expect(m.reference).not.toBeNull();
    expect(m.valeur!).toBeGreaterThan(m.reference!);
    expect(m.lecture).toContain("ne bat PAS");
  });
});

describe("utilite-recommandation", () => {
  it("ne compte que les décisions qui avaient un exercice à proposer", () => {
    // 40 des compétences actives n'en ont aucun : les compter comme non
    // suivies mesurerait la pénurie de contenu, pas la qualité du classement.
    const decisions: DecisionInscrite[] = Array.from({ length: 25 }, (_, i) => ({
      id: `d-${i}`,
      priseLe: EMISSION,
      type: "recommandation",
      politiqueVersion: "recommandation-1",
      cibleCode: "LOG-01",
      cibleRef: i < 5 ? null : `ex-${i}`,
    }));

    const m = evaluerMoteur({
      predictions: [],
      decisions,
      tentatives: [tentative({ exerciseId: "ex-5" }), tentative({ exerciseId: "ex-6" })],
      preuves: [],
      exercicesParId: EXERCICES,
    }).find((m) => m.nom === "utilite-recommandation")!;

    expect(m.n).toBe(20);
    expect(m.enAttente).toBe(5);
    expect(m.valeur).toBeCloseTo(2 / 20, 5);
  });
});
