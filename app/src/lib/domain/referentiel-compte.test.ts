import { describe, expect, it } from "vitest";
import {
  assemblerReferentiel,
  attribuerCodes,
  comparerCodes,
  construireCompetences,
  construireDomaine,
  libelleDomaine,
  modeRetrait,
  modeRetraitDomaine,
  retraitsParCode,
  normaliserImportance,
  normaliserPalier,
  normaliserPrefixe,
  prefixeParDefaut,
  prochainCode,
  slugifier,
  validerCompetence,
  validerDomaine,
  REFERENTIEL_VIDE,
} from "./referentiel-compte";
import {
  DOMAINES_TEST,
  REFERENTIEL_TEST,
  domaineDeTest,
  referentielDe,
  skillDeTest,
} from "./referentiel.fixture";

/*
 * ADR-026 — le référentiel est une donnée par compte, produite par le tuteur et
 * validée par l'utilisateur. Ce module en porte toute la partie mécanique.
 * Ces tests protègent les garanties qui ne peuvent PAS être laissées au modèle :
 * l'unicité des préfixes, l'attribution des codes, et la règle de retrait.
 */

describe("slugifier / préfixes", () => {
  it("produit un identifiant stable, sans accent ni ponctuation", () => {
    expect(slugifier("Philosophie morale")).toBe("philosophie-morale");
    expect(slugifier("Recherche opérationnelle & optimisation")).toBe(
      "recherche-operationnelle-optimisation",
    );
    expect(slugifier("  Droit   public  ")).toBe("droit-public");
  });

  it("dérive un préfixe utilisable quand le tuteur n'en propose pas", () => {
    expect(prefixeParDefaut("Philosophie morale")).toBe("PHI");
    expect(prefixeParDefaut("Droit")).toBe("DRO");
    // Deux lettres suffisent : « IA » est un préfixe valide, pas un cas à
    // compléter. Une seule est complétée plutôt que rejetée.
    expect(normaliserPrefixe("", "IA")).toBe("IA");
    expect(prefixeParDefaut("R")).toBe("RX");
  });

  it("normalise un préfixe fautif au lieu de le rejeter", () => {
    expect(normaliserPrefixe("phi", "Philosophie")).toBe("PHI");
    expect(normaliserPrefixe("P-H-I", "Philosophie")).toBe("PHI");
    expect(normaliserPrefixe("**PHI**", "Philosophie")).toBe("PHI");
    // Illisible : repli sur le nom du domaine, jamais sur une chaîne vide.
    expect(normaliserPrefixe("123", "Philosophie morale")).toBe("PHI");
  });

  it("normalise palier et importance vers des valeurs du domaine", () => {
    expect(normaliserPalier("Intermédiaire")).toBe("intermediaire");
    expect(normaliserPalier("AVANCE")).toBe("avance");
    // Valeur inconnue : le palier le plus bas, pas une erreur.
    expect(normaliserPalier("expert")).toBe("fondamentaux");

    expect(normaliserImportance("0,8")).toBe(0.8);
    expect(normaliserImportance("2")).toBe(1);
    expect(normaliserImportance("-1")).toBe(0);
    // Illisible : 0.5, jamais 0 — une importance nulle retirerait la compétence
    // du calcul de recommandation sans que personne ne l'ait décidé.
    expect(normaliserImportance("beaucoup")).toBe(0.5);
  });
});

describe("ordre numérique des codes", () => {
  it("range LOG-09 avant LOG-10, et non l'inverse", () => {
    const codes = ["LOG-10", "LOG-02", "LOG-09", "LOG-01", "LOG-12"];
    expect([...codes].sort(comparerCodes)).toEqual([
      "LOG-01",
      "LOG-02",
      "LOG-09",
      "LOG-10",
      "LOG-12",
    ]);
  });

  it("tient au passage à trois chiffres, là où le remplissage ne suffit plus", () => {
    // `attribuerCodes` passe à trois chiffres au-delà de 99 : « LOG-100 » et
    // « LOG-99 » n'ont plus la même longueur, et la comparaison textuelle
    // rangeait le premier avant le second.
    expect([...["LOG-100", "LOG-99", "LOG-09"]].sort(comparerCodes)).toEqual([
      "LOG-09",
      "LOG-99",
      "LOG-100",
    ]);
  });

  it("groupe par préfixe avant de comparer les numéros", () => {
    expect([...["STAT-01", "LOG-02", "LOG-01", "DEV-03"]].sort(comparerCodes)).toEqual([
      "DEV-03",
      "LOG-01",
      "LOG-02",
      "STAT-01",
    ]);
  });

  it("retombe sur l'ordre textuel pour un code qu'il ne sait pas lire", () => {
    // Pas de rang fabriqué pour une forme inattendue : on ne prétend pas
    // connaître un numéro qu'on n'a pas su extraire (P2).
    expect([...["LOG-1a", "LOG-01", "ancien"]].sort(comparerCodes)).toEqual([
      "ancien",
      "LOG-01",
      "LOG-1a",
    ]);
  });
});

describe("attribution des codes — jamais laissée au tuteur", () => {
  it("reprend après le plus grand numéro attribué", () => {
    expect(prochainCode("PHI", [])).toBe("PHI-01");
    expect(prochainCode("PHI", ["PHI-01", "PHI-02"])).toBe("PHI-03");
    expect(prochainCode("DEV", ["DEV-01", "PHI-09"])).toBe("DEV-02");
  });

  it("ne réutilise jamais un numéro laissé libre par une suppression", () => {
    // Réattribuer « PHI-02 » ferait pointer les preuves de l'ancienne
    // compétence sur la nouvelle : l'historique deviendrait faux en silence.
    expect(prochainCode("PHI", ["PHI-01", "PHI-03"])).toBe("PHI-04");
  });

  it("attribue plusieurs codes d'affilée sans collision", () => {
    expect(attribuerCodes("PHI", ["PHI-01"], 3)).toEqual(["PHI-02", "PHI-03", "PHI-04"]);
    expect(attribuerCodes("PHI", [], 2)).toEqual(["PHI-01", "PHI-02"]);
  });

  it("passe à trois chiffres au-delà de 99 sans casser le tri par préfixe", () => {
    expect(prochainCode("PHI", ["PHI-99"])).toBe("PHI-100");
  });
});

describe("validation d'un domaine", () => {
  const referentiel = REFERENTIEL_TEST;

  it("accepte une branche neuve", () => {
    expect(
      validerDomaine({ nom: "Philosophie morale", prefixe: "PHI", description: "…" }, referentiel),
    ).toEqual([]);
  });

  it("refuse un préfixe déjà pris — il engendre les codes", () => {
    const erreurs = validerDomaine(
      { nom: "Développement web", prefixe: "DEV", description: "" },
      referentiel,
    );
    expect(erreurs.join(" ")).toContain("déjà pris");
  });

  it("refuse un domaine qui porte un nom déjà affiché, même sous un autre identifiant", () => {
    // Les identifiants du référentiel migré ne dérivent pas de leur nom
    // (« developpement » pour « Développement logiciel ») : comparer les seuls
    // slugs laisserait passer deux domaines indiscernables à l'écran.
    const erreurs = validerDomaine(
      { nom: "développement logiciel", prefixe: "DVL", description: "" },
      referentiel,
    );
    expect(erreurs.join(" ")).toContain("existe déjà");
  });

  it("refuse aussi une collision d'identifiant", () => {
    const r = referentielDe([], [domaineDeTest("philosophie-morale", "Éthique", "ETH", 0)]);
    const erreurs = validerDomaine(
      { nom: "Philosophie morale", prefixe: "PHI", description: "" },
      r,
    );
    expect(erreurs.join(" ")).toContain("existe déjà");
  });

  it("refuse un préfixe qui n'est pas 2 à 5 lettres majuscules", () => {
    for (const prefixe of ["P", "PHILOSO", "PH1"]) {
      expect(
        validerDomaine({ nom: "Autre", prefixe, description: "" }, referentiel).join(" "),
      ).toContain("2 à 5 lettres");
    }
  });

  it("ne se heurte pas à lui-même lors d'une modification", () => {
    expect(
      validerDomaine(
        { nom: "Développement logiciel", prefixe: "DEV", description: "autre texte" },
        referentiel,
        "developpement",
      ),
    ).toEqual([]);
  });
});

describe("validation d'une compétence", () => {
  const referentiel = REFERENTIEL_TEST;

  it("accepte un savoir-faire correctement formé", () => {
    expect(
      validerCompetence(
        { intitule: "Reconstruire un argument sous forme canonique", palier: "fondamentaux", importance: 0.8 },
        referentiel,
        "developpement",
      ),
    ).toEqual([]);
  });

  it("refuse un intitulé trop court pour décrire un savoir-faire", () => {
    const erreurs = validerCompetence(
      { intitule: "Logique", palier: "fondamentaux", importance: 0.5 },
      referentiel,
      "developpement",
    );
    expect(erreurs.join(" ")).toContain("savoir-faire observable");
  });

  it("refuse un doublon d'intitulé dans le même domaine", () => {
    const erreurs = validerCompetence(
      { intitule: "Intitulé de DEV-01", palier: "avance", importance: 0.5 },
      referentiel,
      "developpement",
    );
    expect(erreurs.join(" ")).toContain("DEV-01");
  });

  it("tolère le même intitulé dans un autre domaine", () => {
    expect(
      validerCompetence(
        { intitule: "Intitulé de DEV-01", palier: "avance", importance: 0.5 },
        referentiel,
        "statistiques",
      ),
    ).toEqual([]);
  });

  it("refuse un prérequis inexistant, et l'auto-prérequis", () => {
    expect(
      validerCompetence(
        { intitule: "Un savoir-faire correct", palier: "avance", importance: 0.5, prerequis: ["ZZZ-01"] },
        referentiel,
        "developpement",
      ).join(" "),
    ).toContain("Prérequis inconnu");

    expect(
      validerCompetence(
        { intitule: "Un savoir-faire correct", palier: "avance", importance: 0.5, prerequis: ["DEV-01"] },
        referentiel,
        "developpement",
        "DEV-01",
      ).join(" "),
    ).toContain("son propre prérequis");
  });

  it("refuse une importance hors de [0, 1]", () => {
    expect(
      validerCompetence(
        { intitule: "Un savoir-faire correct", palier: "avance", importance: 1.5 },
        referentiel,
        "developpement",
      ).join(" "),
    ).toContain("entre 0 et 1");
  });
});

describe("retrait — ADR-027, une preuve n'est jamais orpheline", () => {
  it("supprime franchement une compétence sans preuve", () => {
    expect(modeRetrait(0)).toBe("suppression");
  });

  it("archive dès la première preuve — jamais un choix offert", () => {
    // P4 et anti-hallucination §6 : une faiblesse ne disparaît pas. Le mode est
    // DÉRIVÉ du nombre de preuves, pas arbitré par l'utilisateur.
    expect(modeRetrait(1)).toBe("archivage");
    expect(modeRetrait(26)).toBe("archivage");
  });

  it("un domaine ne s'efface que si aucune de ses compétences ne porte de preuve", () => {
    const vide = new Map<string, number>();
    expect(modeRetraitDomaine("developpement", REFERENTIEL_TEST, vide)).toBe("suppression");

    const avecPreuve = new Map([["DEV-03", 2]]);
    expect(modeRetraitDomaine("developpement", REFERENTIEL_TEST, avecPreuve)).toBe("archivage");
    // Une preuve dans un autre domaine ne bloque pas celui-ci.
    expect(modeRetraitDomaine("statistiques", REFERENTIEL_TEST, avecPreuve)).toBe("suppression");
  });

  /*
   * `retraitsParCode` remplace la lecture serveur `chargerRetraits`, qui
   * refaisait `lireReferentiel` et un `SELECT *` sur les preuves alors que la
   * page venait de charger les deux. Devenue pure, elle se teste sans base —
   * et c'est cette table qui fonde l'annonce faite AVANT le clic.
   */
  it("dérive le geste et le compte pour chaque compétence, y compris à zéro", () => {
    const skills = REFERENTIEL_TEST.skills.slice(0, 3);
    const preuves = [
      { skillCode: skills[0].code },
      { skillCode: skills[0].code },
      { skillCode: skills[1].code },
    ];
    const table = retraitsParCode(skills, preuves);

    expect(table.get(skills[0].code)).toEqual({ preuves: 2, mode: "archivage" });
    expect(table.get(skills[1].code)).toEqual({ preuves: 1, mode: "archivage" });
    // Une compétence sans preuve figure quand même : son absence de la table
    // se lirait comme « pas d'information », alors que c'est « aucune preuve ».
    expect(table.get(skills[2].code)).toEqual({ preuves: 0, mode: "suppression" });
    expect(table.size).toBe(3);
  });

  it("ignore une preuve dont le code n'est pas dans la liste fournie", () => {
    const skills = REFERENTIEL_TEST.skills.slice(0, 1);
    const table = retraitsParCode(skills, [{ skillCode: "CODE-ABSENT" }]);
    expect(table.size).toBe(1);
    expect(table.get(skills[0].code)?.preuves).toBe(0);
  });
});

describe("assemblage", () => {
  it("trie par palier, puis rang déclaré, puis code", () => {
    const r = referentielDe([
      skillDeTest("DEV-09", "developpement", "avance", 1, 0),
      skillDeTest("DEV-02", "developpement", "fondamentaux", 1, 5),
      skillDeTest("DEV-01", "developpement", "fondamentaux", 1, 1),
      skillDeTest("DEV-05", "developpement", "intermediaire", 1, 0),
    ]);
    expect(r.skills.map((s) => s.code)).toEqual(["DEV-01", "DEV-02", "DEV-05", "DEV-09"]);
  });

  it("un référentiel vide n'est pas un cas dégradé", () => {
    expect(REFERENTIEL_VIDE.skills).toEqual([]);
    expect(REFERENTIEL_VIDE.actifs).toEqual([]);
    expect(REFERENTIEL_VIDE.codesActifs.size).toBe(0);
    expect(assemblerReferentiel([], []).domaines).toEqual([]);
  });

  it("le libellé d'un domaine retombe sur son identifiant, jamais sur une invention", () => {
    expect(libelleDomaine(REFERENTIEL_TEST, "developpement")).toBe("Développement logiciel");
    expect(libelleDomaine(REFERENTIEL_TEST, "philosophie")).toBe("philosophie");
  });
});

describe("construction depuis une proposition", () => {
  it("attribue les codes depuis le préfixe, sans jamais lire ceux du tuteur", () => {
    const domaine = construireDomaine(
      { nom: "Philosophie morale", prefixe: "PHI", description: "  Éthique appliquée.  " },
      "tuteur",
      2,
    );
    expect(domaine.id).toBe("philosophie-morale");
    expect(domaine.description).toBe("Éthique appliquée.");
    expect(domaine.origine).toBe("tuteur");

    const skills = construireCompetences(
      [
        { intitule: "Reconstruire un argument sous forme canonique", palier: "fondamentaux", importance: 0.9 },
        { intitule: "Distinguer un dilemme moral d'un conflit de valeurs", palier: "intermediaire", importance: 0.8 },
      ],
      domaine,
      REFERENTIEL_TEST,
      "tuteur",
    );

    expect(skills.map((s) => s.code)).toEqual(["PHI-01", "PHI-02"]);
    expect(skills.every((s) => s.domaine === "philosophie-morale")).toBe(true);
    expect(skills.every((s) => s.active && !s.archive)).toBe(true);
    expect(skills.map((s) => s.ordre)).toEqual([0, 1]);
  });

  it("poursuit la numérotation d'un domaine existant plutôt que de la reprendre à 1", () => {
    const domaine = domaineDeTest("developpement", "Développement logiciel", "DEV", 0);
    const skills = construireCompetences(
      [{ intitule: "Un nouveau savoir-faire mesurable", palier: "avance", importance: 0.7 }],
      domaine,
      REFERENTIEL_TEST,
      "tuteur",
    );
    expect(skills[0].code).toBe("DEV-07");
    expect(skills[0].ordre).toBe(6);
  });

  it("les domaines de la fixture restent intacts après construction", () => {
    // `construireCompetences` ne doit rien muter : le référentiel passé sert de
    // source de vérité pour les codes déjà pris, pas de brouillon.
    expect(DOMAINES_TEST.map((d) => d.id)).toEqual(["developpement", "statistiques"]);
    expect(REFERENTIEL_TEST.parCode.has("PHI-01")).toBe(false);
  });
});
