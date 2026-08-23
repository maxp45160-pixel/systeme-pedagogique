import { describe, expect, it } from "vitest";
import {
  BONUS_ECHEANCE_MAX,
  recommander,
} from "./recommend";
import type { Engagement } from "@/lib/domain/engagement";
import type { SkillObservation } from "@/lib/domain/types";
import { computeAllSkillStates } from "./skill-state";
import {
  DOMAINES_TEST,
  REFERENTIEL_TEST,
  SKILLS_TEST,
} from "@/lib/domain/referentiel.fixture";

/*
 * Facteur « Proximité d'échéance » — chantier « fait daté / engagements ».
 *
 * Chaque test protège une règle : fenêtre J-21 → veille, source affichée,
 * un seul bonus par compétence même face à plusieurs engagements, et zéro
 * changement quand aucun engagement n'est transmis (rétrocompatibilité).
 */

const MAINTENANT = new Date("2026-08-22T12:00:00.000Z");
const iso = (decalageJours: number) => {
  const date = new Date(MAINTENANT);
  date.setUTCDate(date.getUTCDate() + decalageJours);
  return date.toISOString().slice(0, 10);
};

// STAT-01 est volontairement hors périmètre dans la fixture : on cible deux
// compétences actives, l'une observée, l'autre jamais évaluée.
const CODE_A = "DEV-01";
const CODE_B = "DEV-02";

function observation(code: string, jours: number): SkillObservation {
  return {
    id: `obs-${code}-${jours}`,
    skillCode: code,
    date: new Date(MAINTENANT.getTime() - jours * 86_400_000).toISOString(),
    type: "exercice",
    niveauObservation: "A",
    autonomie: "A3",
    qualite: "moyenne",
    resultat: "reussi",
    contexte: "Contexte A",
    dimensions: { comprehension: 0.9, application: 0.85 },
    source: { kind: "exercice", ref: "ex-test" },
  };
}

function construireEtats(observationsParCode: Record<string, SkillObservation[]>) {
  const observations = Object.entries(observationsParCode).flatMap(([code, liste]) =>
    liste.map((o) => ({ ...o, skillCode: code })),
  );
  return computeAllSkillStates(SKILLS_TEST, observations, MAINTENANT).filter((etat) =>
    REFERENTIEL_TEST.codesActifs.has(etat.skill.code),
  );
}

function engagement(options: Partial<Engagement> = {}): Engagement {
  return {
    id: "eng-test",
    type: "examen",
    libelle: "Contrôle de statistiques",
    echeanceLe: iso(10),
    codes: [CODE_A],
    ...options,
  };
}

function facteurEcheance(recs: ReturnType<typeof recommander>) {
  const rec = recs.find((r) => r.etat.skill.code === CODE_A);
  return rec?.facteurs.find((f) => f.libelle === "Proximité d'échéance") ?? null;
}

describe("facteur Proximité d'échéance", () => {
  it("bonus croissant à mesure que la date approche", () => {
    const etats = construireEtats({ [CODE_A]: [], [CODE_B]: [] });
    const lointain = facteurEcheance(
      recommander(etats, [], [], 10, undefined, MAINTENANT, undefined, undefined, undefined,
        [engagement({ echeanceLe: iso(21) })]),
    );
    const proche = facteurEcheance(
      recommander(etats, [], [], 10, undefined, MAINTENANT, undefined, undefined, undefined,
        [engagement({ echeanceLe: iso(2) })]),
    );
    expect(lointain).not.toBeNull();
    expect(proche).not.toBeNull();
    expect(proche!.contribution).toBeGreaterThan(lointain!.contribution);
    expect(proche!.contribution).toBeLessThanOrEqual(BONUS_ECHEANCE_MAX);
  });

  it("atteint le maximum à la veille", () => {
    const etats = construireEtats({ [CODE_A]: [] });
    const facteur = facteurEcheance(
      recommander(etats, [], [], 10, undefined, MAINTENANT, undefined, undefined, undefined,
        [engagement({ echeanceLe: iso(1) })]),
    );
    expect(facteur!.contribution).toBe(BONUS_ECHEANCE_MAX);
  });

  it("hors fenêtre : zéro, aucune pénalité — le score redevient celui sans engagements", () => {
    const etats = construireEtats({ [CODE_A]: [observation(CODE_A, 5)] });
    const sans = recommander(etats, [], [], 10, undefined, MAINTENANT);
    for (const echeance of [iso(30), iso(0), iso(-3)]) {
      const avec = recommander(etats, [], [], 10, undefined, MAINTENANT, undefined, undefined, undefined,
        [engagement({ echeanceLe: echeance })]);
      expect(facteurEcheance(avec)).toBeNull();
      expect(avec.find((r) => r.etat.skill.code === CODE_A)!.valeur)
        .toBe(sans.find((r) => r.etat.skill.code === CODE_A)!.valeur);
    }
  });

  it("la phrase porte sa source : engagement, libellé, distance et échéance", () => {
    const etats = construireEtats({ [CODE_A]: [] });
    const facteur = facteurEcheance(
      recommander(etats, [], [], 10, undefined, MAINTENANT, undefined, undefined, undefined,
        [engagement({ libelle: "Examen partiel", echeanceLe: iso(7) })]),
    );
    expect(facteur).not.toBeNull();
    expect(facteur!.phrase).toContain("engagement déclaré : « Examen partiel »");
    expect(facteur!.phrase).toContain(`dans ${7} jours`);
    expect(facteur!.phrase).toContain(iso(7));
  });

  it("plusieurs engagements sur la même compétence : meilleur bonus seulement", () => {
    const etats = construireEtats({ [CODE_A]: [] });
    const recs = recommander(
      etats, [], [], 10, undefined, MAINTENANT, undefined, undefined, undefined,
      [
        engagement({ id: "a", echeanceLe: iso(14), libelle: "Lointain" }),
        engagement({ id: "b", echeanceLe: iso(3), libelle: "Proche" }),
      ],
    );
    const facteurs = recs
      .find((r) => r.etat.skill.code === CODE_A)!
      .facteurs.filter((f) => f.libelle === "Proximité d'échéance");
    expect(facteurs).toHaveLength(1);
    expect(facteurs[0].phrase).toContain("Proche");
    // Le bonus du plus proche (J-3) vaut strictement plus que celui du lointain.
    expect(facteurs[0].contribution).toBeGreaterThan(
      Math.round(BONUS_ECHEANCE_MAX * (1 - 13 / 21)),
    );
  });

  it("un engagement clôturé ne pèse plus rien", () => {
    const etats = construireEtats({ [CODE_A]: [] });
    const recs = recommander(
      etats, [], [], 10, undefined, MAINTENANT, undefined, undefined, undefined,
      [engagement({ clotureLe: "2026-08-21T08:00:00Z", clotureType: "passe" })],
    );
    expect(facteurEcheance(recs)).toBeNull();
  });

  it("ne cible que les compétences visées par l'engagement", () => {
    const etats = construireEtats({ [CODE_A]: [], [CODE_B]: [] });
    const recs = recommander(
      etats, [], [], 10, undefined, MAINTENANT, undefined, undefined, undefined,
      [engagement({ codes: [CODE_A] })],
    );
    const b = recs.find((r) => r.etat.skill.code === CODE_B)!;
    expect(b.facteurs.some((f) => f.libelle === "Proximité d'échéance")).toBe(false);
  });

  it("le bonus peut faire remonter la compétence ciblée dans la file", () => {
    // DEV-01 a des observations récentes (« Pratiquée récemment », -15),
    // DEV-02 jamais évaluée. Sans engagement, DEV-02 domine largement :
    // on vérifie ici que le facteur s'affiche bien et reste sous les
    // grands écarts — il départage, il ne renverse pas (cf. constante).
    const etats = construireEtats({
      [CODE_A]: [observation(CODE_A, 5)],
      [CODE_B]: [],
    });
    const avant = recommander(etats, [], [], 10, undefined, MAINTENANT);
    const apres = recommander(
      etats, [], [], 10, undefined, MAINTENANT, undefined, undefined, undefined,
      [engagement({ echeanceLe: iso(2) })],
    );
    const valeurStatAvant = avant.find((r) => r.etat.skill.code === CODE_A)!.valeur;
    const valeurStatApres = apres.find((r) => r.etat.skill.code === CODE_A)!.valeur;
    expect(valeurStatApres - valeurStatAvant).toBeGreaterThan(0);
    expect(valeurStatApres - valeurStatAvant).toBeLessThanOrEqual(BONUS_ECHEANCE_MAX);
  });

  it("rétrocompatibilité : sans engagements, aucune différence avec l'appel existant", () => {
    const etats = construireEtats({
      [CODE_A]: [observation(CODE_A, 12)],
      [CODE_B]: [observation(CODE_B, 3)],
    });
    const sansParametre = recommander(etats, [], [], 10, undefined, MAINTENANT);
    const parametreOmis = recommander(etats, [], [], 10, undefined, MAINTENANT, undefined, undefined, undefined, []);
    expect(parametreOmis.map((r) => `${r.etat.skill.code}:${r.valeur}`))
      .toEqual(sansParametre.map((r) => `${r.etat.skill.code}:${r.valeur}`));
    expect(DOMAINES_TEST.length).toBeGreaterThan(0); // fixture chargée — garde de lecture
  });
});
