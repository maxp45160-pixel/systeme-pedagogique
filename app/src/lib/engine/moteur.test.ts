import { describe, expect, it } from "vitest";
import { computeSkillState, computeAllSkillStates } from "./skill-state";
import { calculerEtatGlobal } from "./progression";
import { recommander } from "./recommend";
import { evenementsRecents, photographies, type EvenementProgression } from "./historique";
import { autonomieDepuisIndices, qualiteDepuisNature } from "./preuve";
import {
  DOMAINE_PILOTE,
  ORDRE_DIAGNOSTIC,
  SKILLS,
  SKILLS_ACTIFS,
  SKILL_PAR_CODE,
} from "@/lib/domain/referentiel";
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
  return computeSkillState(STAT01, preuves, now);
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

describe("qualité dérivée — protocole d'évaluation §6", () => {
  it("un travail fortement guidé vaut une preuve faible, quel qu'en soit le type", () => {
    expect(qualiteDepuisNature("transfert", "A0")).toBe("faible");
    expect(qualiteDepuisNature("transfert", "A1")).toBe("faible");
    expect(qualiteDepuisNature("exercice", "A1")).toBe("faible");
  });

  it("un transfert ou un projet mené en autonomie vaut une preuve forte", () => {
    expect(qualiteDepuisNature("transfert", "A3")).toBe("forte");
    expect(qualiteDepuisNature("projet", "A4")).toBe("forte");
  });

  it("tout le reste vaut une preuve moyenne", () => {
    for (const t of ["exercice", "calcul", "code", "etude-de-cas", "explication"] as const) {
      expect(qualiteDepuisNature(t, "A3")).toBe("moyenne");
    }
  });

  it("est une fonction pure : mêmes entrées, même résultat", () => {
    expect(qualiteDepuisNature("calcul", "A2")).toBe(qualiteDepuisNature("calcul", "A2"));
  });
});

describe("autonomie observée — protocole d'évaluation §5", () => {
  it("aucun indice consulté vaut une résolution autonome", () => {
    expect(autonomieDepuisIndices(0, 3)).toBe("A3");
    expect(autonomieDepuisIndices(0, 0)).toBe("A3");
  });

  it("tous les indices consultés valent un accompagnement fort", () => {
    expect(autonomieDepuisIndices(3, 3)).toBe("A1");
    expect(autonomieDepuisIndices(4, 3)).toBe("A1");
  });

  it("un ou plusieurs indices sans les épuiser valent un accompagnement partiel", () => {
    expect(autonomieDepuisIndices(1, 3)).toBe("A2");
    expect(autonomieDepuisIndices(2, 3)).toBe("A2");
  });

  it("un exercice sans indice disponible ne peut pas dégrader l'autonomie", () => {
    // `total = 0` : la condition « tous les indices consultés » ne doit pas se
    // déclencher par un 0 >= 0 fortuit.
    expect(autonomieDepuisIndices(0, 0)).toBe("A3");
  });
});

describe("périmètre actif — ADR-018", () => {
  it("ne retient que les compétences du domaine pilote, sans toucher au référentiel", () => {
    expect(SKILLS_ACTIFS.length).toBeGreaterThan(0);
    expect(SKILLS_ACTIFS.every((s) => s.domaine === DOMAINE_PILOTE)).toBe(true);
    // Le référentiel complet reste intact : les compétences hors périmètre sont
    // écartées du calcul, pas supprimées.
    expect(SKILLS.length).toBeGreaterThan(SKILLS_ACTIFS.length);
    expect(SKILLS_ACTIFS.every((s) => SKILL_PAR_CODE.has(s.code))).toBe(true);
  });

  it("n'agrège aucun domaine hors périmètre — un domaine absent n'est pas un domaine à zéro", () => {
    const etats = computeAllSkillStates(SKILLS_ACTIFS, [], MAINTENANT);
    const global = calculerEtatGlobal(etats, MAINTENANT);
    expect(global.parDomaine).toHaveLength(1);
    expect(global.parDomaine[0].domaine).toBe(DOMAINE_PILOTE);
    // Et sans preuve, toujours pas de zéro fabriqué.
    expect(global.scoreGlobal).toBeNull();
  });

  it("une preuve hors périmètre n'entre dans aucun agrégat", () => {
    const horsPerimetre = [preuve({ skill: "STAT-01", jours: 1 })];
    const etats = computeAllSkillStates(SKILLS_ACTIFS, horsPerimetre, MAINTENANT);
    const global = calculerEtatGlobal(etats, MAINTENANT);
    expect(global.nombrePreuves).toBe(0);
    expect(global.scoreGlobal).toBeNull();
  });
});

describe("evenementsRecents — équivalence avec le rejeu naïf", () => {
  /**
   * Implémentation de référence : copie littérale de la boucle quadratique
   * d'origine. Elle rejoue le journal preuve par preuve sur le tableau complet.
   * Le test ne vérifie pas une propriété choisie après coup — il vérifie que la
   * version optimisée rend exactement ce que rendait celle qu'elle remplace.
   */
  function evenementsRecentsNaif(
    preuves: SkillEvidence[],
    limite: number,
    now: Date,
  ): EvenementProgression[] {
    const triees = [...preuves].sort((a, b) => a.date.localeCompare(b.date));
    const evenements: EvenementProgression[] = [];

    for (let i = 0; i < triees.length; i++) {
      const p = triees[i];
      const skill = SKILL_PAR_CODE.get(p.skillCode);
      if (!skill) continue;

      const avant = computeSkillState(skill, triees.slice(0, i), now);
      const apres = computeSkillState(skill, triees.slice(0, i + 1), now);

      evenements.push({
        date: p.date,
        skillCode: p.skillCode,
        intitule: skill.intitule,
        domaine: skill.domaine,
        niveauAvant: avant.niveau,
        niveauApres: apres.niveau,
        franchissement: avant.niveau !== apres.niveau,
        resultat: p.resultat,
        type: p.type,
        contexte: p.contexte,
        commentaire: p.commentaire,
      });
    }

    return evenements.reverse().slice(0, limite);
  }

  // Jeu volontairement piégeux : plusieurs compétences entrelacées, deux dates
  // strictement identiques (l'ordre relatif doit tenir au tri stable), un code
  // hors référentiel, et une preuve non recevable.
  const jeu: SkillEvidence[] = [
    ...Array.from({ length: 12 }, (_, k) =>
      preuve({ skill: "DEV-01", jours: 40 - k, contexte: `dev1-${k}` }),
    ),
    ...Array.from({ length: 9 }, (_, k) =>
      preuve({ skill: "DEV-02", jours: 38 - k * 2, contexte: `dev2-${k}` }),
    ),
    ...Array.from({ length: 7 }, (_, k) =>
      preuve({ skill: "DEV-03", jours: 30 - k * 3, resultat: "echec", contexte: `dev3-${k}` }),
    ),
    // Deux preuves à la même date, sur deux compétences différentes.
    preuve({ skill: "DEV-04", jours: 9, contexte: "meme-date-a" }),
    preuve({ skill: "DEV-05", jours: 9, contexte: "meme-date-b" }),
    // Deux preuves à la même date, sur la MÊME compétence.
    preuve({ skill: "DEV-06", jours: 4, contexte: "meme-date-c" }),
    preuve({ skill: "DEV-06", jours: 4, contexte: "meme-date-d" }),
    // Hors référentiel : ne doit apparaître nulle part, ni occuper de place.
    preuve({ skill: "CODE-INEXISTANT", jours: 2, contexte: "fantome" }),
    preuve({ skill: "STAT-01", jours: 6, contexte: "hors-perimetre-mais-connue" }),
  ];

  for (const limite of [1, 3, 8, 200]) {
    it(`rend exactement la liste du rejeu naïf (limite = ${limite})`, () => {
      expect(evenementsRecents(jeu, limite, MAINTENANT)).toEqual(
        evenementsRecentsNaif(jeu, limite, MAINTENANT),
      );
    });
  }

  it("une limite supérieure au nombre de preuves rend tout le journal recevable", () => {
    const tous = evenementsRecents(jeu, 10_000, MAINTENANT);
    // Toutes les preuves sauf celle dont le code n'existe pas au référentiel.
    expect(tous).toHaveLength(jeu.length - 1);
  });

  it("un code hors référentiel n'occupe pas de place dans la liste", () => {
    expect(evenementsRecents(jeu, 200, MAINTENANT).some((e) => e.skillCode === "CODE-INEXISTANT"))
      .toBe(false);
  });

  it("sort du plus récent au plus ancien", () => {
    const dates = evenementsRecents(jeu, 200, MAINTENANT).map((e) => e.date);
    expect([...dates].sort((a, b) => b.localeCompare(a))).toEqual(dates);
  });

  it("rend une liste vide sans preuve, et supporte une limite nulle", () => {
    expect(evenementsRecents([], 8, MAINTENANT)).toEqual([]);
    expect(evenementsRecents(jeu, 0, MAINTENANT)).toEqual([]);
  });
});

describe("photographies — même périmètre que l'état courant (ADR-020)", () => {
  const preuvesDev = [
    preuve({ skill: "DEV-01", jours: 25, contexte: "A" }),
    preuve({ skill: "DEV-01", jours: 12, contexte: "B" }),
    preuve({ skill: "DEV-02", jours: 5, contexte: "C" }),
  ];

  it("la dernière photographie coïncide avec l'état global courant", () => {
    // L'invariant qui était violé : `/progression` affichait `ctx.global.scoreGlobal`
    // (calculé sur SKILLS_ACTIFS) et, dans le même bloc, un delta issu de
    // `photographies(SKILLS, …)` — deux dénominateurs différents.
    const photos = photographies(SKILLS_ACTIFS, preuvesDev, 30, 3, MAINTENANT);
    const attendu = calculerEtatGlobal(
      computeAllSkillStates(SKILLS_ACTIFS, preuvesDev, MAINTENANT),
      MAINTENANT,
    );

    expect(photos.at(-1)!.scoreGlobal).toBe(attendu.scoreGlobal);
    expect(photos.at(-1)!.competencesEvaluees).toBe(attendu.competencesEvaluees);
    expect(photos.at(-1)!.nombrePreuves).toBe(preuvesDev.length);
  });

  it("le référentiel passé change l'échelle du score — d'où l'obligation d'employer le périmètre actif", () => {
    // Les compétences non mesurées comptent comme des zéros dans le score global
    // (écart connu, ADR-006) : élargir le référentiel dilue mécaniquement le score.
    const surActifs = photographies(SKILLS_ACTIFS, preuvesDev, 30, 3, MAINTENANT).at(-1)!;
    const surTout = photographies(SKILLS, preuvesDev, 30, 3, MAINTENANT).at(-1)!;

    expect(surActifs.scoreGlobal).not.toBeNull();
    expect(surTout.scoreGlobal).not.toBeNull();
    expect(surTout.scoreGlobal!).toBeLessThan(surActifs.scoreGlobal!);
  });
});

describe("score global — protocole d'évaluation §12", () => {
  it("vaut null sans aucune preuve, jamais 0", () => {
    const etats = computeAllSkillStates(SKILLS, [], MAINTENANT);
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
    const etats = computeAllSkillStates(SKILLS, preuves, MAINTENANT);
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
    const etats = computeAllSkillStates(SKILLS, [], MAINTENANT);
    const [premiere] = recommander(etats, [], []);
    expect(premiere.etat.skill.code).toBe(ORDRE_DIAGNOSTIC[0]);
    expect(premiere.raison).toContain("plan d'évaluation initiale");
  });

  it("la raison affichée est construite depuis des facteurs réels et non vide", () => {
    const etats = computeAllSkillStates(SKILLS, [], MAINTENANT);
    for (const r of recommander(etats, [], [], 5)) {
      expect(r.raison.startsWith("Recommandé car")).toBe(true);
      expect(r.facteurs.length).toBeGreaterThan(0);
    }
  });

  it("déclasse une compétence travaillée à l'instant au profit d'une autre", () => {
    const preuves = [
      preuve({ skill: "STAT-01", jours: 0 }),
      preuve({ skill: "STAT-01", jours: 0, contexte: "B" }),
    ];
    const etats = computeAllSkillStates(SKILLS, preuves, MAINTENANT);
    const [premiere] = recommander(etats, [], []);
    expect(premiere.etat.skill.code).not.toBe("STAT-01");
  });
});
