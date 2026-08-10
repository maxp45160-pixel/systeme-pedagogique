import { describe, expect, it } from "vitest";
import { computeSkillState, computeAllSkillStates } from "./skill-state";
import { calculerEtatGlobal } from "./progression";
import { recommander } from "./recommend";
import {
  activiteSurFenetre,
  calculerActivite,
  evenementsRecents,
  photographies,
  type EvenementProgression,
} from "./historique";
import { autonomieDepuisIndices, autonomieObservee, qualiteDepuisNature } from "./preuve";
import {
  DOMAINES_TEST,
  REFERENTIEL_TEST,
  SKILLS_TEST,
  referentielDe,
  skillDeTest,
} from "@/lib/domain/referentiel.fixture";
import type {
  Autonomie,
  Difficulte,
  Dimension,
  Exercise,
  ExerciseAttempt,
  LearningSession,
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

const SKILLS = SKILLS_TEST;
const SKILLS_ACTIFS = REFERENTIEL_TEST.actifs;
const SKILL_PAR_CODE = REFERENTIEL_TEST.parCode;
const DOMAINE_PILOTE = "developpement";

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

/*
 * ADR-033 — fermeture d'ADR-008.
 *
 * `indicesUtilises` ne comptait que les indices INTERNES. Deux preuves de
 * production portaient « A3 — résolution autonome » alors que leur commentaire
 * disait « j'ai eu besoin de l'aide de Claude » et « j'ai regardé sur
 * internet ». La personne était honnête ; l'instrument était sourd. P8 était le
 * dernier principe en défaut.
 */
describe("aide extérieure — l'autonomie cesse d'ignorer ce qui vient du dehors", () => {
  it("sans aide déclarée, rien ne change : le barème des indices fait seul foi", () => {
    // Non-régression : tout ce qui a été mesuré jusqu'ici l'a été sans aide
    // déclarée. Ce chantier ne doit pas rétro-déplacer un niveau existant.
    expect(autonomieObservee(0, 3, "aucune")).toBe("A3");
    expect(autonomieObservee(1, 3, "aucune")).toBe("A2");
    expect(autonomieObservee(3, 3, "aucune")).toBe("A1");
  });

  it("l'aide extérieure plafonne l'autonomie", () => {
    expect(autonomieObservee(0, 3, "documentation")).toBe("A2");
    expect(autonomieObservee(0, 3, "assistant-ia")).toBe("A1");
    expect(autonomieObservee(0, 3, "correction")).toBe("A0");
  });

  it("c'est un minimum, pas un remplacement : un plafond ne RELÈVE jamais", () => {
    // Indices épuisés (A1) ET documentation consultée (plafond A2) : le
    // résultat doit rester A1. Prendre le plafond effacerait la mesure la plus
    // défavorable, donc la plus informative.
    expect(autonomieObservee(3, 3, "documentation")).toBe("A1");
    expect(autonomieObservee(1, 3, "correction")).toBe("A0");
  });

  it("le cas exact d'ADR-008 : A3 devient A1", () => {
    // RO-01 et STAT-02 — zéro indice interne, aide externe réelle.
    expect(autonomieDepuisIndices(0, 0)).toBe("A3");
    expect(autonomieObservee(0, 0, "assistant-ia")).toBe("A1");
  });
});

describe("périmètre actif — par compte depuis ADR-026", () => {
  it("ne retient que les compétences actives, sans toucher au référentiel", () => {
    expect(SKILLS_ACTIFS.length).toBeGreaterThan(0);
    expect(SKILLS_ACTIFS.every((s) => s.active && !s.archive)).toBe(true);
    // Le référentiel complet reste intact : les compétences hors périmètre sont
    // écartées du calcul, pas supprimées.
    expect(SKILLS.length).toBeGreaterThan(SKILLS_ACTIFS.length);
    expect(SKILLS_ACTIFS.every((s) => SKILL_PAR_CODE.has(s.code))).toBe(true);
  });

  it("`parCode` couvre aussi les compétences hors périmètre — sinon leurs preuves perdraient leur intitulé", () => {
    // La garantie que porte `historique.ts` : une preuve ancienne sur une
    // compétence désactivée doit rester lisible (P4).
    expect(SKILL_PAR_CODE.has("STAT-01")).toBe(true);
    expect(REFERENTIEL_TEST.codesActifs.has("STAT-01")).toBe(false);
  });

  it("une compétence archivée sort du périmètre même si elle est active", () => {
    // Les deux drapeaux sont indépendants : `archive` prime, parce qu'il acte
    // qu'une compétence porte des preuves et ne peut plus être supprimée.
    const r = referentielDe([
      skillDeTest("DEV-01", "developpement", "fondamentaux", 1, 0, [], {
        active: true,
        archive: true,
      }),
    ]);
    expect(r.skills).toHaveLength(1);
    expect(r.actifs).toHaveLength(0);
    expect(r.parCode.has("DEV-01")).toBe(true);
  });

  it("n'agrège aucun domaine hors périmètre — un domaine absent n'est pas un domaine à zéro", () => {
    const etats = computeAllSkillStates(SKILLS_ACTIFS, [], MAINTENANT);
    const global = calculerEtatGlobal(etats, MAINTENANT, DOMAINES_TEST);
    expect(global.parDomaine).toHaveLength(1);
    expect(global.parDomaine[0].domaine).toBe(DOMAINE_PILOTE);
    // Et sans preuve, toujours pas de zéro fabriqué.
    expect(global.scoreGlobal).toBeNull();
  });

  it("une preuve hors périmètre n'entre dans aucun agrégat", () => {
    const horsPerimetre = [preuve({ skill: "STAT-01", jours: 1 })];
    const etats = computeAllSkillStates(SKILLS_ACTIFS, horsPerimetre, MAINTENANT);
    const global = calculerEtatGlobal(etats, MAINTENANT, DOMAINES_TEST);
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
      expect(evenementsRecents(jeu, SKILL_PAR_CODE, limite, MAINTENANT)).toEqual(
        evenementsRecentsNaif(jeu, limite, MAINTENANT),
      );
    });
  }

  it("une limite supérieure au nombre de preuves rend tout le journal recevable", () => {
    const tous = evenementsRecents(jeu, SKILL_PAR_CODE, 10_000, MAINTENANT);
    // Toutes les preuves sauf celle dont le code n'existe pas au référentiel.
    expect(tous).toHaveLength(jeu.length - 1);
  });

  it("un code hors référentiel n'occupe pas de place dans la liste", () => {
    expect(
      evenementsRecents(jeu, SKILL_PAR_CODE, 200, MAINTENANT).some(
        (e) => e.skillCode === "CODE-INEXISTANT",
      ),
    ).toBe(false);
  });

  it("une compétence hors périmètre garde son intitulé dans l'historique", () => {
    // `parCode` et non `codesActifs` : c'est toute la raison pour laquelle
    // `evenementsRecents` reçoit la carte complète (P4 — une faiblesse ne
    // disparaît pas, et son historique reste lisible).
    const evenements = evenementsRecents(jeu, SKILL_PAR_CODE, 200, MAINTENANT);
    const horsPerimetre = evenements.find((e) => e.skillCode === "STAT-01");
    expect(horsPerimetre).toBeDefined();
    expect(horsPerimetre!.intitule).toBe(SKILL_PAR_CODE.get("STAT-01")!.intitule);
  });

  it("sort du plus récent au plus ancien", () => {
    const dates = evenementsRecents(jeu, SKILL_PAR_CODE, 200, MAINTENANT).map((e) => e.date);
    expect([...dates].sort((a, b) => b.localeCompare(a))).toEqual(dates);
  });

  it("rend une liste vide sans preuve, et supporte une limite nulle", () => {
    expect(evenementsRecents([], SKILL_PAR_CODE, 8, MAINTENANT)).toEqual([]);
    expect(evenementsRecents(jeu, SKILL_PAR_CODE, 0, MAINTENANT)).toEqual([]);
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
    // (calculé sur le périmètre actif) et, dans le même bloc, un delta issu de
    // `photographies(SKILLS, …)` — deux dénominateurs différents.
    const photos = photographies(SKILLS_ACTIFS, preuvesDev, 30, 3, MAINTENANT, DOMAINES_TEST);
    const attendu = calculerEtatGlobal(
      computeAllSkillStates(SKILLS_ACTIFS, preuvesDev, MAINTENANT),
      MAINTENANT,
      DOMAINES_TEST,
    );

    expect(photos.at(-1)!.scoreGlobal).toBe(attendu.scoreGlobal);
    expect(photos.at(-1)!.competencesEvaluees).toBe(attendu.competencesEvaluees);
    expect(photos.at(-1)!.nombrePreuves).toBe(preuvesDev.length);
  });

  it("élargir le référentiel ne change PAS le score — ADR-006", () => {
    // Garantie inversée le 31/07/2026. Avant, ce test vérifiait le contraire :
    // ajouter des compétences non mesurées faisait chuter le score, parce
    // qu'elles entraient au dénominateur pour leur importance pleine et au
    // numérateur pour rien. Le score était donc anti-corrélé à l'ambition.
    //
    // Depuis ADR-026 le référentiel est extensible par l'utilisateur : ce
    // défaut aurait cessé d'être une verrue documentée pour devenir une
    // incitation structurelle à ne pas étendre son référentiel.
    const surActifs = photographies(
      SKILLS_ACTIFS,
      preuvesDev,
      30,
      3,
      MAINTENANT,
      DOMAINES_TEST,
    ).at(-1)!;
    const surTout = photographies(SKILLS, preuvesDev, 30, 3, MAINTENANT, DOMAINES_TEST).at(-1)!;

    expect(surActifs.scoreGlobal).not.toBeNull();
    expect(surTout.scoreGlobal).toBe(surActifs.scoreGlobal);

    // Ce qui change, et qui doit changer : la couverture. C'est elle qui porte
    // désormais l'information « il reste des compétences non mesurées ».
    const globalActifs = calculerEtatGlobal(
      computeAllSkillStates(SKILLS_ACTIFS, preuvesDev, MAINTENANT),
      MAINTENANT,
      DOMAINES_TEST,
    );
    const globalTout = calculerEtatGlobal(
      computeAllSkillStates(SKILLS, preuvesDev, MAINTENANT),
      MAINTENANT,
      DOMAINES_TEST,
    );
    expect(globalTout.competencesEvaluees).toBe(globalActifs.competencesEvaluees);
    expect(globalTout.competencesTotal).toBeGreaterThan(globalActifs.competencesTotal);
  });
});

describe("score global — protocole d'évaluation §12 et ADR-006", () => {
  it("vaut null sans aucune preuve, jamais 0", () => {
    const etats = computeAllSkillStates(SKILLS, [], MAINTENANT);
    const global = calculerEtatGlobal(etats, MAINTENANT, DOMAINES_TEST);
    expect(global.scoreGlobal).toBeNull();
    expect(global.niveauMoyen).toBeNull();
    expect(global.confiance).toBe("nulle");
  });

  it("vaut null sur un référentiel vide — un compte neuf n'a pas un score de 0", () => {
    // Cas normal d'un compte qui n'a pas encore construit son référentiel
    // (ADR-026), et non un cas dégradé.
    const global = calculerEtatGlobal([], MAINTENANT, []);
    expect(global.scoreGlobal).toBeNull();
    expect(global.niveauMoyen).toBeNull();
    expect(global.competencesTotal).toBe(0);
    expect(global.parDomaine).toEqual([]);
  });

  it("une couverture faible plafonne la confiance sans écraser le score", () => {
    const preuves = [
      preuve({ skill: "STAT-01", jours: 30, contexte: "A" }),
      preuve({ skill: "STAT-01", jours: 20, contexte: "B" }),
      preuve({ skill: "STAT-01", jours: 10, contexte: "C" }),
      preuve({ skill: "STAT-01", jours: 2, contexte: "D" }),
    ];
    const etats = computeAllSkillStates(SKILLS, preuves, MAINTENANT);
    const global = calculerEtatGlobal(etats, MAINTENANT, DOMAINES_TEST);

    // Le doute sur une couverture partielle s'exprime par la confiance et par
    // la couverture, PAS en abaissant le niveau mesuré (ADR-006, P2).
    expect(global.confiance).toBe("faible");
    expect(global.reserves.join(" ")).toContain("plafonnée");
    expect(global.competencesEvaluees).toBe(1);
    expect(global.competencesTotal).toBe(SKILLS.length);

    // Une compétence réellement maîtrisée produit un score élevé : c'est ce que
    // la mesure dit. Les six compétences jamais testées ne le contredisent pas,
    // elles ne disent simplement rien.
    expect(global.scoreGlobal!).toBeGreaterThan(30);
    // Et la réserve doit annoncer la portée du nombre affiché (P3).
    expect(global.reserves.join(" ")).toContain("compétence(s) mesurée(s)");
  });

  it("ajouter une compétence non mesurée ne déplace pas le score", () => {
    const preuves = [
      preuve({ skill: "DEV-01", jours: 20, contexte: "A" }),
      preuve({ skill: "DEV-01", jours: 5, contexte: "B" }),
    ];
    const avant = calculerEtatGlobal(
      computeAllSkillStates([SKILLS[0]], preuves, MAINTENANT),
      MAINTENANT,
      DOMAINES_TEST,
    );
    const apres = calculerEtatGlobal(
      computeAllSkillStates(
        [SKILLS[0], skillDeTest("DEV-99", "developpement", "avance", 1, 99)],
        preuves,
        MAINTENANT,
      ),
      MAINTENANT,
      DOMAINES_TEST,
    );

    expect(apres.scoreGlobal).toBe(avant.scoreGlobal);
    expect(apres.competencesTotal).toBe(avant.competencesTotal + 1);
    expect(apres.competencesEvaluees).toBe(avant.competencesEvaluees);
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
  it("au jour 0, commence par les fondamentaux — ordre dérivé, plus aucune liste en dur", () => {
    // Jusqu'au 31/07/2026 cet ordre venait d'`ORDRE_DIAGNOSTIC`, onze codes
    // écrits à la main. Un référentiel construit par l'utilisateur (ADR-026)
    // ne peut pas porter de liste écrite d'avance : le rang se dérive du
    // palier, puis du rang déclaré dans le domaine.
    const etats = computeAllSkillStates(SKILLS, [], MAINTENANT);
    const classement = recommander(etats, [], [], 10);

    expect(classement[0].etat.skill.palier).toBe("fondamentaux");
    expect(classement[0].raison).toContain("fondamentaux");

    // Aucun palier avancé ne peut précéder un fondamental jamais évalué.
    const rangDuPremierIntermediaire = classement.findIndex(
      (r) => r.etat.skill.palier !== "fondamentaux",
    );
    const fondamentaux = classement.filter((r) => r.etat.skill.palier === "fondamentaux").length;
    expect(rangDuPremierIntermediaire).toBe(fondamentaux);
  });

  it("à palier égal, le rang déclaré départage — et il est stable", () => {
    const etats = computeAllSkillStates(SKILLS, [], MAINTENANT);
    const codes = recommander(etats, [], [], 10)
      .filter((r) => r.etat.skill.palier === "fondamentaux" && r.etat.skill.domaine === "developpement")
      .map((r) => r.etat.skill.code);
    expect(codes).toEqual(["DEV-01", "DEV-02", "DEV-03"]);
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

  /*
   * Le test qui empêche le défaut (a) de revenir : `now` passé en paramètre à
   * `recommander` doit gouverner le facteur « Due pour révision ».
   *
   * Avant le 02/08/2026, `recommander` appelait `estDue(etat)` sans `now` : il
   * retombait sur `new Date()` alors que tout le reste du moteur recevait `now`.
   * Le badge du tableau de bord (calculé avec `ctx.now`) et le score (calculé
   * avec une autre horloge) pouvaient diverger.
   *
   * Pour que `now` soit effectif, `estDue` doit recompter les jours écoulés
   * depuis `dernierePreuve` plutôt que lire `joursDepuisDernierePreuve` (qui est
   * figé à la création de l'état). On force donc `joursDepuisDernierePreuve` à
   * `null` : c'est le chemin où le paramètre `now` change effectivement le
   * résultat.
   */
  it("`now` passé en paramètre gouverne le facteur « Due pour révision »", () => {
    // DEV-01 avec une preuve vieille de 5 jours par rapport à MAINTENANT.
    // Intervalle = 1 (niveau 2, robustesse faible, confiance faible).
    const preuves = [preuve({ skill: "DEV-01", jours: 5 })];
    const etats = computeAllSkillStates(SKILLS, preuves, MAINTENANT);
    // Force `joursDepuisDernierePreuve` à null : `estDue` recompte avec `now`.
    const etatsSansJours = etats.map((e) => ({
      ...e,
      joursDepuisDernierePreuve: null,
    }));

    // Avec `now` = MAINTENANT (5 jours après la preuve) : due.
    const rMaintenant = recommander(etatsSansJours, [], [], 10, undefined, MAINTENANT);
    const rDev01 = rMaintenant.find((r) => r.etat.skill.code === "DEV-01")!;
    const facteurDue = rDev01.facteurs.find((f) => f.libelle === "Due pour révision");
    expect(facteurDue).toBeDefined();

    // Avec `now` = jour de la preuve (0 jour écoulé) : pas due.
    const jourPreuve = new Date(MAINTENANT.getTime() - 5 * JOUR);
    const rJourPreuve = recommander(etatsSansJours, [], [], 10, undefined, jourPreuve);
    const rDev01PasDue = rJourPreuve.find((r) => r.etat.skill.code === "DEV-01")!;
    const facteurPasDue = rDev01PasDue.facteurs.find((f) => f.libelle === "Due pour révision");
    expect(facteurPasDue).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ */

/*
 * Actionnabilité — lot 5, 10/08/2026.
 *
 * Mesuré le 10/08/2026 : 11 compétences actives sur 77 ont un exercice. Le
 * classement seul poussait systématiquement vers le non-couvert (« Jamais
 * évaluée » vaut jusqu'à +70), qui n'a pourtant rien à servir — la carte
 * « Prochaine action » retombait sur « Générer un exercice » plutôt que
 * « Commencer », pour la quasi-totalité des compétences.
 *
 * `BONUS_ACTIONNABLE` (+10) départage un quasi-ex-aequo. Ce n'est PAS une
 * pénalité sur le non-couvert — l'absence d'exercice ne retire rien nulle
 * part ailleurs — et le second test ci-dessous vérifie que le bonus reste
 * trop modeste pour renverser un écart réel.
 */
describe("actionnabilité — un exercice disponible départage, sans jamais pénaliser le non-couvert", () => {
  it("départage deux compétences autrement identiques, vers celle qui a un exercice", () => {
    // Même palier, même importance, même ordre : sans le bonus, seul le code
    // les départage (tri stable) — "AAA-01" gagnerait. C'est pourtant
    // "BBB-01" qui a un exercice, et c'est elle qui doit gagner.
    const a = skillDeTest("AAA-01", "developpement", "fondamentaux", 0.5, 0);
    const b = skillDeTest("BBB-01", "developpement", "fondamentaux", 0.5, 0);
    const referentiel = referentielDe([a, b], DOMAINES_TEST);
    const etats = computeAllSkillStates(referentiel.actifs, [], MAINTENANT);

    const exerciceB: Exercise = {
      id: "ex-b",
      titre: "Exercice B",
      domaine: "developpement",
      type: "application",
      difficulte: 2,
      competences: ["BBB-01"],
      dureeEstimeeMin: 20,
      enonce: "…",
      indices: [],
      correction: "…",
      criteres: [],
      origine: "tuteur",
    };

    const classement = recommander(etats, [exerciceB], [], 10, undefined, MAINTENANT);
    expect(classement[0].etat.skill.code).toBe("BBB-01");
    expect(
      classement[0].facteurs.some((f) => f.libelle === "Exercice disponible"),
    ).toBe(true);
    // "AAA-01" n'a pas le facteur : le bonus ne s'applique qu'à ce qui est
    // réellement actionnable.
    const aaa = classement.find((r) => r.etat.skill.code === "AAA-01")!;
    expect(aaa.facteurs.some((f) => f.libelle === "Exercice disponible")).toBe(false);
  });

  it("ne renverse pas un écart réel : jamais évaluée sans exercice passe devant une compétence actionnable de moindre priorité", () => {
    // DEV-01 : jamais évaluée, aucun exercice — le cas dominant, +70 environ.
    // DEV-05 : déjà évaluée, pratiquée à l'instant (donc "laisser respirer",
    // -15), MAIS elle a un exercice disponible (+10). L'écart réel doit
    // l'emporter sur le bonus modeste.
    const preuves = [preuve({ skill: "DEV-05", jours: 0, resultat: "reussi" })];
    const etats = computeAllSkillStates(SKILLS, preuves, MAINTENANT);

    const exerciceDev05: Exercise = {
      id: "ex-dev05",
      titre: "Exercice DEV-05",
      domaine: "developpement",
      type: "application",
      difficulte: 2,
      competences: ["DEV-05"],
      dureeEstimeeMin: 20,
      enonce: "…",
      indices: [],
      correction: "…",
      criteres: [],
      origine: "tuteur",
    };

    const classement = recommander(etats, [exerciceDev05], [], 10, undefined, MAINTENANT);
    const rangDev01 = classement.findIndex((r) => r.etat.skill.code === "DEV-01");
    const rangDev05 = classement.findIndex((r) => r.etat.skill.code === "DEV-05");
    expect(rangDev01).toBeLessThan(rangDev05);
  });
});

/* ------------------------------------------------------------------ */

/*
 * Le choix de l'exercice — 02/08/2026.
 *
 * Jusqu'ici `choisirExercice` n'excluait QUE les exercices réussis : un échec
 * revenait au tour suivant, à l'identique, indéfiniment. Avec 6 exercices en
 * base pour 54 compétences actives, la file n'avait rien d'autre à servir, et
 * suivre la « prochaine action » revenait à refaire en boucle ce qu'on venait
 * de rater. Le remède n'est pas un délai — trois jours ne rendent pas soluble
 * un exercice hors de portée — mais une condition : un progrès démontré.
 *
 * Le lot 5 (10/08/2026) étend la même règle au partiel, qui en était resté
 * exempté : observé en production, deux exercices ont chacun produit deux
 * « partiel » à plusieurs jours d'écart sans qu'aucune condition ne les fasse
 * sortir de la file entre les deux — la même impasse que l'échec non gouverné.
 */
describe("choix de l'exercice — un résultat non abouti ne redonne pas le même exercice", () => {
  function exo(id: string, difficulte: Difficulte, dureeEstimeeMin = 25): Exercise {
    return {
      id,
      titre: `Exercice ${id}`,
      domaine: "statistiques",
      type: "application",
      difficulte,
      competences: ["STAT-01"],
      dureeEstimeeMin,
      enonce: "…",
      indices: ["a", "b", "c"],
      correction: "…",
      criteres: [],
      origine: "tuteur",
    };
  }

  let n = 0;
  function tent(
    exerciseId: string,
    resultat: ExerciseAttempt["resultat"],
    jours: number,
    statut: ExerciseAttempt["statut"] = "terminee",
  ): ExerciseAttempt {
    return {
      id: `at-${++n}`,
      exerciseId,
      debut: ilYa(jours),
      fin: ilYa(jours),
      dureeMin: 20,
      indicesUtilises: 1,
      reponse: "…",
      evaluation: {},
      resultat,
      statut,
    };
  }

  function propose(
    exercices: Exercise[],
    tentatives: ExerciseAttempt[],
    preuves: SkillEvidence[] = [],
  ): Exercise | null {
    const etats = computeAllSkillStates(SKILLS, preuves, MAINTENANT);
    const classement = recommander(
      etats,
      exercices,
      tentatives,
      SKILLS.length,
      undefined,
      MAINTENANT,
    );
    return classement.find((r) => r.etat.skill.code === "STAT-01")?.exercice ?? null;
  }

  it("un exercice réussi sort de la file", () => {
    const ex = exo("ex-1", 2);
    expect(propose([ex], [tent("ex-1", "reussi", 3)])).toBeNull();
  });

  it("un exercice échoué ne revient pas tant qu'aucun progrès n'est démontré", () => {
    const ex = exo("ex-1", 2);
    const echec = preuve({ skill: "STAT-01", jours: 3, resultat: "echec" });
    expect(propose([ex], [tent("ex-1", "echec", 3)], [echec])).toBeNull();
  });

  it("il revient dès qu'une réussite postérieure le suit sur la compétence", () => {
    const ex = exo("ex-1", 2);
    const preuves = [
      preuve({ skill: "STAT-01", jours: 5, resultat: "echec" }),
      preuve({ skill: "STAT-01", jours: 1, resultat: "reussi", contexte: "Contexte B" }),
    ];
    const propose1 = propose([ex], [tent("ex-1", "echec", 5)], preuves);
    expect(propose1?.id).toBe("ex-1");
  });

  it("une réussite ANTÉRIEURE à l'échec ne suffit pas — le progrès doit être postérieur", () => {
    const ex = exo("ex-1", 2);
    const preuves = [
      preuve({ skill: "STAT-01", jours: 9, resultat: "reussi" }),
      preuve({ skill: "STAT-01", jours: 3, resultat: "echec", contexte: "Contexte B" }),
    ];
    expect(propose([ex], [tent("ex-1", "echec", 3)], preuves)).toBeNull();
  });

  /*
   * Un partiel n'est pas un mur — 09/08/2026 puis lot 5 (10/08/2026).
   *
   * Jusqu'au lot 5, un partiel restait candidat SANS AUCUNE condition,
   * contrairement à l'échec. Observé en production le 10/08/2026 :
   * `diag-dev-02` et `diag-tech-01` ont chacun produit deux « partiel » à
   * plusieurs jours d'écart, sans que rien ne les ait fait sortir de la file
   * entre les deux — le même exercice reproposé, le même résultat obtenu.
   * P4 ne distingue pas l'échec du partiel : les deux sont un résultat non
   * abouti, et les deux exigent la même démonstration de progrès avant de
   * revenir.
   */
  it("un partiel ne revient pas tant qu'aucun progrès n'est démontré — même règle que l'échec", () => {
    // Cas réel de `TECH-01` (10/08/2026) : `diag-tech-01` est son seul
    // exercice, et deux partiels sans progrès l'ont produit à plusieurs jours
    // d'écart. `exercice: null` fait retomber l'interface sur « Générer un
    // exercice » — la sortie voulue, pas une impasse muette.
    const ex = exo("ex-1", 2);
    const partiel = preuve({ skill: "STAT-01", jours: 3, resultat: "partiel" });
    expect(propose([ex], [tent("ex-1", "partiel", 3)], [partiel])).toBeNull();
  });

  it("un partiel revient dès qu'une réussite postérieure le suit sur la compétence", () => {
    const ex = exo("ex-1", 2);
    const preuves = [
      preuve({ skill: "STAT-01", jours: 5, resultat: "partiel" }),
      preuve({ skill: "STAT-01", jours: 1, resultat: "reussi", contexte: "Contexte B" }),
    ];
    expect(propose([ex], [tent("ex-1", "partiel", 5)], preuves)?.id).toBe("ex-1");
  });

  it("un abandon ne compte pas : l'exercice reste proposable", () => {
    // Même règle que `tentativeMenee` — une tentative interrompue ne dit rien.
    const ex = exo("ex-1", 2);
    expect(propose([ex], [tent("ex-1", "echec", 3, "abandonnee")])?.id).toBe("ex-1");
  });

  it("à écart de difficulté égal, ce qui n'a jamais été tenté passe devant — même un exercice redevenu candidat", () => {
    const dejaTente = exo("ex-vu", 2);
    const neuf = exo("ex-neuf", 2);
    // `ex-vu` doit être RECANDIDAT pour que le départage ait quelque chose à
    // départager : une réussite postérieure au partiel le débloque, sans quoi
    // ce test ne prouverait plus rien depuis le lot 5 (`ex-vu` serait déjà
    // exclu par `recommandable`, et `ex-neuf` resterait seul par défaut).
    const preuves = [
      preuve({ skill: "STAT-01", jours: 5, resultat: "partiel" }),
      preuve({ skill: "STAT-01", jours: 1, resultat: "reussi", contexte: "Contexte B" }),
    ];
    expect(
      propose([dejaTente, neuf], [tent("ex-vu", "partiel", 5)], preuves)?.id,
    ).toBe("ex-neuf");
  });

  it("sans candidat, la recommandation n'invente pas d'exercice", () => {
    // C'est le repli assumé : l'interface bascule alors sur « demander un
    // exercice au tuteur » plutôt que de resservir ce qui vient d'échouer.
    const echec = preuve({ skill: "STAT-01", jours: 3, resultat: "echec" });
    expect(propose([exo("ex-1", 2)], [tent("ex-1", "echec", 3)], [echec])).toBeNull();
  });
});

/* ------------------------------------------------------------------ */

/*
 * Refus de recommandation (R1) — 07/08/2026.
 *
 * Le paramètre d'exclusion existait depuis le 31/07 et n'était exercé par
 * AUCUN test : les sept appels à `recommander` s'arrêtaient au 6ᵉ argument.
 * Le défaut est pourtant resté invisible ailleurs — la fonction SQL
 * `charger_tout` ne renvoyait pas la table des refus, l'ensemble arrivait
 * toujours vide, et « Passer » n'écartait rien pendant deux mois.
 *
 * La portée a changé le 07/08 : un refus retire l'exercice proposé, pas la
 * compétence. Écarter la compétence entière assèche une file où 40 des 54
 * compétences actives n'ont aucun exercice.
 */
describe("refus de recommandation — portée exercice, et non compétence", () => {
  function exo(id: string, difficulte: Difficulte): Exercise {
    return {
      id,
      titre: `Exercice ${id}`,
      domaine: "statistiques",
      type: "application",
      difficulte,
      competences: ["STAT-01"],
      dureeEstimeeMin: 25,
      enonce: "…",
      indices: ["a", "b", "c"],
      correction: "…",
      criteres: [],
      origine: "tuteur",
    };
  }

  const AUCUN = { codes: new Set<string>(), exercices: new Set<string>() };

  function file(
    exercices: Exercise[],
    refus: { codes: Set<string>; exercices: Set<string> } = AUCUN,
  ) {
    const etats = computeAllSkillStates(SKILLS, [], MAINTENANT);
    return recommander(etats, exercices, [], SKILLS.length, undefined, MAINTENANT, refus);
  }

  const stat01 = (r: ReturnType<typeof file>) =>
    r.find((x) => x.etat.skill.code === "STAT-01");

  it("sans refus, la file est inchangée — le défaut vaut absence d'exclusion", () => {
    const exercices = [exo("ex-1", 2), exo("ex-2", 2)];
    const etats = computeAllSkillStates(SKILLS, [], MAINTENANT);
    const avecDefaut = recommander(etats, exercices, [], SKILLS.length, undefined, MAINTENANT);
    const avecVide = file(exercices);
    expect(avecVide.map((r) => r.etat.skill.code)).toEqual(
      avecDefaut.map((r) => r.etat.skill.code),
    );
  });

  it("passer un exercice laisse la compétence dans la file, avec un autre exercice", () => {
    const exercices = [exo("ex-1", 2), exo("ex-2", 2)];
    const sansRefus = stat01(file(exercices))!;
    expect(sansRefus.exercice).not.toBeNull();

    const refuse = stat01(
      file(exercices, { codes: new Set(), exercices: new Set([sansRefus.exercice!.id]) }),
    );
    expect(refuse).toBeDefined();
    expect(refuse!.exercice?.id).not.toBe(sansRefus.exercice!.id);
  });

  it("passer le dernier exercice retire la compétence de la file", () => {
    // Sinon elle resterait en tête avec le repli « Générer un exercice » : le
    // clic paraîtrait sans effet, ce que ce mécanisme est censé réparer.
    const exercices = [exo("ex-1", 2)];
    const refuse = stat01(
      file(exercices, { codes: new Set(), exercices: new Set(["ex-1"]) }),
    );
    expect(refuse).toBeUndefined();
  });

  it("une compétence qui n'avait aucun exercice reste dans la file", () => {
    // Elle n'a rien de refusé : son `exercice` null est un manque de stock,
    // pas un refus. L'interface y propose « Générer un exercice ».
    const refuse = stat01(file([], { codes: new Set(), exercices: new Set(["ex-1"]) }));
    expect(refuse).toBeDefined();
    expect(refuse!.exercice).toBeNull();
  });

  it("un refus par code écarte la compétence entière — portée héritée", () => {
    // Ce que sont les refus antérieurs au 07/08/2026, et ceux posés quand
    // aucun exercice n'était proposé.
    const refuse = stat01(
      file([exo("ex-1", 2)], { codes: new Set(["STAT-01"]), exercices: new Set() }),
    );
    expect(refuse).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ */
/* Activité sur une fenêtre glissante                                  */
/* ------------------------------------------------------------------ */

describe("activiteSurFenetre — mesure réellement bornée par la période", () => {
  function seance(jours: number, dureeMin: number | undefined): LearningSession {
    return {
      id: `s-${jours}-${dureeMin ?? "x"}`,
      date: ilYa(jours),
      dureeMin,
      domaines: [STAT01.domaine],
      skillCodes: [STAT01.code],
      activites: [],
      genereAutomatiquement: false,
    };
  }

  it("sans séance, tout vaut zéro — et non « inconnu »", () => {
    expect(activiteSurFenetre([], 30, MAINTENANT)).toEqual({
      joursActifs: 0,
      minutes: 0,
      seances: 0,
    });
  });

  it("exclut ce qui tombe hors de la fenêtre et inclut la borne exacte", () => {
    const sessions = [seance(3, 60), seance(7, 30), seance(8, 45)];
    expect(activiteSurFenetre(sessions, 7, MAINTENANT)).toEqual({
      joursActifs: 2,
      minutes: 90,
      seances: 2,
    });
  });

  it("une séance sans durée reste un jour travaillé, à 0 minute", () => {
    // Ne pas avoir noté sa durée n'est pas ne pas avoir travaillé : l'absence
    // de mesure ne doit pas effacer le fait (protocole anti-hallucination §7).
    const resultat = activiteSurFenetre([seance(1, undefined)], 30, MAINTENANT);
    expect(resultat.joursActifs).toBe(1);
    expect(resultat.seances).toBe(1);
    expect(resultat.minutes).toBe(0);
  });

  it("deux séances le même jour comptent pour un seul jour travaillé", () => {
    const sessions = [seance(2, 20), { ...seance(2, 25), id: "s-bis" }];
    const resultat = activiteSurFenetre(sessions, 30, MAINTENANT);
    expect(resultat.joursActifs).toBe(1);
    expect(resultat.seances).toBe(2);
    expect(resultat.minutes).toBe(45);
  });

  it("à 30 jours, reproduit exactement les compteurs de calculerActivite", () => {
    // Garantit que l'extraction n'a déplacé aucun seuil existant.
    const sessions = [seance(0, 15), seance(12, 90), seance(29, 40), seance(45, 100)];
    const fenetre = activiteSurFenetre(sessions, 30, MAINTENANT);
    const globale = calculerActivite(sessions, MAINTENANT);
    expect(fenetre.joursActifs).toBe(globale.joursActifs30);
    expect(fenetre.minutes).toBe(globale.minutes30);
    expect(fenetre.seances).toBe(globale.seances30);
  });

  /*
   * Séances planifiées (ADR-048).
   *
   * Une séance PRÉVUE est une ligne de `sessions` comme les autres. Sans le
   * filtre `seanceALieu`, elle remplirait une case du bandeau d'activité pour
   * une intention — une mesure fabriquée là où rien n'a été mesuré (P2) — et le
   * défaut serait indétectable à l'œil : la grille paraîtrait simplement plus
   * fournie.
   */
  it("ne compte pas une séance planifiée : elle n'a pas eu lieu", () => {
    const prevue: LearningSession = { ...seance(0, 60), id: "s-prevue", statut: "planifiee" };
    expect(activiteSurFenetre([prevue], 30, MAINTENANT)).toEqual({
      joursActifs: 0,
      minutes: 0,
      seances: 0,
    });
  });

  it("compte une séance en cours : la personne y travaille", () => {
    const encours: LearningSession = { ...seance(0, 25), id: "s-encours", statut: "en-cours" };
    expect(activiteSurFenetre([encours], 30, MAINTENANT).seances).toBe(1);
  });

  it("laisse la séance planifiée hors du total et hors de la dernière séance", () => {
    const eue = seance(3, 40);
    const prevue: LearningSession = {
      ...seance(0, 90),
      id: "s-prevue",
      statut: "planifiee",
      date: ilYa(-2), // prévue dans deux jours
    };
    const a = calculerActivite([eue, prevue], MAINTENANT);
    expect(a.minutesTotal).toBe(40);
    expect(a.minutesParJour.size).toBe(1);
    expect(a.derniereSeance).toBe(eue.date);
  });
});
