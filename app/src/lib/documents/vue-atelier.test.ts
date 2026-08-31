import { describe, expect, it } from "vitest";

import type {
  Exercise,
  ExerciseAttempt,
  Referentiel,
  Skill,
  SkillObservation,
  SkillState,
} from "@/lib/domain/types";
import type { IndexDocumentaire } from "./index";
import { construireVuesAtelier } from "./vue-atelier";
import { construireEtatCompetence } from "@/lib/engine/vues-twiny";

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
  // Le tag que la migration d ADR-107 pose pour chaque competence existante.
  tagsDomaine: ["logistique"],
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

const etatsLot5 = (...etats: SkillState[]) => etats.map(construireEtatCompetence);

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
  verdictTuteur: {
    resultat: "reussi",
    appreciations: {},
    justifications: {},
    bilan: { pointsForts: "", pointsBloquants: "", aRetravailler: [] },
    date: "2026-08-11T10:00:00.000Z",
  },
  reponse: "Analyse des flux terminée",
  notes: "",
  resultat: "reussi",
  statut: "terminee",
  dureeMin: 30,
  evaluation: {
    comprehension: 4,
    application: 4,
  },
};

const referentiel: Referentiel = {
  domaines: [
    {
      id: "logistique",
      nom: "Logistique",
      prefixe: "LOG",
      description: "Gestion des flux",
      ordre: 1,
      version: 1,
      archive: false,
      origine: "utilisateur",
    },
  ],
  skills: [competence, suivante],
  actifs: [competence, suivante],
  parCode: new Map([
    [competence.code, competence],
    [suivante.code, suivante],
  ]),
  codesActifs: new Set([competence.code, suivante.code]),
  domainesParId: new Map([
    [
      "logistique",
      {
        id: "logistique",
        nom: "Logistique",
        prefixe: "LOG",
        description: "Gestion des flux",
        ordre: 1,
        version: 1,
        archive: false,
        origine: "utilisateur",
      },
    ],
  ]),
};

const index: IndexDocumentaire = {
  documents: [],
  parId: new Map(),
  liens: [],
  sortants: new Map(),
  entrants: new Map(),
};

describe("construireVuesAtelier", () => {
  it("construit des fiches de domaine, compétence et exercice complètes", () => {
    const vues = construireVuesAtelier(
      referentiel,
      [etat(competence, [observation]), etat(suivante)],
      [exercice],
      [tentative],
      index,
      [observation],
      [],
      new Set(),
      etatsLot5(etat(competence, [observation]), etat(suivante)),
    );

    expect(vues.domaines).toHaveLength(1);
    expect(vues.domaines[0].nom).toBe("Logistique");
    expect(vues.domaines[0].nombreEvaluees).toBe(1);
    expect(vues.domaines[0].nombreObservations).toBe(1);
    expect(vues.domaines[0].nombreExercices).toBe(1);
    expect(vues.domaines[0].travailRealise).toEqual([
      expect.objectContaining({
        id: "observation:observation-1",
        titre: "transport",
        resultat: "reussi",
        documentId: null,
        competences: [{ code: "LOG-01", titre: "Analyser un flux logistique" }],
      }),
    ]);

    expect(vues.competences).toHaveLength(2);
    expect(vues.competences[0].code).toBe("LOG-01");
    expect(vues.competences[0].niveau).toBe(3);
    expect(vues.competences[0].exercices).toHaveLength(1);
    expect(vues.competences[0].observations).toHaveLength(1);
    expect(vues.competences[0].connexes).toEqual([
      {
        code: "LOG-02",
        intitule: "Optimiser un flux logistique",
        relation: "suivante",
        dejaMesuree: false,
      },
    ]);
  });

  it("gère l'absence d'observation et de tentative sans lever", () => {
    const vues = construireVuesAtelier(
      referentiel,
      [etat(competence), etat(suivante)],
      [],
      [],
      index,
      [],
      [],
      new Set(),
      etatsLot5(etat(competence), etat(suivante)),
    );

    expect(vues.competences[0].niveau).toBeNull();    expect(vues.competences[0].score).toBeNull();
    expect(vues.competences[0].exercices).toHaveLength(0);
    expect(vues.competences[0].observations).toHaveLength(0);
    expect(vues.competences[0].etatLot5.observationPonctuelle).toBeNull();
    expect(vues.competences[0].etatLot5.maitrise.maitrisee).toBe(false);
    expect(vues.domaines[0].nombreEvaluees).toBe(0);
  });

  it("expose le fil des ressources du domaine, ordonné par dernière activité dérivée du journal", () => {
    const ressource = (id: string, titre: string, cible: string) => ({
      id,
      contenuMd: "",
      frontMatter: {},
      corps: "",
      titre,
      type: "cours",
      typeConnu: null,
      schema: null,
      schemaCompatible: true,
      liens: [{ cible }],
    });
    const observationDocumentee: SkillObservation = {
      ...observation,
      id: "observation-documentee",
      date: "2026-08-14T10:00:00.000Z",
      source: {
        kind: "exercice",
        ref: "tentative-2",
        document: { documentId: "doc-recent", snapshotId: "snap-1" },
      },
    };
    const indexAvecRessources: IndexDocumentaire = {
      documents: [
        ressource("doc-vieux", "Cours ancien", suivante.code),
        ressource("doc-recent", "Cours récent", competence.code),
      ],
      parId: new Map(),
      liens: [],
      sortants: new Map([
        ["doc-vieux", [suivante.code]],
        ["doc-recent", [competence.code]],
      ]),
      entrants: new Map(),
    };

    const vues = construireVuesAtelier(
      referentiel,
      [etat(competence, [observation]), etat(suivante)],
      [],
      [],
      indexAvecRessources,
      [observationDocumentee],
      [],
      new Set(),
      etatsLot5(etat(competence, [observation]), etat(suivante)),
    );

    const fil = vues.domaines[0].ressources;
    expect(fil.map((r) => r.documentId)).toEqual(["doc-recent", "doc-vieux"]);
    expect(fil[0].derniereActivite).toBe("2026-08-14T10:00:00.000Z");
    // Jamais mobilisée : listée, sans date fabriquée.
    expect(fil[1].derniereActivite).toBeNull();
  });

  it("compte une compétence rattachée dans la couverture de chaque domaine sans la dupliquer", () => {
    const domaineSecondaire = {
      ...referentiel.domaines[0],
      id: "statistiques",
      nom: "Statistiques",
      prefixe: "STA",
      ordre: 2,
    };
    const competencePartagee: Skill = {
      ...competence,
      tagsDomaine: [competence.domaine, domaineSecondaire.id],
    };
    const referentielPartage: Referentiel = {
      ...referentiel,
      domaines: [...referentiel.domaines, domaineSecondaire],
      skills: [competencePartagee, suivante],
      actifs: [competencePartagee, suivante],
      parCode: new Map([
        [competencePartagee.code, competencePartagee],
        [suivante.code, suivante],
      ]),
      domainesParId: new Map([
        [referentiel.domaines[0].id, referentiel.domaines[0]],
        [domaineSecondaire.id, domaineSecondaire],
      ]),
    };

    const vues = construireVuesAtelier(
      referentielPartage,
      [etat(competencePartagee, [observation]), etat(suivante)],
      [exercice],
      [tentative],
      index,
      [],
      [],
      new Set(),
      etatsLot5(etat(competencePartagee, [observation]), etat(suivante)),
    );

    expect(vues.domaines.map((domaine) => domaine.id)).toEqual([
      "logistique",
      "statistiques",
    ]);
    expect(vues.domaines[1]).toMatchObject({
      nombreEvaluees: 1,
      nombreObservations: 1,
      nombreExercices: 1,
      competences: [{ code: competence.code }],
    });
  });

  it("réutilise les états du lot 5 déjà calculés", () => {
    const etatLot5 = construireEtatCompetence(etat(competence, [observation]));

    const vues = construireVuesAtelier(
      referentiel,
      [etat(competence, [observation]), etat(suivante)],
      [exercice],
      [tentative],
      index,
      [],
      [],
      new Set(),
      [etatLot5],
    );

    expect(vues.competences[0].etatLot5).toBe(etatLot5);
  });

  it("isole les domaines archivés et n'expose pas les domaines dormants", () => {
    const competenceArchivee: Skill = {
      ...competence,
      code: "OLD-01",
      domaine: "archive",
      tagsDomaine: ["archive"],
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
      [],
      [],
      new Set(),
      etatsLot5(etat(competence), etat(suivante)),
    );

    expect(vues.domaines.map((domaine) => domaine.id)).toEqual(["logistique", "archive"]);
    expect(vues.domaines[1]).toMatchObject({
      id: "archive",
      competences: [{ code: "OLD-01", niveau: null, score: null }],
    });
  });

  it("construit la projection des exercices enrichie", () => {
    const vues = construireVuesAtelier(
      referentiel,
      [etat(competence, [observation]), etat(suivante)],
      [exercice],
      [tentative],
      index,
      [],
      [],
      new Set(),
      etatsLot5(etat(competence, [observation]), etat(suivante)),
    );

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
      [observation],
      [],
      new Set(),
      etatsLot5(etat(competence, [observation]), etat(suivante)),
    );

    expect(vues.competences[0].documents.map((document) => document.id)).toEqual(["note-log-01"]);
  });

  it("rend une observation cliquable seulement si son document existe", () => {
    const vues = construireVuesAtelier(
      referentiel,
      [etat(competence, [observation]), etat(suivante)],
      [exercice],
      [tentative],
      indexAvecDocuments(),
      [observation],
      [],
      new Set(),
      etatsLot5(etat(competence, [observation]), etat(suivante)),
    );

    expect(vues.competences[0].observations[0].documentId).toBe("preuve-tentative-1");
    expect(vues.domaines[0].travailRealise[0]).toEqual(expect.objectContaining({
      id: "document:preuve-tentative-1",
      documentId: "preuve-tentative-1",
    }));
  });

  it("ne répète pas un même travail pour chaque compétence observée", () => {
    const observationSuivante: SkillObservation = {
      ...observation,
      id: "observation-2",
      skillCode: suivante.code,
    };
    const vues = construireVuesAtelier(
      referentiel,
      [etat(competence, [observation]), etat(suivante, [observationSuivante])],
      [exercice],
      [tentative],
      indexAvecDocuments(),
      [observation, observationSuivante],
      [],
      new Set(),
      etatsLot5(etat(competence, [observation]), etat(suivante, [observationSuivante])),
    );

    expect(vues.domaines[0].travailRealise).toHaveLength(1);
    expect(vues.domaines[0].travailRealise[0].competences.map(({ code }) => code)).toEqual([
      "LOG-01",
      "LOG-02",
    ]);
  });

  it("ne fabrique pas de cible quand l'Observation n'a produit aucun document", () => {
    const vues = construireVuesAtelier(
      referentiel,
      [etat(competence, [observation]), etat(suivante)],
      [exercice],
      [tentative],
      index,
      [],
      [],
      new Set(),
      etatsLot5(etat(competence, [observation]), etat(suivante)),
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
      [],
      [],
      new Set(),
      etatsLot5(etat(competence, [observation]), etat(suivante)),
    );

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
      [],
      [],
      new Set(),
      etatsLot5(etat(competence, [observation]), etat(suivante)),
    );

    expect(vues.competences[0].domainesExistants).toEqual([]);
  });

  it("porte les échéances déclarées sur le module, dérivées des engagements (ADR-137)", () => {
    const maintenant = new Date(2026, 7, 25);
    const engagement = (id: string, echeanceLe: string, moduleDomaineId?: string) => ({
      id,
      type: "examen" as const,
      libelle: `Échéance ${id}`,
      echeanceLe,
      codes: [],
      moduleDomaineId,
    });
    const engagements = [
      { ...engagement("eng-loin", "2026-10-01", "logistique"), clotureLe: "2026-08-20T10:00:00Z", clotureType: "passe" as const },
      engagement("eng-proche", "2026-09-05", "logistique"),
      engagement("eng-autre", "2026-09-01", "autre-module"),
      engagement("eng-libre", "2026-08-30"),
    ];

    const vues = construireVuesAtelier(
      referentiel,
      [etat(competence)],
      [],
      [],
      index,
      [],
      [],
      new Set(),
      etatsLot5(etat(competence)),
      engagements,
      maintenant,
    );

    // Seul l'engagement ouvert rattaché à CE domaine remonte — clos, étranger
    // et non rattaché restent chez eux. Trié du plus proche au plus lointain.
    expect(vues.domaines[0].orchestrationModule.deadlines).toEqual([
      expect.objectContaining({
        id: "eng-proche",
        type: "examen",
        label: "Échéance eng-proche",
        dueAt: "2026-09-05",
        daysRemaining: 11,
        preparation: "non-estimable",
      }),
    ]);
  });

  it("rend un module sans échéance déclarée par une liste vide, jamais un faux", () => {
    const vues = construireVuesAtelier(
      referentiel,
      [etat(competence)],
      [],
      [],
      index,
      [],
      [],
      new Set(),
      etatsLot5(etat(competence)),
    );

    expect(vues.domaines[0].orchestrationModule.deadlines).toEqual([]);
  });

  it("garde visible un module déclaré avant sa première compétence", () => {
    const moduleVide = {
      id: "macroeconomie-l2",
      nom: "Macroéconomie L2",
      prefixe: "MAC",
      description: "Cours du premier semestre.",
      ordre: 2,
      version: 1,
      archive: false,
      origine: "manuel" as const,
      usage: {
        type: "module" as const,
        module: { anneeAcademique: "2026-2027", periode: "S1" },
      },
    };
    const referentielVide: Referentiel = {
      domaines: [moduleVide],
      skills: [],
      actifs: [],
      parCode: new Map(),
      codesActifs: new Set(),
      domainesParId: new Map([[moduleVide.id, moduleVide]]),
    };

    const vues = construireVuesAtelier(
      referentielVide,
      [],
      [],
      [],
      index,
      [],
      [],
      new Set(),
      [],
    );

    expect(vues.domaines).toHaveLength(1);
    expect(vues.domaines[0]).toMatchObject({
      id: "macroeconomie-l2",
      competences: [],
      ressources: [],
    });
  });
});
