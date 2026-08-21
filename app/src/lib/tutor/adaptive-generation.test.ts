import { describe, expect, it } from "vitest";

import type { MoteurTuteur } from "./moteurs";
import {
  construirePromptGenerationActivite as construirePromptGenerationActiviteBlocs,
  erreursContratGenerationActivite,
  genererContenuActivite,
  type ContratGenerationActivite,
} from "./adaptive-generation";
import { promptComplet } from "./prompt";
import {
  OUTIL_MINI_PROJET_ADAPTATIF,
  outilGenerationActivite,
  validerAppelOutil,
} from "./outils";

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

describe("outil adaptatif fermé", () => {
  it("rend la famille impossible à modifier dans la sortie", () => {
    const outil = outilGenerationActivite();
    expect(outil.schema.properties).not.toHaveProperty("famille");
    expect(outil.schema.properties).not.toHaveProperty("competences");
    expect(outil.schema.properties).not.toHaveProperty("ressourcesAutorisees");
    expect(outil.schema.properties).not.toHaveProperty("contratEvaluation");
    expect(outil.schema.additionalProperties).toBe(false);
  });

  it("valide le contenu du seul outil armé", () => {
    const projet = validerAppelOutil(OUTIL_MINI_PROJET_ADAPTATIF, CONTENU_PROJET, [
      outilGenerationActivite(),
    ]);
    expect(projet).toMatchObject({ genre: "contenu-activite", contenu: { famille: "produire" } });
  });

  it("rejette toute propriété surnuméraire au lieu de l'ignorer", () => {
    expect(
      validerAppelOutil(OUTIL_MINI_PROJET_ADAPTATIF, {
        ...CONTENU_PROJET,
        competences: ["INVENTEE-1"],
      }),
    ).toBeNull();
  });
});

describe("génération adaptative one-shot", () => {
  it("porte le contrat serveur sans donner son arbitrage au tuteur", () => {
    const prompt = promptComplet(construirePromptGenerationActiviteBlocs(PRODUCTION));
    expect(prompt).toContain("TU N'ENREGISTRES RIEN");
    expect(prompt).toContain("LOG-10");
    expect(prompt).toContain("Justifier chaque hypothèse");
    expect(prompt).toContain("ne choisis ni la famille");
  });

  it("arme un seul outil de la famille fixée et retient un contenu validé", async () => {
    const resultat = await genererContenuActivite(
      moteurQuiAppelle(OUTIL_MINI_PROJET_ADAPTATIF, CONTENU_PROJET),
      PRODUCTION,
    );
    expect(resultat.erreur).toBeNull();
    expect(resultat.proposition).toMatchObject({
      famille: "produire",
      titre: "Dimensionner l'accueil d'un atelier",
    });
  });

  it("refuse un contrat incohérent avant tout appel du modèle", async () => {
    let appele = false;
    const moteur = {
      async repondre() {
        appele = true;
      },
    } as unknown as MoteurTuteur;
    // Le contrat vient de l'extérieur : sa cohérence se vérifie au runtime,
    // pas seulement au type.
    const incoherent = {
      ...PRODUCTION,
      modeObservation: "aucune",
    } as unknown as ContratGenerationActivite;
    expect(erreursContratGenerationActivite(incoherent)).toContain(
      "contrat de production incohérent",
    );
    const resultat = await genererContenuActivite(moteur, incoherent);
    expect(appele).toBe(false);
    expect(resultat.proposition).toBeNull();
  });
});
