/**
 * Ce que ces tests protègent, et pourquoi (lot 3.2).
 *
 * La bascule en sortie structurée n'a d'intérêt que si elle REJETTE. Un
 * validateur permissif reproduirait le défaut du gabarit markdown — un
 * demi-exercice accepté en silence — en le rendant plus difficile à voir,
 * puisqu'il aurait l'air d'avoir été validé contre un schéma.
 *
 * D'où l'ordre des cas ci-dessous : les rejets d'abord.
 */

import { describe, expect, it } from "vitest";
import {
  OUTIL_EXERCICE,
  OUTIL_PREUVE,
  OUTIL_REFERENTIEL,
  outilsTuteur,
  validerAppelOutil,
  validerAppelOutilJson,
} from "./outils";
import type { Referentiel } from "@/lib/domain/types";

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

const EXERCICE_ENTIER = {
  titre: "Calcul du stock de sécurité",
  domaine: "logistique",
  type: "calcul",
  difficulte: 2,
  competences: ["LOG-10", "LOG-11"],
  duree_estimee_min: 30,
  enonce: "Une référence consomme 120 unités par semaine…",
  indices: ["Commence par l'écart-type de la demande."],
  correction: "z × σ × √L, soit 1,65 × 20 × √2 ≈ 47 unités.",
  criteres: [{ dimension: "application", libelle: "Sait appliquer la formule au bon horizon" }],
};

const PREUVE_ENTIERE = {
  competence: "log-10",
  niveau_actuel: "2",
  niveau_propose: "3",
  preuve: "A dérivé le stock de sécurité sans indice, avec la bonne racine du délai.",
  autonomie_observee: "A3",
  qualite_preuve: "forte",
  reserve: "Un seul contexte testé.",
};

const BRANCHE_ENTIERE = {
  domaine: "Philosophie analytique",
  prefixe: "PHI",
  description: "Reconstruction et évaluation d'arguments.",
  competences: [
    { palier: "fondamentaux", importance: 0.8, intitule: "Sait reconstruire un argument" },
  ],
  justification: "L'utilisateur a dit vouloir travailler ce sujet.",
};

const REFERENTIEL: Referentiel = {
  domaines: [
    { id: "logistique", nom: "Logistique", prefixe: "LOG", description: "" },
    { id: "dormant", nom: "Dormant", prefixe: "DOR", description: "" },
  ],
  skills: [],
  actifs: [{ domaine: "logistique" }],
} as unknown as Referentiel;

/** Le même objet, privé d'un champ — ce que produit une réponse coupée. */
function sans<T extends object>(objet: T, cle: keyof T): Partial<T> {
  const copie = { ...objet };
  delete copie[cle];
  return copie;
}

/* ------------------------------------------------------------------ */
/* Rejets — la raison d'être de la bascule                             */
/* ------------------------------------------------------------------ */

describe("validerAppelOutil — ce qui doit être rejeté", () => {
  it("rejette un exercice sans correction", () => {
    // Le cas exact du gabarit markdown : les champs arrivent dans l'ordre, et
    // la correction est en fin de bloc. Un flux coupé donnait un exercice
    // « affichable » que le formulaire acceptait à moitié.
    expect(validerAppelOutil(OUTIL_EXERCICE, sans(EXERCICE_ENTIER, "correction"))).toBeNull();
  });

  it("rejette un exercice sans aucun critère retenu", () => {
    // Sans critère, l'exercice ne mesure rien : il produirait une tentative
    // dont on ne pourrait dériver aucune dimension.
    expect(validerAppelOutil(OUTIL_EXERCICE, { ...EXERCICE_ENTIER, criteres: [] })).toBeNull();
  });

  it("rejette un exercice dont le seul critère porte une dimension inconnue", () => {
    expect(
      validerAppelOutil(OUTIL_EXERCICE, {
        ...EXERCICE_ENTIER,
        criteres: [{ dimension: "creativite", libelle: "Sait innover" }],
      }),
    ).toBeNull();
  });

  it("rejette un exercice dont le type n'existe pas", () => {
    expect(validerAppelOutil(OUTIL_EXERCICE, { ...EXERCICE_ENTIER, type: "quiz" })).toBeNull();
  });

  it("rejette une preuve sans autonomie observée", () => {
    expect(validerAppelOutil(OUTIL_PREUVE, sans(PREUVE_ENTIERE, "autonomie_observee"))).toBeNull();
  });

  it("rejette une preuve dont l'autonomie n'est pas une valeur du protocole", () => {
    expect(
      validerAppelOutil(OUTIL_PREUVE, { ...PREUVE_ENTIERE, autonomie_observee: "A9" }),
    ).toBeNull();
  });

  it("rejette une branche sans aucune compétence", () => {
    expect(validerAppelOutil(OUTIL_REFERENTIEL, { ...BRANCHE_ENTIERE, competences: [] })).toBeNull();
  });

  it("rejette un nom d'outil inconnu", () => {
    expect(validerAppelOutil("proposer_note", EXERCICE_ENTIER)).toBeNull();
  });

  it("rejette un JSON tronqué par la limite de jetons", () => {
    // Ce qu'un flux coupé produit réellement : des arguments qui ne parsent pas.
    const coupe = JSON.stringify(EXERCICE_ENTIER).slice(0, 120);
    expect(validerAppelOutilJson(OUTIL_EXERCICE, coupe)).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* Acceptations et normalisation                                       */
/* ------------------------------------------------------------------ */

describe("validerAppelOutil — ce qui passe", () => {
  it("accepte un exercice entier et rend les types de proposition attendus", () => {
    const recu = validerAppelOutil(OUTIL_EXERCICE, EXERCICE_ENTIER);
    expect(recu?.genre).toBe("exercice");
    if (recu?.genre !== "exercice") throw new Error("genre inattendu");

    // Les nombres du schéma redeviennent des chaînes : le formulaire de
    // création et les cartes du chat lisent `PropositionExercice`, inchangé.
    expect(recu.exercice.difficulte).toBe("2");
    expect(recu.exercice.dureeEstimeeMin).toBe("30");
    expect(recu.exercice.competences).toEqual(["LOG-10", "LOG-11"]);
    expect(recu.exercice.criteres).toEqual([
      { dimension: "application", libelle: "Sait appliquer la formule au bon horizon" },
    ]);
  });

  it("écarte un critère invalide sans jeter l'exercice quand il en reste un", () => {
    const recu = validerAppelOutil(OUTIL_EXERCICE, {
      ...EXERCICE_ENTIER,
      criteres: [
        { dimension: "creativite", libelle: "Sait innover" },
        { dimension: "transfert", libelle: "Sait transposer à un autre horizon" },
      ],
    });
    if (recu?.genre !== "exercice") throw new Error("genre inattendu");
    expect(recu.exercice.criteres).toHaveLength(1);
    expect(recu.exercice.criteres[0].dimension).toBe("transfert");
  });

  it("met le code de compétence en majuscules sur une preuve", () => {
    const recu = validerAppelOutil(OUTIL_PREUVE, PREUVE_ENTIERE);
    if (recu?.genre !== "preuve") throw new Error("genre inattendu");
    expect(recu.preuve.competence).toBe("LOG-10");
    expect(recu.preuve.autonomieObservee).toBe("A3");
    expect(recu.preuve.qualitePreuve).toBe("forte");
  });

  it("accepte une branche et rend l'importance en chaîne", () => {
    const recu = validerAppelOutil(OUTIL_REFERENTIEL, BRANCHE_ENTIERE);
    if (recu?.genre !== "referentiel") throw new Error("genre inattendu");
    expect(recu.branche.prefixe).toBe("PHI");
    expect(recu.branche.competences).toEqual([
      { palier: "fondamentaux", importance: "0.8", intitule: "Sait reconstruire un argument" },
    ]);
  });

  it("lit des arguments JSON complets", () => {
    const recu = validerAppelOutilJson(OUTIL_PREUVE, JSON.stringify(PREUVE_ENTIERE));
    expect(recu?.genre).toBe("preuve");
  });
});

/* ------------------------------------------------------------------ */
/* Les schémas eux-mêmes                                               */
/* ------------------------------------------------------------------ */

describe("outilsTuteur", () => {
  it("n'expose AUCUN champ de code de compétence dans le schéma de branche", () => {
    // Garde-fou d'ADR-026 rendu structurel : un code écrit par le tuteur
    // entrerait en collision, et les preuves suivraient la mauvaise compétence.
    const branche = outilsTuteur(REFERENTIEL).find((o) => o.nom === OUTIL_REFERENTIEL);
    const competence = branche?.schema.properties?.competences.items?.properties ?? {};
    expect(Object.keys(competence).sort()).toEqual(["importance", "intitule", "palier"]);
    expect(JSON.stringify(branche?.schema)).not.toContain('"code"');
  });

  it("ignore un code écrit malgré tout dans une compétence proposée", () => {
    const recu = validerAppelOutil(OUTIL_REFERENTIEL, {
      ...BRANCHE_ENTIERE,
      competences: [
        { palier: "avance", importance: 0.5, intitule: "Sait critiquer", code: "PHI-99" },
      ],
    });
    if (recu?.genre !== "referentiel") throw new Error("genre inattendu");
    expect(JSON.stringify(recu.branche)).not.toContain("PHI-99");
  });

  it("n'énumère que les domaines du périmètre actif", () => {
    const exercice = outilsTuteur(REFERENTIEL).find((o) => o.nom === OUTIL_EXERCICE);
    expect(exercice?.schema.properties?.domaine.enum).toEqual(["logistique"]);
  });

  it("n'énumère aucun domaine sur un compte neuf, sans produire d'enum vide", () => {
    const vide = { domaines: [], skills: [], actifs: [] } as unknown as Referentiel;
    const exercice = outilsTuteur(vide).find((o) => o.nom === OUTIL_EXERCICE);
    // Un `enum: []` n'admettrait aucune valeur : le modèle ne pourrait plus
    // proposer d'exercice du tout, y compris après création d'une branche.
    expect(exercice?.schema.properties?.domaine.enum).toBeUndefined();
  });
});
