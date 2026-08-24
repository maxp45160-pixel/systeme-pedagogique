import { describe, it, expect } from "vitest";
import { genererBilanMarkdown, type DonneesExportBilan } from "./export-bilan";
import type { Skill, SkillState } from "./types";

describe("genererBilanMarkdown", () => {
  const skill1: Skill = {
    code: "MATH.DEV.01",
    intitule: "Dérivation de composées",
    domaine: "maths",
    importance: 1,
    palier: "fondamentaux",
    prerequis: [],
    ordre: 1,
    active: true,
    archive: false,
    origine: "manuel",
  };

  const skill2: Skill = {
    code: "MATH.DEV.02",
    intitule: "Étude de convexité",
    domaine: "maths",
    importance: 0.8,
    palier: "intermediaire",
    prerequis: [],
    ordre: 2,
    active: true,
    archive: false,
    origine: "manuel",
  };

  const skill3: Skill = {
    code: "MATH.INT.01",
    intitule: "Calcul d'intégrales",
    domaine: "maths",
    importance: 0.6,
    palier: "fondamentaux",
    prerequis: [],
    ordre: 3,
    active: true,
    archive: false,
    origine: "manuel",
  };

  const etats: SkillState[] = [
    {
      skill: skill1,
      niveau: 3,
      score: 3.5,
      confiance: "forte",
      robustesse: 0.8,
      dimensions: {
        comprehension: 0.9,
        application: 0.8,
        transfert: 0.7,
        integration: 0.6,
        justification: 0.7,
      },
      derniereObservation: "2026-08-20",
      joursDepuisDerniereObservation: 4,
      observations: [
        {
          id: "o1",
          skillCode: "MATH.DEV.01",
          date: "2026-08-20",
          type: "exercice",
          autonomie: "A3",
          qualite: "moyenne",
          niveauObservation: "A",
          resultat: "reussi",
          dimensions: { comprehension: 1, application: 1 },
          contexte: "Exercice de dérivée",
          source: { kind: "exercice", ref: "e1" },
        },
      ],
      contextesTestes: ["Exercice de dérivée"],
      contradictions: [],
      prochaineEtape: "Passer au niveau 4",
      statut: "evalue",
      explication: {
        resume: "Niveau 3",
        facteurs: [],
        nombreObservations: 1,
        reserves: [],
      },
    },
    {
      skill: skill2,
      niveau: 1,
      score: 1.2,
      confiance: "faible",
      robustesse: 0.3,
      dimensions: {
        comprehension: 0.5,
        application: 0.3,
        transfert: 0,
        integration: 0,
        justification: 0.2,
      },
      derniereObservation: "2026-08-22",
      joursDepuisDerniereObservation: 2,
      observations: [
        {
          id: "o2",
          skillCode: "MATH.DEV.02",
          date: "2026-08-22",
          type: "exercice",
          autonomie: "A1",
          qualite: "faible",
          niveauObservation: "B",
          resultat: "partiel",
          dimensions: { comprehension: 0.5 },
          contexte: "Convexité guidée",
          source: { kind: "exercice", ref: "e2" },
        },
      ],
      contextesTestes: ["Convexité guidée"],
      contradictions: [],
      prochaineEtape: "Passer au niveau 2",
      statut: "evalue",
      explication: {
        resume: "Niveau 1",
        facteurs: [],
        nombreObservations: 1,
        reserves: [],
      },
    },
    {
      skill: skill3,
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
      derniereObservation: null,
      joursDepuisDerniereObservation: null,
      observations: [],
      contextesTestes: [],
      contradictions: [],
      prochaineEtape: "Découvrir la notion",
      statut: "non-evalue",
      explication: {
        resume: "Non évalué",
        facteurs: [],
        nombreObservations: 0,
        reserves: [],
      },
    },
  ];

  const skillsParCode = new Map<string, Skill>([
    [skill1.code, skill1],
    [skill2.code, skill2],
    [skill3.code, skill3],
  ]);

  it("génère un document markdown valide avec synthèse et compétences classées", () => {
    const donnees: DonneesExportBilan = {
      identite: { nom: "Léa", email: "lea@univ.fr" },
      dateExport: new Date("2026-08-24T12:00:00Z"),
      scoreGlobal: 72,
      nombreCompetences: 3,
      nombreExercices: 8,
      joursActifs: 5,
      etats,
      skillsParCode,
      engagements: [
        {
          id: "eng-1",
          libelle: "Partiel de maths",
          echeanceLe: "2026-09-10",
          type: "examen",
          codes: ["MATH.DEV.01"],
        },
      ],
    };

    const resultat = genererBilanMarkdown(donnees);

    expect(resultat).toContain("# Bilan de compétences — Système pédagogique");
    expect(resultat).toContain("Léa");
    expect(resultat).toContain("**Score global mesuré** : 72 / 100");
    expect(resultat).toContain("Dérivation de composées");
    expect(resultat).toContain("Niveau 3/4");
    expect(resultat).toContain("Étude de convexité");
    expect(resultat).toContain("Niveau 1/4");
    expect(resultat).toContain("Partiel de maths");
  });
});
