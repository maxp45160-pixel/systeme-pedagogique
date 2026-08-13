import { describe, expect, it } from "vitest";

import type {
  Exercise,
  ExerciseAttempt,
  Referentiel,
  Skill,
  SkillEvidence,
  SkillState,
} from "@/lib/domain/types";
import type { IndexDocumentaire } from "./index";
import { construireVuesAtelier } from "./vue-atelier";

const competence: Skill = {
  code: "LOG-01",
  domaine: "logistique",
  intitule: "Analyser un flux logistique",
  palier: "fondamentaux",
  prerequis: [],
  importance: 1,
  ordre: 1,
  active: true,
  archive: false,
  origine: "utilisateur",
};

const suivante: Skill = {
  ...competence,
  code: "LOG-02",
  intitule: "Optimiser un flux logistique",
  palier: "intermediaire",
  prerequis: [competence.code],
  ordre: 2,
};

const preuve: SkillEvidence = {
  id: "preuve-1",
  skillCode: competence.code,
  date: "2026-08-11T10:00:00.000Z",
  type: "etude-de-cas",
  niveauPreuve: "A",
  autonomie: "A3",
  qualite: "forte",
  resultat: "reussi",
  contexte: "transport",
  dimensions: { application: 0.8 },
  source: { kind: "exercice", ref: "tentative-1" },
};

const etat = (skill: Skill, preuves: SkillEvidence[] = []): SkillState => ({
  skill,
  niveau: preuves.length > 0 ? 3 : null,
  score: preuves.length > 0 ? 0.72 : null,
  confiance: preuves.length > 0 ? "moyenne" : "nulle",
  robustesse: preuves.length > 0 ? 0.6 : null,
  dimensions: {
    comprehension: preuves.length > 0 ? 0.7 : 0,
    application: preuves.length > 0 ? 0.8 : 0,
    transfert: 0,
    integration: 0,
    justification: 0,
  },
  preuves,
  contextesTestes: preuves.length > 0 ? ["transport"] : [],
  dernierePreuve: preuves.at(-1)?.date ?? null,
  joursDepuisDernierePreuve: preuves.length > 0 ? 1 : null,
  contradictions: [],
  prochaineEtape: preuves.length > 0 ? "Tester dans un autre contexte" : "Produire une première preuve",
  explication: { resume: "", facteurs: [], nombrePreuves: preuves.length, reserves: [] },
  statut: preuves.length > 0 ? "evalue" : "non-evalue",
});

const exercice: Exercise = {
  id: "exercice-flux",
  titre: "Diagnostiquer un flux",
  domaine: "logistique",
  type: "etude-de-cas",
  difficulte: 3,
  competences: [competence.code],
  dureeEstimeeMin: 30,
  enonce: "",
  indices: [],
  correction: "",
  criteres: [],
  origine: "manuel",
};

const tentative: ExerciseAttempt = {
  id: "tentative-1",
  exerciseId: exercice.id,
  debut: "2026-08-11T09:30:00.000Z",
  fin: "2026-08-11T10:00:00.000Z",
  indicesUtilises: 0,
  reponse: "",
  evaluation: {},
  resultat: "reussi",
  statut: "terminee",
};

const referentiel: Referentiel = {
  domaines: [{
    id: "logistique",
    nom: "Logistique",
    prefixe: "LOG",
    description: "Comprendre et améliorer les flux.",
    ordre: 1,
    version: 1,
    archive: false,
    origine: "utilisateur",
  }],
  skills: [competence, suivante],
  actifs: [competence, suivante],
  parCode: new Map([[competence.code, competence], [suivante.code, suivante]]),
  codesActifs: new Set([competence.code, suivante.code]),
  domainesParId: new Map(),
};
referentiel.domainesParId.set("logistique", referentiel.domaines[0]);

const index: IndexDocumentaire = {
  documents: [],
  parId: new Map(),
  liens: [],
  sortants: new Map(),
  entrants: new Map(),
};

describe("construireVuesAtelier", () => {
  it("projette le domaine comme fiche mère et relie ses fiches pédagogiques", () => {
    const vues = construireVuesAtelier(
      referentiel,
      [etat(competence, [preuve]), etat(suivante)],
      [exercice],
      [tentative],
      index,
    );

    expect(vues.domaines[0]).toMatchObject({
      kind: "domaine",
      id: "logistique",
      nombreEvaluees: 1,
      nombrePreuves: 1,
      nombreExercices: 1,
      derniereActivite: preuve.date,
    });
    expect(vues.domaines[0].competences.map((item) => item.code)).toEqual([
      competence.code,
      suivante.code,
    ]);

    expect(vues.competences[0]).toMatchObject({
      code: competence.code,
      niveau: 3,
      score: 0.72,
      nombrePreuves: 1,
      nombreContextes: 1,
      suivantes: [suivante.code],
    });
    expect(vues.competences[0].exercices[0]).toMatchObject({
      id: exercice.id,
      tentatives: 1,
      derniereTentative: tentative.fin,
    });
  });

  it("conserve l'absence de preuve comme une absence de niveau", () => {
    const vues = construireVuesAtelier(
      referentiel,
      [etat(competence), etat(suivante)],
      [],
      [],
      index,
    );

    expect(vues.competences[0]).toMatchObject({
      niveau: null,
      score: null,
      robustesse: null,
      nombrePreuves: 0,
    });
    expect(vues.domaines[0].nombreEvaluees).toBe(0);
  });

  it("isole les domaines archivés et n'expose pas les domaines dormants", () => {
    const competenceArchivee: Skill = {
      ...competence,
      code: "OLD-01",
      domaine: "archive",
    };
    const referentielEtendu: Referentiel = {
      ...referentiel,
      domaines: [
        ...referentiel.domaines,
        { ...referentiel.domaines[0], id: "archive", nom: "Archive", archive: true },
        { ...referentiel.domaines[0], id: "dormant", nom: "Dormant" },
      ],
      skills: [...referentiel.skills, competenceArchivee],
      actifs: [...referentiel.actifs],
      domainesParId: new Map(referentiel.domainesParId),
    };
    referentielEtendu.domainesParId.set("archive", referentielEtendu.domaines[1]);
    referentielEtendu.domainesParId.set("dormant", referentielEtendu.domaines[2]);

    const vues = construireVuesAtelier(
      referentielEtendu,
      [etat(competence), etat(suivante)],
      [],
      [],
      index,
    );

    expect(vues.domaines.map((domaine) => domaine.id)).toEqual(["logistique", "archive"]);
    expect(vues.domaines[1]).toMatchObject({
      id: "archive",
      competences: [{ code: "OLD-01", niveau: null, score: null }],
    });
  });
});
