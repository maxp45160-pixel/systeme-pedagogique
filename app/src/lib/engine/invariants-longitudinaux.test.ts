import { describe, expect, it } from "vitest";
import type { ObservationRectification, SkillObservation } from "@/lib/domain/types";
import { REFERENTIEL_TEST } from "@/lib/domain/referentiel.fixture";
import { observationsApresRectifications } from "@/lib/domain/rectifications-observations";
import { computeAllSkillStates } from "./skill-state";
import { calculerEtatGlobal } from "./progression";

// Historiques synthétiques reproductibles ; aucune aptitude réelle déduite.
const MAINTENANT = new Date("2026-09-17T12:00:00Z");
const COMPETENCES = REFERENTIEL_TEST.actifs.slice(0, 3);
const GRAINES = Array.from({ length: 24 }, (_, i) => i + 1);

function aleatoire(graine: number) {
  let etat = graine;
  return () => {
    etat = (Math.imul(etat, 1664525) + 1013904223) >>> 0;
    return etat / 2 ** 32;
  };
}

function melanger<T>(valeurs: T[], tirage: () => number): T[] {
  const copie = [...valeurs];
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(tirage() * (i + 1));
    [copie[i], copie[j]] = [copie[j], copie[i]];
  }
  return copie;
}

function historique(graine: number): SkillObservation[] {
  const tirage = aleatoire(graine);
  return Array.from({ length: 18 }, (_, i) => ({
    id: `synthetique-${graine}-${i}`,
    skillCode: COMPETENCES[i % COMPETENCES.length].code,
    date: new Date(MAINTENANT.getTime() - (100 - i * 4) * 86_400_000).toISOString(),
    type: "exercice",
    niveauObservation: "A",
    autonomie: i % 4 === 0 ? "A1" : "A3",
    qualite: i % 5 === 0 ? "faible" : "moyenne",
    resultat: tirage() < 0.3 ? "echec" : "reussi",
    contexte: `Situation synthétique ${i % 4}`,
    dimensions: { comprehension: Math.round(tirage() * 10) / 10, application: Math.round(tirage() * 10) / 10 },
    source: { kind: "exercice", ref: `ex-synthetique-${i}`, trace: { kind: "tentative", ref: `att-synthetique-${i}` } },
  }));
}

function rectification(o: SkillObservation, type: ObservationRectification["type"], index: number): ObservationRectification {
  return {
    id: `rect-${index}-${o.id}`, observationId: o.id, type,
    date: new Date(MAINTENANT.getTime() - (2 - index) * 60_000).toISOString(),
    motif: "Test synthétique de relecture", origine: "administrateur",
  };
}

function calculer(observations: SkillObservation[], rectifications: ObservationRectification[] = []) {
  return computeAllSkillStates(COMPETENCES, observationsApresRectifications(observations, rectifications), MAINTENANT);
}

describe.each(GRAINES)("frontière historique → état → agrégat, graine %i", (graine) => {
  it("les permutations de chargement ne changent aucun état ni agrégat", () => {
    const observations = historique(graine);
    const rectifications = observations.filter((_, i) => i % 3 === 0).flatMap((o) => [
      rectification(o, "invalidation", 0), rectification(o, "restauration", 1),
    ]);
    const avant = structuredClone({ observations, rectifications });
    const initial = calculer(observations, rectifications);
    // Évite un succès vide si une régression ignore toutes les preuves.
    expect(initial.every((e) => e.statut === "evalue" && e.score !== null)).toBe(true);
    expect(calculerEtatGlobal(initial, MAINTENANT).scoreGlobal).not.toBeNull();
    const tirage = aleatoire(graine * 31);
    const permute = calculer(melanger(observations, tirage), melanger(rectifications, tirage));
    expect(permute).toEqual(initial);
    expect(calculerEtatGlobal(permute, MAINTENANT)).toEqual(calculerEtatGlobal(initial, MAINTENANT));
    expect({ observations, rectifications }).toEqual(avant);
  });

  it("invalider toutes les preuves retrouve l'inconnu et restaurer retrouve l'état initial", () => {
    const observations = historique(graine);
    const invalidations = observations.map((o) => rectification(o, "invalidation", 0));
    const sansPreuve = calculer(observations, invalidations);
    for (const etat of sansPreuve) {
      expect(etat.niveau).toBeNull();
      expect(etat.score).toBeNull();
      expect(etat.robustesse).toBeNull();
      expect(etat.statut).toBe("non-evalue");
    }
    expect(calculerEtatGlobal(sansPreuve, MAINTENANT).scoreGlobal).toBeNull();
    const restaurees = [...invalidations, ...observations.map((o) => rectification(o, "restauration", 1))];
    expect(calculer(observations, restaurees)).toEqual(calculer(observations));
  });

  it("étendre le référentiel sans preuve ne réduit pas le score déjà étayé", () => {
    const observations = historique(graine);
    const etats = calculer(observations);
    const avant = calculerEtatGlobal(etats, MAINTENANT);
    const inconnues = Array.from({ length: 20 }, (_, i) => ({ ...COMPETENCES[0], code: `INCONNUE-${i}` }));
    const apres = calculerEtatGlobal(computeAllSkillStates([...COMPETENCES, ...inconnues], observations, MAINTENANT), MAINTENANT);
    expect(apres.scoreGlobal).toBe(avant.scoreGlobal);
    expect(apres.niveauMoyen).toBe(avant.niveauMoyen);
    expect(apres.competencesEvaluees).toBe(avant.competencesEvaluees);
    expect(apres.competencesTotal).toBe(avant.competencesTotal + 20);
  });

  it("une rectification d'une autre compétence ne modifie pas les états voisins", () => {
    const observations = historique(graine);
    const code = COMPETENCES[0].code;
    const invalidations = observations.filter((o) => o.skillCode === code).map((o) => rectification(o, "invalidation", 0));
    const avant = calculer(observations).filter((e) => e.skill.code !== code);
    const apres = calculer(observations, invalidations).filter((e) => e.skill.code !== code);
    expect(apres).toEqual(avant);
  });
});
