import { describe, expect, it } from "vitest";

import type {
  Domaine,
  Skill,
  SkillObservation,
  SkillState,
} from "@/lib/domain/types";
import type {
  CarteGlobale,
  CorrespondanceCarteGlobale,
  ElementGlobal,
  SelectionCarteGlobale,
} from "@/lib/domain/carte-globale";
import type { Recommandation } from "./recommend";
import { computeSkillState } from "./skill-state";
import {
  adapterRecommandationsAEspaceActif,
  construireCarteIndividuelle,
  construireEspaceActif,
  construireEtatCompetence,
  construireEtatConnaissance,
  LIMITE_ESPACE_ACTIF,
} from "./vues-twiny";

const NOW = new Date("2026-08-20T12:00:00.000Z");

const DOMAINE: Domaine = {
  id: "dev",
  nom: "Développement",
  prefixe: "DEV",
  description: "",
  ordre: 0,
  version: 1,
  archive: false,
  origine: "utilisateur",
};

function skill(
  code: string,
  options: Partial<Pick<Skill, "domaine" | "domainesSecondaires" | "active" | "archive" | "ordre">> = {},
): Skill {
  return {
    code,
    domaine: options.domaine ?? "dev",
    domainesSecondaires: options.domainesSecondaires,
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

function globalElement(
  id: string,
  type: ElementGlobal["type"] = "connaissance",
): ElementGlobal {
  return {
    id,
    type,
    nom: `Global ${id}`,
    description: "",
    statut: "publie",
    provenance: { type: "curation", reference: `ref-${id}` },
    version: 1,
    valideLe: "2026-08-20T08:00:00.000Z",
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

function carte(options: {
  carteGlobale?: CarteGlobale;
  selections?: SelectionCarteGlobale[];
  correspondances?: CorrespondanceCarteGlobale[];
  skills?: Skill[];
  observations?: SkillObservation[];
} = {}) {
  const observations = options.observations ?? [];
  return construireCarteIndividuelle({
    carteGlobale: options.carteGlobale ?? { elements: [], relations: [] },
    selectionsGlobales: options.selections ?? [],
    correspondancesGlobales: options.correspondances ?? [],
    domainesLocaux: [DOMAINE],
    etatsLocaux: (options.skills ?? []).map((item) => computeSkillState(item, observations, NOW)),
  });
}

describe("états du lot 5", () => {
  it("refuse d'inventer un état de connaissance à partir d'une simple présence globale", () => {
    const etat = construireEtatConnaissance(globalElement("k-1"));

    expect(etat).toMatchObject({
      elementId: "k-1",
      conclusion: null,
      confiance: "nulle",
      derniereObservation: null,
      statut: "non-mesure",
    });
    expect(etat.explication.reserves.join(" ")).toContain("ne vaut pas mesure");
  });

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
  it("compose seulement les faits globaux pertinents et conserve une compétence locale archivée", () => {
    const connaissance = globalElement("k-1");
    const competenceGlobale = globalElement("g-1", "competence");
    const autre = globalElement("autre");
    const carteGlobale: CarteGlobale = {
      elements: [connaissance, competenceGlobale, autre],
      relations: [{
        id: "r-1",
        sourceId: "k-1",
        cibleId: "g-1",
        type: "RELATED_TO",
        statut: "publie",
        provenance: { type: "curation", reference: "ref-r" },
        version: 1,
        valideLe: "2026-08-20T08:00:00.000Z",
      }],
    };
    const archivee = skill("DEV-ARCH", { archive: true, active: false });
    const obs = observation("DEV-ARCH");
    const avant = structuredClone(obs);

    const resultat = carte({
      carteGlobale,
      selections: [
        { elementId: "k-1", selectionneLe: "2026-08-20T09:00:00.000Z" },
        { elementId: "g-1", selectionneLe: "2026-08-20T09:05:00.000Z" },
      ],
      skills: [archivee],
      observations: [obs],
    });

    expect(resultat.elementsGlobaux.map((element) => element.id)).toEqual(["k-1", "g-1"]);
    expect(resultat.relationsGlobales.map((relation) => relation.id)).toEqual(["r-1"]);
    expect(resultat.etatsConnaissance.get("k-1")?.conclusion).toBeNull();
    expect(resultat.competencesLocales[0].etatConsolide.skill.archive).toBe(true);
    expect(resultat.reserves.join(" ")).toContain("aucun état");
    expect(obs).toEqual(avant);
  });

  it("ne mélange jamais deux jeux d'entrées privés", () => {
    const globale: CarteGlobale = {
      elements: [globalElement("a"), globalElement("b")],
      relations: [],
    };
    const carteA = carte({
      carteGlobale: globale,
      selections: [{ elementId: "a", selectionneLe: "2026-08-20T09:00:00.000Z" }],
      skills: [skill("A-01")],
    });
    const carteB = carte({
      carteGlobale: globale,
      selections: [{ elementId: "b", selectionneLe: "2026-08-20T09:00:00.000Z" }],
      skills: [skill("B-01")],
    });

    expect(carteA.elementsGlobaux.map((element) => element.id)).toEqual(["a"]);
    expect(carteA.competencesLocales.map((etat) => etat.code)).toEqual(["A-01"]);
    expect(carteB.elementsGlobaux.map((element) => element.id)).toEqual(["b"]);
    expect(carteB.competencesLocales.map((etat) => etat.code)).toEqual(["B-01"]);
  });
});

describe("espace actif borné", () => {
  it("priorise la sélection globale puis le classement du référentiel local", () => {
    const skills = [skill("DEV-A"), skill("DEV-B"), skill("DEV-C"), skill("DEV-D")];
    const etats = skills.map((item) => computeSkillState(item, [], NOW));
    const recommandations = etats.map((etat, index) => recommandation(etat, 100 - index));
    const vue = carte({
      carteGlobale: { elements: [globalElement("k-1")], relations: [] },
      selections: [{ elementId: "k-1", selectionneLe: "2026-08-20T09:00:00.000Z" }],
      skills,
    });

    const espace = construireEspaceActif({ carte: vue, recommandations, limite: 4 });

    expect(espace.elements.map((element) => element.id)).toEqual([
      "k-1",
      "DEV-A",
      "DEV-B",
      "DEV-C",
    ]);
    expect(espace.elements.map((element) => element.origine)).toEqual([
      "selection-globale",
      "referentiel-local",
      "referentiel-local",
      "referentiel-local",
    ]);
    expect(espace.elements.some((element) => element.id === "DEV-D")).toBe(false);
  });

  it("reste à quinze éléments et explique la troncature", () => {
    const skills = Array.from({ length: 20 }, (_, index) => skill(`DEV-${index + 1}`, { ordre: index }));
    const vue = carte({ skills });
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
    // Une correspondance privée est le seul chemin restant qui peut désigner une
    // compétence sortie du périmètre : la carte la garde, l'espace actif la refuse.
    const globaleArchivee = globalElement("g-arch", "competence");
    const globaleHors = globalElement("g-hors", "competence");
    const vue = carte({
      carteGlobale: { elements: [globaleArchivee, globaleHors], relations: [] },
      selections: [
        { elementId: "g-arch", selectionneLe: "2026-08-20T09:00:00.000Z" },
        { elementId: "g-hors", selectionneLe: "2026-08-20T09:01:00.000Z" },
      ],
      correspondances: [
        {
          competenceCode: "DEV-ARCH",
          elementGlobalId: "g-arch",
          acteur: "personne",
          provenance: { type: "utilisateur", reference: "maxime" },
          rattacheLe: "2026-08-20T09:00:00.000Z",
        },
        {
          competenceCode: "DEV-HORS",
          elementGlobalId: "g-hors",
          acteur: "personne",
          provenance: { type: "utilisateur", reference: "maxime" },
          rattacheLe: "2026-08-20T09:01:00.000Z",
        },
      ],
      skills: [archivee, horsPerimetre, active],
    });
    const rec = recommandation(computeSkillState(active, [], NOW));

    const espace = construireEspaceActif({ carte: vue, recommandations: [rec] });

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
  it("rend actionnable une cible globale seulement après un rapprochement explicite", () => {
    const local = skill("DEV-01");
    const autre = skill("DEV-02", { ordre: 1 });
    const globale = globalElement("g-1", "competence");
    const vue = carte({
      carteGlobale: { elements: [globale], relations: [] },
      skills: [local, autre],
      selections: [{ elementId: globale.id, selectionneLe: "2026-08-20T09:00:00.000Z" }],
      correspondances: [{
        competenceCode: local.code,
        elementGlobalId: globale.id,
        acteur: "personne",
        provenance: { type: "utilisateur", reference: "maxime" },
        rattacheLe: "2026-08-20T09:00:00.000Z",
      }],
    });
    const base = vue.competencesLocales.map((etat, index) =>
      recommandation(etat.etatConsolide, index === 0 ? 10 : 100));
    const espace = construireEspaceActif({ carte: vue, recommandations: base });
    const adaptees = adapterRecommandationsAEspaceActif(base, espace);

    expect(vue.competencesLocales.map((etat) => etat.code)).toEqual(["DEV-01", "DEV-02"]);
    expect(espace.codesCompetences).toContain("DEV-01");
    expect(espace.elements.find((element) => element.codeCompetence === "DEV-01"))
      .toMatchObject({ actionnable: true, origine: "selection-globale" });
    expect(adaptees[0].etat.skill.code).toBe("DEV-01");
    expect(adaptees[0].valeur).toBe(10);
    expect(adaptees[0].prioriteLot5).toMatchObject({
      origine: "selection-globale",
      reference: globale.id,
    });
  });

  it("préserve le classement local si la cible globale n'a aucun rapprochement explicite", () => {
    const etat = computeSkillState(skill("DEV-01"), [], NOW);
    const base = [recommandation(etat)];
    const vue = carte({
      carteGlobale: { elements: [globalElement("k-1")], relations: [] },
      selections: [{ elementId: "k-1", selectionneLe: "2026-08-20T09:00:00.000Z" }],
      skills: [etat.skill],
    });
    const espace = construireEspaceActif({ carte: vue, recommandations: base, limite: 1 });

    const adaptees = adapterRecommandationsAEspaceActif(base, espace);

    expect(adaptees[0].etat.skill.code).toBe("DEV-01");
    expect(adaptees[0].prioriteLot5.origine).toBe("referentiel-local");
    expect(adaptees[0].prioriteLot5.explication).toContain("classement explicable");
    expect(adaptees[0].reservesLot5.join(" ")).toContain("sans rapprochement automatique");
  });

  it("place la cible sélectionnée en tête sans modifier les scores existants", () => {
    const a = computeSkillState(skill("DEV-A"), [], NOW);
    const b = computeSkillState(skill("DEV-B"), [], NOW);
    const base = [recommandation(a, 100), recommandation(b, 10)];
    const globale = globalElement("g-1", "competence");
    const vue = carte({
      carteGlobale: { elements: [globale], relations: [] },
      selections: [{ elementId: globale.id, selectionneLe: "2026-08-20T09:00:00.000Z" }],
      correspondances: [{
        competenceCode: "DEV-B",
        elementGlobalId: globale.id,
        acteur: "personne",
        provenance: { type: "utilisateur", reference: "maxime" },
        rattacheLe: "2026-08-20T09:00:00.000Z",
      }],
      skills: [a.skill, b.skill],
    });
    const espace = construireEspaceActif({ carte: vue, recommandations: base });

    const adaptees = adapterRecommandationsAEspaceActif(base, espace);

    expect(adaptees.map((item) => item.etat.skill.code)).toEqual(["DEV-B", "DEV-A"]);
    expect(adaptees.map((item) => item.valeur)).toEqual([10, 100]);
    expect(adaptees[0].prioriteLot5).toMatchObject({
      origine: "selection-globale",
      reference: globale.id,
    });
  });
});
