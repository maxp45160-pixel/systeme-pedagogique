import { describe, expect, it } from "vitest";
import { computeSkillState, computeAllSkillStates } from "./skill-state";
import { calculerEtatGlobal } from "./progression";
import { recommander } from "./recommend";
import { SKILLS, SKILL_PAR_CODE, ORDRE_DIAGNOSTIC } from "@/lib/domain/referentiel";
import type {
  Autonomie,
  Dimension,
  QualitePreuve,
  SkillEvidence,
} from "@/lib/domain/types";

/*
 * Ces tests vérifient que le moteur applique bien les protocoles du dossier
 * `data/00_instructions/`. Chaque cas cite la règle qu'il protège : ce sont
 * ces garanties, et non l'interface, qui rendent le suivi digne de confiance.
 */

const MAINTENANT = new Date("2026-07-24T12:00:00.000Z");
const JOUR = 86_400_000;

function ilYa(jours: number): string {
  return new Date(MAINTENANT.getTime() - jours * JOUR).toISOString();
}

let compteur = 0;

function preuve(options: {
  skill?: string;
  jours?: number;
  autonomie?: Autonomie;
  qualite?: QualitePreuve;
  resultat?: SkillEvidence["resultat"];
  contexte?: string;
  dims?: Partial<Record<Dimension, number>>;
  type?: SkillEvidence["type"];
  combinees?: string[];
}): SkillEvidence {
  return {
    id: `ev-${++compteur}`,
    skillCode: options.skill ?? "STAT-01",
    date: ilYa(options.jours ?? 1),
    type: options.type ?? "exercice",
    niveauPreuve: "A",
    autonomie: options.autonomie ?? "A3",
    qualite: options.qualite ?? "moyenne",
    resultat: options.resultat ?? "reussi",
    contexte: options.contexte ?? "Contexte A",
    dimensions: options.dims ?? { comprehension: 0.9, application: 0.85 },
    competencesCombinees: options.combinees,
    source: { kind: "exercice", ref: "ex-test" },
  };
}

const STAT01 = SKILL_PAR_CODE.get("STAT-01")!;

function etat(preuves: SkillEvidence[], now = MAINTENANT) {
  return computeSkillState(STAT01, preuves, [], now);
}

/* ------------------------------------------------------------------ */

describe("niveau — plafonds du protocole d'évaluation §4", () => {
  it("ne produit aucun niveau sans preuve directe (anti-hallucination §7)", () => {
    const e = etat([]);
    expect(e.niveau).toBeNull();
    expect(e.score).toBeNull();
    expect(e.robustesse).toBeNull();
    expect(e.confiance).toBe("nulle");
    // STAT-01 porte une hypothèse BUT QLIO : elle ne doit pas devenir un niveau.
    expect(e.statut).toBe("hypothese");
  });

  it("une réussite autonome isolée ne suffit pas pour le niveau 3 (instructions §11)", () => {
    const e = etat([preuve({ autonomie: "A3", dims: { comprehension: 0.9, application: 0.9 } })]);
    expect(e.niveau).toBeLessThan(3);
  });

  it("deux réussites autonomes concordantes atteignent le niveau 3", () => {
    const e = etat([
      preuve({ jours: 30, autonomie: "A3", dims: { comprehension: 0.9, application: 0.85 } }),
      preuve({ jours: 5, autonomie: "A3", dims: { comprehension: 0.9, application: 0.85 } }),
    ]);
    expect(e.niveau).toBe(3);
  });

  it("le niveau 4 exige deux contextes distincts, pas seulement du transfert déclaré", () => {
    const memeContexte = etat([
      preuve({ jours: 30, contexte: "Contexte A", dims: { comprehension: 0.9, application: 0.9, transfert: 0.8 } }),
      preuve({ jours: 5, contexte: "Contexte A", dims: { comprehension: 0.9, application: 0.9, transfert: 0.8 } }),
    ]);
    expect(memeContexte.niveau).toBe(3);

    const deuxContextes = etat([
      preuve({ jours: 30, contexte: "Contexte A", dims: { comprehension: 0.9, application: 0.9, transfert: 0.8 } }),
      preuve({ jours: 5, contexte: "Contexte B", dims: { comprehension: 0.9, application: 0.9, transfert: 0.8 } }),
    ]);
    expect(deuxContextes.niveau).toBe(4);
  });

  it("le niveau 5 exige une preuve intégrée combinant plusieurs compétences", () => {
    const sansIntegration = etat([
      preuve({ jours: 40, contexte: "A", dims: { comprehension: 1, application: 1, transfert: 0.9 } }),
      preuve({ jours: 20, contexte: "B", dims: { comprehension: 1, application: 1, transfert: 0.9 } }),
      preuve({ jours: 2, contexte: "C", dims: { comprehension: 1, application: 1, transfert: 0.9 } }),
    ]);
    expect(sansIntegration.niveau).toBe(4);

    const avecIntegration = etat([
      ...sansIntegration.preuves,
      preuve({
        jours: 1,
        contexte: "Projet",
        type: "projet",
        combinees: ["LOG-01", "RO-01"],
        dims: { comprehension: 1, application: 1, transfert: 0.9, integration: 0.8, justification: 0.8 },
      }),
    ]);
    expect(avecIntegration.niveau).toBe(5);
  });

  it("ignore les preuves de niveau C et D (anti-hallucination §2)", () => {
    const deduites: SkillEvidence[] = [
      { ...preuve({}), niveauPreuve: "C" },
      { ...preuve({}), niveauPreuve: "D" },
    ];
    expect(etat(deduites).niveau).toBeNull();
  });
});

describe("régression — protocole d'évaluation §9", () => {
  it("un échec isolé baisse la confiance, pas le niveau", () => {
    const base = [
      preuve({ jours: 40, contexte: "A" }),
      preuve({ jours: 20, contexte: "B" }),
    ];
    const avant = etat(base);
    const apres = etat([...base, preuve({ jours: 1, resultat: "echec", dims: { comprehension: 0.5, application: 0.2 } })]);

    expect(apres.niveau).toBe(avant.niveau);
    expect(apres.contradictions).toHaveLength(1);
    // La preuve contradictoire est conservée, jamais supprimée (§6).
    expect(apres.preuves).toHaveLength(3);
  });

  it("abaisse le niveau d'un palier après deux échecs autonomes consécutifs", () => {
    const base = [
      preuve({ jours: 60, contexte: "A" }),
      preuve({ jours: 45, contexte: "B" }),
    ];
    const avant = etat(base);
    const apres = etat([
      ...base,
      preuve({ jours: 10, resultat: "echec", autonomie: "A3", dims: { application: 0.2 } }),
      preuve({ jours: 2, resultat: "echec", autonomie: "A3", dims: { application: 0.2 } }),
    ]);

    expect(avant.niveau).not.toBeNull();
    expect(apres.niveau!).toBe(avant.niveau! - 1);
    expect(apres.explication.reserves.join(" ")).toContain("§9");
  });
});

describe("récence — protocole d'évaluation §7", () => {
  it("l'ancienneté dégrade la confiance et la robustesse, jamais le niveau acquis", () => {
    const recentes = [
      preuve({ jours: 20, contexte: "A" }),
      preuve({ jours: 5, contexte: "B" }),
    ];
    const anciennes = [
      preuve({ jours: 400, contexte: "A" }),
      preuve({ jours: 380, contexte: "B" }),
    ];

    const r = etat(recentes);
    const a = etat(anciennes);

    expect(a.niveau).toBe(r.niveau);
    expect(a.robustesse!).toBeLessThan(r.robustesse!);
    expect(a.explication.reserves.join(" ")).toContain("Dernière preuve il y a");
  });
});

describe("score global — protocole d'évaluation §12", () => {
  it("vaut null sans aucune preuve, jamais 0", () => {
    const etats = computeAllSkillStates(SKILLS, [], new Map(), MAINTENANT);
    const global = calculerEtatGlobal(etats, MAINTENANT);
    expect(global.scoreGlobal).toBeNull();
    expect(global.niveauMoyen).toBeNull();
    expect(global.confiance).toBe("nulle");
  });

  it("plafonne la confiance globale quand la couverture du référentiel est faible", () => {
    const preuves = [
      preuve({ skill: "STAT-01", jours: 30, contexte: "A" }),
      preuve({ skill: "STAT-01", jours: 20, contexte: "B" }),
      preuve({ skill: "STAT-01", jours: 10, contexte: "C" }),
      preuve({ skill: "STAT-01", jours: 2, contexte: "D" }),
    ];
    const etats = computeAllSkillStates(SKILLS, preuves, new Map(), MAINTENANT);
    const global = calculerEtatGlobal(etats, MAINTENANT);

    expect(global.confiance).toBe("faible");
    expect(global.reserves.join(" ")).toContain("plafonnée");
    // Une compétence maîtrisée sur l'ensemble du référentiel ne peut pas produire un score élevé.
    expect(global.scoreGlobal!).toBeLessThan(10);
  });

  it("le score n'excède jamais 5 et reste à une décimale", () => {
    const parfait = etat([
      preuve({ jours: 30, contexte: "A", qualite: "forte", autonomie: "A4", dims: { comprehension: 1, application: 1, transfert: 1, integration: 1, justification: 1 } }),
      preuve({ jours: 10, contexte: "B", qualite: "forte", autonomie: "A4", dims: { comprehension: 1, application: 1, transfert: 1, integration: 1, justification: 1 } }),
    ]);
    expect(parfait.score!).toBeLessThanOrEqual(5);
    expect(parfait.score).toBe(Math.round(parfait.score! * 10) / 10);
  });
});

/*
 * Le bloc « expérience — non-farmable par construction » (5 tests) a été retiré
 * le 28/07/2026 avec la mécanique d'XP elle-même (ADR-017). La garantie qu'il
 * protégeait — un XP ne peut exister sans preuve source — n'a plus d'objet :
 * ce n'est pas un garde-fou affaibli, c'est une mécanique supprimée.
 */

describe("recommandation — protocole d'évaluation §16", () => {
  it("au jour 0, recommande le premier diagnostic du plan d'évaluation initiale", () => {
    const etats = computeAllSkillStates(SKILLS, [], new Map(), MAINTENANT);
    const [premiere] = recommander(etats, [], [], []);
    expect(premiere.etat.skill.code).toBe(ORDRE_DIAGNOSTIC[0]);
    expect(premiere.raison).toContain("plan d'évaluation initiale");
  });

  it("la raison affichée est construite depuis des facteurs réels et non vide", () => {
    const etats = computeAllSkillStates(SKILLS, [], new Map(), MAINTENANT);
    for (const r of recommander(etats, [], [], [], 5)) {
      expect(r.raison.startsWith("Recommandé car")).toBe(true);
      expect(r.facteurs.length).toBeGreaterThan(0);
    }
  });

  it("déclasse une compétence travaillée à l'instant au profit d'une autre", () => {
    const preuves = [
      preuve({ skill: "STAT-01", jours: 0 }),
      preuve({ skill: "STAT-01", jours: 0, contexte: "B" }),
    ];
    const etats = computeAllSkillStates(SKILLS, preuves, new Map(), MAINTENANT);
    const [premiere] = recommander(etats, [], [], []);
    expect(premiere.etat.skill.code).not.toBe("STAT-01");
  });
});
