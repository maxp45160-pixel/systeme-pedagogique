import { describe, expect, it } from "vitest";
import type { MoteurTuteur } from "./moteurs";
import {
  construirePromptExplication,
  evaluerExplication,
} from "./explication";
import {
  OUTIL_EVALUATION_EXPLICATION,
  outilEvaluationExplication,
  validerAppelOutil,
} from "./outils";

const EXEMPLE_EVALUATION = {
  resultat: "reussi",
  score_comprehension: 0.85,
  score_justification: 0.75,
  points_cles: [
    "Définit clairement la loi de Little",
    "Explique la relation entre débit, temps de séjour et stock",
  ],
  points_manquants: ["Pourrait préciser l'hypothèse de stationnarité"],
  feedback_formatif: "Très bonne explication avec une intuition concrète.",
  conseil_suivant: "Tu peux passer à un premier exercice guidé.",
};

function moteurQuiRepond(reponseOutil: Record<string, unknown>): MoteurTuteur {
  return {
    nom: "mock",
    modele: "mock-model",
    repondre: async ({ outils, envoyer }) => {
      envoyer("outils-actifs", { actifs: true });
      const proposition = validerAppelOutil(
        OUTIL_EVALUATION_EXPLICATION,
        reponseOutil,
        outils,
      );
      if (proposition) {
        envoyer("proposition", proposition);
      } else {
        envoyer("proposition-rejetee", { nom: OUTIL_EVALUATION_EXPLICATION });
      }
    },
  };
}

describe("Évaluation d'auto-explication", () => {
  it("construit un prompt contenant la compétence et le domaine", () => {
    const prompt = construirePromptExplication(
      { code: "LOG-01", intitule: "Calculer un coût de stockage", palier: "fondamentaux" },
      { nom: "Logistique", description: "Gestion des stocks et flux" },
    );
    expect(prompt).toContain("LOG-01");
    expect(prompt).toContain("Calculer un coût de stockage");
    expect(prompt).toContain("Logistique");
    expect(prompt).toContain("proposer_evaluation_explication");
  });

  it("valide un appel d'outil conforme", () => {
    const outil = outilEvaluationExplication();
    const resultat = validerAppelOutil(
      OUTIL_EVALUATION_EXPLICATION,
      EXEMPLE_EVALUATION,
      [outil],
    );
    expect(resultat).toEqual({
      genre: "evaluation-explication",
      evaluation: {
        resultat: "reussi",
        scoreComprehension: 0.85,
        scoreJustification: 0.75,
        pointsCles: [
          "Définit clairement la loi de Little",
          "Explique la relation entre débit, temps de séjour et stock",
        ],
        pointsManquants: ["Pourrait préciser l'hypothèse de stationnarité"],
        feedbackFormatif: "Très bonne explication avec une intuition concrète.",
        conseilSuivant: "Tu peux passer à un premier exercice guidé.",
      },
    });
  });

  it("rejette une évaluation avec des clés manquantes ou invalides", () => {
    const outil = outilEvaluationExplication();
    expect(
      validerAppelOutil(
        OUTIL_EVALUATION_EXPLICATION,
        { resultat: "inconnu", score_comprehension: 1.5 },
        [outil],
      ),
    ).toBeNull();
  });

  it("exécute evaluerExplication avec succès via un moteur simulé", async () => {
    const moteur = moteurQuiRepond(EXEMPLE_EVALUATION);
    const resultat = await evaluerExplication(
      moteur,
      { code: "LOG-01", intitule: "Calculer un coût de stockage", palier: "fondamentaux" },
      "Le coût de stockage représente les frais engagés pour conserver un produit...",
      { nom: "Logistique", description: "Gestion des flux" },
    );

    expect(resultat.erreur).toBeNull();
    expect(resultat.evaluation?.resultat).toBe("reussi");
    expect(resultat.evaluation?.scoreComprehension).toBe(0.85);
  });
});
