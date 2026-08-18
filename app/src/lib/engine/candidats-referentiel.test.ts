/**
 * Ce que ces tests protègent.
 *
 * Ce module prépare des propositions que personne n'a demandées. Le risque
 * n'est donc pas qu'il en produise trop peu — un lot vide ne coûte rien — mais
 * qu'il en produise de **plausibles et fausses** : une arête inventée entre dans
 * le graphe, pondère la recommandation, et personne ne saura plus d'où elle
 * vient. C'est exactement ce qu'ADR-056 a retiré du graphe des compétences.
 *
 * D'où la règle que ces tests vérifient d'abord : **sans ordre observable,
 * aucune arête**. Sur le référentiel réel du compte au 18/08/2026, le détecteur
 * en produit d'ailleurs zéro — deux paires sont co-mobilisées, aucune n'a
 * d'ordre. C'est le comportement voulu, pas une panne.
 */

import { describe, expect, it } from "vitest";

import type {
  Exercise,
  ExerciseAttempt,
  Referentiel,
  Skill,
  SkillEvidence,
  SkillState,
} from "@/lib/domain/types";
import {
  detecterAretes,
  detecterCandidats,
  detecterDormances,
  detecterRangements,
  detecterScissions,
  ECART_DIMENSION_SCISSION,
  type EntreesCandidats,
} from "./candidats-referentiel";

const NOW = new Date("2026-08-18T09:00:00.000Z");

function skill(code: string, options: Partial<Skill> = {}): Skill {
  return {
    code,
    domaine: "logistique",
    intitule: `Calculer ${code}`,
    palier: "fondamentaux",
    prerequis: [],
    importance: 0.5,
    ordre: 0,
    active: true,
    archive: false,
    origine: "tuteur",
    ...options,
  } as Skill;
}

function referentiel(skills: Skill[]): Referentiel {
  const actifs = skills.filter((s) => s.active && !s.archive);
  return {
    domaines: [],
    skills,
    actifs,
    parCode: new Map(skills.map((s) => [s.code, s])),
    codesActifs: new Set(actifs.map((s) => s.code)),
    domainesParId: new Map(),
  };
}

function exercice(id: string, competences: string[], options: Partial<Exercise> = {}): Exercise {
  return {
    id,
    titre: id,
    domaine: "logistique",
    type: "probleme",
    difficulte: 3,
    competences,
    dureeEstimeeMin: 30,
    enonce: "",
    indices: [],
    correction: "",
    criteres: [],
    origine: "tuteur",
    ...options,
  } as Exercise;
}

let compteur = 0;
function preuve(options: Partial<SkillEvidence> & { skillCode: string }): SkillEvidence {
  return {
    id: `ev-${++compteur}`,
    date: "2026-08-01T09:00:00.000Z",
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

function etat(code: string, preuves: SkillEvidence[]): SkillState {
  return { skill: skill(code), preuves } as unknown as SkillState;
}

function entrees(partiel: Partial<EntreesCandidats> = {}): EntreesCandidats {
  return {
    referentiel: referentiel([]),
    etats: [],
    preuves: [],
    exercices: [],
    tentatives: [],
    seances: [],
    now: NOW,
    ...partiel,
  };
}

/* ------------------------------------------------------------------ */

describe("detecterAretes", () => {
  const deux = referentiel([skill("LOG-01"), skill("LOG-02")]);

  it("n'invente AUCUNE arête sans ordre observable", () => {
    // Le cas réel : DEV-03 et DEV-04 sont co-mobilisées cinq fois, et aucune
    // n'a de preuve réussie antérieure à l'autre. Le détecteur se tait.
    const candidats = detecterAretes(
      entrees({
        referentiel: deux,
        exercices: [exercice("ex-1", ["LOG-01", "LOG-02"]), exercice("ex-2", ["LOG-01", "LOG-02"])],
        preuves: [preuve({ skillCode: "LOG-01", resultat: "echec" })],
      }),
    );
    expect(candidats).toEqual([]);
  });

  it("n'invente aucune arête sur une seule co-mobilisation", () => {
    const candidats = detecterAretes(
      entrees({
        referentiel: deux,
        exercices: [exercice("ex-1", ["LOG-01", "LOG-02"])],
        preuves: [
          preuve({ skillCode: "LOG-01", date: "2026-07-01T09:00:00.000Z" }),
          preuve({ skillCode: "LOG-02", date: "2026-08-01T09:00:00.000Z" }),
        ],
      }),
    );
    expect(candidats).toEqual([]);
  });

  it("oriente l'arête vers ce qui a été démontré en premier", () => {
    const candidats = detecterAretes(
      entrees({
        referentiel: deux,
        exercices: [exercice("ex-1", ["LOG-01", "LOG-02"]), exercice("ex-2", ["LOG-01", "LOG-02"])],
        preuves: [
          preuve({ skillCode: "LOG-01", date: "2026-07-01T09:00:00.000Z", resultat: "reussi" }),
          preuve({ skillCode: "LOG-02", date: "2026-08-01T09:00:00.000Z" }),
        ],
      }),
    );
    expect(candidats).toHaveLength(1);
    expect(candidats[0].amont).toBe("LOG-01");
    expect(candidats[0].aval).toBe("LOG-02");
    expect(candidats[0].motifs.join(" ")).toContain("Co-mobilisées 2 fois");
  });

  it("ne repropose pas une arête déjà déclarée, dans un sens ni dans l'autre", () => {
    const declaree = referentiel([skill("LOG-01"), skill("LOG-02", { prerequis: ["LOG-01"] })]);
    const communs = {
      exercices: [exercice("ex-1", ["LOG-01", "LOG-02"]), exercice("ex-2", ["LOG-01", "LOG-02"])],
      preuves: [
        preuve({ skillCode: "LOG-01", date: "2026-07-01T09:00:00.000Z" }),
        preuve({ skillCode: "LOG-02", date: "2026-08-01T09:00:00.000Z" }),
      ],
    };
    expect(detecterAretes(entrees({ referentiel: declaree, ...communs }))).toEqual([]);

    const inverse = referentiel([skill("LOG-01", { prerequis: ["LOG-02"] }), skill("LOG-02")]);
    expect(detecterAretes(entrees({ referentiel: inverse, ...communs }))).toEqual([]);
  });

  it("compte aussi les co-mobilisations de séance, pas seulement d'exercice", () => {
    const candidats = detecterAretes(
      entrees({
        referentiel: deux,
        seances: [
          { date: "2026-07-01", skillCodes: ["LOG-01", "LOG-02"] },
          { date: "2026-07-05", skillCodes: ["LOG-01", "LOG-02"] },
        ],
        preuves: [
          preuve({ skillCode: "LOG-01", date: "2026-07-01T09:00:00.000Z" }),
          preuve({ skillCode: "LOG-02", date: "2026-08-01T09:00:00.000Z" }),
        ],
      }),
    );
    expect(candidats).toHaveLength(1);
  });
});

describe("detecterAretes — la source « rédaction » (ADR-086)", () => {
  function domaine(codes: [string, string, number][]): EntreesCandidats {
    return entrees({
      referentiel: referentiel(
        codes.map(([code, palier, ordre]) =>
          skill(code, { palier: palier as Skill["palier"], ordre }),
        ),
      ),
    });
  }

  it("relie la dernière d'un palier à la première du suivant", () => {
    const candidats = detecterAretes(
      domaine([
        ["LOG-01", "fondamentaux", 0],
        ["LOG-02", "fondamentaux", 1],
        ["LOG-03", "intermediaire", 2],
      ]),
    );
    expect(candidats).toHaveLength(1);
    expect(candidats[0].source).toBe("redaction");
    expect(candidats[0].amont).toBe("LOG-02");
    expect(candidats[0].aval).toBe("LOG-03");
    expect(candidats[0].motifs.join(" ")).toContain("FAIBLE");
  });

  it("ne CHAÎNE PAS les compétences d'un même palier — c'est ce qu'ADR-056 a retiré", () => {
    // Un domaine de treize compétences d'un seul palier produirait douze
    // fausses arêtes si l'adjacence par `ordre` suffisait. Elle ne suffit pas.
    const candidats = detecterAretes(
      domaine([
        ["LOG-01", "fondamentaux", 0],
        ["LOG-02", "fondamentaux", 1],
        ["LOG-03", "fondamentaux", 2],
        ["LOG-04", "fondamentaux", 3],
      ]),
    );
    expect(candidats).toEqual([]);
  });

  it("produit au plus deux arêtes par domaine, quel que soit le nombre de compétences", () => {
    const candidats = detecterAretes(
      domaine([
        ["LOG-01", "fondamentaux", 0],
        ["LOG-02", "fondamentaux", 1],
        ["LOG-03", "intermediaire", 2],
        ["LOG-04", "intermediaire", 3],
        ["LOG-05", "avance", 4],
        ["LOG-06", "avance", 5],
      ]),
    );
    expect(candidats).toHaveLength(2);
  });

  it("passe derrière une arête d'usage : le signal fort d'abord", () => {
    const base = domaine([
      ["LOG-01", "fondamentaux", 0],
      ["LOG-02", "fondamentaux", 1],
      ["LOG-03", "intermediaire", 2],
    ]);
    const candidats = detecterAretes({
      ...base,
      exercices: [
        exercice("ex-1", ["LOG-01", "LOG-02"]),
        exercice("ex-2", ["LOG-01", "LOG-02"]),
      ],
      preuves: [
        preuve({ skillCode: "LOG-01", date: "2026-07-01T09:00:00.000Z" }),
        preuve({ skillCode: "LOG-02", date: "2026-08-01T09:00:00.000Z" }),
      ],
    });
    expect(candidats[0].source).toBe("usage");
    expect(candidats.at(-1)?.source).toBe("redaction");
  });

  it("ne repropose pas une arête déjà déclarée", () => {
    const declaree = entrees({
      referentiel: referentiel([
        skill("LOG-02", { palier: "fondamentaux", ordre: 1 }),
        skill("LOG-03", { palier: "intermediaire", ordre: 2, prerequis: ["LOG-02"] }),
      ]),
    });
    expect(detecterAretes(declaree)).toEqual([]);
  });
});

describe("detecterScissions", () => {
  const famille = (cle: string) => ({ cle, libelle: cle, derivee: true });

  it("repère une compétence dont une dimension diverge selon la famille", () => {
    const preuves = [
      preuve({ skillCode: "LOG-01", familleSituation: famille("f:calcul"), dimensions: { application: 0.9 } }),
      preuve({ skillCode: "LOG-01", familleSituation: famille("f:calcul"), dimensions: { application: 0.9 } }),
      preuve({ skillCode: "LOG-01", familleSituation: famille("f:etude"), dimensions: { application: 0.2 } }),
      preuve({ skillCode: "LOG-01", familleSituation: famille("f:etude"), dimensions: { application: 0.2 } }),
    ];
    const candidats = detecterScissions(entrees({ etats: [etat("LOG-01", preuves)] }));
    expect(candidats).toHaveLength(1);
    expect(candidats[0].motifs[0]).toContain("application");
  });

  it("ne dit rien sous le seuil d'écart", () => {
    const juste = ECART_DIMENSION_SCISSION - 0.05;
    const preuves = [
      preuve({ skillCode: "LOG-01", familleSituation: famille("f:a"), dimensions: { application: 0.5 + juste } }),
      preuve({ skillCode: "LOG-01", familleSituation: famille("f:a"), dimensions: { application: 0.5 + juste } }),
      preuve({ skillCode: "LOG-01", familleSituation: famille("f:b"), dimensions: { application: 0.5 } }),
      preuve({ skillCode: "LOG-01", familleSituation: famille("f:b"), dimensions: { application: 0.5 } }),
    ];
    expect(detecterScissions(entrees({ etats: [etat("LOG-01", preuves)] }))).toEqual([]);
  });

  it("ignore les preuves dont la famille est un repli sur le libellé", () => {
    // Un libellé libre est presque un identifiant : il divergerait toujours, et
    // toutes les compétences seraient candidates à la scission (ADR-083).
    const preuves = [
      preuve({ skillCode: "LOG-01", dimensions: { application: 0.9 }, contexte: "A" }),
      preuve({ skillCode: "LOG-01", dimensions: { application: 0.9 }, contexte: "A" }),
      preuve({ skillCode: "LOG-01", dimensions: { application: 0.1 }, contexte: "B" }),
      preuve({ skillCode: "LOG-01", dimensions: { application: 0.1 }, contexte: "B" }),
    ];
    expect(detecterScissions(entrees({ etats: [etat("LOG-01", preuves)] }))).toEqual([]);
  });

  it("repère une compétence dont toutes les tentatives dépassent l'heure", () => {
    // Le protocole §2e demande une compétence prouvable en 20 à 60 minutes.
    const tentatives = [
      { id: "t-1", exerciseId: "ex-1", statut: "terminee", dureeMin: 95 },
      { id: "t-2", exerciseId: "ex-1", statut: "terminee", dureeMin: 80 },
    ] as unknown as ExerciseAttempt[];
    const candidats = detecterScissions(
      entrees({
        etats: [etat("LOG-01", [])],
        exercices: [exercice("ex-1", ["LOG-01"])],
        tentatives,
      }),
    );
    expect(candidats).toHaveLength(1);
    expect(candidats[0].motifs[0]).toContain("60 min");
  });

  it("ne dit rien si une seule tentative dépasse l'heure", () => {
    const tentatives = [
      { id: "t-1", exerciseId: "ex-1", statut: "terminee", dureeMin: 95 },
      { id: "t-2", exerciseId: "ex-1", statut: "terminee", dureeMin: 30 },
    ] as unknown as ExerciseAttempt[];
    expect(
      detecterScissions(
        entrees({
          etats: [etat("LOG-01", [])],
          exercices: [exercice("ex-1", ["LOG-01"])],
          tentatives,
        }),
      ),
    ).toEqual([]);
  });
});

describe("detecterDormances", () => {
  it("repère une compétence sans preuve, sans exercice et sans arête", () => {
    const candidats = detecterDormances(
      entrees({ referentiel: referentiel([skill("LLM-01")]) }),
    );
    expect(candidats).toHaveLength(1);
    expect(candidats[0].code).toBe("LLM-01");
  });

  it("épargne une compétence rattachée à quoi que ce soit", () => {
    const cas: Partial<EntreesCandidats>[] = [
      { preuves: [preuve({ skillCode: "LLM-01" })] },
      { exercices: [exercice("ex-1", ["LLM-01"])] },
      { referentiel: referentiel([skill("LLM-01"), skill("LLM-02", { prerequis: ["LLM-01"] })]) },
    ];
    for (const partiel of cas) {
      const base = entrees({ referentiel: referentiel([skill("LLM-01")]), ...partiel });
      expect(detecterDormances(base).some((c) => c.code === "LLM-01")).toBe(false);
    }
  });

  it("épargne une compétence archivée — elle est déjà retirée", () => {
    const archivee = referentiel([skill("LLM-01", { archive: true, active: false })]);
    expect(detecterDormances(entrees({ referentiel: archivee }))).toEqual([]);
  });
});

describe("detecterRangements", () => {
  it("repère une compétence dont TOUTES les preuves viennent d'un autre domaine", () => {
    const candidats = detecterRangements(
      entrees({
        referentiel: referentiel([skill("LOG-01", { domaine: "logistique" })]),
        exercices: [exercice("ex-1", ["LOG-01"], { domaine: "statistiques" })],
        preuves: [
          preuve({ skillCode: "LOG-01", source: { kind: "exercice", ref: "ex-1" } }),
          preuve({ skillCode: "LOG-01", source: { kind: "exercice", ref: "ex-1" } }),
        ],
      }),
    );
    expect(candidats).toHaveLength(1);
    expect(candidats[0].domaineObserve).toBe("statistiques");
  });

  it("se tait sur une simple majorité — ce serait le stock d'exercices, pas le rangement", () => {
    const candidats = detecterRangements(
      entrees({
        referentiel: referentiel([skill("LOG-01", { domaine: "logistique" })]),
        exercices: [
          exercice("ex-1", ["LOG-01"], { domaine: "statistiques" }),
          exercice("ex-2", ["LOG-01"], { domaine: "logistique" }),
        ],
        preuves: [
          preuve({ skillCode: "LOG-01", source: { kind: "exercice", ref: "ex-1" } }),
          preuve({ skillCode: "LOG-01", source: { kind: "exercice", ref: "ex-1" } }),
          preuve({ skillCode: "LOG-01", source: { kind: "exercice", ref: "ex-2" } }),
        ],
      }),
    );
    expect(candidats).toEqual([]);
  });

  it("se tait quand le rattachement secondaire est déjà déclaré (ADR-081)", () => {
    const candidats = detecterRangements(
      entrees({
        referentiel: referentiel([
          skill("LOG-01", { domaine: "logistique", domainesSecondaires: ["statistiques"] }),
        ]),
        exercices: [exercice("ex-1", ["LOG-01"], { domaine: "statistiques" })],
        preuves: [
          preuve({ skillCode: "LOG-01", source: { kind: "exercice", ref: "ex-1" } }),
          preuve({ skillCode: "LOG-01", source: { kind: "exercice", ref: "ex-1" } }),
        ],
      }),
    );
    expect(candidats).toEqual([]);
  });
});

describe("detecterCandidats", () => {
  it("rend un lot vide sur un référentiel vide, sans échouer", () => {
    const lot = detecterCandidats(entrees());
    expect(lot.total).toBe(0);
  });
});
