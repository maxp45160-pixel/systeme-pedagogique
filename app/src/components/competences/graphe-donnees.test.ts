import { describe, expect, it } from "vitest";
import { construireGraphe } from "./graphe-donnees";
import type {
  Domaine,
  Exercise,
  Referentiel,
  Skill,
  SkillState,
} from "@/lib/domain/types";
import type { Theme } from "@/lib/domain/theme";

/* ------------------------------------------------------------------ */
/* Usines à mocks                                                      */
/* ------------------------------------------------------------------ */

function domaine(id: string, prefixe: string, nom: string, ordre: number): Domaine {
  return { id, nom, prefixe, description: "", ordre, archive: false, origine: "manuel" };
}

function competence(
  code: string,
  domaineId: string,
  opts: Partial<Skill> = {},
): Skill {
  return {
    code,
    domaine: domaineId,
    intitule: `Intitulé ${code}`,
    palier: "fondamentaux",
    prerequis: [],
    importance: 0.5,
    ordre: 0,
    active: true,
    archive: false,
    origine: "manuel",
    ...opts,
  };
}

function etat(skill: Skill, opts: Partial<SkillState> = {}): SkillState {
  return {
    skill,
    niveau: null,
    score: null,
    confiance: "nulle",
    robustesse: null,
    dimensions: {
      comprehension: 0,
      application: 0,
      transfert: 0,
      integration: 0,
      justification: 0,
    },
    preuves: [],
    contextesTestes: [],
    dernierePreuve: null,
    joursDepuisDernierePreuve: null,
    contradictions: [],
    prochaineEtape: "",
    explication: {
      resume: "",
      facteurs: [],
      nombrePreuves: 0,
      reserves: [],
    },
    statut: "non-evalue",
    ...opts,
  };
}

function exercice(id: string, domaineId: string, competences: string[]): Exercise {
  return {
    id,
    titre: `Exercice ${id}`,
    domaine: domaineId,
    type: "application",
    difficulte: 2,
    competences,
    dureeEstimeeMin: 10,
    enonce: "",
    indices: [],
    correction: "",
    criteres: [],
    origine: "manuel",
  };
}

function theme(id: string, codes: string[]): Theme {
  return {
    id,
    libelle: `Thème ${id}`,
    codes,
    origine: "utilisateur",
    creeLe: "2026-08-01",
    archive: false,
  };
}

function referentiel(domaines: Domaine[], skills: Skill[]): Referentiel {
  const actifs = skills.filter((s) => s.active && !s.archive);
  const parCode = new Map(skills.map((s) => [s.code, s]));
  const domainesParId = new Map(domaines.map((d) => [d.id, d]));
  return {
    domaines,
    skills,
    actifs,
    parCode,
    codesActifs: new Set(actifs.map((s) => s.code)),
    domainesParId,
  };
}

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

describe("construireGraphe", () => {
  it("filtre les prérequis hors périmètre actif", () => {
    const d = domaine("log", "LOG", "Logique", 0);
    const s1 = competence("LOG-01", "log");
    const s2 = competence("LOG-02", "log", { prerequis: ["LOG-01", "ARCHIVÉ-01"] });

    const donnees = construireGraphe(
      referentiel([d], [s1, s2]),
      [etat(s1), etat(s2)],
      [],
      [],
    );

    const pre = donnees.competences.find((c) => c.code === "LOG-02");
    expect(pre?.prerequis).toEqual(["LOG-01"]);
  });

  it("crée une chaîne séquentielle quand les prérequis explicites manquent", () => {
    const d = domaine("fts", "FTS", "Fondamentaux", 0);
    const s1 = competence("FTS-01", "fts");
    const s2 = competence("FTS-02", "fts");
    const s3 = competence("FTS-03", "fts");

    const donnees = construireGraphe(
      referentiel([d], [s1, s2, s3]),
      [etat(s1), etat(s2), etat(s3)],
      [],
      [],
    );

    const prerequisEntre = donnees.aretes.filter(
      (a) => a.type === "prerequis" && a.poids !== 1,
    );
    expect(prerequisEntre.sort((a, b) => a.source.localeCompare(b.source))).toEqual([
      { source: "FTS-01", target: "FTS-02", type: "prerequis", poids: 0.7 },
      { source: "FTS-02", target: "FTS-03", type: "prerequis", poids: 0.7 },
    ]);
  });

  it("exclut les thèmes à moins de 2 codes actifs", () => {
    const d = domaine("mej", "MEJ", "Méthode", 0);
    const s1 = competence("MEJ-01", "mej");

    const donnees = construireGraphe(
      referentiel([d], [s1]),
      [etat(s1)],
      [],
      [theme("theme-1", ["MEJ-01", "ABSENT-99"])],
    );

    expect(donnees.themes).toHaveLength(0);
  });

  it("déduplique les arêtes (même type/source/cible)", () => {
    const d = domaine("mej", "MEJ", "Méthode", 0);
    const s1 = competence("MEJ-01", "mej");
    const s2 = competence("MEJ-02", "mej");
    const s3 = competence("MEJ-03", "mej");

    const donnees = construireGraphe(
      referentiel([d], [s1, s2, s3]),
      [etat(s1), etat(s2), etat(s3)],
      [exercice("ex-1", "mej", ["MEJ-01", "MEJ-02", "MEJ-03"])],
      [],
    );

    const cle = new Set<string>();
    for (const a of donnees.aretes) {
      const cl = `${a.type}:${a.source}:${a.target}`;
      expect(cle.has(cl)).toBe(false);
      cle.add(cl);
    }
  });

  it("émet les arêtes sémantiques sous le type semantic et renseigne similarites", () => {
    const d1 = domaine("dev", "DEV", "Développement logiciel", 0);
    const d2 = domaine("cyb", "CYB", "Cybersécurité des applications", 1);
    const s1 = competence("DEV-01", "dev", {
      intitule: "Développer des applications web sécurisées",
    });
    const s2 = competence("CYB-01", "cyb", {
      intitule: "Sécuriser les applications web développées",
    });

    const donnees = construireGraphe(
      referentiel([d1, d2], [s1, s2]),
      [etat(s1), etat(s2)],
      [],
      [],
    );

    const semantic = donnees.aretes.filter((a) => a.type === "semantic");
    expect(semantic.length).toBeGreaterThan(0);
    // Le champ similarites est renseigné (plus jamais vide)
    expect(donnees.similarites.length).toBeGreaterThan(0);
    // Chaque arête sémantique a un poids dans (0, 1]
    for (const a of semantic) {
      expect(a.poids).toBeGreaterThan(0);
      expect(a.poids).toBeLessThanOrEqual(1);
    }
  });

  it("filtre les exercices archivés", () => {
    const d = domaine("mej", "MEJ", "Méthode", 0);
    const s1 = competence("MEJ-01", "mej");
    const exActif = exercice("ex-1", "mej", ["MEJ-01"]);
    const exArchive = { ...exercice("ex-2", "mej", ["MEJ-01"]), archive: true };

    const donnees = construireGraphe(
      referentiel([d], [s1]),
      [etat(s1)],
      [exActif, exArchive],
      [],
    );

    expect(donnees.exercices.map((e) => e.id)).toEqual(["ex-1"]);
  });
});