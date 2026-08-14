import { describe, expect, it } from "vitest";

import type { SkillState } from "@/lib/domain/types";
import type { Recommandation } from "./recommend";
import { adaptLegacyExercise } from "@/lib/domain/legacy-activity-adapter";
import type { Exercise } from "@/lib/domain/types";
import { choisirActionUnifiee, lireContexteInstant } from "./action-unifiee";

const NOW = "2026-08-13T10:00:00.000Z";

function exercice(id: string, code: string, dureeEstimeeMin: number): Exercise {
  return {
    id,
    titre: `Exercice ${id}`,
    domaine: "dev",
    type: "application",
    difficulte: 3,
    competences: [code],
    dureeEstimeeMin,
    enonce: "Énoncé",
    indices: [],
    correction: "Correction",
    criteres: [{ dimension: "application", libelle: "Appliquer" }],
    origine: "manuel",
  };
}

function etat(code: string): SkillState {
  return {
    skill: {
      code,
      domaine: "dev",
      intitule: code,
      palier: "fondamentaux",
      prerequis: [],
      importance: 1,
      ordre: 0,
      active: true,
      archive: false,
      origine: "utilisateur",
    },
    niveau: null,
    score: null,
    confiance: "nulle",
    robustesse: null,
    dimensions: { comprehension: 0, application: 0, transfert: 0, integration: 0, justification: 0 },
    preuves: [],
    contextesTestes: [],
    dernierePreuve: null,
    joursDepuisDernierePreuve: null,
    contradictions: [],
    prochaineEtape: "Diagnostiquer",
    explication: { resume: "", facteurs: [], nombrePreuves: 0, reserves: [] },
    statut: "non-evalue",
  };
}

function recommandation(code: string, ex: Exercise | null): Recommandation {
  return {
    etat: etat(code),
    valeur: 10,
    facteurs: [],
    raison: "Raison",
    exercice: ex,
    difficulteCible: 3,
    dureeEstimeeMin: ex?.dureeEstimeeMin ?? 20,
    calibration: null,
  };
}

function entrees(exercices: Exercise[], recommandations: Recommandation[], tempsMin: number) {
  return {
    accountId: "compte-a",
    instant: { tempsMin, capacite: "standard" as const },
    declaredAt: NOW,
    recommandations,
    rankedSkillStates: recommandations.map((r) => r.etat),
    activities: exercices.map((ex) => adaptLegacyExercise("compte-a", ex)),
    openRuns: [],
  };
}

describe("contexte d'instant", () => {
  it("retombe sur les valeurs par défaut quand l'URL est absente ou aberrante", () => {
    expect(lireContexteInstant({})).toEqual({ tempsMin: 25, capacite: "standard" });
    expect(lireContexteInstant({ temps: "abc", capacite: "cosmique" }))
      .toEqual({ tempsMin: 25, capacite: "standard" });
    expect(lireContexteInstant({ temps: "3" }).tempsMin).toBe(25);
    expect(lireContexteInstant({ temps: "9999" }).tempsMin).toBe(25);
  });

  it("lit ce qui est déclaré quand c'est plausible", () => {
    expect(lireContexteInstant({ temps: "45", capacite: "faible" }))
      .toEqual({ tempsMin: 45, capacite: "faible" });
  });
});

describe("arbitrage à l'instant T", () => {
  it("laisse la file inchangée quand le premier tient dans le temps déclaré", () => {
    const court = exercice("ex-court", "DEV-01", 20);
    const long = exercice("ex-long", "DEV-02", 60);
    const resultat = choisirActionUnifiee(entrees(
      [court, long],
      [recommandation("DEV-01", court), recommandation("DEV-02", long)],
      30,
    ));
    expect(resultat?.kind).toBe("exercice");
    if (resultat?.kind !== "exercice") throw new Error("branche inattendue");
    expect(resultat.recommandations[0].exercice?.id).toBe("ex-court");
  });

  it("remet en tête l'exercice qui tient réellement dans le temps disponible", () => {
    const long = exercice("ex-long", "DEV-01", 60);
    const court = exercice("ex-court", "DEV-02", 15);
    const resultat = choisirActionUnifiee(entrees(
      [long, court],
      [recommandation("DEV-01", long), recommandation("DEV-02", court)],
      20,
    ));
    expect(resultat?.kind).toBe("exercice");
    if (resultat?.kind !== "exercice") throw new Error("branche inattendue");
    expect(resultat.recommandations[0].exercice?.id).toBe("ex-court");
    // Rien n'est perdu : la compétence écartée reste dans la file.
    expect(resultat.recommandations).toHaveLength(2);
    expect(resultat.recommandations[1].exercice?.id).toBe("ex-long");
  });

  it("rend la file habituelle, avec sa réserve, quand rien ne tient", () => {
    const long = exercice("ex-long", "DEV-01", 60);
    const resultat = choisirActionUnifiee(entrees(
      [long],
      [recommandation("DEV-01", long)],
      10,
    ));
    expect(resultat?.kind).toBe("exercice");
    if (resultat?.kind !== "exercice") throw new Error("branche inattendue");
    expect(resultat.recommandations[0].exercice?.id).toBe("ex-long");
    expect(resultat.reserves[0]).toContain("10 min");
  });

  it("ne rend rien quand il n'y a ni activité ni file", () => {
    expect(choisirActionUnifiee(entrees([], [], 30))).toBeNull();
  });

  it("expose les facteurs d'arbitrage sans inventer de contribution chiffrée", () => {
    const court = exercice("ex-court", "DEV-01", 15);
    const resultat = choisirActionUnifiee(entrees(
      [court],
      [recommandation("DEV-01", court)],
      20,
    ));
    if (resultat?.kind !== "exercice") throw new Error("branche inattendue");
    expect(resultat.facteurs.map((f) => f.kind)).toContain("temps");
    expect(resultat.facteurs.every((f) => !("contribution" in f))).toBe(true);
  });
});
