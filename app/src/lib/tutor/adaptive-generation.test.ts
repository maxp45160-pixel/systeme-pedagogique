import { describe, expect, it } from "vitest";

import type { MoteurTuteur } from "./moteurs";
import {
  construirePromptGenerationActivite,
  erreursContratGenerationActivite,
  genererContenuActivite,
  type ContratGenerationActivite,
} from "./adaptive-generation";
import {
  OUTIL_EVALUATION_PROJET,
  OUTIL_EXPLORATION_ADAPTATIVE,
  OUTIL_MINI_PROJET_ADAPTATIF,
  outilEvaluationProjet,
  outilGenerationActivite,
  validerAppelOutil,
} from "./outils";

const EXPLORATION: ContratGenerationActivite = {
  famille: "explorer",
  objectif: "Comprendre pourquoi une file sature avant de calculer son débit.",
  competences: [{ code: "LOG-10", intitule: "Analyser un flux logistique" }],
  dureeEstimeeMin: 20,
  demandeCognitive: "faible",
  workspace: "exploration-guidee",
  modeObservation: "aucune",
  contraintes: ["Pas de calcul avant l'intuition"],
  ressourcesAutorisees: [{ id: "cours-files", libelle: "Cours sur les files", usage: "normal" }],
  contratEvaluation: [],
  versionContrat: 1,
};

const PRODUCTION: ContratGenerationActivite = {
  famille: "produire",
  objectif: "Dimensionner une file dans un contexte nouveau.",
  competences: [{ code: "LOG-10", intitule: "Analyser un flux logistique" }],
  dureeEstimeeMin: 45,
  demandeCognitive: "standard",
  workspace: "mini-projet",
  modeObservation: "soumission-finale",
  contraintes: ["Justifier chaque hypothèse"],
  ressourcesAutorisees: [
    { id: "formulaire", libelle: "Formulaire de référence", usage: "normal" },
  ],
  contratEvaluation: [
    {
      id: "transfert",
      libelle: "Adapte la méthode au nouveau contexte",
      attendu: "Les hypothèses du contexte modifient explicitement le modèle.",
      caractere: "transfert",
    },
    {
      id: "justification",
      libelle: "Justifie les choix",
      attendu: "Chaque paramètre est relié à une donnée ou une hypothèse annoncée.",
      caractere: "standard",
    },
  ],
  versionContrat: 2,
};

const CONTENU_EXPLORATION = {
  titre: "Voir la saturation",
  description: "Une exploration guidée par deux situations contrastées.",
  brief: "Observe puis explique le changement de régime.",
  jalons: [
    {
      titre: "Comparer",
      consigne: "Compare les deux situations.",
      resultat_attendu: "Une différence formulée avec ses propres mots.",
    },
  ],
  workspace: {
    introduction: "Commence par une intuition.",
    parcours: [
      {
        titre: "Deux files",
        contenu: "La première absorbe les arrivées, la seconde accumule du retard.",
        invite_annotation: "Qu'est-ce qui change ?",
      },
    ],
    synthese_facultative: "Résume le seuil avec tes mots.",
  },
};

const CONTENU_PROJET = {
  titre: "Dimensionner l'accueil d'un atelier",
  description: "Un cas de transfert sur un flux de personnes.",
  brief: "Propose un dimensionnement défendable à partir des données fournies.",
  jalons: [
    {
      titre: "Modéliser",
      consigne: "Pose les hypothèses et le modèle.",
      resultat_attendu: "Un modèle annoté et ses hypothèses.",
    },
  ],
  workspace: {
    demarrage: "Lis le contexte et liste les inconnues.",
    canevas_artefact: [
      { section: "Hypothèses", consigne: "Distingue données et hypothèses." },
      { section: "Décision", consigne: "Défends le dimensionnement retenu." },
    ],
    conseils_realisation: ["Relie chaque paramètre à sa source."],
    consigne_soumission: "Relis les critères puis soumets une version figée.",
  },
};

const EVALUATION = {
  criteres: [
    {
      critere_id: "transfert",
      appreciation: "demontre",
      justification: "Le modèle est adapté aux arrivées par créneaux.",
      elements_observes: ["Les arrivées sont segmentées par créneau."],
    },
    {
      critere_id: "justification",
      appreciation: "partiellement-demontre",
      justification: "Le débit est sourcé, mais pas la variabilité.",
      elements_observes: ["Le débit moyen cite le relevé fourni."],
    },
  ],
  synthese: "Le transfert est visible ; une hypothèse reste non sourcée.",
  reserves: ["La variabilité n'est pas quantifiée dans l'artefact."],
};

function moteurQuiAppelle(nom: string, entree: unknown): MoteurTuteur {
  return {
    async repondre({ envoyer, outils }) {
      const proposition = validerAppelOutil(nom, entree, outils);
      if (proposition) envoyer("proposition", proposition);
      else envoyer("proposition-rejetee", { message: "sortie invalide" });
      envoyer("fin", { outils: { actifs: true } });
    },
  } as MoteurTuteur;
}

describe("outils adaptatifs fermés", () => {
  it("rend la famille impossible à modifier dans la sortie", () => {
    for (const famille of ["explorer", "produire"] as const) {
      const outil = outilGenerationActivite(famille);
      expect(outil.schema.properties).not.toHaveProperty("famille");
      expect(outil.schema.properties).not.toHaveProperty("competences");
      expect(outil.schema.properties).not.toHaveProperty("ressourcesAutorisees");
      expect(outil.schema.properties).not.toHaveProperty("contratEvaluation");
      expect(outil.schema.additionalProperties).toBe(false);
    }
  });

  it("déduit la famille du seul outil armé", () => {
    const exploration = validerAppelOutil(
      OUTIL_EXPLORATION_ADAPTATIVE,
      CONTENU_EXPLORATION,
      [outilGenerationActivite("explorer")],
    );
    const projet = validerAppelOutil(OUTIL_MINI_PROJET_ADAPTATIF, CONTENU_PROJET, [
      outilGenerationActivite("produire"),
    ]);
    expect(exploration).toMatchObject({ genre: "contenu-activite", contenu: { famille: "explorer" } });
    expect(projet).toMatchObject({ genre: "contenu-activite", contenu: { famille: "produire" } });
  });

  it("rejette toute propriété surnuméraire au lieu de l'ignorer", () => {
    expect(
      validerAppelOutil(OUTIL_EXPLORATION_ADAPTATIVE, {
        ...CONTENU_EXPLORATION,
        competences: ["INVENTEE-1"],
      }),
    ).toBeNull();
  });

  it("ferme les identifiants de critères par l'enum serveur", () => {
    const outil = outilEvaluationProjet(PRODUCTION.contratEvaluation);
    const ids = outil.schema.properties?.criteres?.items?.properties?.critere_id?.enum;
    expect(ids).toEqual(["transfert", "justification"]);
    expect(outil.schema.properties).not.toHaveProperty("qualite_observation");
    expect(outil.schema.properties).not.toHaveProperty("autonomie");
    expect(outil.schema.properties).not.toHaveProperty("niveau_competence");
    expect(outil.schema.properties).not.toHaveProperty("score_global");
  });

  it("exige chaque critère exactement une fois", () => {
    const outil = outilEvaluationProjet(PRODUCTION.contratEvaluation);
    expect(validerAppelOutil(OUTIL_EVALUATION_PROJET, EVALUATION, [outil])).toMatchObject({
      genre: "evaluation-projet",
      evaluation: { criteres: [{ critereId: "transfert" }, { critereId: "justification" }] },
    });
    expect(
      validerAppelOutil(
        OUTIL_EVALUATION_PROJET,
        { ...EVALUATION, criteres: [EVALUATION.criteres[0], EVALUATION.criteres[0]] },
        [outil],
      ),
    ).toBeNull();
    expect(
      validerAppelOutil(
        OUTIL_EVALUATION_PROJET,
        {
          ...EVALUATION,
          criteres: [
            EVALUATION.criteres[0],
            { ...EVALUATION.criteres[1], critere_id: "code-invente" },
          ],
        },
        [outil],
      ),
    ).toBeNull();
  });
});

describe("génération adaptative one-shot", () => {
  it("porte le contrat serveur sans donner son arbitrage au tuteur", () => {
    const prompt = construirePromptGenerationActivite(PRODUCTION);
    expect(prompt).toContain("TU N'ENREGISTRES RIEN");
    expect(prompt).toContain("LOG-10");
    expect(prompt).toContain("Justifier chaque hypothèse");
    expect(prompt).toContain("ne choisis ni la famille");
  });

  it("arme un seul outil de la famille fixée et retient un contenu validé", async () => {
    const resultat = await genererContenuActivite(
      moteurQuiAppelle(OUTIL_EXPLORATION_ADAPTATIVE, CONTENU_EXPLORATION),
      EXPLORATION,
    );
    expect(resultat.erreur).toBeNull();
    expect(resultat.proposition).toMatchObject({ famille: "explorer", titre: "Voir la saturation" });
  });

  it("refuse un contrat incohérent avant tout appel du modèle", async () => {
    let appele = false;
    const moteur = {
      async repondre() {
        appele = true;
      },
    } as unknown as MoteurTuteur;
    const incoherent = { ...EXPLORATION, modeObservation: "soumission-finale" as const };
    expect(erreursContratGenerationActivite(incoherent)).toContain("contrat d'exploration incohérent");
    const resultat = await genererContenuActivite(moteur, incoherent);
    expect(appele).toBe(false);
    expect(resultat.proposition).toBeNull();
  });
});
