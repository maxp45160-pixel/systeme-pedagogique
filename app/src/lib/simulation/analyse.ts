/**
 * Ce qu'on peut lire d'un parcours simulé.
 *
 * Une intention : ramener chaque chiffre affiché à un fait du journal. Une
 * métrique qu'on ne peut pas ouvrir ligne à ligne est une métrique qu'il faut
 * croire sur parole.
 *
 * `construireRegistre` inscrit, pour chaque prédiction, le fait qui l'a
 * tranchée et l'écart obtenu. Les lectures agrégées d'un parcours long vivent
 * dans `tableau-de-bord.ts`, qui part de ce même registre.
 */

import {
  resoudreDurees,
  resoudreRetentions,
  resoudreReussites,
  type PredictionInscrite,
} from "@/lib/engine/auto-evaluation";
import type { TypePrediction } from "@/lib/engine/prediction";
import type { ResultatSimulation } from "./types";

/* ------------------------------------------------------------------ */
/* Registre des prédictions                                            */
/* ------------------------------------------------------------------ */

export interface LigneRegistre {
  prediction: PredictionInscrite;
  type: TypePrediction;
  /** `null` tant qu'aucun fait ne l'a tranchée — jamais compté comme faux. */
  observe: number | null;
  /** Écart absolu prédit/observé, dans l'unité de la prédiction. */
  ecart: number | null;
  /** Le fait qui a tranché — P3, pour pouvoir y remonter. */
  fait: { kind: "tentative" | "observation"; ref: string; date: string } | null;
}

export function construireRegistre(resultat: ResultatSimulation): LigneRegistre[] {
  const tentatives = resultat.pas.at(-1)?.tentatives ?? [];
  const observations = resultat.pas.at(-1)?.observations ?? [];
  const exercicesParId = new Map(
    resultat.scenario.exercices.map((e) => [e.id, { dureeEstimeeMin: e.dureeEstimeeMin }]),
  );

  const resolutions = [
    ...resoudreReussites(resultat.predictions, tentatives, exercicesParId),
    ...resoudreDurees(resultat.predictions, tentatives, exercicesParId),
    ...resoudreRetentions(resultat.predictions, observations),
  ];
  const parId = new Map(resolutions.map((r) => [r.prediction.id, r]));

  return resultat.predictions
    .map((prediction) => {
      const resolution = parId.get(prediction.id) ?? null;
      return {
        prediction,
        type: prediction.type,
        observe: resolution?.observe ?? null,
        ecart: resolution ? Math.abs(prediction.valeur - resolution.observe) : null,
        fait: resolution?.source ?? null,
      };
    })
    .sort((a, b) => a.prediction.emiseLe.localeCompare(b.prediction.emiseLe));
}
