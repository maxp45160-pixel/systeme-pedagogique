import { describe, expect, it } from "vitest";
import { computeSkillState, computeAllSkillStates } from "./skill-state";
import {
  FACTEUR_DERNIER_RESULTAT,
  FACTEUR_NIVEAU,
  INTERVALLE_BASE_JOURS,
  MODELE_ACTIF,
  estDue,
  prochaineRevision,
  revisionsDues,
} from "./spaced";
import { REFERENTIEL_TEST, SKILLS_TEST } from "@/lib/domain/referentiel.fixture";
import type { Autonomie, Dimension, QualitePreuve, SkillEvidence } from "@/lib/domain/types";

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

function preuve(options: {
  jours?: number;
  autonomie?: Autonomie;
  qualite?: QualitePreuve;
  resultat?: SkillEvidence["resultat"];
  contexte?: string;
  dims?: Partial<Record<Dimension, number>>;
}): SkillEvidence {
  return {
    id: `ev-spaced-${++compteur}`,
    skillCode: "DEV-01",
    date: ilYa(options.jours ?? 1),
    type: "exercice",
    niveauPreuve: "A",
    autonomie: options.autonomie ?? "A3",
    qualite: options.qualite ?? "moyenne",
    resultat: options.resultat ?? "reussi",
    contexte: options.contexte ?? "Contexte A",
    dimensions: options.dims ?? { comprehension: 0.9, application: 0.85 },
    source: { kind: "exercice", ref: "ex-spaced" },
  };
}

const DEV01 = REFERENTIEL_TEST.parCode.get("DEV-01")!;

function etat(preuves: SkillEvidence[], now = MAINTENANT) {
  return computeSkillState(DEV01, preuves, now);
}

function intervalle(e: ReturnType<typeof etat>): number | null {
  return MODELE_ACTIF.intervalle(e);
}

/* ------------------------------------------------------------------ */

describe("intervalle — dérivé de l'état, jamais stocké (P1)", () => {
  it("vaut null sans aucune preuve : à diagnostiquer, pas à réviser", () => {
    expect(intervalle(etat([]))).toBeNull();
  });

  it("une compétence fraîche se révise très vite", () => {
    // Une seule preuve récente : niveau 2, robustesse faible, confiance faible.
    // L'intervalle est le produit des facteurs, arrondi — il reste court.
    const e = etat([preuve({ jours: 1 })]);
    expect(e.niveau).toBe(2);
    expect(intervalle(e)!).toBeLessThanOrEqual(2);
  });

  it("l'intervalle croît avec le niveau — chaque palier double (protocole §4)", () => {
    // Niveau 3 : deux réussites autonomes concordantes (instructions §11).
    const e = etat([
      preuve({ jours: 30, contexte: "A" }),
      preuve({ jours: 5, contexte: "B" }),
    ]);
    expect(e.niveau).toBe(3);
    // Niveau 3 → ×4 ; robustesse et confiance moyennes → intervalle > base.
    expect(intervalle(e)!).toBeGreaterThan(INTERVALLE_BASE_JOURS * FACTEUR_NIVEAU[3]);
  });

  it("la robustesse allonge l'intervalle — c'est le proxy de stabilité (§13)", () => {
    const fragile = etat([preuve({ jours: 1 })]);
    const robuste = etat([
      preuve({ jours: 60, contexte: "A" }),
      preuve({ jours: 30, contexte: "B" }),
      preuve({ jours: 10, contexte: "C" }),
      preuve({ jours: 2, contexte: "D" }),
    ]);
    expect(robuste.robustesse!).toBeGreaterThan(fragile.robustesse!);
    expect(intervalle(robuste)!).toBeGreaterThan(intervalle(fragile)!);
  });

  it("la confiance module l'intervalle — faible révise plus tôt, forte plus tard (§10)", () => {
    const faible = etat([preuve({ jours: 1 })]);
    const forte = etat([
      preuve({ jours: 30, contexte: "A", qualite: "forte", autonomie: "A4" }),
      preuve({ jours: 20, contexte: "B", qualite: "forte", autonomie: "A4" }),
      preuve({ jours: 10, contexte: "C", qualite: "forte", autonomie: "A4" }),
      preuve({ jours: 2, contexte: "D", qualite: "forte", autonomie: "A4" }),
    ]);
    expect(forte.confiance).toBe("forte");
    expect(intervalle(forte)!).toBeGreaterThan(intervalle(faible)!);
  });

  it("l'intervalle est borné à 1 jour minimum — jamais 0", () => {
    // Même avec un échec récent (facteur 0,5), l'intervalle ne descend pas sous 1.
    const e = etat([preuve({ jours: 1, resultat: "echec", dims: { application: 0.2 } })]);
    expect(intervalle(e)!).toBeGreaterThanOrEqual(1);
  });
});

describe("réaction à la performance — variante A'", () => {
  it("un échec récent porte le facteur 0,5 dans l'explication", () => {
    // La garantie est que le facteur exposé pour un « echec » est bien 0,5
    // (P3 : le nombre affiché et le calcul tiennent ensemble). L'intervalle
    // lui-même dépend aussi du niveau et de la robustesse, qui diffèrent entre
    // un « reussi » et un « echec » — on ne compare donc pas les intervalles.
    const echec = etat([preuve({ jours: 1, resultat: "echec", dims: { application: 0.2 } })]);
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
    const partiel = etat([preuve({ jours: 1, resultat: "partiel" })]);
    const facteurResultat = MODELE_ACTIF.facteurs(partiel).find(
      (f) => f.libelle === "Dernier résultat",
    );
    expect(facteurResultat?.multiplicateur).toBe(FACTEUR_DERNIER_RESULTAT.partiel);
  });
});

describe("estDue — la compétence est-elle à réviser aujourd'hui ?", () => {
  it("n'est jamais due sans preuve : à diagnostiquer, pas à réviser", () => {
    expect(estDue(etat([]), MAINTENANT)).toBe(false);
  });

  it("est due quand l'intervalle est dépassé", () => {
    // Niveau 2, robustesse faible, confiance faible → intervalle 1 jour.
    // Une preuve vieille de 5 jours dépasse l'intervalle.
    const e = etat([preuve({ jours: 5 })]);
    expect(estDue(e, MAINTENANT)).toBe(true);
  });

  it("n'est pas due tant que l'intervalle n'est pas atteint", () => {
    // Preuve du jour : 0 jour écoulé, intervalle ≥ 1 → pas due.
    const e = etat([preuve({ jours: 0 })]);
    expect(estDue(e, MAINTENANT)).toBe(false);
  });

  it("une compétence robuste n'est pas due après quelques jours", () => {
    // Niveau 3, robustesse élevée → intervalle de plusieurs jours.
    const e = etat([
      preuve({ jours: 30, contexte: "A", qualite: "forte", autonomie: "A4" }),
      preuve({ jours: 20, contexte: "B", qualite: "forte", autonomie: "A4" }),
      preuve({ jours: 10, contexte: "C", qualite: "forte", autonomie: "A4" }),
      preuve({ jours: 2, contexte: "D", qualite: "forte", autonomie: "A4" }),
    ]);
    expect(intervalle(e)!).toBeGreaterThan(2);
    expect(estDue(e, MAINTENANT)).toBe(false);
  });
});

describe("prochaineRevision — point d'entrée unique, avec justification (P3)", () => {
  it("rend une raison et des facteurs pour une compétence évaluée", () => {
    const e = etat([preuve({ jours: 5 })]);
    const r = prochaineRevision(e, MAINTENANT);
    expect(r.facteurs.length).toBeGreaterThan(0);
    expect(r.raison).toContain("jour");
    // Chaque facteur porte son multiplicateur — aucun nombre sans sa source.
    for (const f of r.facteurs) {
      expect(f.multiplicateur).toBeGreaterThan(0);
    }
  });

  it("rend une raison explicite pour une compétence sans preuve", () => {
    const r = prochaineRevision(etat([]), MAINTENANT);
    expect(r.due).toBe(false);
    expect(r.raison).toContain("diagnostiquer");
    expect(r.facteurs).toHaveLength(0);
  });

  it("les facteurs affichés sont exactement ceux du calcul (source unique)", () => {
    const e = etat([preuve({ jours: 5 })]);
    const r = prochaineRevision(e, MAINTENANT);
    const produit = r.facteurs.reduce((acc, f) => acc * f.multiplicateur, INTERVALLE_BASE_JOURS);
    expect(r.intervalleJours).toBe(Math.max(1, Math.round(produit)));
  });

  it("porte le champ `sansPreuve` — vrai sans preuve, faux avec", () => {
    expect(prochaineRevision(etat([]), MAINTENANT).sansPreuve).toBe(true);
    expect(prochaineRevision(etat([preuve({ jours: 5 })]), MAINTENANT).sansPreuve).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* Agrégation — `revisionsDues`                                        */
/* ------------------------------------------------------------------ */

/*
 * `revisionsDues` agrège les états en une liste triée de compétences à
 * réviser. Les tests ci-dessous protègent les règles qui rendent le bloc
 * « À réviser » du tableau de bord honnête : pas de compétence sans preuve,
 * pas de compétence non due, tri par retard relatif, ordre déterministe.
 */

describe("revisionsDues — agrégation pure, triée par retard", () => {
  // Les tests ont besoin de plusieurs compétences distinctes : on prend le
  // référentiel de test, qui en porte six actives (DEV-01 → DEV-06).
  const SKILLS = SKILLS_TEST;

  function preuvesPour(code: string, jours: number): SkillEvidence {
    return {
      ...preuve({ jours }),
      id: `ev-rev-${code}-${jours}`,
      skillCode: code,
    };
  }

  it("exclut les compétences sans preuve — à diagnostiquer, pas à réviser", () => {
    // Aucune preuve sur aucune compétence : la liste est vide, pas une liste
    // de zéros. On ne contourne pas `intervalle === null`.
    const etats = computeAllSkillStates(SKILLS, [], MAINTENANT);
    expect(revisionsDues(etats, MAINTENANT)).toEqual([]);
  });

  it("exclut les compétences qui ne sont pas dues", () => {
    // Une preuve récente (0 jour) sur DEV-01 : intervalle ≥ 1, pas due.
    const preuves = [preuvesPour("DEV-01", 0)];
    const etats = computeAllSkillStates(SKILLS, preuves, MAINTENANT);
    expect(revisionsDues(etats, MAINTENANT)).toEqual([]);
  });

  it("rend une liste vide quand rien n'est dû — et non une erreur", () => {
    const etats = computeAllSkillStates(SKILLS, [], MAINTENANT);
    const dues = revisionsDues(etats, MAINTENANT);
    expect(dues).toEqual([]);
    expect(dues.length).toBe(0);
  });

  it("le retard vaut bien joursEcoules / intervalleJours sur un cas calculé à la main", () => {
    // DEV-01 avec une seule preuve vieille de 5 jours :
    //   niveau 2 → ×2 ; robustesse calculée (non nulle avec une preuve) ; confiance faible → ×0,5 ;
    //   dernier résultat réussi → ×1.
    //   L'intervalle exact dépend de la robustesse dérivée : on le lit dans
    //   l'état, puis on vérifie que retard = ecoules / intervalle.
    const preuves = [preuvesPour("DEV-01", 5)];
    const etats = computeAllSkillStates(SKILLS, preuves, MAINTENANT);
    const dues = revisionsDues(etats, MAINTENANT);
    expect(dues).toHaveLength(1);
    expect(dues[0].etat.skill.code).toBe("DEV-01");
    const ecoules = dues[0].revision.joursEcoules ?? 0;
    expect(dues[0].retard).toBe(ecoules / dues[0].revision.intervalleJours);
  });

  it("trie par retard décroissant — la plus en retard d'abord", () => {
    // DEV-01 : preuve vieille de 10 jours, intervalle 1 → retard 10.
    // DEV-02 : preuve vieille de 3 jours, intervalle 1 → retard 3.
    // DEV-03 : preuve vieille de 7 jours, intervalle 1 → retard 7.
    // Ordre attendu : DEV-01 (10), DEV-03 (7), DEV-02 (3).
    const preuves = [
      preuvesPour("DEV-01", 10),
      preuvesPour("DEV-02", 3),
      preuvesPour("DEV-03", 7),
    ];
    const etats = computeAllSkillStates(SKILLS, preuves, MAINTENANT);
    const dues = revisionsDues(etats, MAINTENANT);
    const codes = dues.map((d) => d.etat.skill.code);
    expect(codes).toEqual(["DEV-01", "DEV-03", "DEV-02"]);
    // Le retard décroît bien.
    expect(dues[0].retard).toBeGreaterThanOrEqual(dues[1].retard);
    expect(dues[1].retard).toBeGreaterThanOrEqual(dues[2].retard);
  });

  it("départage les ex æquo par intervalle croissant, puis par code — déterministe", () => {
    // Deux compétences avec le même retard (10/1 = 10) : on prend celle à
    // l'intervalle le plus court d'abord. Si l'intervalle est aussi égal, le
    // code départage — l'ordre doit être stable et testable.
    //
    // Ici DEV-01 et DEV-02 ont toutes deux une preuve vieille de 10 jours,
    // un seul contexte, niveau 2, confiance faible → intervalle 1 pour les
    // deux. Retard = 10 pour les deux. Le code départage : DEV-01 avant DEV-02.
    const preuves = [
      preuvesPour("DEV-01", 10),
      preuvesPour("DEV-02", 10),
    ];
    const etats = computeAllSkillStates(SKILLS, preuves, MAINTENANT);
    const dues = revisionsDues(etats, MAINTENANT);
    expect(dues).toHaveLength(2);
    expect(dues[0].etat.skill.code).toBe("DEV-01");
    expect(dues[1].etat.skill.code).toBe("DEV-02");
    // Même retard, même intervalle : l'ordre ne dépend que du code.
    expect(dues[0].retard).toBe(dues[1].retard);
    expect(dues[0].revision.intervalleJours).toBe(dues[1].revision.intervalleJours);
  });
});
