import { describe, expect, it } from "vitest";

import type {
  Skill,
  SkillObservation,
  SkillState,
} from "@/lib/domain/types";
import type { Recommandation } from "./recommend";
import { computeSkillState } from "./skill-state";
import {
  adapterRecommandationsAEspaceActif,
  construireCarteIndividuelle,
  construireEspaceActif,
  construireEtatCompetence,
  LIMITE_ESPACE_ACTIF,
} from "./vues-twiny";

const NOW = new Date("2026-08-20T12:00:00.000Z");

function skill(
  code: string,
  options: Partial<Pick<Skill, "domaine" | "tagsDomaine" | "active" | "archive" | "ordre">> = {},
): Skill {
  return {
    code,
    domaine: options.domaine ?? "dev",
    tagsDomaine: options.tagsDomaine,
    intitule: `Compétence ${code}`,
    palier: "fondamentaux",
    prerequis: [],
    importance: 0.8,
    ordre: options.ordre ?? 0,
    active: options.active ?? true,
    archive: options.archive ?? false,
    origine: "utilisateur",
  };
}

function observation(code: string, id = `obs-${code}`): SkillObservation {
  return {
    id,
    skillCode: code,
    date: "2026-08-19T12:00:00.000Z",
    type: "exercice",
    niveauObservation: "A",
    autonomie: "A3",
    qualite: "moyenne",
    resultat: "reussi",
    contexte: "Problème standard",
    familleSituation: {
      cle: "exercice:dev/probleme",
      libelle: "dev · probleme",
      derivee: true,
    },
    dimensions: { comprehension: 0.8, application: 0.8 },
    source: { kind: "exercice", ref: "ex-1" },
  };
}

function recommandation(etat: SkillState, valeur = 10): Recommandation {
  return {
    etat,
    valeur,
    facteurs: [{ libelle: "Classement existant", contribution: valeur, phrase: "prioritaire" }],
    raison: "Recommandé car prioritaire.",
    exercice: null,
    difficulteCible: 2,
    dureeEstimeeMin: 30,
    calibration: null,
  };
}

function carte(skills: Skill[], observations: SkillObservation[] = []) {
  return construireCarteIndividuelle(
    skills.map((item) => computeSkillState(item, observations, NOW)),
  );
}

describe("états du lot 5", () => {
  it("distingue l'Observation ponctuelle de l'état et de la maîtrise consolidés", () => {
    const obs = observation("DEV-01");
    const etat = construireEtatCompetence(computeSkillState(skill("DEV-01"), [obs], NOW));

    expect(etat.observationPonctuelle).toBe(obs);
    expect(etat.etatConsolide.confiance).toBe("faible");
    expect(etat.maitrise.maitrisee).toBe(false);
    expect(etat.maitrise.explication.nombreObservations).toBe(1);
  });
});

describe("carte individuelle", () => {
  it("conserve une compétence locale archivée et ne mute jamais ses entrées", () => {
    const archivee = skill("DEV-ARCH", { archive: true, active: false });
    const obs = observation("DEV-ARCH");
    const avant = structuredClone(obs);

    const resultat = carte([archivee], [obs]);

    expect(resultat.competencesLocales[0].etatConsolide.skill.archive).toBe(true);
    expect(resultat.competencesLocales[0].observationPonctuelle).toBe(obs);
    expect(obs).toEqual(avant);
  });

  it("ne mélange jamais deux jeux d'entrées privés", () => {
    const carteA = carte([skill("A-01")]);
    const carteB = carte([skill("B-01")]);

    expect(carteA.competencesLocales.map((etat) => etat.code)).toEqual(["A-01"]);
    expect(carteB.competencesLocales.map((etat) => etat.code)).toEqual(["B-01"]);
  });
});

describe("espace actif borné", () => {
  it("priorise le classement du référentiel local et borne la liste", () => {
    const skills = [
      skill("DEV-A"),
      skill("DEV-B", { ordre: 1 }),
      skill("DEV-C", { ordre: 2 }),
      skill("DEV-D", { ordre: 3 }),
    ];
    const etats = skills.map((item) => computeSkillState(item, [], NOW));
    // Seules A et C sont recommandées : elles passent devant, les autres
    // suivent dans l'ordre du référentiel.
    const recommandations = [recommandation(etats[0], 50), recommandation(etats[2], 40)];
    const vue = carte(skills);

    const espace = construireEspaceActif({ carte: vue, recommandations, limite: 4 });

    expect(espace.elements.map((element) => element.id)).toEqual([
      "DEV-A",
      "DEV-C",
      "DEV-B",
      "DEV-D",
    ]);
    expect(espace.elements.map((element) => element.actionnable)).toEqual([
      true,
      true,
      false,
      false,
    ]);
  });

  it("reste à quinze éléments et explique la troncature", () => {
    const skills = Array.from({ length: 20 }, (_, index) => skill(`DEV-${index + 1}`, { ordre: index }));
    const vue = carte(skills);
    const recommandations = vue.competencesLocales.map((etat, index) =>
      recommandation(etat.etatConsolide, 100 - index));

    const espace = construireEspaceActif({ carte: vue, recommandations });

    expect(espace.limite).toBe(LIMITE_ESPACE_ACTIF);
    expect(espace.elements).toHaveLength(15);
    expect(espace.reserves.join(" ")).toContain("borne explicite de 15");
  });

  it("garde l'historique archivé et hors périmètre hors des actions", () => {
    const archivee = skill("DEV-ARCH", { active: false, archive: true });
    const horsPerimetre = skill("DEV-HORS", { active: false });
    const active = skill("DEV-ACTIVE");
    const vue = carte([archivee, horsPerimetre, active]);
    const recs = [
      recommandation(computeSkillState(archivee, [], NOW)),
      recommandation(computeSkillState(horsPerimetre, [], NOW)),
      recommandation(computeSkillState(active, [], NOW)),
    ];

    const espace = construireEspaceActif({ carte: vue, recommandations: recs });

    expect(vue.competencesLocales.map((etat) => etat.code)).toEqual([
      "DEV-ARCH",
      "DEV-HORS",
      "DEV-ACTIVE",
    ]);
    expect(espace.codesCompetences).toEqual(["DEV-ACTIVE"]);
    expect(espace.reserves.join(" ")).toContain("archivée");
    expect(espace.reserves.join(" ")).toContain("hors périmètre");
  });
});

describe("recommandations adaptées", () => {
  it("préserve le classement local si l'espace actif ne porte aucun code", () => {
    const etat = computeSkillState(skill("DEV-01"), [], NOW);
    const base = [recommandation(etat)];
    const espace = construireEspaceActif({ carte: carte([]), recommandations: base });

    const adaptees = adapterRecommandationsAEspaceActif(base, espace);

    expect(adaptees[0].etat.skill.code).toBe("DEV-01");
    expect(adaptees[0].prioriteLot5.origine).toBe("referentiel-local");
    expect(adaptees[0].prioriteLot5.explication).toContain("classement explicable");
  });

  it("borne la file à six sans modifier les scores existants", () => {
    const skills = Array.from({ length: 9 }, (_, index) => skill(`DEV-${index + 1}`, { ordre: index }));
    const vue = carte(skills);
    const base = vue.competencesLocales.map((etat, index) =>
      recommandation(etat.etatConsolide, 100 - index));
    const espace = construireEspaceActif({ carte: vue, recommandations: base });

    const adaptees = adapterRecommandationsAEspaceActif(base, espace);

    expect(adaptees.map((item) => item.etat.skill.code)).toEqual([
      "DEV-1",
      "DEV-2",
      "DEV-3",
      "DEV-4",
      "DEV-5",
      "DEV-6",
    ]);
    expect(adaptees.map((item) => item.valeur)).toEqual([100, 99, 98, 97, 96, 95]);
    expect(adaptees.every((item) => item.prioriteLot5.origine === "referentiel-local")).toBe(true);
  });

  it("propage la réserve de troncature de l'espace actif", () => {
    const skills = Array.from({ length: 20 }, (_, index) => skill(`DEV-${index + 1}`, { ordre: index }));
    const vue = carte(skills);
    const base = vue.competencesLocales.map((etat) =>
      recommandation(etat.etatConsolide));
    const espace = construireEspaceActif({ carte: vue, recommandations: base });

    const adaptees = adapterRecommandationsAEspaceActif(base.slice(0, 6), espace);

    expect(adaptees[0].reservesLot5.join(" ")).toContain("borne explicite de 15");
  });
});
