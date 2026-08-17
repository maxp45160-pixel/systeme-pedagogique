import { describe, expect, it } from "vitest";

import type { SkillState } from "@/lib/domain/types";
import type { Recommandation } from "./recommend";
import { adaptLegacyExercise } from "@/lib/domain/legacy-activity-adapter";
import { adaptNoteOperationnelle, idActiviteNote } from "@/lib/domain/note-activity-adapter";
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

function noteOperationnelle(id: string, type: string, codes: string[]) {
  const activite = adaptNoteOperationnelle(
    "compte-a",
    {
      id,
      titre: `Note ${id}`,
      type,
      tags: [],
      schema: "pedagogie/v1",
      schemaCompatible: true,
      frontMatter: { role: "operationnel", contexte: "Contexte", domaine: "dev" },
      liens: codes.map((cible) => ({ cible })),
      createdAt: NOW,
      updatedAt: NOW,
    },
    { codesActifs: new Set(codes), documentsFiges: new Set() },
  );
  if (!activite) throw new Error("la fabrique de test doit produire un candidat");
  return activite;
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

  /*
   * Une note de séance appartient à la famille « entrainer », comme un
   * exercice. Sans le test du préfixe placé AVANT la branche exercice, elle
   * serait remise en tête de la file d'exercices : l'écran proposerait un
   * exercice là où la personne a engagé une séance.
   */
  it("ne confond pas une note de séance avec un exercice malgré leur famille commune", () => {
    const court = exercice("ex-court", "DEV-01", 15);
    const note = noteOperationnelle("seance-lundi", "seance", ["DEV-01"]);
    const resultat = choisirActionUnifiee({
      ...entrees([court], [recommandation("DEV-01", court)], 30),
      activities: [note],
    });
    expect(resultat?.kind).toBe("note");
    if (resultat?.kind !== "note") throw new Error("branche inattendue");
    expect(resultat.noteId).toBe("seance-lundi");
  });

  it("mène vers la fiche, pas vers la file, quand une note l'emporte", () => {
    const note = noteOperationnelle("projet-audit", "projet", ["DEV-01"]);
    const resultat = choisirActionUnifiee({
      ...entrees([], [recommandation("DEV-01", null)], 60),
      activities: [note],
    });
    if (resultat?.kind !== "note") throw new Error("branche inattendue");
    expect(resultat.action.activityId).toBe(idActiviteNote("projet-audit"));
    expect(resultat.action.family).toBe("produire");
  });

  it("propose l'action suivante (autre note ou exercice) quand une note n'est plus candidate", () => {
    const court = exercice("ex-court", "DEV-01", 20);
    const note1 = noteOperationnelle("projet-1", "projet", ["DEV-01"]);
    const note2 = noteOperationnelle("projet-2", "projet", ["DEV-01"]);

    // Quand les deux sont candidates, la première est proposée
    const avecNote1 = choisirActionUnifiee({
      ...entrees([court], [recommandation("DEV-01", court)], 60),
      activities: [note1, note2],
    });
    expect(avecNote1?.kind).toBe("note");
    if (avecNote1?.kind === "note") {
      expect(avecNote1.noteId).toBe("projet-1");
    }

    // Quand note1 est écartée (exclue des activités), note2 est proposée
    const sansNote1 = choisirActionUnifiee({
      ...entrees([court], [recommandation("DEV-01", court)], 60),
      activities: [note2],
    });
    expect(sansNote1?.kind).toBe("note");
    if (sansNote1?.kind === "note") {
      expect(sansNote1.noteId).toBe("projet-2");
    }

    // Quand toutes les notes sont écartées, l'exercice prend le relais immédiatement
    const sansNotes = choisirActionUnifiee({
      ...entrees([court], [recommandation("DEV-01", court)], 60),
      activities: [],
    });
    expect(sansNotes?.kind).toBe("exercice");
    if (sansNotes?.kind === "exercice") {
      expect(sansNotes.recommandations[0].exercice?.id).toBe("ex-court");
    }
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

  /*
   * Une note sans aucun lien vers un code actif (skillCodes vide) reste une
   * action proposable : son travail est engagé, sa famille est connue. C'est
   * exactement le cas où le bouton « Passer » était masqué — la carte ne
   * trouvait pas de code à refuser, et la suggestion ne pouvait pas être
   * écartée. Le refus est porté par l'identifiant d'activité seul.
   */
  it("une note sans code de compétence reste proposable par l'arbitrage", () => {
    const note = noteOperationnelle("note-libre", "projet", []);
    const resultat = choisirActionUnifiee({
      ...entrees([], [recommandation("DEV-01", null)], 60),
      activities: [note],
    });
    if (resultat?.kind !== "note") throw new Error("branche inattendue");
    expect(resultat.action.activityId).toBe(idActiviteNote("note-libre"));
    expect(resultat.action.target.skillCodes).toEqual([]);
  });

  it("la note sans code, écartée, laisse la place à l'exercice suivant", () => {
    const court = exercice("ex-court", "DEV-01", 20);
    const note = noteOperationnelle("note-libre", "projet", []);

    // Seule candidate, elle est proposée.
    const seule = choisirActionUnifiee({
      ...entrees([], [recommandation("DEV-01", court)], 60),
      activities: [note],
    });
    expect(seule?.kind).toBe("note");

    // Passée (absente des activités), l'exercice de la file prend le relais.
    const sansNote = choisirActionUnifiee(
      entrees([court], [recommandation("DEV-01", court)], 60),
    );
    expect(sansNote?.kind).toBe("exercice");
    if (sansNote?.kind !== "exercice") throw new Error("branche inattendue");
    expect(sansNote.recommandations[0].exercice?.id).toBe("ex-court");
  });

  /*
   * Un exercice que `recommander` a retiré de la file (non abouti — partiel ou
   * échec — sans progrès démontré) ne doit pas réapparaître par la porte de
   * l'arbitrage. Avant le correctif, `activities` portait tout le corpus et
   * l'exercice restait candidat ; sa compétence étant absente de la file, il
   * était retenu en tête sous forme d'« activité » (CarteActionActivite) — la
   * carte réaffichait le même exercice que la personne venait de faire.
   */
  it("un exercice exclu de la file ne réapparaît pas par la porte de l'arbitrage", () => {
    // DEV-01 vient d'être fait en partiel : `recommander` laisse la compétence
    // dans la file mais avec `exercice: null` — son exercice n'est plus proposé.
    const retrouve = exercice("ex-dev01", "DEV-01", 20);
    const resultat = choisirActionUnifiee({
      ...entrees([retrouve], [recommandation("DEV-01", null)], 30),
    });

    // L'exercice rejeté ne doit jamais être proposé comme action isolée.
    expect(resultat?.kind).toBe("exercice");
    if (resultat?.kind !== "exercice") throw new Error("branche inattendue");
    expect(resultat.recommandations[0].exercice).toBeNull();
    expect(
      resultat.recommandations.some((r) => r.exercice?.id === "ex-dev01"),
    ).toBe(false);
  });

  it("l'exercice sanctionné par la file l'emporte quand le corpus contient aussi un exercice écarté", () => {
    const sanctionne = exercice("ex-dev02", "DEV-02", 15);
    const ecarte = exercice("ex-dev01", "DEV-01", 10);
    const resultat = choisirActionUnifiee({
      ...entrees(
        [sanctionne, ecarte],
        [recommandation("DEV-02", sanctionne), recommandation("DEV-01", null)],
        30,
      ),
    });

    if (resultat?.kind !== "exercice") throw new Error("branche inattendue");
    expect(resultat.recommandations[0].exercice?.id).toBe("ex-dev02");
    expect(
      resultat.recommandations.some((r) => r.exercice?.id === "ex-dev01"),
    ).toBe(false);
  });
});
