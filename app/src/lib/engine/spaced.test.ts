import { describe, expect, it } from "vitest";
import { computeSkillState } from "./skill-state";
import {
  FACTEUR_DERNIER_RESULTAT,
  FACTEUR_NIVEAU,
  INTERVALLE_BASE_JOURS,
  MODELE_ACTIF,
  estDue,
  prochaineRevision,
} from "./spaced";
import { REFERENTIEL_TEST } from "@/lib/domain/referentiel.fixture";
import type { Autonomie, Dimension, QualiteObservation, SkillObservation } from "@/lib/domain/types";

/*
 * Ces tests vérifient que la répétition espacée (méthode A') dérive bien
 * l'intervalle de révision de l'état de la compétence, sans rien stocker (P1),
 * et qu'elle réagit à la performance (variante A'). Chaque cas cite la règle
 * qu'il protège.
 *
 * L'intervalle est lu via `MODELE_ACTIF.intervalle` : c'est l'interface que
 * les appelants utilisent, et c'est elle qui devra rester stable quand la
 * méthode C (FSRS) remplacera la méthode A'.
 */

const MAINTENANT = new Date("2026-07-24T12:00:00.000Z");
const JOUR = 86_400_000;

function ilYa(jours: number): string {
  return new Date(MAINTENANT.getTime() - jours * JOUR).toISOString();
}

let compteur = 0;

function observation(options: {
  jours?: number;
  autonomie?: Autonomie;
  qualite?: QualiteObservation;
  resultat?: SkillObservation["resultat"];
  contexte?: string;
  dims?: Partial<Record<Dimension, number>>;
}): SkillObservation {
  return {
    id: `obs-spaced-${++compteur}`,
    skillCode: "DEV-01",
    date: ilYa(options.jours ?? 1),
    type: "exercice",
    niveauObservation: "A",
    autonomie: options.autonomie ?? "A3",
    qualite: options.qualite ?? "moyenne",
    resultat: options.resultat ?? "reussi",
    contexte: options.contexte ?? "Contexte A",
    dimensions: options.dims ?? { comprehension: 0.9, application: 0.85 },
    source: { kind: "exercice", ref: "ex-spaced" },
  };
}

const DEV01 = REFERENTIEL_TEST.parCode.get("DEV-01")!;

function etat(observations: SkillObservation[], now = MAINTENANT) {
  return computeSkillState(DEV01, observations, now);
}

function intervalle(e: ReturnType<typeof etat>): number | null {
  return MODELE_ACTIF.intervalle(e);
}

/* ------------------------------------------------------------------ */

describe("intervalle — dérivé de l'état, jamais stocké (P1)", () => {
  it("vaut null sans aucune observation : à diagnostiquer, pas à réviser", () => {
    expect(intervalle(etat([]))).toBeNull();
  });

  it("une compétence fraîche se révise très vite", () => {
    // Une seule observation récente : niveau 2, robustesse faible, confiance faible.
    // L'intervalle est le produit des facteurs, arrondi — il reste court.
    const e = etat([observation({ jours: 1 })]);
    expect(e.niveau).toBe(2);
    expect(intervalle(e)!).toBeLessThanOrEqual(2);
  });

  it("l'intervalle croît avec le niveau — chaque palier double (protocole §4)", () => {
    // Niveau 3 : deux réussites autonomes concordantes (instructions §11).
    const e = etat([
      observation({ jours: 30, contexte: "A" }),
      observation({ jours: 5, contexte: "B" }),
    ]);
    expect(e.niveau).toBe(3);
    // Niveau 3 → ×4 ; robustesse et confiance moyennes → intervalle > base.
    expect(intervalle(e)!).toBeGreaterThan(INTERVALLE_BASE_JOURS * FACTEUR_NIVEAU[3]);
  });

  it("la robustesse allonge l'intervalle — c'est le proxy de stabilité (§13)", () => {
    const fragile = etat([observation({ jours: 1 })]);
    const robuste = etat([
      observation({ jours: 60, contexte: "A" }),
      observation({ jours: 30, contexte: "B" }),
      observation({ jours: 10, contexte: "C" }),
      observation({ jours: 2, contexte: "D" }),
    ]);
    expect(robuste.robustesse!).toBeGreaterThan(fragile.robustesse!);
    expect(intervalle(robuste)!).toBeGreaterThan(intervalle(fragile)!);
  });

  it("la confiance module l'intervalle — faible révise plus tôt, forte plus tard (§10)", () => {
    const faible = etat([observation({ jours: 1 })]);
    const forte = etat([
      observation({ jours: 30, contexte: "A", qualite: "forte", autonomie: "A4" }),
      observation({ jours: 20, contexte: "B", qualite: "forte", autonomie: "A4" }),
      observation({ jours: 10, contexte: "C", qualite: "forte", autonomie: "A4" }),
      observation({ jours: 2, contexte: "D", qualite: "forte", autonomie: "A4" }),
    ]);
    expect(forte.confiance).toBe("forte");
    expect(intervalle(forte)!).toBeGreaterThan(intervalle(faible)!);
  });

  it("l'intervalle est borné à 1 jour minimum — jamais 0", () => {
    // Même avec un échec récent (facteur 0,5), l'intervalle ne descend pas sous 1.
    const e = etat([observation({ jours: 1, resultat: "echec", dims: { application: 0.2 } })]);
    expect(intervalle(e)!).toBeGreaterThanOrEqual(1);
  });
});

describe("réaction à la performance — variante A'", () => {
  it("un échec récent porte le facteur 0,5 dans l'explication", () => {
    // La garantie est que le facteur exposé pour un « echec » est bien 0,5
    // (P3 : le nombre affiché et le calcul tiennent ensemble). L'intervalle
    // lui-même dépend aussi du niveau et de la robustesse, qui diffèrent entre
    // un « reussi » et un « echec » — on ne compare donc pas les intervalles.
    const echec = etat([observation({ jours: 1, resultat: "echec", dims: { application: 0.2 } })]);
    const facteurResultat = MODELE_ACTIF.facteurs(echec).find(
      (f) => f.libelle === "Dernier résultat",
    );
    expect(facteurResultat?.multiplicateur).toBe(FACTEUR_DERNIER_RESULTAT.echec);
  });

  it("un résultat partiel porte le facteur 0,75 dans l'explication", () => {
    // La garantie est que le facteur exposé pour un « partiel » est bien 0,75
    // (P3 : le nombre affiché et le calcul tiennent ensemble). L'intervalle
    // lui-même dépend aussi du niveau et de la robustesse, qui diffèrent entre
    // un « reussi » et un « partiel » — on ne compare donc pas les intervalles.
    const partiel = etat([observation({ jours: 1, resultat: "partiel" })]);
    const facteurResultat = MODELE_ACTIF.facteurs(partiel).find(
      (f) => f.libelle === "Dernier résultat",
    );
    expect(facteurResultat?.multiplicateur).toBe(FACTEUR_DERNIER_RESULTAT.partiel);
  });
});

describe("estDue — la compétence est-elle à réviser aujourd'hui ?", () => {
  it("n'est jamais due sans observation : à diagnostiquer, pas à réviser", () => {
    expect(estDue(etat([]), MAINTENANT)).toBe(false);
  });

  it("est due quand l'intervalle est dépassé", () => {
    // Niveau 2, robustesse faible, confiance faible → intervalle 1 jour.
    // Une observation vieille de 5 jours dépasse l'intervalle.
    const e = etat([observation({ jours: 5 })]);
    expect(estDue(e, MAINTENANT)).toBe(true);
  });

  it("n'est pas due tant que l'intervalle n'est pas atteint", () => {
    // Observation du jour : 0 jour écoulé, intervalle ≥ 1 → pas due.
    const e = etat([observation({ jours: 0 })]);
    expect(estDue(e, MAINTENANT)).toBe(false);
  });

  it("une compétence robuste n'est pas due après quelques jours", () => {
    // Niveau 3, robustesse élevée → intervalle de plusieurs jours.
    const e = etat([
      observation({ jours: 30, contexte: "A", qualite: "forte", autonomie: "A4" }),
      observation({ jours: 20, contexte: "B", qualite: "forte", autonomie: "A4" }),
      observation({ jours: 10, contexte: "C", qualite: "forte", autonomie: "A4" }),
      observation({ jours: 2, contexte: "D", qualite: "forte", autonomie: "A4" }),
    ]);
    expect(intervalle(e)!).toBeGreaterThan(2);
    expect(estDue(e, MAINTENANT)).toBe(false);
  });
});

describe("prochaineRevision — point d'entrée unique, avec justification (P3)", () => {
  it("rend une raison et des facteurs pour une compétence évaluée", () => {
    const e = etat([observation({ jours: 5 })]);
    const r = prochaineRevision(e, MAINTENANT);
    expect(r.facteurs.length).toBeGreaterThan(0);
    expect(r.raison).toContain("jour");
    // Chaque facteur porte son multiplicateur — aucun nombre sans sa source.
    for (const f of r.facteurs) {
      expect(f.multiplicateur).toBeGreaterThan(0);
    }
  });

  it("rend une raison explicite pour une compétence sans observation", () => {
    const r = prochaineRevision(etat([]), MAINTENANT);
    expect(r.due).toBe(false);
    expect(r.raison).toContain("diagnostiquer");
    expect(r.facteurs).toHaveLength(0);
  });

  it("les facteurs affichés sont exactement ceux du calcul (source unique)", () => {
    const e = etat([observation({ jours: 5 })]);
    const r = prochaineRevision(e, MAINTENANT);
    const produit = r.facteurs.reduce((acc, f) => acc * f.multiplicateur, INTERVALLE_BASE_JOURS);
    expect(r.intervalleJours).toBe(Math.max(1, Math.round(produit)));
  });

  it("porte le champ `sansObservation` — vrai sans observation, faux avec", () => {
    expect(prochaineRevision(etat([]), MAINTENANT).sansObservation).toBe(true);
    expect(prochaineRevision(etat([observation({ jours: 5 })]), MAINTENANT).sansObservation).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
