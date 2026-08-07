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
  JUSTIFICATION_MAX,
  OUTIL_CORRECTION,
  OUTIL_EXERCICE,
  OUTIL_REFERENTIEL,
  outilCorrection,
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

  it("accepte une branche et rend l'importance en chaîne", () => {
    const recu = validerAppelOutil(OUTIL_REFERENTIEL, BRANCHE_ENTIERE);
    if (recu?.genre !== "referentiel") throw new Error("genre inattendu");
    expect(recu.branche.prefixe).toBe("PHI");
    expect(recu.branche.competences).toEqual([
      { palier: "fondamentaux", importance: "0.8", intitule: "Sait reconstruire un argument" },
    ]);
  });

  it("lit des arguments JSON complets", () => {
    const recu = validerAppelOutilJson(OUTIL_EXERCICE, JSON.stringify(EXERCICE_ENTIER));
    expect(recu?.genre).toBe("exercice");
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

  it("n'expose PAS proposer_correction — la correction ne passe pas par le chat", () => {
    /*
     * C'est le premier des six verrous qui bornent l'exception à ADR-036.
     * Le chemin de correction doit voir la correction de l'exercice ; le chat,
     * non. Si cet outil entrait ici, il voyagerait avec chaque message et
     * l'exception cesserait d'en être une.
     */
    const noms = outilsTuteur(REFERENTIEL).map((o) => o.nom);
    expect(noms).not.toContain(OUTIL_CORRECTION);
    expect(noms).toEqual([OUTIL_EXERCICE, OUTIL_REFERENTIEL]);
  });
});

/* ------------------------------------------------------------------ */
/* La correction — l'outil du lot A1                                   */
/* ------------------------------------------------------------------ */

const CRITERES = [
  { dimension: "application", libelle: "Applique la formule au bon horizon" },
  { dimension: "justification", libelle: "Justifie le choix du niveau de service" },
];

const CORRECTION_ENTIERE = {
  resultat: "partiel",
  appreciations: [
    { critere: 1, valeur: "1", justification: "La formule est appliquée sur √2." },
    { critere: 2, valeur: "0.5", justification: "Le 95 % est posé sans être justifié." },
  ],
};

describe("outilCorrection — le schéma", () => {
  it("borne le numéro de critère au nombre réel de critères", () => {
    /*
     * Borner par le schéma plutôt que par une phrase du prompt : « numérote de
     * 1 à 2 » est une consigne qu'on peut manquer, `maximum: 2` est une valeur
     * que le schéma n'admet pas.
     */
    const schema = outilCorrection(CRITERES).schema;
    const critere = schema.properties?.appreciations.items?.properties?.critere;
    expect(critere?.minimum).toBe(1);
    expect(critere?.maximum).toBe(2);
  });

  it("n'énumère que les trois positions de l'échelle", () => {
    const schema = outilCorrection(CRITERES).schema;
    const valeur = schema.properties?.appreciations.items?.properties?.valeur;
    expect(valeur?.enum).toEqual(["0", "0.5", "1"]);
  });

  it("nomme les résultats dans les mêmes termes que le formulaire", () => {
    // `lib/domain/bilan.ts` est la source unique : si l'écran et le prompt
    // divergeaient, rien ne le signalerait — la mesure serait simplement fausse.
    const schema = outilCorrection(CRITERES).schema;
    expect(schema.properties?.resultat.enum).toEqual(["reussi", "partiel", "echec"]);
    expect(schema.properties?.resultat.description).toContain(
      "Méthode correcte, résultat incomplet",
    );
  });

  it("interdit explicitement de recopier la correction", () => {
    const schema = outilCorrection(CRITERES).schema;
    const justification = schema.properties?.appreciations.items?.properties?.justification;
    expect(justification?.description).toContain("Ne recopie pas la correction");
  });
});

describe("validerCorrection — les rejets", () => {
  it("accepte un verdict complet et rend les valeurs en chaînes", () => {
    const recu = validerAppelOutil(OUTIL_CORRECTION, CORRECTION_ENTIERE);
    if (recu?.genre !== "correction") throw new Error("genre inattendu");
    expect(recu.correction.resultat).toBe("partiel");
    expect(recu.correction.appreciations).toEqual([
      { critere: "1", valeur: "1", justification: "La formule est appliquée sur √2." },
      { critere: "2", valeur: "0.5", justification: "Le 95 % est posé sans être justifié." },
    ]);
  });

  it("rejette une appréciation hors de l'échelle plutôt que de la ramener à 0", () => {
    /*
     * Le cœur du module. Un 0 est une MESURE — « non démontré ». Le fabriquer
     * à partir d'une valeur illisible produirait un jugement indiscernable
     * d'un vrai. C'est P2, et c'est le défaut d'ADR-034 transposé.
     */
    const recu = validerAppelOutil(OUTIL_CORRECTION, {
      ...CORRECTION_ENTIERE,
      appreciations: [{ critere: 1, valeur: "0.75", justification: "À moitié." }],
    });
    expect(recu).toBeNull();
  });

  it("rejette un résultat hors des trois valeurs", () => {
    const recu = validerAppelOutil(OUTIL_CORRECTION, {
      ...CORRECTION_ENTIERE,
      resultat: "excellent",
    });
    expect(recu).toBeNull();
  });

  it("rejette une justification qui dépasse le plafond", () => {
    /*
     * Ce n'est pas une règle de style : c'est la borne de confinement de
     * l'exception à ADR-036. Une justification de 2 000 caractères, c'est la
     * correction réécrite, et la borne serait vide.
     */
    const recu = validerAppelOutil(OUTIL_CORRECTION, {
      ...CORRECTION_ENTIERE,
      appreciations: [{ critere: 1, valeur: "1", justification: "x".repeat(JUSTIFICATION_MAX + 1) }],
    });
    expect(recu).toBeNull();
  });

  it("accepte une justification exactement au plafond", () => {
    const recu = validerAppelOutil(OUTIL_CORRECTION, {
      resultat: "reussi",
      appreciations: [{ critere: 1, valeur: "1", justification: "x".repeat(JUSTIFICATION_MAX) }],
    });
    expect(recu?.genre).toBe("correction");
  });

  it("rejette une appréciation sans justification — un verdict sans motif ne se relit pas", () => {
    const recu = validerAppelOutil(OUTIL_CORRECTION, {
      resultat: "reussi",
      appreciations: [{ critere: 1, valeur: "1", justification: "  " }],
    });
    expect(recu).toBeNull();
  });

  it("rejette un verdict sans aucune appréciation", () => {
    const recu = validerAppelOutil(OUTIL_CORRECTION, { resultat: "reussi", appreciations: [] });
    expect(recu).toBeNull();
  });

  it("rejette une correction tronquée par la limite de jetons", () => {
    // Le symptôme le plus courant : le JSON ne parse pas.
    const recu = validerAppelOutilJson(
      OUTIL_CORRECTION,
      '{"resultat":"partiel","appreciations":[{"critere":1,"valeur":"1","justi',
    );
    expect(recu).toBeNull();
  });

  it("lit une valeur numérique et une virgule décimale", () => {
    // Les fournisseurs ne respectent pas tous `type: "string"`, et une locale
    // française produit « 0,5 ». Les deux nomment une position de l'échelle.
    const recu = validerAppelOutil(OUTIL_CORRECTION, {
      resultat: "partiel",
      appreciations: [{ critere: 1, valeur: 0.5, justification: "Partiellement." }],
    });
    if (recu?.genre !== "correction") throw new Error("genre inattendu");
    expect(recu.correction.appreciations[0].valeur).toBe("0.5");

    const virgule = validerAppelOutil(OUTIL_CORRECTION, {
      resultat: "partiel",
      appreciations: [{ critere: 1, valeur: "0,5", justification: "Partiellement." }],
    });
    expect(virgule?.genre).toBe("correction");
  });
});
