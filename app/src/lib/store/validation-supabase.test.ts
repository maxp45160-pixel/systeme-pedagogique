import { describe, expect, it } from "vitest";
import {
  validerLignesSupabase,
  validerObservation,
  validerTentative,
} from "./validation-supabase";

const observationHistorique = {
  id: "obs-historique",
  skillCode: "DEV-01",
  date: "2026-08-19T10:00:00.000Z",
  type: "code",
  niveauObservation: "A",
  autonomie: "A3",
  qualite: "moyenne",
  resultat: "reussi",
  contexte: "Exercice historique",
  dimensions: { application: 0.8 },
  // Aucune trace de tentative n'est inventée pour les lignes du cutover.
  source: { kind: "exercice", ref: "ex-1" },
};

describe("validation de la frontière Supabase", () => {
  it("accepte une observation historique sans lui fabriquer de trace", () => {
    const resultat = validerObservation(observationHistorique);
    expect(resultat.source.trace).toBeUndefined();
    expect(resultat).toBe(observationHistorique);
  });

  it("valide la trace exacte quand elle existe", () => {
    expect(validerObservation({
      ...observationHistorique,
      id: "obs-nouvelle",
      source: {
        kind: "exercice",
        ref: "ex-1",
        trace: { kind: "tentative", ref: "att-1" },
      },
    }).source.trace).toEqual({ kind: "tentative", ref: "att-1" });
  });

  it("refuse une trace ou une dimension invalide sans valeur de remplacement", () => {
    expect(() => validerObservation({
      ...observationHistorique,
      source: { kind: "exercice", ref: "ex-1", trace: { kind: "tentative", ref: "" } },
    })).toThrow(/source\.trace\.ref/);

    expect(() => validerObservation({
      ...observationHistorique,
      dimensions: { application: "0.8" },
    })).toThrow(/dimensions\.application/);
  });

  it("refuse les colonnes numériques encodées en texte", () => {
    expect(() => validerTentative({
      id: "att-1",
      exerciseId: "ex-1",
      debut: "2026-08-20T10:00:00.000Z",
      indicesUtilises: "0",
      reponse: "Réponse",
      evaluation: {},
      resultat: "partiel",
      statut: "en-cours",
    })).toThrow(/indicesUtilises/);
  });

  it("distingue une liste vide mesurée d'une réponse SELECT absente", () => {
    expect(validerLignesSupabase([], "observations")).toEqual([]);
    expect(() => validerLignesSupabase(null, "observations")).toThrow(/tableau attendu/);
  });
});
