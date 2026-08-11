import { describe, expect, it } from "vitest";
import {
  exerciceComplet,
  extrairePropositionsReferentiel,
} from "./proposition";

const EXERCICE_COMPLET = {
  titre: "Stock de sécurité",
  enonce: "Calcule le stock de sécurité.",
  correction: "Appliquer la formule combinée.",
  competences: ["LOG-09"],
  criteres: [{ libelle: "Applique la formule correctement" }],
};

describe("exerciceComplet", () => {
  it("accepte une proposition entièrement renseignée", () => {
    expect(exerciceComplet(EXERCICE_COMPLET)).toBe(true);
  });

  it("refuse toute donnée indispensable absente", () => {
    expect(exerciceComplet({ ...EXERCICE_COMPLET, correction: "" })).toBe(false);
    expect(exerciceComplet({ ...EXERCICE_COMPLET, competences: [] })).toBe(false);
    expect(exerciceComplet({ ...EXERCICE_COMPLET, criteres: [{ libelle: " " }] })).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* Proposition de référentiel — ADR-026                                */
/*                                                                     */
/* Troisième gabarit. Il porte une contrainte que les deux autres      */
/* n'ont pas : le tuteur n'y écrit AUCUN code de compétence. Un code   */
/* est la clé étrangère des preuves — le laisser inventer par un       */
/* modèle ouvrirait la porte aux collisions silencieuses.              */
/* ------------------------------------------------------------------ */

const BRANCHE = `Je vois. Voici une première branche.

PROPOSITION DE RÉFÉRENTIEL
Domaine : Philosophie morale
Préfixe : PHI
Description : Analyser et construire des arguments éthiques.
Compétence : fondamentaux | 1 | Reconstruire un argument moral sous forme canonique (prémisses, conclusion)
Compétence : intermediaire | 0.8 | Distinguer un dilemme moral d'un conflit de valeurs sur un cas réel
Compétence : avance | 0.7 | Confronter deux cadres normatifs sur un même cas et justifier son arbitrage
Justification : Tu as dit vouloir travailler l'éthique appliquée, sans formation préalable.

---

Dis-moi si ça correspond.`;

describe("extrairePropositionsReferentiel", () => {
  it("extrait le domaine et toutes ses compétences", () => {
    const [p] = extrairePropositionsReferentiel(BRANCHE);
    expect(p.domaine).toBe("Philosophie morale");
    expect(p.prefixe).toBe("PHI");
    expect(p.description).toBe("Analyser et construire des arguments éthiques.");
    expect(p.competences).toHaveLength(3);
    expect(p.justification).toContain("éthique appliquée");
  });

  it("découpe palier, importance et intitulé", () => {
    const [p] = extrairePropositionsReferentiel(BRANCHE);
    expect(p.competences[0]).toEqual({
      palier: "fondamentaux",
      importance: "1",
      intitule: "Reconstruire un argument moral sous forme canonique (prémisses, conclusion)",
    });
    expect(p.competences[2].palier).toBe("avance");
    expect(p.competences[2].importance).toBe("0.7");
  });

  it("n'avale pas la prose qui suit le séparateur", () => {
    const [p] = extrairePropositionsReferentiel(BRANCHE);
    expect(p.justification).not.toContain("Dis-moi");
    expect(p.competences.every((c) => !c.intitule.includes("Dis-moi"))).toBe(true);
  });

  it("ne lit aucun code de compétence — le gabarit n'en contient pas", () => {
    // Garantie structurelle : l'objet produit n'a pas de champ `code`. Si le
    // tuteur en écrit un dans l'intitulé, il reste du texte, sans effet.
    const [p] = extrairePropositionsReferentiel(BRANCHE);
    expect(Object.keys(p.competences[0])).toEqual(["palier", "importance", "intitule"]);
  });

  it("ne confond pas « Compétences » de l'exercice avec « Compétence » du référentiel", () => {
    // Les étiquettes sont ancrées : `Compétences :` ne doit pas alimenter le
    // gabarit de référentiel, sans quoi une proposition d'exercice placée dans
    // le même message polluerait la branche.
    const melange = `${BRANCHE}\n\nPROPOSITION D'EXERCICE\nCompétences : LOG-01`;
    const [p] = extrairePropositionsReferentiel(melange);
    expect(p.competences).toHaveLength(3);
  });

  it("rejette une branche sans compétence — il n'y aurait rien à valider", () => {
    expect(
      extrairePropositionsReferentiel(
        "PROPOSITION DE RÉFÉRENTIEL\nDomaine : Droit\nPréfixe : DRO\nDescription : x",
      ),
    ).toEqual([]);
  });

  it("ne produit rien sur un message ordinaire", () => {
    expect(extrairePropositionsReferentiel("Parlons de ton objectif d'abord.")).toEqual([]);
  });

  it("garde l'intitulé entier même s'il contient une barre verticale", () => {
    const [p] = extrairePropositionsReferentiel(
      "PROPOSITION DE RÉFÉRENTIEL\nDomaine : Shell\nPréfixe : SH\n" +
        "Compétence : fondamentaux | 0.9 | Chaîner deux commandes avec | et prédire le flux",
    );
    expect(p.competences[0].intitule).toBe("Chaîner deux commandes avec | et prédire le flux");
  });

  it("tolère un gabarit incomplet plutôt que de perdre la compétence", () => {
    const [p] = extrairePropositionsReferentiel(
      "PROPOSITION DE RÉFÉRENTIEL\nDomaine : Droit\nCompétence : Qualifier juridiquement des faits",
    );
    expect(p.competences[0].intitule).toBe("Qualifier juridiquement des faits");
    expect(p.competences[0].palier).toBe("");
  });
});

describe("proposition de référentiel — étiquettes en gras (même régression)", () => {
  const EN_GRAS = `**PROPOSITION DE RÉFÉRENTIEL**
**Domaine** : Philosophie morale
**Préfixe :** PHI
**Description** : Analyser et construire des arguments éthiques.
**Compétence** : *fondamentaux* | 1 | Reconstruire un argument moral sous forme canonique
**Compétence** : *intermediaire* | 0,8 | Distinguer un dilemme d'un conflit de valeurs
**Justification** : Tu veux travailler l'éthique appliquée.`;

  it("extrait la branche malgré le gras et l'italique", () => {
    const [p] = extrairePropositionsReferentiel(EN_GRAS);
    expect(p.domaine).toBe("Philosophie morale");
    expect(p.prefixe).toBe("PHI");
    expect(p.competences).toHaveLength(2);
    expect(p.competences[0].palier).toBe("fondamentaux");
    // La virgule décimale est normalisée plus loin, par `normaliserImportance`.
    expect(p.competences[1].importance).toBe("0,8");
  });
});
