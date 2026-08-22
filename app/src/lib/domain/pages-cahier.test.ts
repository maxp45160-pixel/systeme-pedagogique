import { describe, expect, it } from "vitest";
import {
  construirePage,
  extraireDocumentsOperationnels,
  grilleMois,
  jourDeLaSeance,
  jourValide,
  joursDuCahier,
  moisDecale,
  moisValide,
  resumeDuJour,
  resumesDuMois,
  semaineDuJour,
  voisinesDeLaPage,
} from "./pages-cahier";
import type { ExerciseAttempt, LearningSession } from "./types";

const AUJOURDHUI = new Date("2026-08-16T10:00:00");

function seance(extra: Partial<LearningSession> = {}): LearningSession {
  return {
    id: "ses-1",
    date: "2026-08-14T09:00:00.000Z",
    domaines: ["developpement"],
    skillCodes: ["DEV-01"],
    activites: [{ type: "exercice", ref: "ex-a", libelle: "A" }],
    genereAutomatiquement: false,
    ...extra,
  };
}

import type { ApercuDocument } from "@/lib/documents/types-documents";

describe("extraireDocumentsOperationnels", () => {
  it("extrait uniquement les documents au rôle opérationnel", () => {
    const apercus: ApercuDocument[] = [
      {
        id: "doc-1",
        titre: "Projet LLM",
        type: "projet",
        tags: [],
        schema: "pedagogie/v1",
        schemaCompatible: true,
        frontMatter: {
          role: "operationnel",
          contexte: "Création simulateur",
          projet_duree_min: "45",
          projet_competences: "UPL-01, EES-01",
        },
        liens: [{ cible: "UPL-01" }, { cible: "EES-01" }],
        createdAt: "2026-08-16T12:00:00.000Z",
        updatedAt: "2026-08-16T12:00:00.000Z",
      },
      {
        id: "doc-2",
        titre: "Note de cours",
        type: "cours",
        tags: [],
        schema: "pedagogie/v1",
        schemaCompatible: true,
        frontMatter: { role: "support" },
        liens: [],
        createdAt: "2026-08-15T12:00:00.000Z",
        updatedAt: "2026-08-15T12:00:00.000Z",
      },
    ];

    const resultats = extraireDocumentsOperationnels(apercus, []);
    expect(resultats).toHaveLength(1);
    expect(resultats[0].id).toBe("doc-1");
    expect(resultats[0].titre).toBe("Projet LLM");
    expect(resultats[0].dureeMin).toBe(45);
    expect(resultats[0].competences).toEqual(["UPL-01", "EES-01"]);
    expect(resultats[0].fige).toBe(false);
  });
});

describe("jourDeLaSeance", () => {
  it("range une séance planifiée sur le jour prévu, pas sur sa date d'écriture", () => {
    // C'est ce qui donne au cahier des pages à venir : on va chercher une
    // séance prévue là où elle aura lieu.
    const prevue = seance({
      statut: "planifiee",
      date: "2026-08-14T09:00:00.000Z",
      planifieePour: "2026-08-20T09:00:00.000Z",
    });
    expect(jourDeLaSeance(prevue)).toBe("2026-08-20");
  });

  it("range toutes les autres sur leur date réelle", () => {
    expect(jourDeLaSeance(seance({ statut: "terminee" }))).toBe("2026-08-14");
    expect(jourDeLaSeance(seance({ statut: "en-cours" }))).toBe("2026-08-14");
  });
});

describe("jourValide", () => {
  it("accepte une clé bien formée et refuse le reste sans rien deviner", () => {
    expect(jourValide("2026-08-16")).toBe("2026-08-16");
    expect(jourValide("16/08/2026")).toBeNull();
    expect(jourValide("2026-8-1")).toBeNull();
    expect(jourValide(undefined)).toBeNull();
    expect(jourValide("2026-13-45")).toBeNull();
  });
});

describe("joursDuCahier", () => {
  it("inclut toujours le jour courant : c'est la page où l'on écrit", () => {
    expect(joursDuCahier({ seances: [], notes: [], aujourdHui: AUJOURDHUI })).toEqual([
      "2026-08-16",
    ]);
  });

  it("rassemble séances, notes et projets, sans doublon, du plus ancien au plus récent", () => {
    const jours = joursDuCahier({
      seances: [
        seance({ id: "a", date: "2026-08-14T09:00:00.000Z" }),
        seance({ id: "b", date: "2026-08-14T18:00:00.000Z" }),
        seance({ id: "c", statut: "planifiee", planifieePour: "2026-08-20T09:00:00.000Z" }),
      ],
      notes: [{ notee: "2026-08-11" }, { notee: "2026-08-14" }, {}],
      projets: [
        {
          id: "p-1",
          titre: "Projet 1",
          type: "projet",
          competences: [],
          createdAt: "2026-08-12T10:00:00.000Z",
        },
      ],
      aujourdHui: AUJOURDHUI,
    });
    expect(jours).toEqual(["2026-08-11", "2026-08-12", "2026-08-14", "2026-08-16", "2026-08-20"]);
  });
});

describe("construirePage", () => {
  const entrees = {
    seances: [
      seance({ id: "composee", date: "2026-08-14T09:00:00.000Z" }),
      seance({ id: "trace-1", date: "2026-08-14T11:00:00.000Z", genereAutomatiquement: true }),
      seance({ id: "trace-2", date: "2026-08-14T10:00:00.000Z", genereAutomatiquement: true }),
      seance({ id: "autre-jour", date: "2026-08-15T09:00:00.000Z" }),
    ],
    notes: [{ notee: "2026-08-14" }, { notee: "2026-08-15" }],
    projets: [
      {
        id: "proj-1",
        titre: "Simulateur",
        type: "projet",
        competences: ["DEV-01"],
        createdAt: "2026-08-14T14:00:00.000Z",
      },
    ],
  };

  it("sépare les séances composées des traces automatiques", () => {
    // 45 des 51 lignes de `sessions` sont des traces : les rendre comme des
    // séances noyait les vraies.
    const page = construirePage("2026-08-14", entrees);
    expect(page.seances.map((s) => s.id)).toEqual(["composee"]);
    expect(page.traces.map((s) => s.id)).toEqual(["trace-2", "trace-1"]);
  });

  it("ne retient que les notes et projets du jour", () => {
    const page = construirePage("2026-08-14", entrees);
    expect(page.notes).toEqual([{ notee: "2026-08-14" }]);
    expect(page.projets).toHaveLength(1);
    expect(page.projets[0].id).toBe("proj-1");
  });

  it("rend une page vide plutôt que rien, pour un jour sans contenu", () => {
    const page = construirePage("2026-08-01", entrees);
    expect(page.jour).toBe("2026-08-01");
    expect(page.seances).toHaveLength(0);
    expect(page.notes).toHaveLength(0);
  });
});

describe("voisinesDeLaPage", () => {
  const jours = ["2026-08-11", "2026-08-14", "2026-08-16"];

  it("saute les jours vides : un cahier n'est pas un calendrier", () => {
    expect(voisinesDeLaPage("2026-08-14", jours)).toEqual({
      precedente: "2026-08-11",
      suivante: "2026-08-16",
    });
  });

  it("n'a pas de voisine au-delà des bords", () => {
    expect(voisinesDeLaPage("2026-08-11", jours).precedente).toBeNull();
    expect(voisinesDeLaPage("2026-08-16", jours).suivante).toBeNull();
  });

  it("situe un jour absent de la liste entre ses voisins immédiats", () => {
    expect(voisinesDeLaPage("2026-08-12", jours)).toEqual({
      precedente: "2026-08-11",
      suivante: "2026-08-14",
    });
  });
});

describe("calendrier", () => {
  it("décale les mois en respectant le passage d'année", () => {
    expect(moisDecale("2026-08", 1)).toBe("2026-09");
    expect(moisDecale("2026-12", 1)).toBe("2027-01");
    expect(moisDecale("2026-01", -1)).toBe("2025-12");
    expect(moisDecale("2026-08", -13)).toBe("2025-07");
  });

  it("valide un mois et refuse le reste", () => {
    expect(moisValide("2026-08")).toBe("2026-08");
    expect(moisValide("2026-13")).toBeNull();
    expect(moisValide("2026-8")).toBeNull();
    expect(moisValide(undefined)).toBeNull();
  });

  it("commence les semaines le lundi", () => {
    // Le 1er août 2026 est un samedi : la première semaine commence donc le
    // lundi 27 juillet.
    const grille = grilleMois("2026-08", [], AUJOURDHUI);
    expect(grille[0][0].jour).toBe("2026-07-27");
    expect(grille[0][0].dansLeMois).toBe(false);
    expect(grille[0][5].jour).toBe("2026-08-01");
    expect(grille[0][5].dansLeMois).toBe(true);
  });

  it("marque les jours qui portent une page, et aujourd'hui", () => {
    const grille = grilleMois("2026-08", ["2026-08-14"], AUJOURDHUI).flat();
    expect(grille.find((c) => c.jour === "2026-08-14")?.aContenu).toBe(true);
    expect(grille.find((c) => c.jour === "2026-08-13")?.aContenu).toBe(false);
    expect(grille.find((c) => c.jour === "2026-08-16")?.estAujourdHui).toBe(true);
  });

  it("couvre tout le mois sans traîner une semaine entièrement vide", () => {
    for (const mois of ["2026-02", "2026-08", "2027-02", "2024-02"]) {
      const cases = grilleMois(mois, [], AUJOURDHUI).flat();
      const dedans = cases.filter((c) => c.dansLeMois);
      const dernier = new Date(`${moisDecale(mois, 1)}-01T12:00:00`);
      dernier.setDate(0);
      expect(dedans).toHaveLength(dernier.getDate());
      expect(cases.length % 7).toBe(0);
    }
  });
});



/* ------------------------------------------------------------------ */
/* Le résumé d'un jour et la bande de semaine (ADR-101)                 */
/* ------------------------------------------------------------------ */

function tentative(extra: Partial<ExerciseAttempt> = {}): ExerciseAttempt {
  return {
    id: "att-1",
    exerciseId: "ex-a",
    debut: "2026-08-14T09:05:00.000Z",
    fin: "2026-08-14T09:25:00.000Z",
    indicesUtilises: 0,
    reponse: "",
    evaluation: {},
    resultat: "reussi",
    statut: "terminee",
    ...extra,
  };
}

describe("resumeDuJour", () => {
  it("compte les résultats des tentatives menées pendant les séances du jour", () => {
    const resume = resumeDuJour("2026-08-14", {
      seances: [
        seance({
          activites: [
            { type: "exercice", ref: "ex-a", libelle: "A" },
            { type: "exercice", ref: "ex-b", libelle: "B" },
          ],
          statut: "terminee",
        }),
      ],
      notes: [],
      tentatives: [
        tentative({ exerciseId: "ex-a", resultat: "reussi" }),
        tentative({ id: "att-2", exerciseId: "ex-b", resultat: "partiel" }),
      ],
    });

    expect(resume.reussis).toBe(1);
    expect(resume.partiels).toBe(1);
    expect(resume.nonAboutis).toBe(0);
    expect(resume.seances).toBe(1);
  });

  it("ne compte pas une tentative ouverte avant le début de la séance", () => {
    const resume = resumeDuJour("2026-08-14", {
      seances: [seance({ statut: "terminee" })],
      notes: [],
      // Antérieure à `seance.date` : c'est « fait un jour », pas « fait
      // pendant cette séance ».
      tentatives: [tentative({ debut: "2026-08-01T08:00:00.000Z" })],
    });

    expect(resume.reussis).toBe(0);
  });

  it("laisse la durée absente quand aucune séance n'en note (invariant 3)", () => {
    const resume = resumeDuJour("2026-08-14", {
      seances: [seance({ statut: "terminee" })],
      notes: [],
      tentatives: [],
    });

    expect(resume.dureeMin).toBeUndefined();
  });

  it("somme les durées notées", () => {
    const resume = resumeDuJour("2026-08-14", {
      seances: [
        seance({ id: "s1", statut: "terminee", dureeMin: 20 }),
        seance({ id: "s2", statut: "terminee", dureeMin: 25 }),
      ],
      notes: [],
      tentatives: [],
    });

    expect(resume.dureeMin).toBe(45);
  });

  it("signale un jour dont une séance attend encore un geste", () => {
    const resume = resumeDuJour("2026-08-14", {
      seances: [seance({ statut: "en-cours" })],
      notes: [],
      tentatives: [],
    });

    expect(resume.ouverte).toBe(true);
  });

  it("ne signale pas ouvert un jour dont tout est refermé", () => {
    const resume = resumeDuJour("2026-08-14", {
      seances: [seance({ statut: "terminee" })],
      notes: [],
      tentatives: [],
    });

    expect(resume.ouverte).toBe(false);
  });

  it("sépare les traces automatiques des séances composées", () => {
    const resume = resumeDuJour("2026-08-14", {
      seances: [
        seance({ id: "s1", statut: "terminee" }),
        seance({ id: "s2", statut: "terminee", genereAutomatiquement: true }),
      ],
      notes: [],
      tentatives: [],
    });

    expect(resume.seances).toBe(1);
    expect(resume.traces).toBe(1);
  });

  it("reprend l'intention déclarée comme titre du jour", () => {
    const resume = resumeDuJour("2026-08-14", {
      seances: [
        seance({
          statut: "terminee",
          besoinDeclare: {
            intention: "Comprendre le stock de sécurité",
            codesVises: ["DEV-01"],
            tempsDisponibleMin: 45,
            declareLe: "2026-08-14T08:55:00.000Z",
          },
        }),
      ],
      notes: [],
      tentatives: [],
    });

    expect(resume.titre).toBe("Comprendre le stock de sécurité");
  });
});

describe("resumesDuMois", () => {
  it("ne garde que les jours du mois, du plus récent au plus ancien", () => {
    const jours = ["2026-07-30", "2026-08-03", "2026-08-14", "2026-09-01"];
    const resumes = resumesDuMois("2026-08", jours, {
      seances: [],
      notes: [],
      tentatives: [],
    });

    expect(resumes.map((r) => r.jour)).toEqual(["2026-08-14", "2026-08-03"]);
  });
});

describe("semaineDuJour", () => {
  it("rend les sept jours du lundi au dimanche", () => {
    // 2026-08-21 est un vendredi.
    expect(semaineDuJour("2026-08-21")).toEqual([
      "2026-08-17",
      "2026-08-18",
      "2026-08-19",
      "2026-08-20",
      "2026-08-21",
      "2026-08-22",
      "2026-08-23",
    ]);
  });

  it("traite le dimanche comme la fin de sa semaine, pas le début de la suivante", () => {
    // 2026-08-23 est un dimanche : `getDay()` rend 0, d'où le décalage.
    expect(semaineDuJour("2026-08-23")[0]).toBe("2026-08-17");
    expect(semaineDuJour("2026-08-23")[6]).toBe("2026-08-23");
  });

  it("traverse un changement de mois", () => {
    expect(semaineDuJour("2026-09-01")).toEqual([
      "2026-08-31",
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
      "2026-09-04",
      "2026-09-05",
      "2026-09-06",
    ]);
  });
});
