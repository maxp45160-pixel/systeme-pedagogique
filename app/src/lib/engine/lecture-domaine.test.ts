import { describe, expect, it } from "vitest";
import {
  codesDuDomaine,
  FENETRE_VEILLE_JOURS,
  lectureDomaine,
  resoudreFiltreDomaine,
} from "./lecture-domaine";
import { computeAllSkillStates } from "./skill-state";
import { referentielDe, skillDeTest, DOMAINES_TEST } from "@/lib/domain/referentiel.fixture";
import type {
  Exercise,
  ExerciseAttempt,
  SkillObservation,
} from "@/lib/domain/types";

/*
 * Ce que ces tests protègent : le filtre par domaine ne fabrique rien — il
 * ignore un paramètre invalide au lieu de planter, garde les rattachées dans
 * le périmètre, ne confond jamais « jamais observé » et « en veille », et
 * rend une dernière observation SOURCÉE ou pas de dernière observation du
 * tout.
 */

const MAINTENANT = new Date("2026-08-15T10:00:00.000Z");

/** Un domaine secondaire pour vérifier la règle des rattachées (ADR-081). */
const REFERENTIEL = referentielDe(
  [
    skillDeTest("DEV-01", "developpement", "fondamentaux", 1, 0),
    skillDeTest("DEV-02", "developpement", "fondamentaux", 1, 1),
    // Partagée : portée par `developpement`, sert `statistiques`.
    skillDeTest("DEV-03", "developpement", "intermediaire", 0.9, 2),
  ],
  DOMAINES_TEST,
  [{ code: "DEV-03", domaine: "statistiques" }],
);

let compteur = 0;

function observation(skillCode: string, date: string): SkillObservation {
  return {
    id: `obs-${++compteur}`,
    skillCode,
    date,
    type: "exercice",
    niveauObservation: "A",
    autonomie: "A3",
    qualite: "moyenne",
    resultat: "reussi",
    contexte: `Contexte ${compteur}`,
    dimensions: { comprehension: 0.9 },
    source: { kind: "exercice", ref: "ex-1" },
  };
}

function exercice(id: string, competences: string[]): Exercise {
  return {
    id,
    titre: id,
    domaine: competences[0]?.split("-")[0].toLowerCase() ?? "developpement",
    type: "application",
    difficulte: 2,
    competences,
    dureeEstimeeMin: 15,
    enonce: "",
    indices: [],
    correction: "",
    criteres: [],
    origine: "seed",
  };
}

function tentative(id: string, exerciseId: string): ExerciseAttempt {
  return {
    id,
    exerciseId,
    debut: "2026-08-14T09:00:00.000Z",
    fin: "2026-08-14T09:20:00.000Z",
    indicesUtilises: 0,
    reponse: "",
    evaluation: {},
    resultat: "reussi",
    statut: "terminee",
  };
}

describe("resoudreFiltreDomaine — validation du paramètre d'URL", () => {
  const domaines = DOMAINES_TEST;

  it("retient un identifiant réel", () => {
    expect(resoudreFiltreDomaine("developpement", domaines)).toBe("developpement");
  });

  it("ignore proprement tout ce qui ne désigne aucun domaine réel", () => {
    expect(resoudreFiltreDomaine("inconnu", domaines)).toBeNull();
    expect(resoudreFiltreDomaine(undefined, domaines)).toBeNull();
    expect(resoudreFiltreDomaine("", domaines)).toBeNull();
    expect(resoudreFiltreDomaine("Développement", domaines)).toBeNull();
    expect(resoudreFiltreDomaine("developpement ", domaines)).toBeNull();
  });
});

describe("codesDuDomaine — périmètre porteur ET rattachées", () => {
  it("inclut les compétences rattachées sans les dupliquer", () => {
    const codes = codesDuDomaine(REFERENTIEL.skills, "statistiques");
    expect(codes.has("DEV-03")).toBe(true);
    expect(codes.size).toBe(1);
  });

  it("n'attrape pas les compétences des autres domaines", () => {
    const codes = codesDuDomaine(REFERENTIEL.skills, "statistiques");
    expect(codes.has("DEV-01")).toBe(false);
    expect(codes.has("DEV-02")).toBe(false);
  });
});

describe("lectureDomaine — le découpage d'un domaine", () => {
  /*
   * Les états se dérivent des MÊMES observations que la lecture : dans la page,
   * `chargerContexte` calcule les uns depuis l'autre. Un état figé sans
   * journal ferait échouer tout comptage de compétences mesurées.
   */
  function entrees(observations: SkillObservation[], extras: Partial<Parameters<typeof lectureDomaine>[0]> = {}) {
    return {
      domaineId: "developpement",
      skills: REFERENTIEL.skills,
      etats: computeAllSkillStates(REFERENTIEL.skills, observations, MAINTENANT),
      observations,
      exercices: [] as Exercise[],
      tentatives: [] as ExerciseAttempt[],
      now: MAINTENANT,
      ...extras,
    };
  }

  it("sur un domaine sans aucune observation : rien encore observé, et pas de dernière observation inventée", () => {
    const lecture = lectureDomaine(entrees([]));

    expect(lecture.competencesMesurees).toBe(0);
    expect(lecture.competencesEnVeille).toBe(0);
    expect(lecture.derniereObservation).toBeNull();
    expect(lecture.etats).toHaveLength(3);
  });

  it("restreint états, observations et tentatives au périmètre du domaine", () => {
    const observations = [
      observation("DEV-01", "2026-08-01T09:00:00.000Z"),
      observation("STAT-01", "2026-08-02T09:00:00.000Z"),
    ];
    const lecture = lectureDomaine(
      entrees(observations, {
        exercices: [exercice("ex-dev", ["DEV-01"]), exercice("ex-stat", ["STAT-01"]), exercice("ex-mixte", ["DEV-02", "STAT-01"])],
        tentatives: [
          tentative("t1", "ex-dev"),
          tentative("t2", "ex-stat"),
          tentative("t3", "ex-mixte"),
        ],
      }),
    );

    expect(lecture.observations.map((o) => o.skillCode)).toEqual(["DEV-01"]);
    // Un exercice mixte reste attribué au domaine dès qu'il touche UNE de ses
    // compétences — les données ne permettent pas de quote-part.
    expect(lecture.tentatives.map((t) => t.id)).toEqual(["t1", "t3"]);
    expect(lecture.competencesMesurees).toBe(1);
  });

  it("distingue « en veille » d'une simple absence de mesure", () => {
    const lecture = lectureDomaine(
      entrees([
        // Récente : mesurée et pas en veille.
        observation("DEV-01", "2026-08-14T09:00:00.000Z"),
        // Ancienne : mesurée mais sortie de la fenêtre.
        observation("DEV-02", "2026-05-01T09:00:00.000Z"),
      ]),
    );

    expect(lecture.competencesMesurees).toBe(2);
    expect(lecture.competencesEnVeille).toBe(1);
  });

  it(`place exactement à la frontière des ${FENETRE_VEILLE_JOURS} jours`, () => {
    const aLaLimite = new Date(MAINTENANT.getTime() - FENETRE_VEILLE_JOURS * 24 * 60 * 60 * 1000);
    const lecture = lectureDomaine(entrees([observation("DEV-01", aLaLimite.toISOString())]));

    expect(lecture.competencesEnVeille).toBe(0);
  });

  it("rend la dernière observation avec sa source, pas seulement sa date", () => {
    const manuelle = observation("DEV-01", "2026-08-13T09:00:00.000Z");
    manuelle.source = { kind: "manuel", ref: "saisie" };
    const lecture = lectureDomaine(
      entrees([
        observation("DEV-01", "2026-08-01T09:00:00.000Z"),
        manuelle,
      ]),
    );

    expect(lecture.derniereObservation).toEqual({ date: "2026-08-13T09:00:00.000Z", origine: "manuel" });
  });

  it("garde les observations d'une compétence archivée attribuées à leur domaine", () => {
    const avecArchivee = referentielDe([
      skillDeTest("DEV-01", "developpement", "fondamentaux", 1, 0),
      skillDeTest("DEV-09", "developpement", "avance", 0.8, 6, [], {
        archive: true,
      }),
    ]);
    const observations = [observation("DEV-09", "2026-07-01T09:00:00.000Z")];
    const lecture = lectureDomaine({
      domaineId: "developpement",
      skills: avecArchivee.skills,
      etats: computeAllSkillStates(avecArchivee.skills, observations, MAINTENANT),
      observations,
      exercices: [],
      tentatives: [],
      now: MAINTENANT,
    });

    // La preuve existe : elle reste lisible là où elle a été portée (P4).
    expect(lecture.observations).toHaveLength(1);
    expect(lecture.derniereObservation?.origine).toBe("exercice");
  });
});
