import { describe, expect, it } from "vitest";
import {
  validerDomaine,
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

const domaineNu = {
  id: "logistique",
  nom: "Logistique",
  prefixe: "LOG",
  description: "",
  ordre: 0,
  version: 1,
  archive: false,
  origine: "utilisateur",
};

describe("rattachement d'un domaine à la carte des savoirs", () => {
  it("accepte un domaine sans rattachement — c'est l'état normal", () => {
    expect(validerDomaine({ ...domaineNu }).carteNoeud).toBeUndefined();
  });

  it("accepte un rattachement complet", () => {
    const domaine = validerDomaine({
      ...domaineNu,
      carteNoeud: "industrie",
      carteVersion: "2026-08-22",
      carteOrigine: "manuel",
      carteValideLe: "2026-08-22T10:00:00.000Z",
    });
    expect(domaine.carteNoeud).toBe("industrie");
    expect(domaine.carteOrigine).toBe("manuel");
  });

  it("refuse un rattachement incomplet plutôt que de le compléter", () => {
    expect(() =>
      validerDomaine({ ...domaineNu, carteNoeud: "industrie" }),
    ).toThrow(/rattachement de carte incomplet/);
  });

  it("refuse une origine que la base n'autorise pas", () => {
    expect(() =>
      validerDomaine({
        ...domaineNu,
        carteNoeud: "industrie",
        carteVersion: "2026-08-22",
        carteOrigine: "lexical",
        carteValideLe: "2026-08-22T10:00:00.000Z",
      }),
    ).toThrow();
  });

  it("refuse une date de validation qui n'en est pas une", () => {
    expect(() =>
      validerDomaine({
        ...domaineNu,
        carteNoeud: "industrie",
        carteVersion: "2026-08-22",
        carteOrigine: "manuel",
        carteValideLe: "hier",
      }),
    ).toThrow();
  });

  it("accepte un nœud absent de la carte courante — le chargement ne doit pas casser", () => {
    /*
     * La carte évolue en dépôt. Un nœud retiré rendrait tout le référentiel
     * illisible si la validation le refusait ici. L'obsolescence se signale
     * à l'affichage, elle ne bloque pas la lecture.
     */
    expect(
      validerDomaine({
        ...domaineNu,
        carteNoeud: "region-retiree-de-la-carte",
        carteVersion: "2026-01-01",
        carteOrigine: "tuteur",
        carteValideLe: "2026-01-01T10:00:00.000Z",
      }).carteNoeud,
    ).toBe("region-retiree-de-la-carte");
  });
});
