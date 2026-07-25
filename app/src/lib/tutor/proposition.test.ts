import { describe, expect, it } from "vitest";
import { extrairePropositions } from "./proposition";

/*
 * Le parseur transforme une proposition texte du tuteur en objet exploitable.
 * Il doit rester tolérant : un message sans proposition ne produit rien, un
 * message qui en contient plusieurs les extrait toutes.
 */

const UN_BLOC = `Bonne progression. Voici mon analyse.

PROPOSITION DE MISE À JOUR
Compétence : STAT-07
Niveau actuel : 0
Niveau proposé : 1
Preuve : a reformulé seul le lien z-score / stock de sécurité
Autonomie observée : A3
Qualité de la preuve : moyenne
Réserve : à confirmer sur un second contexte

Dis-moi si tu veux continuer.`;

describe("extrairePropositions", () => {
  it("extrait un bloc complet", () => {
    const props = extrairePropositions(UN_BLOC);
    expect(props).toHaveLength(1);
    expect(props[0]).toEqual({
      competence: "STAT-07",
      niveauActuel: "0",
      niveauPropose: "1",
      preuve: "a reformulé seul le lien z-score / stock de sécurité",
      autonomieObservee: "A3",
      qualitePreuve: "moyenne",
      reserve: "à confirmer sur un second contexte",
    });
  });

  it("renvoie un tableau vide pour un message sans proposition", () => {
    expect(extrairePropositions("Voici un indice : commence par trier la série.")).toEqual([]);
    expect(extrairePropositions("")).toEqual([]);
  });

  it("extrait deux propositions d'un même message", () => {
    const deux = `${UN_BLOC}

PROPOSITION DE MISE À JOUR
Compétence : LOG-09
Niveau actuel : 0
Niveau proposé : 1
Preuve : calculs corrects sous incertitude combinée
Autonomie observée : A2
Qualité de la preuve : faible
Réserve : compréhension intuitive non confirmée`;
    const props = extrairePropositions(deux);
    expect(props).toHaveLength(2);
    expect(props.map((p) => p.competence)).toEqual(["STAT-07", "LOG-09"]);
  });

  it("tolère un champ manquant sans lever d'erreur", () => {
    const partiel = `PROPOSITION DE MISE À JOUR
Compétence : LOG-02
Preuve : script exécuté seul`;
    const props = extrairePropositions(partiel);
    expect(props).toHaveLength(1);
    expect(props[0].competence).toBe("LOG-02");
    expect(props[0].preuve).toBe("script exécuté seul");
    expect(props[0].niveauPropose).toBe(""); // champ absent → chaîne vide, pas d'erreur
  });
});
