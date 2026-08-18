/**
 * Ce que ces tests protègent.
 *
 * Ce module est le seul du moteur qui écrive quelque chose sans qu'un fait
 * l'exige : une prédiction est un pari, pas une mesure. Deux risques, et le
 * second est celui qui ruinerait le chantier entier :
 *
 * - **fabriquer** une probabilité là où aucune preuve n'existe. Un 0,5 par
 *   défaut confondrait « je ne sais pas » et « une chance sur deux » (P2), et
 *   la métrique de calibration serait ensuite calculée sur des paris que le
 *   moteur n'avait aucun droit de prendre ;
 * - **écrire à chaque rendu**. La clé d'idempotence porte le jour : sans elle,
 *   le journal compterait les rafraîchissements de page et l'auto-évaluation
 *   mesurerait la navigation de l'utilisateur, pas la justesse du moteur.
 *
 * Les fixtures sont volontairement synthétiques : contrairement aux seuils
 * d'ADR-028, les constantes de ce module n'ont aucune donnée derrière elles —
 * c'est précisément ce que le lot 3 doit mesurer.
 */

import { describe, expect, it } from "vitest";

import type { Exercise, ExerciseAttempt, SkillState } from "@/lib/domain/types";
import {
  cleDecision,
  emettre,
  MODELE_VERSION,
  P_MAX,
  P_MIN,
  POLITIQUE_VERSION,
  P_REUSSITE_CALIBRE,
  predireDuree,
  predireRetention,
  predireReussite,
} from "./prediction";

const MAINTENANT = new Date("2026-08-18T09:00:00.000Z");
const JOUR = 86_400_000;

function ilYa(jours: number): string {
  return new Date(MAINTENANT.getTime() - jours * JOUR).toISOString();
}

/** Un état de compétence minimal — seuls les champs lus par le module. */
function etat(options: {
  niveau?: number | null;
  robustesse?: number | null;
  preuves?: number;
  joursDepuis?: number | null;
}): SkillState {
  const nombre = options.preuves ?? 2;
  return {
    skill: { code: "LOG-01", intitule: "Test", domaine: "logistique" },
    niveau: options.niveau === undefined ? 3 : options.niveau,
    score: 3.2,
    confiance: "moyenne",
    robustesse: options.robustesse === undefined ? 0.5 : options.robustesse,
    dimensions: {},
    preuves: Array.from({ length: nombre }, () => ({ date: ilYa(5) })),
    contextesTestes: ["exercice:logistique/calcul"],
    dernierePreuve: nombre > 0 ? ilYa(5) : null,
    joursDepuisDernierePreuve:
      options.joursDepuis === undefined ? 5 : options.joursDepuis,
    contradictions: [],
    prochaineEtape: "",
    statut: nombre > 0 ? "evalue" : "non-evalue",
    explication: { resume: "", facteurs: [], nombrePreuves: nombre, reserves: [] },
  } as unknown as SkillState;
}

const EXERCICE = { id: "ex-1", dureeEstimeeMin: 30 } as Pick<
  Exercise,
  "id" | "dureeEstimeeMin"
>;

function tentative(dureeMin: number): Pick<
  ExerciseAttempt,
  "exerciseId" | "statut" | "dureeMin"
> {
  return { exerciseId: "ex-1", statut: "terminee", dureeMin };
}

/* ------------------------------------------------------------------ */

describe("predireReussite", () => {
  it("ne prédit RIEN sans preuve — l'absence de mesure n'est pas une chance sur deux", () => {
    expect(predireReussite(etat({ niveau: null, preuves: 0 }), 2)).toBeNull();
  });

  it("rend la probabilité calibrée quand la difficulté tombe sur celle du niveau", () => {
    // Niveau 3 appelle la difficulté 4 : écart nul.
    const p = predireReussite(etat({ niveau: 3 }), 4);
    expect(p?.valeur).toBeCloseTo(P_REUSSITE_CALIBRE, 5);
    expect(p?.entrees.ecart).toBe(0);
  });

  it("décroît quand la difficulté monte au-dessus de ce que le niveau appelle", () => {
    const facile = predireReussite(etat({ niveau: 3 }), 2)!.valeur;
    const calibre = predireReussite(etat({ niveau: 3 }), 4)!.valeur;
    const dur = predireReussite(etat({ niveau: 3 }), 5)!.valeur;
    expect(facile).toBeGreaterThan(calibre);
    expect(calibre).toBeGreaterThan(dur);
  });

  it("n'affirme jamais la certitude, dans un sens ni dans l'autre", () => {
    for (const niveau of [0, 1, 2, 3, 4, 5]) {
      for (const difficulte of [1, 2, 3, 4, 5] as const) {
        const p = predireReussite(etat({ niveau }), difficulte)!.valeur;
        expect(p).toBeGreaterThanOrEqual(P_MIN);
        expect(p).toBeLessThanOrEqual(P_MAX);
      }
    }
  });

  it("porte la confiance en entrée sans la faire entrer dans le calcul", () => {
    // La confiance dit ce que vaut notre connaissance, pas ce que vaut la
    // personne. Elle servira à segmenter la calibration, pas à la décaler.
    const p = predireReussite(etat({ niveau: 3 }), 4)!;
    expect(p.entrees).toHaveProperty("confiance");
  });
});

describe("predireDuree", () => {
  it("s'appuie sur l'estimation tant qu'il n'y a pas deux tentatives menées", () => {
    const p = predireDuree(EXERCICE, [tentative(12)]);
    expect(p.valeur).toBe(30);
    expect(p.entrees.source).toBe("estimee");
  });

  it("bascule sur la médiane observée dès deux tentatives", () => {
    // Le cas d'ADR-045 : la durée réelle vaut environ la moitié de l'estimée.
    const p = predireDuree(EXERCICE, [tentative(12), tentative(16), tentative(14)]);
    expect(p.valeur).toBe(14);
    expect(p.entrees.source).toBe("observee");
    expect(p.entrees.observations).toBe(3);
    // L'estimation reste portée : c'est l'écart entre les deux qu'on mesure.
    expect(p.entrees.dureeEstimeeMin).toBe(30);
  });
});

describe("predireRetention", () => {
  it("ne prédit rien sur une compétence sans preuve — il n'y a rien à retenir", () => {
    expect(
      predireRetention(etat({ niveau: null, preuves: 0, robustesse: null }), MAINTENANT),
    ).toBeNull();
  });

  it("croît avec la robustesse, le proxy de stabilité du protocole §13", () => {
    const fragile = predireRetention(etat({ robustesse: 0 }), MAINTENANT)!;
    const solide = predireRetention(etat({ robustesse: 1 }), MAINTENANT)!;
    expect(fragile.valeur).toBeLessThan(solide.valeur);
    expect(fragile.valeur).toBeCloseTo(0.5, 5);
    expect(solide.valeur).toBeCloseTo(0.9, 5);
  });

  it("porte un horizon dans le futur, jamais dans le passé", () => {
    const p = predireRetention(etat({ robustesse: 0.8 }), MAINTENANT)!;
    expect(new Date(p.horizonLe).getTime()).toBeGreaterThanOrEqual(MAINTENANT.getTime());
  });
});

describe("cleDecision", () => {
  it("porte le JOUR, pas l'instant — deux rendus le même jour donnent la même clé", () => {
    const matin = new Date("2026-08-18T08:00:00.000Z");
    const soir = new Date("2026-08-18T21:30:00.000Z");
    expect(cleDecision(matin, "recommandation", "LOG-01", POLITIQUE_VERSION)).toBe(
      cleDecision(soir, "recommandation", "LOG-01", POLITIQUE_VERSION),
    );
  });

  it("change de jour en jour, de cible en cible, et de politique en politique", () => {
    const base = cleDecision(MAINTENANT, "recommandation", "LOG-01", "v1");
    const lendemain = new Date(MAINTENANT.getTime() + JOUR);
    expect(cleDecision(lendemain, "recommandation", "LOG-01", "v1")).not.toBe(base);
    expect(cleDecision(MAINTENANT, "recommandation", "LOG-02", "v1")).not.toBe(base);
    expect(cleDecision(MAINTENANT, "recommandation", "LOG-01", "v2")).not.toBe(base);
  });
});

describe("emettre", () => {
  const commun = {
    now: MAINTENANT,
    difficulteVisee: 4 as const,
    calibration: null,
    facteurs: [{ libelle: "Importance", contribution: 20, phrase: "elle sert ton objectif" }],
    tentatives: [tentative(12), tentative(16)],
  };

  it("produit une décision et ses trois prédictions sur une compétence mesurée", () => {
    const { decision, predictions } = emettre({
      ...commun,
      etat: etat({ niveau: 3, robustesse: 0.6 }),
      exercice: EXERCICE,
    });

    expect(decision.politiqueVersion).toBe(POLITIQUE_VERSION);
    expect(decision.cibleCode).toBe("LOG-01");
    expect(decision.cibleRef).toBe("ex-1");
    expect(decision.facteurs).toHaveLength(1);
    expect(decision.etatEntree.sourceDifficulte).toBe("niveau");

    expect(predictions.map((p) => p.type).sort()).toEqual([
      "duree",
      "retention",
      "reussite",
    ]);
    for (const p of predictions) {
      expect(p.modeleVersion).toBe(MODELE_VERSION);
      // Chaque prédiction porte ses entrées : P3, aucune valeur sans sa source.
      expect(Object.keys(p.entrees).length).toBeGreaterThan(0);
      // Sa clé dérive de celle de la décision : les deux se rejoignent.
      expect(p.requestId.startsWith(decision.requestId)).toBe(true);
    }
  });

  it("dit que la difficulté vient de la calibration quand elle en vient", () => {
    const { decision } = emettre({
      ...commun,
      etat: etat({ niveau: 3 }),
      exercice: EXERCICE,
      calibration: { difficulteConseillee: 4 } as never,
    });
    expect(decision.etatEntree.sourceDifficulte).toBe("calibration");
  });

  it("n'émet ni réussite ni durée quand aucun exercice n'est proposé", () => {
    // Le cas dominant du compte : 40 compétences actives sans aucun exercice.
    const { predictions } = emettre({
      ...commun,
      etat: etat({ niveau: 3, robustesse: 0.6 }),
      exercice: null,
    });
    expect(predictions.map((p) => p.type)).toEqual(["retention"]);
  });

  it("n'émet aucune prédiction sur une compétence jamais mesurée, sauf la durée", () => {
    // Un exercice de diagnostic a bien une durée attendue — c'est un fait sur
    // l'exercice. La réussite et la rétention, elles, porteraient sur une
    // personne dont on ne sait rien.
    const { predictions } = emettre({
      ...commun,
      etat: etat({ niveau: null, preuves: 0, robustesse: null, joursDepuis: null }),
      exercice: EXERCICE,
    });
    expect(predictions.map((p) => p.type)).toEqual(["duree"]);
  });

  it("rejoue à l'identique deux fois le même jour — l'insertion sera un doublon", () => {
    const entrees = {
      ...commun,
      etat: etat({ niveau: 3, robustesse: 0.6 }),
      exercice: EXERCICE,
    };
    const a = emettre(entrees);
    // 09h et 15h UTC : le même jour civil sous tout fuseau raisonnable. Un
    // 22h UTC bascule au lendemain dès UTC+2 — voir la note de `cleDecision`.
    const b = emettre({ ...entrees, now: new Date("2026-08-18T15:00:00.000Z") });
    expect(a.decision.requestId).toBe(b.decision.requestId);
    expect(a.predictions.map((p) => p.requestId)).toEqual(
      b.predictions.map((p) => p.requestId),
    );
  });
});
