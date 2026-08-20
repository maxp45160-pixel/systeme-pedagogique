import { describe, expect, it } from "vitest";
import { construireGraphe } from "./graphe";
import { REFERENTIEL_TEST, referentielDe, skillDeTest } from "./referentiel.fixture";
import type { Exercise, SkillState } from "./types";
import { reconstruireIndexDocumentaire } from "@/lib/documents/index";

/*
 * Ce que ce fichier protège : le graphe ne dérive QUE des liens réels
 * (prérequis déclarés, exercice, similarité de vocabulaire), jamais
 * de liens fabriqués (chaîne séquentielle par code, regroupement par
 * mots-clés). Une compétence isolée reste isolée.
 */

function etat(surcharge: Partial<SkillState> = {}): SkillState {
  const skill = REFERENTIEL_TEST.parCode.get("DEV-01")!;
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
    ...surcharge,
  } as SkillState;
}

function etatsDuReferentiel(): SkillState[] {
  return REFERENTIEL_TEST.actifs.map((s) => etat({ skill: s }));
}

describe("construireGraphe", () => {
  it("ne produit aucune arête pour une compétence sans prérequis ni exercice", () => {
    const referentiel = referentielDe([
      skillDeTest("DEV-01", "developpement", "fondamentaux", 1, 0),
      skillDeTest("DEV-02", "developpement", "fondamentaux", 1, 1),
    ]);
    const etats = referentiel.actifs.map((s) => etat({ skill: s }));
    const { noeuds, liens } = construireGraphe(referentiel, etats, []);
    const idDev01 = "competence:DEV-01";
    expect(noeuds.some((n) => n.id === idDev01)).toBe(true);
    expect(liens.some((l) => l.source === idDev01 || l.target === idDev01)).toBe(false);
  });

  it("ne fabrique jamais de chaîne séquentielle par code — le backbone de l'ancienne version a disparu", () => {
    const { liens } = construireGraphe(REFERENTIEL_TEST, etatsDuReferentiel(), []);
    const faux = liens.find(
      (l) =>
        l.type === "prerequis" &&
        ((l.source === "competence:DEV-01" && l.target === "competence:DEV-02") ||
          (l.source === "competence:DEV-02" && l.target === "competence:DEV-01")),
    );
    expect(faux).toBeUndefined();
  });

  it("dérive un lien prerequis orienté pour chaque prérequis actif déclaré", () => {
    const { liens } = construireGraphe(REFERENTIEL_TEST, etatsDuReferentiel(), []);
    const l = liens.find((x) => x.type === "prerequis" && x.target === "competence:DEV-03");
    expect(l).toEqual({
      source: "competence:DEV-02",
      target: "competence:DEV-03",
      type: "prerequis",
      poids: 1,
      oriente: true,
    });
  });

  it("écarte un prérequis hors périmètre sans fabriquer de repli", () => {
    const referentiel = referentielDe([
      skillDeTest("DEV-01", "developpement", "fondamentaux", 1, 0),
      skillDeTest("DEV-02", "developpement", "fondamentaux", 1, 1, ["DEV-99"]),
    ]);
    const etats = referentiel.actifs.map((s) => etat({ skill: s }));
    const { liens } = construireGraphe(referentiel, etats, []);
    expect(liens).toHaveLength(0);
  });

  it("un exercice devient un nœud hub relié à ses compétences actives, un exercice archivé est exclu", () => {
    const exercices: Exercise[] = [
      {
        id: "ex-1",
        titre: "Exercice vivant",
        domaine: "developpement",
        type: "application",
        difficulte: 2,
        competences: ["DEV-01", "DEV-02"],
        dureeEstimeeMin: 10,
        enonce: "",
        indices: [],
        correction: "",
        criteres: [],
        origine: "seed",
      },
      {
        id: "ex-2",
        titre: "Exercice archivé",
        domaine: "developpement",
        type: "application",
        difficulte: 2,
        competences: ["DEV-01"],
        dureeEstimeeMin: 10,
        enonce: "",
        indices: [],
        correction: "",
        criteres: [],
        origine: "seed",
        archive: true,
      },
    ];
    const { noeuds, liens } = construireGraphe(REFERENTIEL_TEST, etatsDuReferentiel(), exercices);
    expect(noeuds.some((n) => n.id === "exercice:ex-1")).toBe(true);
    expect(noeuds.some((n) => n.id === "exercice:ex-2")).toBe(false);
    expect(liens.filter((l) => l.type === "exercice")).toHaveLength(2);
  });

  it("ajoute les documents Markdown et leurs liens résolus au graphe existant", () => {
    const exercice: Exercise = {
      id: "ex-1",
      titre: "Exercice vivant",
      domaine: "developpement",
      type: "application",
      difficulte: 2,
      competences: ["DEV-01"],
      dureeEstimeeMin: 10,
      enonce: "",
      indices: [],
      correction: "",
      criteres: [],
      origine: "seed",
    };
    const index = reconstruireIndexDocumentaire(
      [
        {
          id: "preuve-1",
          contenuMd: "---\ntype: preuve\nid: preuve-1\ncreated_at: 2026-08-12\n---\n\n# Production\n\n- [[DEV-01]]\n- [[exercice:ex-1]]\n- [[inconnu]]",
        },
      ],
      ["DEV-01", "exercice:ex-1"],
    );

    const graphe = construireGraphe(
      REFERENTIEL_TEST,
      etatsDuReferentiel(),
      [exercice],
      index,
    );

    expect(graphe.noeuds).toContainEqual(expect.objectContaining({
      id: "document:preuve-1",
      type: "document",
      libelle: "Production",
    }));
    expect(graphe.liens).toEqual(expect.arrayContaining([
      {
        source: "document:preuve-1",
        target: "competence:DEV-01",
        type: "document",
        poids: 0.8,
        oriente: true,
      },
      {
        source: "document:preuve-1",
        target: "exercice:ex-1",
        type: "document",
        poids: 0.8,
        oriente: true,
      },
    ]));
    expect(graphe.liens.some((lien) => lien.target === "inconnu")).toBe(false);
  });
});
