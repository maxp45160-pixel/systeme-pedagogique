import { describe, expect, it } from "vitest";
import { extrairePropositions, extrairePropositionsExercice } from "./proposition";

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

/*
 * Le parseur d'exercices ferme la boucle de contenu (ADR-004). Il est la
 * symétrie du précédent, avec une difficulté en plus : l'énoncé et la
 * correction s'étendent sur plusieurs lignes.
 */

const EXERCICE = `Voici un exercice adapté à ton niveau.

PROPOSITION D'EXERCICE
Titre : Stock de sécurité avec délai fournisseur variable
Domaine : logistique
Type : calcul
Difficulté : 3
Compétences : LOG-09, STAT-02
Durée estimée : 35 min
Énoncé :
Un fournisseur livre en 5 jours en moyenne, avec un écart-type de 1,5 jour.
La demande quotidienne suit une loi normale de moyenne 40 et d'écart-type 8.

Calcule le stock de sécurité pour un taux de service de 95 %.
Indice : commence par identifier les deux sources d'incertitude.
Indice : la formule combinée fait intervenir L×σ_D² et D²×σ_L².
Correction :
σ_combiné = √(L×σ_D² + D²×σ_L²) = √(5×64 + 1600×2,25) = 62,6
SS = 1,65 × 62,6 ≈ 104 unités.
Critère : application — Applique la formule combinée sans confondre les termes
Critère : justification — Explique pourquoi les variances s'additionnent

Dis-moi si tu veux le commencer.`;

describe("extrairePropositionsExercice", () => {
  it("extrait un exercice complet", () => {
    const [ex] = extrairePropositionsExercice(EXERCICE);
    expect(ex.titre).toBe("Stock de sécurité avec délai fournisseur variable");
    expect(ex.domaine).toBe("logistique");
    expect(ex.type).toBe("calcul");
    expect(ex.difficulte).toBe("3");
    expect(ex.competences).toEqual(["LOG-09", "STAT-02"]);
    expect(ex.dureeEstimeeMin).toBe("35");
  });

  it("conserve les énoncés et corrections sur plusieurs lignes", () => {
    const [ex] = extrairePropositionsExercice(EXERCICE);
    expect(ex.enonce).toContain("Un fournisseur livre en 5 jours");
    expect(ex.enonce).toContain("Calcule le stock de sécurité");
    // La ligne vide interne de l'énoncé doit survivre au découpage.
    expect(ex.enonce).toContain("\n\n");
    expect(ex.correction).toContain("σ_combiné");
    expect(ex.correction).toContain("SS = 1,65");
    // L'énoncé s'arrête à l'étiquette suivante, il n'avale pas les indices.
    expect(ex.enonce).not.toContain("commence par identifier");
  });

  it("collecte les champs répétables", () => {
    const [ex] = extrairePropositionsExercice(EXERCICE);
    expect(ex.indices).toHaveLength(2);
    expect(ex.indices[0]).toBe("commence par identifier les deux sources d'incertitude.");
    expect(ex.criteres).toEqual([
      {
        dimension: "application",
        libelle: "Applique la formule combinée sans confondre les termes",
      },
      { dimension: "justification", libelle: "Explique pourquoi les variances s'additionnent" },
    ]);
  });

  it("normalise les codes de compétence et extrait la durée en nombre", () => {
    const [ex] = extrairePropositionsExercice(`PROPOSITION D'EXERCICE
Titre : T
Compétences :  log-01 ,stat-02
Durée estimée : environ 20 minutes
Énoncé : E`);
    expect(ex.competences).toEqual(["LOG-01", "STAT-02"]);
    expect(ex.dureeEstimeeMin).toBe("20");
  });

  it("n'avale pas la prose qui suit le bloc", () => {
    // Le fixture se termine par « Dis-moi si tu veux le commencer. » sans
    // séparateur : un champ mono-ligne doit se refermer sur sa propre ligne.
    const [ex] = extrairePropositionsExercice(EXERCICE);
    expect(ex.criteres.at(-1)?.libelle).toBe("Explique pourquoi les variances s'additionnent");
    expect(ex.indices.at(-1)).not.toContain("Dis-moi");
  });

  it("s'arrête à un séparateur markdown", () => {
    const [ex] = extrairePropositionsExercice(`PROPOSITION D'EXERCICE
Titre : T
Énoncé : Calcule la moyenne.
---
Ce texte est un commentaire du tuteur, pas une partie de l'énoncé.`);
    expect(ex.enonce).toBe("Calcule la moyenne.");
  });

  it("ignore une proposition inexploitable", () => {
    // Sans titre ni énoncé, le formulaire ne serait pré-rempli de rien.
    expect(extrairePropositionsExercice(`PROPOSITION D'EXERCICE\nDomaine : logistique`)).toEqual([]);
    expect(extrairePropositionsExercice("Voici un exercice : calcule la moyenne.")).toEqual([]);
    expect(extrairePropositionsExercice("")).toEqual([]);
  });

  it("extrait deux exercices d'un même message", () => {
    const deux = `${EXERCICE}

PROPOSITION D'EXERCICE
Titre : Loi de Poisson sur un comptage de défauts
Énoncé : Un poste produit en moyenne 3 défauts par heure.`;
    const props = extrairePropositionsExercice(deux);
    expect(props).toHaveLength(2);
    expect(props[1].titre).toBe("Loi de Poisson sur un comptage de défauts");
  });

  it("n'est pas déclenché par une proposition de preuve", () => {
    expect(extrairePropositionsExercice(UN_BLOC)).toEqual([]);
    expect(extrairePropositions(EXERCICE)).toEqual([]);
  });
});

/*
 * Régression du 31/07/2026 — étiquettes en gras.
 *
 * Le gabarit demande `Titre : …`. mistral-large-2512 écrit systématiquement
 * `**Titre** : …`, parfois `**Titre :**`, et met certaines valeurs en
 * italique. La correspondance littérale échouait sur TOUS les champs : la
 * proposition perdait son titre, se faisait rejeter par le filtre, et aucun
 * bouton n'apparaissait dans le chat. C'est la panne qui a tenu le premier
 * maillon de la boucle fermé — `exercises` est resté à 0 ligne.
 *
 * Les deux blocs ci-dessous sont des réponses réelles du modèle, capturées
 * sur `/api/tutor` le 31/07/2026.
 */

const EXERCICE_EN_GRAS = `**PROPOSITION D'EXERCICE**
**Titre** : Filtrer et transformer une liste de commandes clients
**Domaine** : developpement
**Type** : application
**Difficulté** : 2
**Compétences** : DEV-03, DEV-02
**Durée estimée** : 15 minutes
**Énoncé** :
On te donne une liste de commandes clients en Python.

\`\`\`python
commandes = [{"id": 1, "montant": 120, "statut": "validé"}]
\`\`\`

**Indice** : Commence par écrire la condition de filtrage.
**Correction** :
\`\`\`python
valides = [c for c in commandes if c["statut"] == "validé"]
\`\`\`
**Critère** : *application* — Tu as appliqué \`filter\` pour résoudre un problème concret.
**Critère** : *comprehension* — Tu as expliqué le résultat attendu avant de coder.`;

describe("étiquettes en gras (régression mistral-large)", () => {
  it("extrait un exercice dont les étiquettes sont en gras", () => {
    const [ex] = extrairePropositionsExercice(EXERCICE_EN_GRAS);
    expect(ex).toBeDefined();
    expect(ex.titre).toBe("Filtrer et transformer une liste de commandes clients");
    expect(ex.domaine).toBe("developpement");
    expect(ex.type).toBe("application");
    expect(ex.difficulte).toBe("2");
    expect(ex.competences).toEqual(["DEV-03", "DEV-02"]);
    expect(ex.dureeEstimeeMin).toBe("15");
    expect(ex.enonce).toContain("liste de commandes clients");
    expect(ex.indices).toHaveLength(1);
    expect(ex.correction).toContain("statut");
  });

  it("nettoie l'emphase des dimensions de critère", () => {
    const [ex] = extrairePropositionsExercice(EXERCICE_EN_GRAS);
    expect(ex.criteres.map((c) => c.dimension)).toEqual(["application", "comprehension"]);
    expect(ex.criteres[0].libelle).toContain("problème concret");
  });

  it("accepte la variante où le deux-points est dans le gras", () => {
    const [ex] = extrairePropositionsExercice(
      `PROPOSITION D'EXERCICE\n**Titre :** Lire un type union\n**Énoncé :** Que vaut AUTONOMIE["A2"] ?`,
    );
    expect(ex.titre).toBe("Lire un type union");
    expect(ex.enonce).toBe('Que vaut AUTONOMIE["A2"] ?');
  });

  it("retire l'italique autour d'un titre", () => {
    const [ex] = extrairePropositionsExercice(
      `PROPOSITION D'EXERCICE\nTitre : *Détecter un piège de typage*\nÉnoncé : Lis cet extrait.`,
    );
    expect(ex.titre).toBe("Détecter un piège de typage");
  });

  it("numérote les indices sans casser leur étiquette", () => {
    const [ex] = extrairePropositionsExercice(
      `PROPOSITION D'EXERCICE\nTitre : T\nÉnoncé : E\n**Indice 1** : regarde le type\n**Indice 2** : compare les branches`,
    );
    expect(ex.indices).toEqual(["regarde le type", "compare les branches"]);
  });

  it("extrait une proposition de preuve dont les étiquettes sont en gras", () => {
    const props = extrairePropositions(
      `**PROPOSITION DE MISE À JOUR**\n**Compétence** : DEV-03\n**Niveau actuel** : 1\n**Niveau proposé** : 2\n**Preuve** : a filtré puis transformé une liste sans aide\n**Autonomie observée** : A3\n**Qualité de la preuve** : forte\n**Réserve** : un seul contexte testé`,
    );
    expect(props).toHaveLength(1);
    expect(props[0].competence).toBe("DEV-03");
    expect(props[0].niveauPropose).toBe("2");
    expect(props[0].preuve).toBe("a filtré puis transformé une liste sans aide");
  });

  it("ne prend pas pour un champ une ligne de prose ou de code", () => {
    const [ex] = extrairePropositionsExercice(
      `PROPOSITION D'EXERCICE\nTitre : T\nÉnoncé : E\n\`\`\`json\n{"id": 1, "statut": "ok"}\n\`\`\``,
    );
    expect(ex.titre).toBe("T");
    // Rien d'autre n'a été capturé comme champ connu.
    expect(ex.correction).toBe("");
  });
});

describe("valeur rejetée à la ligne suivante", () => {
  const BLOC = `PROPOSITION D'EXERCICE
**Titre** : T
**Énoncé** :
Lis cet extrait.
**Indice** :
Regarde le type de retour.
**Indice** :
Compare les deux branches.
**Correction** :
Le type est \`string | undefined\`.
**Critère** :
*comprehension* — Tu as nommé le type exact.

Dis-moi si tu veux commencer.`;

  it("récupère les indices écrits sous leur étiquette", () => {
    const [ex] = extrairePropositionsExercice(BLOC);
    expect(ex.indices).toEqual(["Regarde le type de retour.", "Compare les deux branches."]);
  });

  it("récupère le critère et sa dimension", () => {
    const [ex] = extrairePropositionsExercice(BLOC);
    expect(ex.criteres).toEqual([
      { dimension: "comprehension", libelle: "Tu as nommé le type exact." },
    ]);
  });

  it("n'avale pas la prose qui suit le bloc", () => {
    const [ex] = extrairePropositionsExercice(BLOC);
    expect(JSON.stringify(ex)).not.toContain("Dis-moi si tu veux");
    expect(ex.enonce).toBe("Lis cet extrait.");
    expect(ex.correction).toContain("string | undefined");
  });
});
