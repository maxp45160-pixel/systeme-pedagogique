import { describe, expect, it } from "vitest";
import { resumeCroissance } from "./croissance";
import { REFERENTIEL_TEST } from "@/lib/domain/referentiel.fixture";
import { DUREE_ESTIMEE_MAX } from "@/lib/domain/exercice";
import type {
  ExerciseAttempt,
  LearningSession,
  SkillObservation,
} from "@/lib/domain/types";

/*
 * Ce que ces tests protègent : les deux fenêtres ne disent pas la même chose,
 * et aucune ne fabrique de mesure. « Aujourd'hui » est un jour calendaire ;
 * « 7 derniers jours » est glissant. Confondre les deux ferait passer un
 * travail d'hier soir pour un travail du matin.
 */

const MAINTENANT = new Date("2026-08-15T10:00:00.000Z");
const SKILLS = REFERENTIEL_TEST.parCode;

/*
 * Les dates sont ancrées sur le calendrier LOCAL, pas sur UTC.
 *
 * `cleJour` lit `getDate()` — le jour tel que la personne le voit. Un test
 * écrit en UTC pur passerait à Londres et échouerait à Paris : « hier 23 h UTC »
 * y est déjà aujourd'hui. Ces deux helpers rendent le scénario vrai partout.
 */
function aLHeureLocale(joursDecales: number, heure: number): string {
  const date = new Date(MAINTENANT);
  date.setDate(date.getDate() + joursDecales);
  date.setHours(heure, 0, 0, 0);
  return date.toISOString();
}

/** La veille, tard — moins de 24 h avant MAINTENANT, mais un autre jour. */
const VEILLE_TARD = aLHeureLocale(-1, 23);
const CE_MATIN = aLHeureLocale(0, 8);
const AVANT_HIER = aLHeureLocale(-2, 8);

let compteur = 0;

function observation(skill: string, date: string): SkillObservation {
  return {
    id: `obs-${++compteur}`,
    skillCode: skill,
    date,
    type: "exercice",
    niveauObservation: "A",
    autonomie: "A3",
    qualite: "moyenne",
    resultat: "reussi",
    contexte: `Contexte ${compteur}`,
    dimensions: { comprehension: 0.9, application: 0.85 },
    source: { kind: "exercice", ref: "ex-1" },
  };
}

function tentative(fin: string, statut: ExerciseAttempt["statut"] = "terminee"): ExerciseAttempt {
  return {
    id: `att-${++compteur}`,
    exerciseId: "ex-1",
    debut: fin,
    fin,
    dureeMin: 20,
    indicesUtilises: 0,
    reponse: "…",
    evaluation: {},
    resultat: "reussi",
    statut,
  };
}

function seance(date: string, dureeMin = 20): LearningSession {
  return {
    id: `ses-${++compteur}`,
    date,
    dureeMin,
    domaines: ["developpement"],
    skillCodes: ["DEV-01"],
    activites: [{ type: "exercice", ref: "ex-1", libelle: "Tri" }],
    genereAutomatiquement: true,
    statut: "terminee",
  };
}

/* ------------------------------------------------------------------ */

describe("resumeCroissance — les deux fenêtres", () => {
  it("ne compte pas hier soir dans « aujourd'hui », même à moins de 24 h", () => {
    // Moins de 24 h avant maintenant, mais la veille au calendrier.
    const hierSoir = VEILLE_TARD;
    const resume = resumeCroissance({
      sessions: [],
      tentatives: [tentative(hierSoir)],
      observations: [observation("DEV-01", hierSoir)],
      skillsParCode: SKILLS,
      now: MAINTENANT,
    });

    expect(resume.jour.observations).toBe(0);
    expect(resume.jour.exercicesMenes).toBe(0);
    // La fenêtre glissante, elle, le voit.
    expect(resume.semaine.observations).toBe(1);
    expect(resume.semaine.exercicesMenes).toBe(1);
  });

  it("compte le travail du jour dans les deux fenêtres", () => {
    const ceMatin = CE_MATIN;
    const resume = resumeCroissance({
      sessions: [seance(ceMatin)],
      tentatives: [tentative(ceMatin)],
      observations: [observation("DEV-01", ceMatin)],
      skillsParCode: SKILLS,
      now: MAINTENANT,
    });

    expect(resume.jour.observations).toBe(1);
    expect(resume.jour.exercicesMenes).toBe(1);
    expect(resume.jour.minutes).toBe(20);
    expect(resume.semaine.observations).toBe(1);
  });

  it("ignore une tentative abandonnée (P2 : elle n'a rien mesuré)", () => {
    const ceMatin = CE_MATIN;
    const resume = resumeCroissance({
      sessions: [],
      tentatives: [tentative(ceMatin, "abandonnee")],
      observations: [],
      skillsParCode: SKILLS,
      now: MAINTENANT,
    });

    expect(resume.jour.exercicesMenes).toBe(0);
    expect(resume.vide).toBe(true);
  });
});

describe("resumeCroissance — ce qui a changé", () => {
  it("ne compte une première mesure qu'une fois dans l'histoire de la compétence", () => {
    const ancien = aLHeureLocale(-45, 8);
    const ceMatin = CE_MATIN;
    const resume = resumeCroissance({
      sessions: [],
      tentatives: [],
      observations: [observation("DEV-01", ancien), observation("DEV-01", ceMatin)],
      skillsParCode: SKILLS,
      now: MAINTENANT,
    });

    // La compétence était déjà mesurée en juillet : aujourd'hui n'inaugure rien.
    expect(resume.jour.premieresMesures).toBe(0);
  });

  it("reconnaît une compétence mesurée pour la première fois", () => {
    const ceMatin = CE_MATIN;
    const resume = resumeCroissance({
      sessions: [],
      tentatives: [],
      observations: [observation("DEV-02", ceMatin)],
      skillsParCode: SKILLS,
      now: MAINTENANT,
    });

    expect(resume.jour.premieresMesures).toBe(1);
  });

  it("liste les compétences travaillées sans doublon, dans l'ordre du journal", () => {
    const resume = resumeCroissance({
      sessions: [],
      tentatives: [],
      observations: [
        observation("DEV-02", aLHeureLocale(0, 9)),
        observation("DEV-01", aLHeureLocale(0, 8)),
        observation("DEV-01", aLHeureLocale(0, 9)),
      ],
      skillsParCode: SKILLS,
      now: MAINTENANT,
    });

    expect(resume.jour.competencesTravaillees).toEqual(["DEV-01", "DEV-02"]);
  });

  it("rend les événements de progression avec leur effet réel sur le niveau", () => {
    const resume = resumeCroissance({
      sessions: [],
      tentatives: [],
      observations: [
        observation("DEV-01", AVANT_HIER),
        observation("DEV-01", CE_MATIN),
      ],
      skillsParCode: SKILLS,
      now: MAINTENANT,
    });

    expect(resume.evenements).toHaveLength(2);
    // Le plus récent en tête, et chacun porte son avant/après.
    expect(resume.evenements[0].date).toBe(CE_MATIN);
    expect(resume.evenements[0]).toHaveProperty("niveauAvant");
    expect(resume.evenements[0]).toHaveProperty("niveauApres");
  });
});

describe("resumeCroissance — l'écran vide", () => {
  it("se juge sur la semaine, pas sur la journée", () => {
    const avantHier = AVANT_HIER;
    const resume = resumeCroissance({
      sessions: [seance(avantHier)],
      tentatives: [tentative(avantHier)],
      observations: [observation("DEV-01", avantHier)],
      skillsParCode: SKILLS,
      now: MAINTENANT,
    });

    expect(resume.jour.observations).toBe(0);
    expect(resume.vide).toBe(false);
  });

  it("est vide quand rien n'a eu lieu sur sept jours", () => {
    const resume = resumeCroissance({
      sessions: [],
      tentatives: [],
      observations: [observation("DEV-01", aLHeureLocale(-75, 8))],
      skillsParCode: SKILLS,
      now: MAINTENANT,
    });

    expect(resume.vide).toBe(true);
    expect(resume.semaine.observations).toBe(0);
  });
});

describe("resumeCroissance — un palier franchi n'est pas une rencontre", () => {
  it("ne compte pas une première mesure comme un palier franchi", () => {
    const resume = resumeCroissance({
      sessions: [],
      tentatives: [],
      // Une seule observation : la compétence passe de « non mesurée » à un niveau.
      observations: [observation("DEV-02", CE_MATIN)],
      skillsParCode: SKILLS,
      now: MAINTENANT,
    });

    const evenement = resume.evenements[0];
    expect(evenement.niveauAvant).toBeNull();
    // `evenementsRecents` dit « le niveau a changé »…
    expect(evenement.franchissement).toBe(true);
    // …mais la croissance ne l'appelle pas un palier franchi.
    expect(resume.jour.franchissements).toBe(0);
    expect(resume.jour.premieresMesures).toBe(1);
  });
});

/*
 * Le temps d'horloge d'une tentative abandonnée (ADR-071).
 *
 * C'est cet écran qui a rendu le défaut visible : le 15/08/2026, l'accueil de
 * l'Atelier affichait « AUJOURD'HUI · TRAVAILLÉ 16 h 55 · EXERCICES 0 ·
 * OBSERVATIONS 0 » pour `att-mst5fis8-rfsu6`, un exercice ouvert la veille au soir et
 * abandonné le matin — `duree_min = 1015`.
 */
describe("resumeCroissance — temps retenu d'un abandon", () => {
  const nuitOuverte: ExerciseAttempt = {
    ...tentative(CE_MATIN, "abandonnee"),
    debut: VEILLE_TARD,
    dureeMin: 1015,
    resultat: "partiel",
  };

  it("plafonne à la durée estimée quand elle est fournie", () => {
    const resume = resumeCroissance({
      sessions: [seance(CE_MATIN, 1015)],
      tentatives: [nuitOuverte],
      observations: [],
      skillsParCode: SKILLS,
      dureesEstimees: new Map([["ex-1", 60]]),
      now: MAINTENANT,
    });

    expect(resume.jour.minutes).toBe(60);
    expect(resume.semaine.minutes).toBe(60);
  });

  it("sans table d'estimations, retombe sur le garde-fou plutôt que sur 1015", () => {
    // `dureesEstimees` est optionnelle : un appelant qui l'oublie ne doit pas
    // pour autant réintroduire la nuit entière.
    const resume = resumeCroissance({
      sessions: [seance(CE_MATIN, 1015)],
      tentatives: [nuitOuverte],
      observations: [],
      skillsParCode: SKILLS,
      now: MAINTENANT,
    });

    expect(resume.jour.minutes).toBe(DUREE_ESTIMEE_MAX);
  });

  it("ne touche pas une tentative menée de durée plausible", () => {
    const resume = resumeCroissance({
      sessions: [seance(CE_MATIN)],
      tentatives: [tentative(CE_MATIN)],
      observations: [],
      skillsParCode: SKILLS,
      dureesEstimees: new Map([["ex-1", 15]]),
      now: MAINTENANT,
    });

    expect(resume.jour.minutes).toBe(20);
  });
});
