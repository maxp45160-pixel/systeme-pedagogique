import { describe, expect, it } from "vitest";
import { construireArbreDomaine } from "./arbre-competences";
import { DOMAINES_TEST, referentielDe, skillDeTest } from "./referentiel.fixture";
import type { Skill, SkillState } from "./types";

/*
 * Ce que ce fichier protège :
 *   - un prérequis manquant est AFFICHÉ (grisé) au lieu d'être jeté — c'est
 *     l'information que l'utilisateur veut voir ;
 *   - les deux fantômes ne sont jamais confondus : `hors-perimetre` (le
 *     référentiel le connaît) et `non-creee` (personne ne le connaît) ;
 *   - aucune arête vers l'avant n'est inventée : ce qui n'est pas déclaré
 *     n'apparaît pas, et se signale par une feuille.
 */

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

/** Une compétence maîtrisée au sens de `estMaitrisee` : niveau ≥ 4, confiance ≥ moyenne. */
function etatMaitrise(skill: Skill): SkillState {
  return etat(skill, {
    niveau: 4,
    confiance: "forte",
    statut: "evalue",
    observations: [{}, {}] as SkillState["observations"],
    derniereObservation: "2026-08-20T09:00:00.000Z",
  });
}

describe("construireArbreDomaine", () => {
  it("range les compétences par palier puis par ordre déclaré", () => {
    const referentiel = referentielDe([
      skillDeTest("DEV-02", "developpement", "fondamentaux", 1, 1),
      skillDeTest("DEV-01", "developpement", "fondamentaux", 1, 0),
      skillDeTest("DEV-04", "developpement", "intermediaire", 1, 0),
    ]);
    const etats = referentiel.actifs.map((s) => etat(s));

    const arbre = construireArbreDomaine("developpement", referentiel, etats);

    expect(arbre.rangees.map((r) => r.palier)).toEqual(["fondamentaux", "intermediaire"]);
    expect(arbre.rangees[0].noeuds.map((n) => n.code)).toEqual(["DEV-01", "DEV-02"]);
    expect(arbre.rangees[1].noeuds.map((n) => n.code)).toEqual(["DEV-04"]);
  });

  it("n'ouvre aucune rangée pour un palier vide", () => {
    const referentiel = referentielDe([
      skillDeTest("DEV-01", "developpement", "fondamentaux", 1, 0),
    ]);
    const arbre = construireArbreDomaine(
      "developpement",
      referentiel,
      referentiel.actifs.map((s) => etat(s)),
    );

    expect(arbre.rangees).toHaveLength(1);
  });

  it("dérive les quatre statuts d'une compétence travaillable", () => {
    const referentiel = referentielDe([
      skillDeTest("DEV-01", "developpement", "fondamentaux", 1, 0),
      skillDeTest("DEV-02", "developpement", "fondamentaux", 1, 1),
      skillDeTest("DEV-03", "developpement", "fondamentaux", 1, 2, ["DEV-01"]),
      skillDeTest("DEV-04", "developpement", "fondamentaux", 1, 3, ["DEV-02"]),
    ]);
    const parCode = referentiel.parCode;
    const etats = [
      etatMaitrise(parCode.get("DEV-01")!),
      etat(parCode.get("DEV-02")!, {
        niveau: 2,
        confiance: "faible",
        statut: "evalue",
        observations: [{}] as SkillState["observations"],
      }),
      // DEV-03 : prérequis DEV-01 maîtrisé, aucune observation → disponible.
      etat(parCode.get("DEV-03")!),
      // DEV-04 : prérequis DEV-02 pas encore maîtrisé → prerequis-incomplet.
      etat(parCode.get("DEV-04")!),
    ];

    const arbre = construireArbreDomaine("developpement", referentiel, etats);
    const statut = (code: string) =>
      arbre.rangees.flatMap((r) => r.noeuds).find((n) => n.code === code)?.statut;

    expect(statut("DEV-01")).toBe("maitrisee");
    expect(statut("DEV-02")).toBe("en-cours");
    expect(statut("DEV-03")).toBe("disponible");
    expect(statut("DEV-04")).toBe("prerequis-incomplet");
  });

  it("affiche en hors-perimetre un prérequis que le référentiel connaît mais n'active pas", () => {
    const referentiel = referentielDe([
      skillDeTest("STAT-01", "statistiques", "fondamentaux", 1, 0, [], { active: false }),
      skillDeTest("DEV-01", "developpement", "intermediaire", 1, 0, ["STAT-01"]),
    ]);
    const etats = referentiel.actifs.map((s) => etat(s));

    const arbre = construireArbreDomaine("developpement", referentiel, etats);
    const noeud = arbre.rangees.flatMap((r) => r.noeuds).find((n) => n.code === "STAT-01");

    expect(noeud).toMatchObject({
      statut: "hors-perimetre",
      intitule: "Intitulé de STAT-01",
      palier: "fondamentaux", // son vrai palier, pas celui de la compétence qui la cite
      palierInconnu: false,
    });
    expect(arbre.aretes).toContainEqual({ source: "STAT-01", target: "DEV-01", fantome: true });
  });

  it("affiche en non-creee un prérequis que personne ne connaît, et lui emprunte un palier", () => {
    const referentiel = referentielDe([
      skillDeTest("DEV-01", "developpement", "intermediaire", 1, 0, ["FANTOME-42"]),
    ]);
    const etats = referentiel.actifs.map((s) => etat(s));

    const arbre = construireArbreDomaine("developpement", referentiel, etats);
    const noeud = arbre.rangees.flatMap((r) => r.noeuds).find((n) => n.code === "FANTOME-42");

    expect(noeud).toMatchObject({
      statut: "non-creee",
      intitule: "FANTOME-42", // faute de mieux : le code fait office d'intitulé
      palier: "intermediaire", // emprunté à DEV-01
      palierInconnu: true,
      niveau: null,
    });
  });

  it("n'invente aucun nœud fantôme sans une arête qui le cite", () => {
    const referentiel = referentielDe([
      skillDeTest("DEV-01", "developpement", "fondamentaux", 1, 0),
      skillDeTest("STAT-01", "statistiques", "fondamentaux", 1, 0, [], { active: false }),
    ]);
    const etats = referentiel.actifs.map((s) => etat(s));

    const arbre = construireArbreDomaine("developpement", referentiel, etats);

    expect(arbre.rangees.flatMap((r) => r.noeuds).map((n) => n.code)).toEqual(["DEV-01"]);
    expect(arbre.aretes).toEqual([]);
  });

  it("ne fabrique aucune arête vers l'avant : une compétence sans suite déclarée est une feuille", () => {
    const referentiel = referentielDe([
      skillDeTest("DEV-01", "developpement", "fondamentaux", 1, 0),
      skillDeTest("DEV-02", "developpement", "fondamentaux", 1, 1, ["DEV-01"]),
    ]);
    const etats = [
      etatMaitrise(referentiel.parCode.get("DEV-01")!),
      etatMaitrise(referentiel.parCode.get("DEV-02")!),
    ];

    const arbre = construireArbreDomaine("developpement", referentiel, etats);

    expect(arbre.aretes).toEqual([{ source: "DEV-01", target: "DEV-02", fantome: false }]);
    // DEV-02 termine le chemin : rien ne la cite, aucune suite n'est inventée.
    expect(arbre.feuilles).toEqual(["DEV-02"]);
  });

  it("ne compte jamais une compétence jamais travaillée parmi les feuilles", () => {
    const referentiel = referentielDe([
      skillDeTest("DEV-01", "developpement", "fondamentaux", 1, 0),
    ]);
    const etats = referentiel.actifs.map((s) => etat(s));

    const arbre = construireArbreDomaine("developpement", referentiel, etats);

    expect(arbre.feuilles).toEqual([]);
  });

  it("inclut une compétence rattachée et la signale comme telle (ADR-081)", () => {
    const referentiel = referentielDe(
      [
        skillDeTest("STAT-01", "statistiques", "fondamentaux", 1, 0),
        skillDeTest("DEV-01", "developpement", "fondamentaux", 1, 1),
      ],
      DOMAINES_TEST,
      [{ code: "STAT-01", domaine: "developpement" }],
    );
    const etats = referentiel.actifs.map((s) => etat(s));

    const arbre = construireArbreDomaine("developpement", referentiel, etats);
    const noeud = arbre.rangees.flatMap((r) => r.noeuds).find((n) => n.code === "STAT-01");

    expect(noeud).toMatchObject({ rattachee: true, domaine: "statistiques" });
  });

  it("remonte les suivantes déclarées, y compris hors du domaine", () => {
    const referentiel = referentielDe([
      skillDeTest("DEV-01", "developpement", "fondamentaux", 1, 0),
      skillDeTest("STAT-01", "statistiques", "fondamentaux", 1, 0, ["DEV-01"]),
    ]);
    const etats = referentiel.actifs.map((s) => etat(s));

    const arbre = construireArbreDomaine("developpement", referentiel, etats);
    const noeud = arbre.rangees.flatMap((r) => r.noeuds).find((n) => n.code === "DEV-01");

    expect(noeud?.suivantes).toEqual(["STAT-01"]);
  });
});
