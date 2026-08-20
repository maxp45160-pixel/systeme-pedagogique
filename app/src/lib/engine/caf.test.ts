import { describe, expect, it } from "vitest";
import {
  composerSeance,
  nombreExercicesConseille,
  themePourDomaine,
  themesSuggeres,
  THEMES_CIBLES_MAX,
} from "./caf";
import { EXERCICES_PAR_SEANCE_MAX } from "@/lib/domain/seance";
import { computeAllSkillStates } from "./skill-state";
import { recommander } from "./recommend";
import { SKILLS_TEST } from "@/lib/domain/referentiel.fixture";
import { motifRefusBlueprint } from "@/lib/domain/seance";
import type {
  DemandeSeance,
  Difficulte,
  Exercise,
  ExerciseAttempt,
  SkillObservation,
} from "@/lib/domain/types";

/*
 * Le modèle d'assemblage (ADR-049).
 *
 * Le cas nominal de ce module n'est PAS « composer une belle séance » : au
 * 10/08/2026, 11 compétences actives sur 77 ont un exercice. Le cas nominal est
 * « une place tenue, trois à rédiger », et c'est ce que la plupart des tests
 * ci-dessous vérifient.
 *
 * La propriété la plus importante est la dernière du fichier : une compétence
 * jamais évaluée SANS exercice doit passer devant une compétence déjà travaillée
 * QUI en a un. L'inverse est exactement le défaut rapporté à l'usage — « ça me
 * repropose toujours les mêmes exercices » — et il serait invisible : la séance
 * paraîtrait simplement mieux remplie.
 */

const MAINTENANT = new Date("2026-08-10T12:00:00.000Z");

function exercice(
  id: string,
  competences: string[],
  options: { difficulte?: Difficulte; duree?: number; domaine?: string } = {},
): Exercise {
  return {
    id,
    titre: `Exercice ${id}`,
    domaine: options.domaine ?? "developpement",
    type: "application",
    difficulte: options.difficulte ?? 2,
    competences,
    dureeEstimeeMin: options.duree ?? 20,
    enonce: "…",
    indices: ["i1", "i2"],
    correction: "…",
    criteres: [],
    origine: "tuteur",
  };
}

let compteur = 0;
function observation(skillCode: string, jours: number): SkillObservation {
  return {
    id: `obs-${++compteur}`,
    skillCode,
    date: new Date(MAINTENANT.getTime() - jours * 86_400_000).toISOString(),
    type: "exercice",
    niveauObservation: "A",
    autonomie: "A3",
    qualite: "moyenne",
    resultat: "reussi",
    contexte: "test",
    dimensions: { comprehension: 0.8, application: 0.8 },
    source: { kind: "exercice", ref: "ex-passe" },
  };
}

const etats = (observations: SkillObservation[] = []) =>
  computeAllSkillStates(
    SKILLS_TEST.filter((s) => s.active),
    observations,
    MAINTENANT,
  );

const DEMANDE: DemandeSeance = {
  dureeCibleMin: 60,
  nombreExercices: 3,
  portee: { type: "mono", domaine: "developpement" },
};

const composer = (
  demande: Partial<DemandeSeance> = {},
  exercices: Exercise[] = [],
  tentatives: ExerciseAttempt[] = [],
  observations: SkillObservation[] = [],
) =>
  composerSeance(
    { ...DEMANDE, ...demande },
    etats(observations),
    exercices,
    tentatives,
    undefined,
    MAINTENANT,
  );

/* ------------------------------------------------------------------ */

/*
 * Thèmes suggérés — 10/08/2026.
 *
 * Le compositeur demandait de cocher les compétences visées dans une liste de
 * 77 cases : le besoin déclaré coûtait plus cher que la séance qu'il préparait.
 * Ces thèmes remplacent la liste, et la propriété qui compte est la première
 * ci-dessous : **le premier thème EST la prochaine action**. Si les deux
 * pouvaient diverger, le tableau de bord et le compositeur proposeraient deux
 * priorités différentes le même jour (ADR-049).
 */
describe("themesSuggeres — la suggestion sort du même classement que la prochaine action", () => {
  const NOMS = new Map([
    ["developpement", "Développement logiciel"],
    ["statistiques", "Statistiques"],
  ]);

  const classement = () =>
    recommander(etats(), [], [], SKILLS_TEST.length, undefined, MAINTENANT);

  it("place la prochaine action en tête, et le dit", () => {
    const reco = classement();
    const themes = themesSuggeres(reco, NOMS);
    expect(themes[0].codesImposes).toEqual([reco[0].etat.skill.code]);
    expect(themes[0].libelle).toBe(reco[0].etat.skill.intitule);
    expect(themes[0].detail).toContain("Prochaine action");
  });

  it("borne les thèmes ciblés et nomme le domaine plutôt que son identifiant", () => {
    const themes = themesSuggeres(classement(), NOMS);
    const cibles = themes.filter((t) => t.cle.startsWith("competence:"));
    expect(cibles).toHaveLength(THEMES_CIBLES_MAX);
    expect(cibles[0].detail).toContain("Développement logiciel");
    expect(cibles[0].detail).not.toContain("developpement");
  });

  it("cible une compétence dans le périmètre de SON domaine, jamais transverse", () => {
    // Un thème ciblé doit remplir la séance avec les voisines de la compétence
    // visée : la porter en transverse la noierait dans le reste du référentiel.
    const themes = themesSuggeres(classement(), NOMS);
    const premier = themes[0];
    expect(premier.portee.type).toBe("mono");
    if (premier.portee.type === "mono") {
      expect(premier.portee.domaine).toBe(classement()[0].etat.skill.domaine);
    }
  });

  it("ajoute un thème par domaine représenté, sans compétence imposée", () => {
    const themes = themesSuggeres(classement(), NOMS);
    const parDomaine = themes.filter((t) => t.cle.startsWith("domaine:"));
    expect(parDomaine.length).toBeGreaterThan(0);
    for (const t of parDomaine) {
      expect(t.codesImposes).toEqual([]);
      expect(t.portee.type).toBe("mono");
    }
  });

  it("n'offre le transverse que si deux domaines au moins sont en jeu", () => {
    const unSeulDomaine = classement().filter(
      (r) => r.etat.skill.domaine === "developpement",
    );
    expect(themesSuggeres(unSeulDomaine, NOMS).some((t) => t.cle === "transverse")).toBe(
      false,
    );
  });

  it("rend une liste vide sans recommandation — aucun thème par défaut", () => {
    // P2 : sans classement, il n'existe aucune raison de proposer un sujet
    // plutôt qu'un autre. L'écran doit le dire, pas inventer.
    expect(themesSuggeres([], NOMS)).toEqual([]);
  });

  it("retombe sur l'identifiant quand le nom du domaine est inconnu", () => {
    const themes = themesSuggeres(classement(), new Map());
    expect(themes[0].detail).toContain("developpement");
  });

  it("produit des clés distinctes — elles servent de sélection", () => {
    const cles = themesSuggeres(classement(), NOMS).map((t) => t.cle);
    expect(new Set(cles).size).toBe(cles.length);
  });

  it("chaque thème compose : sa portée et ses codes imposés sont une demande valide", () => {
    // Le lien entre la suggestion et l'assemblage : ce qu'un thème décrit doit
    // se composer, sinon le sélecteur offrirait des impasses.
    for (const t of themesSuggeres(classement(), NOMS)) {
      const c = composerSeance(
        { dureeCibleMin: 60, nombreExercices: 2, portee: t.portee, codesImposes: t.codesImposes },
        etats(),
        [],
        [],
        undefined,
        MAINTENANT,
      );
      expect(c.activites.length + c.manquants.length).toBeGreaterThan(0);
      expect(motifRefusBlueprint(c.blueprint)).toBeNull();
    }
  });

  it("représente un domaine déclaré sans imposer une compétence", () => {
    const theme = themePourDomaine("developpement", "Développement logiciel");

    expect(theme.portee).toEqual({ type: "mono", domaine: "developpement" });
    expect(theme.codesImposes).toEqual([]);
    expect(theme.detail).toBe("Domaine choisi dans ton travail");
  });
});

/* ------------------------------------------------------------------ */

describe("nombreExercicesConseille — un nombre dérivé porte sa source", () => {
  const menee = (dureeMin: number, i: number): ExerciseAttempt => ({
    id: `at-m-${i}`,
    exerciseId: "ex-1",
    debut: "2026-08-01T09:00:00.000Z",
    dureeMin,
    indicesUtilises: 0,
    reponse: "…",
    evaluation: {},
    resultat: "reussi",
    statut: "terminee",
  });

  it("divise par la médiane OBSERVÉE, pas par l'estimation du tuteur", () => {
    /*
     * ADR-045 : sur les réussites réelles, la durée valait 0,48 fois
     * l'estimation. Diviser par l'estimation proposerait deux fois trop peu
     * d'exercices. Ici l'estimation dit 40 min, l'observation dit 20 :
     * 60 min doivent donner 3 exercices, pas 2 (arrondi de 1,5).
     */
    const exercices = [exercice("ex-1", ["DEV-01"], { duree: 40 })];
    const tentatives = [menee(20, 1), menee(20, 2)];
    const c = nombreExercicesConseille(60, exercices, tentatives)!;
    expect(c.nombre).toBe(3);
    expect(c.reference.source).toBe("observee");
    expect(c.explication).toContain("médiane de 2 tentative(s) réellement menée(s)");
  });

  it("retombe sur les durées estimées du corpus, et le dit", () => {
    const exercices = [exercice("ex-1", ["DEV-01"], { duree: 30 })];
    const c = nombreExercicesConseille(60, exercices, [])!;
    expect(c.nombre).toBe(2);
    expect(c.reference.source).toBe("estimee");
    expect(c.explication).toContain("aucune tentative menée");
  });

  it("rend null sans corpus ni tentative : rien à quoi se référer", () => {
    // P2 : pas de valeur par défaut plausible. L'écran demandera le nombre.
    expect(nombreExercicesConseille(60, [], [])).toBeNull();
  });

  it("ignore les exercices archivés dans le repli sur l'estimation", () => {
    const exercices = [
      { ...exercice("ex-vieux", ["DEV-01"], { duree: 240 }), archive: true },
      exercice("ex-1", ["DEV-01"], { duree: 20 }),
    ];
    expect(nombreExercicesConseille(60, exercices, [])!.nombre).toBe(3);
  });

  it("borne le nombre, et annonce qu'il a été borné", () => {
    const exercices = [exercice("ex-1", ["DEV-01"], { duree: 10 })];
    const haut = nombreExercicesConseille(480, exercices, [])!;
    expect(haut.nombre).toBe(EXERCICES_PAR_SEANCE_MAX);
    expect(haut.explication).toContain("Ramené à");

    const bas = nombreExercicesConseille(5, [exercice("ex-1", ["DEV-01"], { duree: 60 })], [])!;
    expect(bas.nombre).toBe(1);
    expect(bas.explication).toContain("Remonté à");
  });

  it("cite le temps déclaré dans son explication", () => {
    const c = nombreExercicesConseille(45, [exercice("ex-1", ["DEV-01"], { duree: 20 })], [])!;
    expect(c.explication).toContain("45 min disponibles");
  });
});

describe("composerSeance — bibliothèque vide", () => {
  it("remplit toutes les places en manquants plutôt que de rendre une séance vide", () => {
    const c = composer({ nombreExercices: 3 });
    expect(c.activites).toEqual([]);
    expect(c.manquants).toHaveLength(3);
    expect(c.explication.join(" ")).toContain("0 trouvé(s) en bibliothèque, 3 à rédiger");
  });

  it("donne à chaque manquant une difficulté visée et une raison", () => {
    const m = composer({ nombreExercices: 1 }).manquants[0];
    expect(m.difficulteCible).toBeGreaterThanOrEqual(1);
    expect(m.difficulteCible).toBeLessThanOrEqual(5);
    expect(m.raison).not.toBe("");
    expect(m.intitule).toContain("Intitulé de");
  });

  it("ne prête aucune durée aux exercices qui n'existent pas", () => {
    // P2 : un exercice à rédiger n'a pas de durée. Lui en donner une gonflerait
    // le total d'une valeur que personne n'a écrite.
    const c = composer({ nombreExercices: 3 });
    expect(c.dureeEstimeeTotaleMin).toBe(0);
    expect(c.explication.join(" ")).toContain("leur durée n'est pas connue");
  });
});

describe("composerSeance — mélange existant et manquant", () => {
  it("retient l'exercice existant et déclare le reste à rédiger", () => {
    const c = composer({ nombreExercices: 3 }, [exercice("ex-1", ["DEV-01"])]);
    expect(c.activites.map((a) => a.ref)).toEqual(["ex-1"]);
    expect(c.activites[0].code).toBe("DEV-01");
    expect(c.manquants).toHaveLength(2);
    expect(c.activites.length + c.manquants.length).toBe(3);
  });

  it("compte la durée des seuls exercices retenus, et cite la cible", () => {
    const c = composer({ nombreExercices: 2, dureeCibleMin: 60 }, [
      exercice("ex-1", ["DEV-01"], { duree: 25 }),
    ]);
    expect(c.dureeEstimeeTotaleMin).toBe(25);
    expect(c.explication.join(" ")).toContain("25 min pour une cible de 60 min");
  });

  it("n'inscrit pas deux fois un exercice qui vise plusieurs compétences", () => {
    // Il tient une place, pas deux — et la compétence qu'il couvre au passage
    // ne consomme pas de place non plus : la suivante prend la sienne.
    const c = composer({ nombreExercices: 2 }, [exercice("ex-multi", ["DEV-01", "DEV-02"])]);
    expect(c.activites.map((a) => a.ref)).toEqual(["ex-multi"]);
    expect(c.manquants).toHaveLength(1);
    expect(c.manquants[0].code).not.toBe("DEV-02");
    expect(c.explication.join(" ")).toContain("déjà couvertes par un exercice retenu");
  });
});

describe("composerSeance — la portée", () => {
  it("mono : n'assemble que dans le domaine demandé", () => {
    const c = composer({ portee: { type: "mono", domaine: "statistiques" } });
    // STAT-01 est hors périmètre dans le référentiel de test : rien à composer.
    expect(c.activites).toEqual([]);
    expect(c.manquants).toEqual([]);
    expect(c.explication[0]).toContain("Aucune compétence active dans le périmètre");
  });

  it("transverse : accepte plusieurs domaines", () => {
    const c = composer({
      nombreExercices: 2,
      portee: { type: "transverse", domaines: ["developpement", "statistiques"] },
    });
    expect(c.activites.length + c.manquants.length).toBe(2);
  });
});

describe("composerSeance — le besoin déclaré commande", () => {
  it("fait passer les codes visés devant le classement", () => {
    // DEV-06 est en fin de classement (palier intermédiaire, rang 5). Visé, il
    // occupe la première place. Sans cela, le besoin déclaré serait décoratif :
    // on l'enregistrerait et la séance composerait la même chose sans lui.
    const c = composer({ nombreExercices: 2, codesImposes: ["DEV-06"] });
    const premier = [...c.activites, ...c.manquants][0];
    expect(premier.code).toBe("DEV-06");
  });

  it("écarte un code visé hors du périmètre, et le dit", () => {
    const c = composer({ nombreExercices: 1, codesImposes: ["STAT-01"] });
    expect(c.explication.join(" ")).toContain("hors du périmètre de la séance");
    expect(c.explication.join(" ")).toContain("STAT-01");
  });

  it("fait d'un code visé sans exercice un manquant, jamais un silence", () => {
    const c = composer({ nombreExercices: 1, codesImposes: ["DEV-06"] }, [
      exercice("ex-1", ["DEV-01"]),
    ]);
    expect(c.manquants.map((m) => m.code)).toEqual(["DEV-06"]);
    expect(c.activites).toEqual([]);
  });
});

describe("composerSeance — le blueprint rendu", () => {
  it("range les cibles dans l'ordre de déroulé, activités puis manquants", () => {
    const c = composer({ nombreExercices: 3 }, [exercice("ex-1", ["DEV-01"])]);
    expect(c.blueprint.cibles).toHaveLength(3);
    expect(c.blueprint.cibles[0].code).toBe("DEV-01");
    expect(c.blueprint.cibles.map((x) => x.code)).toEqual([
      ...c.activites.map((a) => a.code),
      ...c.manquants.map((m) => m.code),
    ]);
  });

  it("produit un blueprint que le domaine accepte d'écrire", () => {
    // Le lien entre l'assemblage et l'écriture : ce que caf compose doit passer
    // la validation de `lib/domain/seance.ts`, sinon la séance ne s'écrira pas.
    const c = composer({ nombreExercices: 3 }, [exercice("ex-1", ["DEV-01"])]);
    expect(motifRefusBlueprint(c.blueprint)).toBeNull();
  });

  it("ne recopie pas les codes visés dans le blueprint", () => {
    // Ils vivent dans `besoinDeclare.codesVises`. Deux exemplaires de la même
    // déclaration finiraient par diverger.
    const c = composer({ nombreExercices: 1, codesImposes: ["DEV-06"] });
    expect(c.blueprint).not.toHaveProperty("codesImposes");
  });
});

describe("composerSeance — quand le périmètre est plus petit que la demande", () => {
  it("rend moins de places et le dit, plutôt que de remplir au hasard", () => {
    const c = composerSeance(
      { ...DEMANDE, nombreExercices: 6 },
      etats().slice(0, 2),
      [],
      [],
      undefined,
      MAINTENANT,
    );
    expect(c.activites.length + c.manquants.length).toBe(2);
    expect(c.explication.join(" ")).toContain("2 au lieu de 6");
  });
});

describe("composerSeance — la propriété qui protège du défaut rapporté", () => {
  it("préfère une compétence jamais évaluée SANS exercice à une compétence travaillée QUI en a un", () => {
    /*
     * Le scénario exact du 10/08/2026 : 11 compétences couvertes sur 77. Se
     * rabattre sur ce qui est disponible remplirait la séance d'exercices déjà
     * travaillés, et le corpus ne se remplirait jamais. La séance doit rendre
     * un manquant — c'est lui qui devient la commande passée au tuteur.
     */
    const observations = [observation("DEV-05", 1)];
    const exercices = [exercice("ex-dev05", ["DEV-05"])];
    const c = composer({ nombreExercices: 1 }, exercices, [], observations);

    expect(c.activites).toEqual([]);
    expect(c.manquants).toHaveLength(1);
    expect(c.manquants[0].code).not.toBe("DEV-05");
  });

  it("retient tout de même l'exercice existant dès qu'il reste une place pour lui", () => {
    // La règle n'est pas « ignorer ce qui existe » : c'est « ne pas s'y rabattre
    // au détriment de ce qui n'a jamais été mesuré ».
    const observations = [observation("DEV-05", 400)];
    const exercices = [exercice("ex-dev05", ["DEV-05"])];
    const c = composer({ nombreExercices: 6 }, exercices, [], observations);
    expect(c.activites.map((a) => a.ref)).toContain("ex-dev05");
  });
});

