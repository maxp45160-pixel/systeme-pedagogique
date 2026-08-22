import { describe, expect, it } from "vitest";
import { construireArbreSavoirs } from "./arbre-savoirs";
import { DOMAINES_TEST, domaineDeTest, referentielDe, skillDeTest } from "./referentiel.fixture";
import type { Domaine, Skill, SkillState } from "./types";

/*
 * Ce que ce fichier protège : le tronc de l'arbre vient du classement, et de
 * rien d'autre. Aucune région « Divers », aucun rattachement par défaut, aucun
 * nœud dupliqué, aucune arête vers l'avant.
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

/** Un domaine classé sous une région de la carte. */
const classe = (id: string, nom: string, prefixe: string, noeud: string, ordre = 0): Domaine => ({
  ...domaineDeTest(id, nom, prefixe, ordre),
  carteNoeud: noeud,
  carteVersion: "2026-08-22",
  carteOrigine: "manuel",
  carteValideLe: "2026-08-22T10:00:00.000Z",
});

describe("construireArbreSavoirs", () => {
  it("remonte un domaine classé jusqu'à sa région, pas jusqu'à sa discipline", () => {
    const referentiel = referentielDe(
      [skillDeTest("DEV-01", "developpement", "fondamentaux", 1, 0)],
      [classe("developpement", "Développement", "DEV", "informatique")],
    );
    const etats = referentiel.actifs.map((s) => etat(s));

    const { noeuds, liens } = construireArbreSavoirs(referentiel, etats, {
      maintenant: MAINTENANT,
    });

    /* « Informatique » vit sous « Créations humaines » : c'est la région qui porte. */
    expect(noeuds.find((n) => n.niveau === "region")).toMatchObject({
      id: "region:creations-humaines",
      libelle: "Créations humaines",
      parent: null,
    });
    expect(liens).toContainEqual({
      source: "region:creations-humaines",
      target: "domaine:developpement",
      type: "contient",
      fantome: false,
    });
  });

  it("laisse un domaine non classé sans parent, sans inventer de région d'accueil", () => {
    const referentiel = referentielDe(
      [skillDeTest("DEV-01", "developpement", "fondamentaux", 1, 0)],
      DOMAINES_TEST,
    );
    const etats = referentiel.actifs.map((s) => etat(s));

    const { noeuds, domainesNonClasses } = construireArbreSavoirs(referentiel, etats, {
      maintenant: MAINTENANT,
    });

    expect(noeuds.some((n) => n.niveau === "region")).toBe(false);
    expect(noeuds.find((n) => n.id === "domaine:developpement")?.parent).toBeNull();
    expect(domainesNonClasses).toContain("developpement");
  });

  it("n'ouvre pas de région pour un classement devenu obsolète", () => {
    const referentiel = referentielDe(
      [skillDeTest("DEV-01", "developpement", "fondamentaux", 1, 0)],
      [classe("developpement", "Développement", "DEV", "region-retiree-de-la-carte")],
    );
    const etats = referentiel.actifs.map((s) => etat(s));

    const { noeuds, domainesNonClasses } = construireArbreSavoirs(referentiel, etats, {
      maintenant: MAINTENANT,
    });

    expect(noeuds.some((n) => n.niveau === "region")).toBe(false);
    expect(domainesNonClasses).toEqual(["developpement"]);
  });

  it("n'ouvre que les régions qui recueillent réellement un domaine", () => {
    const referentiel = referentielDe(
      [skillDeTest("DEV-01", "developpement", "fondamentaux", 1, 0)],
      [classe("developpement", "Développement", "DEV", "informatique")],
    );
    const etats = referentiel.actifs.map((s) => etat(s));

    const { noeuds } = construireArbreSavoirs(referentiel, etats, { maintenant: MAINTENANT });

    /* La carte en compte quatre ; une seule accueille quelque chose. */
    expect(noeuds.filter((n) => n.niveau === "region")).toHaveLength(1);
  });

  it("place chaque compétence sous son premier tag, une seule fois", () => {
    const referentiel = referentielDe(
      [
        skillDeTest("STAT-01", "statistiques", "fondamentaux", 1, 0),
        skillDeTest("DEV-01", "developpement", "fondamentaux", 1, 0),
      ],
      [
        classe("developpement", "Développement", "DEV", "informatique"),
        classe("statistiques", "Statistiques", "STAT", "mathematiques", 1),
      ],
      [
        { code: "STAT-01", domaine: "statistiques" },
        { code: "STAT-01", domaine: "developpement" },
        { code: "DEV-01", domaine: "developpement" },
      ],
    );
    const etats = referentiel.actifs.map((s) => etat(s));

    const { noeuds, liens } = construireArbreSavoirs(referentiel, etats, {
      maintenant: MAINTENANT,
    });

    /* Taguée sur les deux (ADR-107) : elle se dessine une fois, sous le premier. */
    expect(noeuds.filter((n) => n.id === "competence:STAT-01")).toHaveLength(1);
    expect(noeuds.find((n) => n.id === "competence:STAT-01")?.parent).toBe("domaine:statistiques");
    expect(
      liens.filter((l) => l.type === "contient" && l.target === "competence:STAT-01"),
    ).toHaveLength(1);
  });

  it("dérive l'état d'une compétence sans jamais fabriquer de niveau", () => {
    const referentiel = referentielDe(
      [
        skillDeTest("DEV-01", "developpement", "fondamentaux", 1, 0),
        skillDeTest("DEV-02", "developpement", "fondamentaux", 1, 1),
        skillDeTest("DEV-03", "developpement", "fondamentaux", 1, 2),
      ],
      [classe("developpement", "Développement", "DEV", "informatique")],
    );
    const parCode = referentiel.parCode;
    const etats = [
      etat(parCode.get("DEV-01")!, {
        niveau: 4,
        confiance: "forte",
        statut: "evalue",
        observations: [{}, {}] as SkillState["observations"],
        derniereObservation: "2026-08-20T09:00:00.000Z",
      }),
      etat(parCode.get("DEV-02")!, {
        niveau: 2,
        confiance: "faible",
        statut: "evalue",
        observations: [{}] as SkillState["observations"],
        derniereObservation: "2026-08-20T09:00:00.000Z",
      }),
      etat(parCode.get("DEV-03")!),
    ];

    const { noeuds } = construireArbreSavoirs(referentiel, etats, { maintenant: MAINTENANT });
    const etatDe = (code: string) => noeuds.find((n) => n.id === `competence:${code}`)?.etat;

    expect(etatDe("DEV-01")).toBe("maitrisee");
    expect(etatDe("DEV-02")).toBe("en-cours");
    expect(etatDe("DEV-03")).toBe("ouverte");
  });

  it("marque actif ce qui a été travaillé dans la fenêtre, et pas au-delà", () => {
    const referentiel = referentielDe(
      [
        skillDeTest("DEV-01", "developpement", "fondamentaux", 1, 0),
        skillDeTest("STAT-01", "statistiques", "fondamentaux", 1, 0),
      ],
      [
        classe("developpement", "Développement", "DEV", "informatique"),
        classe("statistiques", "Statistiques", "STAT", "mathematiques", 1),
      ],
    );
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

    const { noeuds } = construireArbreSavoirs(referentiel, etats, { maintenant: MAINTENANT });

    expect(noeuds.find((n) => n.id === "domaine:developpement")?.actif).toBe(true);
    expect(noeuds.find((n) => n.id === "domaine:statistiques")?.actif).toBe(false);
  });

  it("traverse l'arbre avec les prérequis déclarés, sans en inventer", () => {
    const referentiel = referentielDe(
      [
        skillDeTest("DEV-01", "developpement", "fondamentaux", 1, 0),
        skillDeTest("DEV-02", "developpement", "fondamentaux", 1, 1, ["DEV-01"]),
      ],
      [classe("developpement", "Développement", "DEV", "informatique")],
    );
    const etats = referentiel.actifs.map((s) => etat(s));

    const { liens } = construireArbreSavoirs(referentiel, etats, { maintenant: MAINTENANT });
    const prerequis = liens.filter((l) => l.type === "prerequis");

    expect(prerequis).toEqual([
      {
        source: "competence:DEV-01",
        target: "competence:DEV-02",
        type: "prerequis",
        fantome: false,
      },
    ]);
  });

  it("montre un prérequis qui n'existe pas, marqué fantôme", () => {
    const referentiel = referentielDe(
      [skillDeTest("DEV-01", "developpement", "fondamentaux", 1, 0, ["FANTOME-42"])],
      [classe("developpement", "Développement", "DEV", "informatique")],
    );
    const etats = referentiel.actifs.map((s) => etat(s));

    const { noeuds, liens } = construireArbreSavoirs(referentiel, etats, {
      maintenant: MAINTENANT,
    });

    expect(noeuds.find((n) => n.id === "competence:FANTOME-42")).toMatchObject({
      etat: "fantome",
      libelle: "FANTOME-42",
      parent: "domaine:developpement",
      actif: false,
    });
    expect(liens).toContainEqual({
      source: "competence:FANTOME-42",
      target: "competence:DEV-01",
      type: "prerequis",
      fantome: true,
    });
  });

  it("écarte un domaine mis de côté, avec ses compétences", () => {
    const referentiel = referentielDe(
      [skillDeTest("DEV-01", "developpement", "fondamentaux", 1, 0, [], { active: false })],
      [{ ...classe("developpement", "Développement", "DEV", "informatique"), archive: true }],
    );
    const etats = referentiel.skills.map((s) => etat(s));

    const { noeuds } = construireArbreSavoirs(referentiel, etats, { maintenant: MAINTENANT });

    expect(noeuds).toEqual([]);
  });

  it("rend le même arbre d'un appel à l'autre", () => {
    const referentiel = referentielDe(
      [
        skillDeTest("DEV-01", "developpement", "fondamentaux", 1, 0),
        skillDeTest("DEV-02", "developpement", "fondamentaux", 1, 1, ["DEV-01"]),
      ],
      [classe("developpement", "Développement", "DEV", "informatique")],
    );
    const etats = referentiel.actifs.map((s) => etat(s));

    const a = construireArbreSavoirs(referentiel, etats, { maintenant: MAINTENANT });
    const b = construireArbreSavoirs(referentiel, etats, { maintenant: MAINTENANT });

    expect(a).toEqual(b);
  });
});
