import { describe, expect, it } from "vitest";
import { construireGraphe } from "./graphe";
import { REFERENTIEL_TEST, referentielDe, skillDeTest } from "./referentiel.fixture";
import type { Exercise, SkillState } from "./types";
import type { Theme } from "./theme";
import { reconstruireIndexDocumentaire } from "@/lib/documents/index";

/*
 * Ce que ce fichier protège : le graphe ne dérive QUE des liens réels
 * (prérequis déclarés, thème, exercice, similarité de vocabulaire), jamais
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
  it("ne produit aucune arête pour une compétence sans prérequis, thème ni exercice", () => {
    // Référentiel volontairement sans aucun prérequis déclaré — contrairement
    // à REFERENTIEL_TEST, où DEV-04/DEV-06 en portent (fixture partagée).
    const referentiel = referentielDe([
      skillDeTest("DEV-01", "developpement", "fondamentaux", 1, 0),
      skillDeTest("DEV-02", "developpement", "fondamentaux", 1, 1),
    ]);
    const etats = referentiel.actifs.map((s) => etat({ skill: s }));
    const { noeuds, liens } = construireGraphe(referentiel, etats, [], []);
    const idDev01 = "competence:DEV-01";
    expect(noeuds.some((n) => n.id === idDev01)).toBe(true);
    // DEV-01 n'est le prérequis explicite de personne dans ce test, et n'a
    // ni thème ni exercice : aucun lien ne doit le toucher.
    expect(liens.some((l) => l.source === idDev01 || l.target === idDev01)).toBe(false);
  });

  it("ne fabrique jamais de chaîne séquentielle par code — le backbone de l'ancienne version a disparu", () => {
    // DEV-01, DEV-02 sont consécutifs et sans prérequis déclaré entre eux :
    // l'ancienne version les aurait reliés par un faux « prerequis » 0.7.
    const { liens } = construireGraphe(REFERENTIEL_TEST, etatsDuReferentiel(), [], []);
    const faux = liens.find(
      (l) =>
        l.type === "prerequis" &&
        ((l.source === "competence:DEV-01" && l.target === "competence:DEV-02") ||
          (l.source === "competence:DEV-02" && l.target === "competence:DEV-01")),
    );
    expect(faux).toBeUndefined();
  });

  it("dérive un lien prerequis orienté pour chaque prérequis actif déclaré", () => {
    const { liens } = construireGraphe(REFERENTIEL_TEST, etatsDuReferentiel(), [], []);
    // DEV-03 déclare DEV-02 en prérequis (referentiel.fixture.ts).
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
    const { liens } = construireGraphe(referentiel, etats, [], []);
    expect(liens).toHaveLength(0);
  });

  it("un thème avec au moins 2 codes actifs devient un nœud hub relié à ses membres", () => {
    const theme: Theme = {
      id: "theme-1",
      libelle: "Un thème",
      codes: ["DEV-01", "DEV-02"],
      origine: "utilisateur",
      creeLe: "2026-08-01T00:00:00.000Z",
      archive: false,
    };
    const { noeuds, liens } = construireGraphe(REFERENTIEL_TEST, etatsDuReferentiel(), [], [theme]);
    expect(noeuds.some((n) => n.id === "theme:theme-1" && n.type === "theme")).toBe(true);
    expect(liens.filter((l) => l.type === "theme")).toEqual([
      { source: "theme:theme-1", target: "competence:DEV-01", type: "theme", poids: 0.6, oriente: false },
      { source: "theme:theme-1", target: "competence:DEV-02", type: "theme", poids: 0.6, oriente: false },
    ]);
  });

  it("un thème avec un seul code actif n'entre pas dans le graphe", () => {
    const referentiel = referentielDe([
      skillDeTest("DEV-01", "developpement", "fondamentaux", 1, 0),
      skillDeTest("DEV-02", "developpement", "fondamentaux", 1, 1),
    ]);
    const etats = referentiel.actifs.map((s) => etat({ skill: s }));
    const theme: Theme = {
      id: "theme-1",
      libelle: "Un thème isolé",
      codes: ["DEV-01"],
      origine: "utilisateur",
      creeLe: "2026-08-01T00:00:00.000Z",
      archive: false,
    };
    const { noeuds, liens } = construireGraphe(referentiel, etats, [], [theme]);
    expect(noeuds.some((n) => n.id === "theme:theme-1")).toBe(false);
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
    const { noeuds, liens } = construireGraphe(REFERENTIEL_TEST, etatsDuReferentiel(), exercices, []);
    expect(noeuds.some((n) => n.id === "exercice:ex-1")).toBe(true);
    expect(noeuds.some((n) => n.id === "exercice:ex-2")).toBe(false);
    expect(liens.filter((l) => l.type === "exercice")).toHaveLength(2);
  });

  it("dédoublonne les liens identiques", () => {
    const referentiel = referentielDe([
      skillDeTest("DEV-01", "developpement", "fondamentaux", 1, 0),
      skillDeTest("DEV-02", "developpement", "fondamentaux", 1, 1, ["DEV-01"]),
    ]);
    const etats = referentiel.actifs.map((s) => etat({ skill: s }));
    const theme: Theme = {
      id: "t1",
      libelle: "Doublon potentiel",
      codes: ["DEV-01", "DEV-02"],
      origine: "utilisateur",
      creeLe: "2026-08-01T00:00:00.000Z",
      archive: false,
    };
    const { liens } = construireGraphe(referentiel, etats, [], [theme, theme]);
    // Le même thème deux fois ne doit pas produire deux fois les mêmes arêtes.
    expect(liens.filter((l) => l.type === "theme")).toHaveLength(2);
  });

  it("préfixe tous les identifiants par type — pas de collision entre espaces de noms", () => {
    const theme: Theme = {
      id: "DEV-01", // collision volontaire avec un code de compétence
      libelle: "Collision d'id",
      codes: ["DEV-01", "DEV-02"],
      origine: "utilisateur",
      creeLe: "2026-08-01T00:00:00.000Z",
      archive: false,
    };
    const { noeuds } = construireGraphe(REFERENTIEL_TEST, etatsDuReferentiel(), [], [theme]);
    const ids = noeuds.map((n) => n.id);
    expect(ids).toContain("competence:DEV-01");
    expect(ids).toContain("theme:DEV-01");
    expect(new Set(ids).size).toBe(ids.length);
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
      [],
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
