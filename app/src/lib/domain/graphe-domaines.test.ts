import { describe, expect, it } from "vitest";
import { construireGrapheDomaines } from "./graphe-domaines";
import {
  DOMAINES_TEST,
  domaineDeTest,
  referentielDe,
  skillDeTest,
} from "./referentiel.fixture";
import type { Exercise, Skill, SkillState } from "./types";

/*
 * Ce que ce fichier protège : le graphe des domaines ne dérive QUE de faits
 * déclarés — prérequis traversant une frontière, rattachement ADR-081,
 * exercice partagé. Un domaine sans trace reste isolé, et aucune proximité
 * de vocabulaire ne vient combler le vide.
 */

const MAINTENANT = new Date("2026-08-22T12:00:00.000Z");

function etat(skill: Skill, surcharge: Partial<SkillState> = {}): SkillState {
  return {
    skill,
    niveau: null,
    score: null,
    confiance: "nulle",
    robustesse: null,
    dimensions: {} as SkillState["dimensions"],
    observations: [],
    contextesTestes: [],
    derniereObservation: null,
    joursDepuisDerniereObservation: null,
    contradictions: [],
    prochaineEtape: "",
    explication: { resume: "", facteurs: [] },
    statut: "non-evalue",
    ...surcharge,
  } as SkillState;
}

function exercice(id: string, competences: string[], surcharge: Partial<Exercise> = {}): Exercise {
  return {
    id,
    titre: `Exercice ${id}`,
    competences,
    domaine: "developpement",
    archive: false,
    ...surcharge,
  } as Exercise;
}

describe("construireGrapheDomaines", () => {
  it("laisse isolé un domaine qu'aucun fait ne relie", () => {
    const referentiel = referentielDe([
      skillDeTest("DEV-01", "developpement", "fondamentaux", 1, 0),
      skillDeTest("STAT-01", "statistiques", "fondamentaux", 1, 0),
    ]);
    const etats = referentiel.actifs.map((s) => etat(s));

    const { noeuds, liens } = construireGrapheDomaines(referentiel, etats, [], {
      maintenant: MAINTENANT,
    });

    expect(noeuds.map((n) => n.id)).toEqual(["developpement", "statistiques"]);
    expect(liens).toEqual([]);
  });

  it("dérive un lien prerequis orienté quand un prérequis traverse une frontière", () => {
    const referentiel = referentielDe([
      skillDeTest("STAT-01", "statistiques", "fondamentaux", 1, 0),
      skillDeTest("DEV-01", "developpement", "fondamentaux", 1, 0, ["STAT-01"]),
    ]);
    const etats = referentiel.actifs.map((s) => etat(s));

    const { liens } = construireGrapheDomaines(referentiel, etats, [], {
      maintenant: MAINTENANT,
    });

    expect(liens).toEqual([
      {
        source: "statistiques",
        target: "developpement",
        type: "prerequis",
        occurrences: 1,
        poids: 1,
        oriente: true,
      },
    ]);
  });

  it("ne produit aucun lien pour un prérequis interne au domaine", () => {
    const referentiel = referentielDe([
      skillDeTest("DEV-01", "developpement", "fondamentaux", 1, 0),
      skillDeTest("DEV-02", "developpement", "fondamentaux", 1, 1, ["DEV-01"]),
    ]);
    const etats = referentiel.actifs.map((s) => etat(s));

    const { liens } = construireGrapheDomaines(referentiel, etats, [], {
      maintenant: MAINTENANT,
    });

    expect(liens).toEqual([]);
  });

  it("écarte un prérequis hors périmètre sans fabriquer de repli", () => {
    const referentiel = referentielDe([
      skillDeTest("STAT-01", "statistiques", "fondamentaux", 1, 0, [], { active: false }),
      skillDeTest("DEV-01", "developpement", "fondamentaux", 1, 0, ["STAT-01"]),
    ]);
    const etats = referentiel.actifs.map((s) => etat(s));

    const { liens } = construireGrapheDomaines(referentiel, etats, [], {
      maintenant: MAINTENANT,
    });

    expect(liens).toEqual([]);
  });

  it("dérive un lien non orienté entre deux domaines qu'une même compétence sert (ADR-107)", () => {
    const referentiel = referentielDe(
      [skillDeTest("DEV-01", "developpement", "fondamentaux", 1, 0)],
      DOMAINES_TEST,
      [
        { code: "DEV-01", domaine: "developpement" },
        { code: "DEV-01", domaine: "statistiques" },
      ],
    );
    const etats = referentiel.actifs.map((s) => etat(s));

    const { liens, noeuds } = construireGrapheDomaines(referentiel, etats, [], {
      maintenant: MAINTENANT,
    });

    expect(liens).toEqual([
      {
        source: "developpement",
        target: "statistiques",
        type: "rattachement",
        occurrences: 1,
        poids: 1,
        oriente: false,
      },
    ]);
    // La rattachée compte dans la couverture des deux domaines, jamais dupliquée.
    expect(noeuds.find((n) => n.id === "statistiques")?.nombreCompetences).toBe(1);
    expect(noeuds.find((n) => n.id === "developpement")?.nombreCompetences).toBe(1);
  });

  it("relie deux domaines qu'un même exercice vivant mobilise", () => {
    const referentiel = referentielDe([
      skillDeTest("DEV-01", "developpement", "fondamentaux", 1, 0),
      skillDeTest("STAT-01", "statistiques", "fondamentaux", 1, 0),
    ]);
    const etats = referentiel.actifs.map((s) => etat(s));

    const { liens } = construireGrapheDomaines(
      referentiel,
      etats,
      [exercice("ex-1", ["DEV-01", "STAT-01"])],
      { maintenant: MAINTENANT },
    );

    expect(liens).toEqual([
      {
        source: "developpement",
        target: "statistiques",
        type: "exercice",
        occurrences: 1,
        poids: 1,
        oriente: false,
      },
    ]);
  });

  it("ignore un exercice archivé", () => {
    const referentiel = referentielDe([
      skillDeTest("DEV-01", "developpement", "fondamentaux", 1, 0),
      skillDeTest("STAT-01", "statistiques", "fondamentaux", 1, 0),
    ]);
    const etats = referentiel.actifs.map((s) => etat(s));

    const { liens } = construireGrapheDomaines(
      referentiel,
      etats,
      [exercice("ex-1", ["DEV-01", "STAT-01"], { archive: true })],
      { maintenant: MAINTENANT },
    );

    expect(liens).toEqual([]);
  });

  it("compte les occurrences et normalise le poids par type", () => {
    const referentiel = referentielDe(
      [
        skillDeTest("STAT-01", "statistiques", "fondamentaux", 1, 0),
        skillDeTest("STAT-02", "statistiques", "fondamentaux", 1, 1),
        skillDeTest("DEV-01", "developpement", "fondamentaux", 1, 0, ["STAT-01", "STAT-02"]),
        skillDeTest("ALG-01", "algebre", "fondamentaux", 1, 0, ["STAT-01"]),
      ],
      [...DOMAINES_TEST, domaineDeTest("algebre", "Algèbre", "ALG", 2)],
    );
    const etats = referentiel.actifs.map((s) => etat(s));

    const { liens } = construireGrapheDomaines(referentiel, etats, [], {
      maintenant: MAINTENANT,
    });

    const versDev = liens.find((l) => l.target === "developpement");
    const versAlg = liens.find((l) => l.target === "algebre");
    expect(versDev).toMatchObject({ occurrences: 2, poids: 1 });
    expect(versAlg).toMatchObject({ occurrences: 1, poids: 0.5 });
  });

  it("marque actif un domaine observé dans la fenêtre, et pas au-delà", () => {
    const referentiel = referentielDe([
      skillDeTest("DEV-01", "developpement", "fondamentaux", 1, 0),
      skillDeTest("STAT-01", "statistiques", "fondamentaux", 1, 0),
    ]);
    const etats = [
      etat(referentiel.parCode.get("DEV-01")!, {
        derniereObservation: "2026-08-20T09:00:00.000Z",
        statut: "evalue",
      }),
      etat(referentiel.parCode.get("STAT-01")!, {
        derniereObservation: "2026-01-05T09:00:00.000Z",
        statut: "evalue",
      }),
    ];

    const { noeuds } = construireGrapheDomaines(referentiel, etats, [], {
      maintenant: MAINTENANT,
    });

    expect(noeuds.find((n) => n.id === "developpement")).toMatchObject({
      actif: true,
      nombreEvaluees: 1,
      couverture: 1,
    });
    expect(noeuds.find((n) => n.id === "statistiques")?.actif).toBe(false);
  });

  it("ne marque jamais actif un domaine sans observation, et met sa couverture à zéro", () => {
    const referentiel = referentielDe([
      skillDeTest("DEV-01", "developpement", "fondamentaux", 1, 0),
    ]);
    const etats = referentiel.actifs.map((s) => etat(s));

    const { noeuds } = construireGrapheDomaines(referentiel, etats, [], {
      maintenant: MAINTENANT,
    });

    expect(noeuds[0]).toMatchObject({ actif: false, couverture: 0, derniereObservation: null });
  });

  it("exclut les domaines archivés, nœuds comme arêtes", () => {
    const referentiel = referentielDe(
      [
        skillDeTest("STAT-01", "statistiques", "fondamentaux", 1, 0),
        skillDeTest("DEV-01", "developpement", "fondamentaux", 1, 0, ["STAT-01"]),
      ],
      [
        domaineDeTest("developpement", "Développement logiciel", "DEV", 0),
        { ...domaineDeTest("statistiques", "Statistiques", "STAT", 1), archive: true },
      ],
    );
    const etats = referentiel.actifs.map((s) => etat(s));

    const { noeuds, liens } = construireGrapheDomaines(referentiel, etats, [], {
      maintenant: MAINTENANT,
    });

    expect(noeuds.map((n) => n.id)).toEqual(["developpement"]);
    expect(liens).toEqual([]);
  });

  it("ordonne les nœuds par ordre déclaré du référentiel", () => {
    const referentiel = referentielDe(
      [
        skillDeTest("DEV-01", "developpement", "fondamentaux", 1, 0),
        skillDeTest("STAT-01", "statistiques", "fondamentaux", 1, 0),
        skillDeTest("ALG-01", "algebre", "fondamentaux", 1, 0),
      ],
      [
        domaineDeTest("algebre", "Algèbre", "ALG", 0),
        domaineDeTest("developpement", "Développement logiciel", "DEV", 1),
        domaineDeTest("statistiques", "Statistiques", "STAT", 2),
      ],
    );
    const etats = referentiel.actifs.map((s) => etat(s));

    const { noeuds } = construireGrapheDomaines(referentiel, etats, [], {
      maintenant: MAINTENANT,
    });

    expect(noeuds.map((n) => n.id)).toEqual(["algebre", "developpement", "statistiques"]);
  });
});
