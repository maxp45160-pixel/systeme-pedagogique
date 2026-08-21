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
  FEEDBACK_MAX,
  JUSTIFICATION_MAX,
  RETRAVAILLER_ITEMS_MAX,
  RETRAVAILLER_MAX,
  OUTIL_CORRECTION,
  OUTIL_EXERCICE,
  OUTIL_REFERENTIEL,
  OUTIL_INTENTION,
  outilCorrection,
  outilIntention,
  outilsTuteur,
  validerAppelOutil,
  validerAppelOutilJson,
  outilReferentielComplet,
  BRANCHES_MAX_COMPTE_ETABLI,
  OUTIL_REFERENTIEL_COMPLET,
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
    { palier: "fondamentaux", importance: 0.8, verbeAction: "structurer", objet: "un argument moral" },
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
    // L'entrée porte trois champs, la sortie porte la phrase : c'est
    // l'APPLICATION qui assemble l'intitulé, jamais le tuteur (ADR-086).
    expect(recu.branche.competences).toEqual([
      { palier: "fondamentaux", importance: "0.8", intitule: "Structurer un argument moral" },
    ]);
  });

  it("lit des arguments JSON complets", () => {
    const recu = validerAppelOutilJson(OUTIL_EXERCICE, JSON.stringify(EXERCICE_ENTIER));
    expect(recu?.genre).toBe("exercice");
  });

  it("accepte une intention et la normalise", () => {
    const recu = validerAppelOutil(OUTIL_EXERCICE, { ...EXERCICE_ENTIER, intention: "Décision" });
    if (recu?.genre !== "exercice") throw new Error("genre inattendu");
    // "Décision" n'existe pas dans la liste : `dansEnum` rend "" — absente,
    // pas fabriquée. C'est `convertirProposition`, en aval, qui refuserait
    // une valeur non vide mais hors liste.
    expect(recu.exercice.intention).toBe("");
  });

  it("accepte une intention connue, insensible à la casse", () => {
    const recu = validerAppelOutil(OUTIL_EXERCICE, { ...EXERCICE_ENTIER, intention: "Transfert" });
    if (recu?.genre !== "exercice") throw new Error("genre inattendu");
    expect(recu.exercice.intention).toBe("transfert");
  });

  it("accepte un exercice sans intention — champ optionnel", () => {
    const recu = validerAppelOutil(OUTIL_EXERCICE, EXERCICE_ENTIER);
    if (recu?.genre !== "exercice") throw new Error("genre inattendu");
    expect(recu.exercice.intention).toBe("");
  });
});

/* ------------------------------------------------------------------ */
/* Les schémas eux-mêmes                                               */
/* ------------------------------------------------------------------ */

describe("outilReferentielComplet — le plafond de domaines (ADR-088)", () => {
  it("plafonne les branches quand le compte a déjà des domaines", () => {
    // Le plafond vit dans le SCHÉMA, pas dans la consigne : `maxItems` ne se
    // contourne pas. Mesuré le 18/08/2026 : un seul sujet avait produit cinq
    // domaines et 40 compétences, aucune mesurée.
    const outil = outilReferentielComplet(REFERENTIEL);
    expect(outil.schema.properties?.branches.maxItems).toBe(BRANCHES_MAX_COMPTE_ETABLI);
    expect(outil.description).toContain("rattache les compétences à un domaine existant");
  });

  it("ne plafonne pas l'amorçage d'un compte vide", () => {
    // Un compte neuf n'a rien à surcharger, et poser la structure d'un coup
    // est le geste normal (protocole §6).
    const outil = outilReferentielComplet({ ...REFERENTIEL, domaines: [] });
    expect(outil.schema.properties?.branches.maxItems).toBeUndefined();
  });

  it("renforce la structure pour une vue d'ensemble débutante", () => {
    const outil = outilReferentielComplet(
      { ...REFERENTIEL, domaines: [] },
      "Je veux apprendre la physique, je suis un gros noob",
    );
    expect(outil.schema.properties?.branches.minItems).toBe(2);
    expect(outil.schema.properties?.branches.items?.properties?.competences?.minItems).toBe(3);
  });

  it("écarte les branches au-delà du plafond au lieu de les accepter", () => {
    const outil = outilReferentielComplet(REFERENTIEL);
    const branche = (domaine: string) => ({
      domaine,
      prefixe: "XXX",
      description: "d",
      competences: [
        { palier: "fondamentaux", importance: 0.5, verbeAction: "analyser", objet: "un flux" },
      ],
      justification: "j",
    });
    const recu = validerAppelOutil(
      OUTIL_REFERENTIEL_COMPLET,
      { resume: "r", branches: [branche("A"), branche("B"), branche("C"), branche("D")] },
      [outil],
    );
    if (recu?.genre !== "referentiel-complet") throw new Error("genre inattendu");
    expect(recu.branches).toHaveLength(BRANCHES_MAX_COMPTE_ETABLI);
    // Annoncé, jamais tu (ADR-036).
    expect(recu.ecartees).toBe(2);
  });
});

describe("outilsTuteur", () => {
  it("n'expose AUCUN champ de code de compétence dans le schéma de branche", () => {
    // Garde-fou d'ADR-026 rendu structurel : un code écrit par le tuteur
    // entrerait en collision, et les observations suivraient la mauvaise compétence.
    const branche = outilsTuteur(REFERENTIEL).find((o) => o.nom === OUTIL_REFERENTIEL);
    const competence = branche?.schema.properties?.competences.items?.properties ?? {};
    // ADR-086 : l'intitulé n'est plus une phrase libre mais trois champs,
    // dont un `enum` fermé de verbes. Aucun champ de code, comme avant.
    expect(Object.keys(competence).sort()).toEqual([
      "importance",
      "objet",
      "palier",
      "precision",
      "verbeAction",
    ]);
    expect(JSON.stringify(branche?.schema)).not.toContain('"code"');
  });

  it("ignore un code écrit malgré tout dans une compétence proposée", () => {
    const recu = validerAppelOutil(OUTIL_REFERENTIEL, {
      ...BRANCHE_ENTIERE,
      competences: [
        { palier: "avance", importance: 0.5, verbeAction: "argumenter", objet: "une critique", code: "PHI-99" },
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

  it("n'expose pas d'outil hors chat — outilsTuteur ne rend qu'exercice et référentiel", () => {
    const noms = outilsTuteur(REFERENTIEL).map((o) => o.nom);
    expect(noms).toEqual([OUTIL_EXERCICE, OUTIL_REFERENTIEL]);
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

const BILAN_ENTIER = {
  points_forts: "La formule est appliquée jusqu'au bout.",
  points_bloquants: "Le niveau de service est choisi sans motif : le résultat n'est pas défendable.",
  a_retravailler: ["Justifier un seuil avant de l'employer"],
};

const CORRECTION_ENTIERE = {
  resultat: "partiel",
  appreciations: [
    { critere: 1, valeur: "1", justification: "La formule est appliquée sur √2." },
    { critere: 2, valeur: "0.5", justification: "Le 95 % est posé sans être justifié." },
  ],
  bilan: BILAN_ENTIER,
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
      bilan: BILAN_ENTIER,
    });
    expect(recu?.genre).toBe("correction");
  });

  /* ---------------------------------------------------------------- */
  /* Le bilan rédigé (ADR-046)                                         */
  /* ---------------------------------------------------------------- */

  it("rejette un verdict sans bilan — sinon le tuteur retombe sur la grille de cases", () => {
    // C'est tout l'objet du lot : un verdict qui n'explique rien redeviendrait
    // le remplissage de formulaire que ce chantier lui retire.
    expect(validerAppelOutil(OUTIL_CORRECTION, sans(CORRECTION_ENTIERE, "bilan"))).toBeNull();
  });

  it("rejette un bilan amputé d'un de ses trois champs", () => {
    for (const cle of ["points_forts", "points_bloquants", "a_retravailler"] as const) {
      const recu = validerAppelOutil(OUTIL_CORRECTION, {
        ...CORRECTION_ENTIERE,
        bilan: sans(BILAN_ENTIER, cle),
      });
      expect(recu, cle).toBeNull();
    }
  });

  it("rejette un bilan qui dépasse son plafond", () => {
    /*
     * Plus large que `JUSTIFICATION_MAX` parce qu'il ne porte AUCUNE mesure —
     * mais borné quand même : ce texte est persisté, et une partie repart dans
     * le contexte du chat.
     */
    expect(
      validerAppelOutil(OUTIL_CORRECTION, {
        ...CORRECTION_ENTIERE,
        bilan: { ...BILAN_ENTIER, points_bloquants: "x".repeat(FEEDBACK_MAX + 1) },
      }),
    ).toBeNull();

    expect(
      validerAppelOutil(OUTIL_CORRECTION, {
        ...CORRECTION_ENTIERE,
        bilan: { ...BILAN_ENTIER, a_retravailler: ["x".repeat(RETRAVAILLER_MAX + 1)] },
      }),
    ).toBeNull();
  });

  it("rejette une liste « à retravailler » vide ou trop longue", () => {
    expect(
      validerAppelOutil(OUTIL_CORRECTION, {
        ...CORRECTION_ENTIERE,
        bilan: { ...BILAN_ENTIER, a_retravailler: [] },
      }),
    ).toBeNull();

    expect(
      validerAppelOutil(OUTIL_CORRECTION, {
        ...CORRECTION_ENTIERE,
        bilan: {
          ...BILAN_ENTIER,
          a_retravailler: Array.from({ length: RETRAVAILLER_ITEMS_MAX + 1 }, (_, i) => `point ${i}`),
        },
      }),
    ).toBeNull();
  });

  it("accepte un bilan exactement aux plafonds", () => {
    const recu = validerAppelOutil(OUTIL_CORRECTION, {
      ...CORRECTION_ENTIERE,
      bilan: {
        points_forts: "x".repeat(FEEDBACK_MAX),
        points_bloquants: "y".repeat(FEEDBACK_MAX),
        a_retravailler: Array.from({ length: RETRAVAILLER_ITEMS_MAX }, () => "z".repeat(RETRAVAILLER_MAX)),
      },
    });
    if (recu?.genre !== "correction") throw new Error("genre inattendu");
    expect(recu.correction.bilan.aRetravailler).toHaveLength(RETRAVAILLER_ITEMS_MAX);
  });

  it("l'outil de correction reste hors du chat, bilan ou pas", () => {
    /*
     * Le verrou le plus fragile d'ADR-041, revérifié maintenant que la sortie
     * de ce chemin est plus large : si `outilCorrection` entrait dans
     * `outilsTuteur`, il voyagerait avec chaque message et l'exception à
     * ADR-036 cesserait d'en être une.
     */
    const noms = outilsTuteur(REFERENTIEL).map((o) => o.nom);
    expect(noms).not.toContain(OUTIL_CORRECTION);
  });

  it("rejette une appréciation sans justification — un verdict sans motif ne se relit pas", () => {
    const recu = validerAppelOutil(OUTIL_CORRECTION, {
      resultat: "reussi",
      appreciations: [{ critere: 1, valeur: "1", justification: "  " }],
      bilan: BILAN_ENTIER,
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
      bilan: BILAN_ENTIER,
    });
    if (recu?.genre !== "correction") throw new Error("genre inattendu");
    expect(recu.correction.appreciations[0].valeur).toBe("0.5");

    const virgule = validerAppelOutil(OUTIL_CORRECTION, {
      resultat: "partiel",
      appreciations: [{ critere: 1, valeur: "0,5", justification: "Partiellement." }],
      bilan: BILAN_ENTIER,
    });
    expect(virgule?.genre).toBe("correction");
  });
});


/* ------------------------------------------------------------------ */
/* traduire_intention — le point d'entrée le plus emprunté             */
/* ------------------------------------------------------------------ */

/**
 * Ce que ces cas protègent : `traduire_intention` est armé sur le chemin que
 * tout le monde prend. Un validateur permissif y ferait entrer un code inventé
 * dans une URL de composition, donc une génération sur une compétence qui
 * n'existe pas. Le premier cas est celui-là.
 */
describe("validerAppelOutil — traduire_intention", () => {
  const outils = [outilIntention(["LOG-01", "LOG-02"])];
  const valider = (entree: unknown) => validerAppelOutil(OUTIL_INTENTION, entree, outils);

  const TRAVAIL = {
    genre: "travail",
    titre: "Deux exercices sur le stock de sécurité",
    pourquoi: "La compétence n'a aucune observation récente.",
    codes: ["LOG-01"],
    sujet: "",
  };

  it("écarte un code absent du schéma armé", () => {
    const recu = valider({
      action: { ...TRAVAIL, codes: ["LOG-01", "LOG-99"] },
      alternatives: [],
    });
    if (recu?.genre !== "intention") throw new Error("genre inattendu");
    expect(recu.traduction.action.codes).toEqual(["LOG-01"]);
  });

  it("rejette un travail dont tous les codes sont inventés", () => {
    expect(valider({ action: { ...TRAVAIL, codes: ["LOG-99"] }, alternatives: [] })).toBeNull();
  });

  it("rejette un genre hors de l'énumération", () => {
    expect(valider({ action: { ...TRAVAIL, genre: "poème" }, alternatives: [] })).toBeNull();
  });

  it("accepte une traduction complète", () => {
    const recu = valider({
      action: TRAVAIL,
      alternatives: [
        { genre: "note", titre: "Déposer l'énoncé", pourquoi: "Pour le relire.", codes: [], sujet: "" },
      ],
    });
    if (recu?.genre !== "intention") throw new Error("genre inattendu");
    expect(recu.traduction.action.genre).toBe("travail");
    expect(recu.traduction.alternatives).toHaveLength(1);
  });

  it("n'énumère aucun code quand le compte est neuf", () => {
    const neuf = outilIntention([]);
    expect(neuf.schema.properties?.action?.properties?.codes?.items?.enum).toBeUndefined();
  });
});
