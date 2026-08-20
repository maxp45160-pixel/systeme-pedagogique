import { describe, expect, it } from "vitest";

import type {
  Exercise,
  ExerciseAttempt,
  Referentiel,
  Skill,
  SkillObservation,
  SkillState,
} from "@/lib/domain/types";
import type { Theme } from "@/lib/domain/theme";
import type { IndexDocumentaire } from "./index";
import { construireVuesAtelier } from "./vue-atelier";
import {
  construireEtatCompetence,
  type RecommandationAdaptee,
} from "@/lib/engine/vues-twiny";

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

const observation: SkillObservation = {
  id: "observation-1",
  skillCode: competence.code,
  date: "2026-08-11T10:00:00.000Z",
  type: "etude-de-cas",
  niveauObservation: "A",
  autonomie: "A3",
  qualite: "forte",
  resultat: "reussi",
  contexte: "transport",
  dimensions: { application: 0.8 },
  source: { kind: "exercice", ref: "tentative-1" },
};

const etat = (skill: Skill, observations: SkillObservation[] = []): SkillState => ({
  skill,
  niveau: observations.length > 0 ? 3 : null,
  score: observations.length > 0 ? 0.72 : null,
  confiance: observations.length > 0 ? "moyenne" : "nulle",
  robustesse: observations.length > 0 ? 0.6 : null,
  dimensions: {
    comprehension: observations.length > 0 ? 0.7 : 0,
    application: observations.length > 0 ? 0.8 : 0,
    transfert: 0,
    integration: 0,
    justification: 0,
  },
  observations,
  contextesTestes: observations.length > 0 ? ["transport"] : [],
  derniereObservation: observations.at(-1)?.date ?? null,
  joursDepuisDerniereObservation: observations.length > 0 ? 1 : null,
  contradictions: [],
  prochaineEtape: observations.length > 0 ? "Tester dans un autre contexte" : "Produire une première observation",
  explication: { resume: "", facteurs: [], nombreObservations: observations.length, reserves: [] },
  statut: observations.length > 0 ? "evalue" : "non-evalue",
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
      [etat(competence, [observation]), etat(suivante)],
      [exercice],
      [tentative],
      index,
    );

    expect(vues.domaines[0]).toMatchObject({
      kind: "domaine",
      id: "logistique",
      nombreEvaluees: 1,
      nombreObservations: 1,
      nombreExercices: 1,
      derniereActivite: observation.date,
    });
    expect(vues.domaines[0].competences.map((item) => item.code)).toEqual([
      competence.code,
      suivante.code,
    ]);

    expect(vues.competences[0]).toMatchObject({
      code: competence.code,
      niveau: 3,
      score: 0.72,
      nombreObservations: 1,
      nombreContextes: 1,
      suivantes: [suivante.code],
    });
    expect(vues.competences[0].etatLot5).toBeDefined();
    expect(vues.competences[0].exercices[0]).toMatchObject({
      id: exercice.id,
      tentatives: 1,
      derniereTentative: tentative.fin,
    });
  });

  it("conserve l'absence d'observation comme une absence de niveau", () => {
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
      nombreObservations: 0,
    });
    expect(vues.competences[0].etatLot5.observationPonctuelle).toBeNull();
    expect(vues.competences[0].etatLot5.maitrise.maitrisee).toBe(false);
    expect(vues.domaines[0].nombreEvaluees).toBe(0);
  });

  it("réutilise les états du lot 5 et la recommandation déjà adaptée", () => {
    const theme: Theme = {
      id: "flux-opti-lot5",
      libelle: "Optimisation des flux",
      intention: "",
      codes: [competence.code],
      origine: "utilisateur",
      creeLe: "2026-08-10T08:00:00.000Z",
      archive: false,
    };
    const etatLot5 = construireEtatCompetence(etat(competence, [observation]));
    const recommandation = {
      etat: etatLot5.etatConsolide,
      valeur: 42,
      facteurs: [],
      raison: "Classement existant",
      exercice: null,
      difficulteCible: 2,
      dureeEstimeeMin: 30,
      calibration: null,
      prioriteLot5: {
        origine: "objectif",
        reference: "objectif-1",
        explication: "Cette compétence appartient à la cible d'un objectif actif.",
      },
      reservesLot5: ["La cible reste locale."],
    } satisfies RecommandationAdaptee;

    const vues = construireVuesAtelier(
      referentiel,
      [etat(competence, [observation]), etat(suivante)],
      [exercice],
      [tentative],
      index,
      [],
      [],
      new Set(),
      [theme],
      [etatLot5],
      [recommandation],
    );

    expect(vues.competences[0].etatLot5).toBe(etatLot5);
    expect(vues.themes[0].prochaineActionRecommandee).toEqual({
      code: competence.code,
      titre: competence.intitule,
      motif: "Cette compétence appartient à la cible d'un objectif actif.",
      reserves: ["La cible reste locale."],
    });
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

  it("construit les vues thématiques et d'exercices enrichies", () => {
    const theme: Theme = {
      id: "flux-opti",
      libelle: "Optimisation des flux",
      intention: "Comprendre et optimiser les flux logistiques",
      codes: [competence.code, suivante.code],
      origine: "utilisateur",
      creeLe: "2026-08-10T08:00:00.000Z",
      archive: false,
    };

    const vues = construireVuesAtelier(
      referentiel,
      [etat(competence, [observation]), etat(suivante)],
      [exercice],
      [tentative],
      index,
      [],
      [],
      new Set(),
      [theme],
    );

    expect(vues.themes[0]).toMatchObject({
      kind: "theme",
      id: "flux-opti",
      libelle: "Optimisation des flux",
      intention: "Comprendre et optimiser les flux logistiques",
      nombreEvaluees: 1,
      nombreObservations: 1,
      nombreExercices: 1,
      tauxCouverture: 0.5,
    });
    expect(vues.themes[0].competences.map((c) => c.code)).toEqual(["LOG-01", "LOG-02"]);
    expect(vues.themes[0].domaines[0]).toMatchObject({
      id: "logistique",
      nombreCompetences: 2,
      nombreEvaluees: 1,
    });

    expect(vues.exercices[0]).toMatchObject({
      kind: "exercice",
      id: exercice.id,
      titre: exercice.titre,
      domaineId: "logistique",
      nombreTentatives: 1,
      meilleurResultat: "reussi",
    });
  });
});

describe("vue d'une compétence — ce que l'Atelier a le droit de montrer", () => {
  /** L'index tel que le corpus le rend après un passage : fiche, preuve, et une note. */
  function indexAvecDocuments(): IndexDocumentaire {
    const documents = [
      { id: "exercice-flux", titre: "Diagnostiquer un flux", type: "exercice" },
      { id: "preuve-tentative-1", titre: "Preuve de travail", type: "preuve" },
      { id: "note-log-01", titre: "Note sur LOG-01", type: "note" },
    ];
    return {
      documents: documents as unknown as IndexDocumentaire["documents"],
      parId: new Map(
        documents.map((document) => [document.id, document]),
      ) as unknown as IndexDocumentaire["parId"],
      liens: [],
      sortants: new Map(),
      entrants: new Map([[competence.code, documents.map((document) => document.id)]]),
    };
  }

  it("ne garde que les supports dans les ressources associées", () => {
    const vues = construireVuesAtelier(
      referentiel,
      [etat(competence, [observation]), etat(suivante)],
      [exercice],
      [tentative],
      indexAvecDocuments(),
    );

    /*
     * La fiche d'exercice et la preuve citent la compétence, donc `entrants` les
     * rend — mais `exercices` et `observations` les nomment déjà avec leurs mesures.
     */
    expect(vues.competences[0].documents.map((document) => document.id)).toEqual(["note-log-01"]);
  });

  it("rend une observation cliquable seulement si son document existe", () => {
    const vues = construireVuesAtelier(
      referentiel,
      [etat(competence, [observation]), etat(suivante)],
      [exercice],
      [tentative],
      indexAvecDocuments(),
    );

    /* `source.ref` vaut `tentative-1`, et `production.ts` écrit `preuve-tentative-1`. */
    expect(vues.competences[0].observations[0].documentId).toBe("preuve-tentative-1");
  });

  it("ne fabrique pas de cible quand l'Observation n'a produit aucun document", () => {
    const vues = construireVuesAtelier(
      referentiel,
      [etat(competence, [observation]), etat(suivante)],
      [exercice],
      [tentative],
      index,
    );

    expect(vues.competences[0].observations[0].documentId).toBeNull();
  });

  it("nomme les domaines vivants où une relation peut créer une compétence", () => {
    const vues = construireVuesAtelier(
      referentiel,
      [etat(competence, [observation]), etat(suivante)],
      [exercice],
      [tentative],
      index,
    );

    /*
     * L'écran doit pouvoir écrire « Créer dans Logistique » plutôt que
     * « Créer dans logistique » : la personne valide une création dont elle
     * lit la destination.
     */
    expect(vues.competences[0].domainesExistants).toEqual([{ id: "logistique", nom: "Logistique" }]);
  });

  it("n'offre pas un domaine archivé comme destination", () => {
    const archive: Referentiel = {
      ...referentiel,
      domaines: [{ ...referentiel.domaines[0], archive: true }],
    };

    const vues = construireVuesAtelier(
      archive,
      [etat(competence, [observation]), etat(suivante)],
      [exercice],
      [tentative],
      index,
    );

    /* Un domaine archivé n'accueille rien : le proposer serait proposer une impasse. */
    expect(vues.competences[0].domainesExistants).toEqual([]);
  });
});
