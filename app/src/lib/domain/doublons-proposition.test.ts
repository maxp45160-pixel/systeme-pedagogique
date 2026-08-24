import { describe, expect, it } from "vitest";

import {
  competenceVoisine,
  domaineVoisin,
  SEUIL_DOUBLON_COMPETENCE,
  SEUIL_DOUBLON_DOMAINE,
} from "./doublons-proposition";

const DOMAINES = [
  { id: "logistique-industrielle", nom: "Logistique industrielle" },
  { id: "resilience-logistique", nom: "Résilience logistique" },
  { id: "gestion-des-stocks", nom: "Gestion des stocks" },
  { id: "statistiques-descriptives", nom: "Statistiques descriptives" },
  { id: "mathematiques-appliquees", nom: "Mathématiques appliquées" },
  { id: "developpement-logiciel", nom: "Développement logiciel" },
  { id: "gestion-de-production", nom: "Gestion de production" },
  { id: "qualite", nom: "Qualité et amélioration continue" },
  { id: "systemes-d-information", nom: "Systèmes d'information" },
  { id: "management-de-projet", nom: "Management de projet" },
];

const COMPETENCES = [
  { code: "STA-01", intitule: "Décrire un jeu de données industriel avec des statistiques descriptives adaptées" },
  { code: "STA-07", intitule: "Interpréter un z-score dans un contexte de gestion industrielle" },
  { code: "STA-09", intitule: "Interpréter un intervalle de confiance sur une moyenne" },
  { code: "LOG-05", intitule: "Évaluer la résilience d'un réseau logistique face à une rupture" },
  { code: "LOG-27", intitule: "Analyser la structure d'un réseau logistique multi-échelons" },
  { code: "LOG-31", intitule: "Calculer un stock de sécurité" },
];

describe("domaineVoisin", () => {
  /*
   * Le cas réel du 24/08/2026 : la relecture proposait de créer ce
   * sous-domaine alors que « Résilience logistique » existait déjà.
   */
  it("reconnaît une reformulation d'un domaine existant", () => {
    const voisin = domaineVoisin(
      "Résilience et optimisation des réseaux logistiques",
      DOMAINES,
    );
    expect(voisin?.id).toBe("resilience-logistique");
    expect(voisin?.score).toBeGreaterThanOrEqual(SEUIL_DOUBLON_DOMAINE);
  });

  it("reconnaît un nom identique à la casse près", () => {
    expect(domaineVoisin("  gestion DES stocks ", DOMAINES)?.id).toBe("gestion-des-stocks");
  });

  it("reconnaît un nom qui étend un nom existant", () => {
    expect(domaineVoisin("Gestion des stocks et approvisionnements", DOMAINES)?.id).toBe(
      "gestion-des-stocks",
    );
  });

  /*
   * Ce qui doit PASSER. Un mot commun ne fait pas un doublon : sans l'IDF, et
   * sans le candidat dans le corpus, « Gestion » suffirait à confondre ces
   * deux-là.
   */
  it("laisse passer un sujet distinct qui partage un mot", () => {
    expect(domaineVoisin("Pilotage de la production industrielle", DOMAINES)).toBeNull();
    expect(domaineVoisin("Statistiques inférentielles", DOMAINES)).toBeNull();
    expect(domaineVoisin("Ordonnancement d'atelier", DOMAINES)).toBeNull();
  });

  it("ne voit rien dans un référentiel vide", () => {
    expect(domaineVoisin("Résilience logistique", [])).toBeNull();
  });

  it("rend le nom existant, pour qu'un journal puisse le citer", () => {
    expect(domaineVoisin("Résilience et optimisation des réseaux logistiques", DOMAINES)?.texte)
      .toBe("Résilience logistique");
  });
});

describe("competenceVoisine", () => {
  it("reconnaît une reformulation d'un intitulé existant", () => {
    const voisin = competenceVoisine(
      "Décrire un jeu de données industriel à l'aide de statistiques descriptives",
      COMPETENCES,
    );
    expect(voisin?.id).toBe("STA-01");
    expect(voisin?.score).toBeGreaterThanOrEqual(SEUIL_DOUBLON_COMPETENCE);
  });

  /*
   * Le seuil des compétences est plus haut que celui des domaines, et c'est ce
   * cas qui l'exige : deux savoir-faire voisins d'un même domaine partagent
   * beaucoup de vocabulaire sans se confondre.
   */
  it("laisse passer deux savoir-faire voisins mais distincts", () => {
    expect(competenceVoisine("Interpréter un z-score", COMPETENCES)).toBeNull();
    expect(
      competenceVoisine("Calculer un stock de sécurité à partir d'un taux de service", COMPETENCES),
    ).toBeNull();
  });

  it("laisse passer un savoir-faire réellement absent", () => {
    expect(
      competenceVoisine(
        "Appliquer des méthodes de réduction de dimensionnalité pour analyser des jeux de données industriels complexes",
        COMPETENCES,
      ),
    ).toBeNull();
  });
});
