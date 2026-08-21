import { describe, expect, it } from "vitest";
import { construireMondeFictif, objectifsDuMonde } from "./monde";
import { deroulerParcoursLong } from "./parcours-long";
import { construireTableauDeBord } from "./tableau-de-bord";
import {
  construireExportAnalyse,
  ecrireExportAnalyse,
  redigerConclusion,
  FORMAT_EXPORT,
  VERSION_EXPORT,
} from "./export";

/**
 * Le parcours long est déterministe et lourd : on le déroule une fois pour
 * toutes les assertions, deux fois seulement pour vérifier la reproductibilité.
 */
const parcours = deroulerParcoursLong();
const tableau = construireTableauDeBord(parcours);

describe("monde fictif", () => {
  it("n'emprunte rien à un référentiel réel", () => {
    const domaines = parcours.monde.lots.map((l) => l.domaine.id);
    expect(domaines).toEqual(["mecanique", "energie", "ondes", "thermodynamique"]);
    expect(domaines).not.toContain("logistique");
  });

  it("déclare des objectifs sur des compétences qui existent", () => {
    const codes = new Set(parcours.monde.lots.flatMap((l) => l.competences.map((c) => c.code)));
    for (const objectif of objectifsDuMonde(parcours.monde)) {
      expect(objectif.competences.length).toBeGreaterThan(0);
      for (const code of objectif.competences) expect(codes.has(code)).toBe(true);
    }
  });

  it("donne une aptitude à chaque compétence, y compris celles à venir", () => {
    const codes = parcours.monde.lots.flatMap((l) => l.competences.map((c) => c.code));
    for (const code of codes) {
      expect(parcours.monde.profil.aptitude[code]).toBeGreaterThan(0);
    }
  });
});

describe("déroulé", () => {
  it("produit du volume sur dix-huit mois", () => {
    expect(parcours.resumes).toHaveLength(parcours.monde.jours + 1);
    expect(tableau.entete.tentativesMenees).toBeGreaterThan(150);
    expect(tableau.entete.observations).toBeGreaterThan(150);
    expect(tableau.entete.predictions).toBeGreaterThan(100);
  });

  it("étend le référentiel en cours de route", () => {
    const premier = parcours.resumes[0].competencesTotal;
    const dernier = parcours.resumes.at(-1)!.competencesTotal;
    expect(premier).toBe(parcours.monde.lots[0].competences.length);
    expect(dernier).toBe(
      parcours.monde.lots.reduce((somme, lot) => somme + lot.competences.length, 0),
    );
    expect(parcours.resumes.filter((r) => r.genre === "extension")).toHaveLength(3);
  });

  // Un second déroulé complet : quelques secondes quand la suite entière tourne
  // en parallèle, d'où le délai explicite.
  it(
    "est reproductible à la graine près",
    () => {
      const bis = deroulerParcoursLong(construireMondeFictif());
      expect(bis.resumes.at(-1)?.scoreGlobal).toBe(parcours.resumes.at(-1)?.scoreGlobal);
      expect(bis.actions).toHaveLength(parcours.actions.length);
      expect(bis.veriteTerrain).toEqual(parcours.veriteTerrain);
    },
    30_000,
  );

  it("ne tire aucune preuve d'une tentative abandonnée", () => {
    const dernier = parcours.resultat.pas.at(-1)!;
    const abandonnees = new Set(
      dernier.tentatives.filter((t) => t.statut === "abandonnee").map((t) => t.id),
    );
    expect(abandonnees.size).toBeGreaterThan(0);
    for (const observation of dernier.observations) {
      expect(abandonnees.has(observation.source?.trace?.ref ?? "")).toBe(false);
    }
  });

  it("n'invente aucune mesure sans source", () => {
    for (const observation of parcours.resultat.pas.at(-1)!.observations) {
      expect(observation.source?.ref).toBeTruthy();
    }
  });

  it("ne signale pas une calibration changée quand la fenêtre des verdicts glisse", () => {
    expect(parcours.resultat.anomalies.filter((a) => a.regle === "calibration-sans-tentative"))
      .toHaveLength(0);
  });

  it("ne fabrique pas de transfert sur une réussite mono-compétence", () => {
    const exercices = new Map(parcours.resultat.scenario.exercices.map((e) => [e.id, e]));
    const observations = parcours.resultat.pas.at(-1)!.observations;
    const observation = observations.find((o) => {
      const exercice = exercices.get(o.source.ref);
      return o.resultat === "reussi" && exercice?.competences.length === 1;
    });

    expect(observation).toBeDefined();
    expect(observation?.dimensions.transfert).toBeUndefined();
  });
});

describe("tableau de bord", () => {
  it("compare le niveau estimé à une aptitude que le moteur n'a jamais vue", () => {
    expect(tableau.justesse.comparables).toBeGreaterThan(10);
    expect(tableau.justesse.ecartMoyen).not.toBeNull();
    expect(tableau.justesse.biais).not.toBeNull();
  });

  it("statue sur chaque objectif déclaré", () => {
    expect(tableau.objectifs).toHaveLength(objectifsDuMonde(parcours.monde).length);
    for (const objectif of tableau.objectifs) {
      expect(objectif.partFinale).toBeGreaterThanOrEqual(0);
      expect(objectif.partFinale).toBeLessThanOrEqual(1);
      if (objectif.jourAtteint !== null) {
        expect(objectif.jourAtteint).toBeGreaterThanOrEqual(objectif.jourDeclare);
      }
    }
  });

  it("rend un verdict lisible sur chaque question", () => {
    expect(tableau.verdicts.length).toBeGreaterThanOrEqual(10);
    for (const verdict of tableau.verdicts) {
      expect(verdict.question.length).toBeGreaterThan(10);
      expect(verdict.valeur.length).toBeGreaterThan(0);
      expect(["ok", "alerte", "echec", "inconnu"]).toContain(verdict.statut);
    }
  });

  it("décrit le graphe final sans fabriquer d'arête", () => {
    const codes = new Set(tableau.graphe.noeuds.map((n) => n.code));
    for (const lien of tableau.graphe.liens) {
      expect(codes.has(lien.de)).toBe(true);
      expect(codes.has(lien.vers)).toBe(true);
    }
    expect(tableau.graphe.noeuds.length).toBe(tableau.entete.competences);
  });

  it("n'agrège que des prédictions présentes au registre", () => {
    const tranchees = tableau.registre.filter((l) => l.observe !== null).length;
    const reussite = tableau.metriques.find((m) => m.nom === "brier-reussite");
    expect(reussite).toBeDefined();
    expect(tranchees).toBeGreaterThanOrEqual(reussite!.n);
  });
});

describe("export pour analyse", () => {
  const analyse = construireExportAnalyse(tableau, parcours.monde, parcours.actions);

  it("se relit sans le code : format, unites, conventions", () => {
    expect(analyse.format).toBe(FORMAT_EXPORT);
    expect(analyse.version).toBe(VERSION_EXPORT);
    expect(analyse.notice.nature).toContain("SIMUL");
    expect(Object.keys(analyse.notice.unites).length).toBeGreaterThan(4);
    expect(analyse.notice.conventions.length).toBeGreaterThan(3);
  });

  it("porte le monde, la conclusion et la matiere", () => {
    expect(analyse.monde.domaines).toHaveLength(parcours.monde.lots.length);
    expect(analyse.conclusion.resume.length).toBeGreaterThan(40);
    expect(analyse.actions).toHaveLength(parcours.actions.length);
    expect(analyse.registre).toHaveLength(tableau.registre.length);
    expect(analyse.anomalies.every((a) => a.occurrences > 0)).toBe(true);
  });

  it("est du JSON valide et relisable", () => {
    const relu = JSON.parse(ecrireExportAnalyse(analyse)) as typeof analyse;
    expect(relu.entete.jours).toBe(tableau.entete.jours);
    expect(relu.conclusion.constats.length).toBe(analyse.conclusion.constats.length);
  });
});

describe("conclusion", () => {
  const conclusion = redigerConclusion(tableau);

  it("ne tire un constat que d'un verdict qui n'est pas au vert", () => {
    const clesVertes = tableau.verdicts.filter((v) => v.statut === "ok").map((v) => v.cle);
    for (const cle of clesVertes) {
      expect(conclusion.constats.some((c) => c.cle === cle)).toBe(false);
    }
    expect(conclusion.tenu).toHaveLength(clesVertes.length);
  });

  it("cite un chiffre et un endroit où regarder", () => {
    for (const constat of conclusion.constats) {
      expect(constat.fait.length).toBeGreaterThan(20);
      expect(constat.piste.length).toBeGreaterThan(20);
    }
    expect(conclusion.reserve).toContain("apprenant modèle");
  });
});
