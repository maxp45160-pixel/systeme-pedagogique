import { describe, expect, it } from "vitest";

import type { Skill } from "@/lib/domain/types";
import {
  MAX_RELATIONS_PROPOSEES,
  OUTIL_RELATIONS,
  outilsRelations,
  validerAppelOutil,
} from "./outils";
import type { MoteurTuteur } from "./moteurs";
import { construirePromptRelations, proposerRelations } from "./relations-referentiel";

const OUTILS = [outilsRelations(["LOG-02", "MAT-01"], ["logistique", "maths"])];

function valider(entree: unknown) {
  const recue = validerAppelOutil(OUTIL_RELATIONS, entree, OUTILS);
  return recue?.genre === "relations" ? recue.relations : null;
}

const RELATION = {
  intitule: "Calculer une moyenne pondérée sur un jeu de données",
  palier: "fondamentaux",
  domaineId: "maths",
  justification: "Le calcul du coût moyen de possession en dépend.",
};

/** La même relation, privée d'un champ — ce qu'un fournisseur bavard omet. */
function sans(champ: keyof typeof RELATION): Record<string, unknown> {
  const copie: Record<string, unknown> = { ...RELATION };
  delete copie[champ];
  return copie;
}

describe("outilsRelations — ce que le schéma laisse exprimer", () => {
  it("ferme l'enum des codes sur les compétences du compte", () => {
    const relation = OUTILS[0].schema.properties?.prerequis?.items;
    expect(relation?.properties?.codeExistant?.enum).toEqual(["LOG-02", "MAT-01"]);
  });

  it("ferme l'enum des domaines sur les domaines existants", () => {
    const relation = OUTILS[0].schema.properties?.prerequis?.items;
    expect(relation?.properties?.domaineId?.enum).toEqual(["logistique", "maths"]);
  });

  it("n'offre aucun champ pour frapper un code neuf", () => {
    const relation = OUTILS[0].schema.properties?.prerequis?.items;
    /* ADR-026/031 : la frappe d'un identifiant neuf doit rester inexprimable. */
    expect(Object.keys(relation?.properties ?? {})).not.toContain("code");
  });

  it("borne les deux listes", () => {
    expect(OUTILS[0].schema.properties?.prerequis?.maxItems).toBe(MAX_RELATIONS_PROPOSEES);
    expect(OUTILS[0].schema.properties?.suivantes?.maxItems).toBe(MAX_RELATIONS_PROPOSEES);
  });

  it("exige les deux listes, pas seulement le résumé", () => {
    /*
     * L'outil est seul armé donc l'appel est forcé : un modèle qui ne rend que
     * les champs obligatoires renvoyait `resume` seul, et la validation
     * rejetait tout. Les deux listes doivent être exigées, quitte à être vides.
     */
    expect(OUTILS[0].schema.required).toEqual(["resume", "prerequis", "suivantes"]);
  });
});

describe("validation des relations proposées", () => {
  it("retient une proposition complète", () => {
    const relations = valider({ resume: "Une progression.", prerequis: [RELATION] });
    expect(relations?.prerequis[0]).toEqual({
      codeExistant: null,
      intitule: RELATION.intitule,
      palier: "fondamentaux",
      domaineId: "maths",
      justification: RELATION.justification,
    });
  });

  it("garde le code désigné quand il est dans l'enum", () => {
    const relations = valider({
      resume: "",
      prerequis: [{ ...RELATION, codeExistant: "MAT-01" }],
    });
    expect(relations?.prerequis[0].codeExistant).toBe("MAT-01");
  });

  it("ignore un code hors enum sans perdre la ligne", () => {
    /*
     * L'intitulé reste exploitable : l'écriture retrouvera l'homonyme s'il
     * existe. Perdre la ligne entière ferait disparaître une relation juste
     * pour une désignation fausse.
     */
    const relations = valider({
      resume: "",
      prerequis: [{ ...RELATION, codeExistant: "AUTRE-99" }],
    });
    expect(relations?.prerequis).toHaveLength(1);
    expect(relations?.prerequis[0].codeExistant).toBeNull();
  });

  it("ramène un domaine inconnu à null plutôt que de placer au hasard", () => {
    const relations = valider({
      resume: "",
      prerequis: [{ ...RELATION, domaineId: "physique" }],
    });
    /* `null` fait afficher « demanderait un nouveau domaine » : rien n'est créé. */
    expect(relations?.prerequis[0].domaineId).toBeNull();
  });

  it("ramène un domaine absent à null", () => {
    const relations = valider({ resume: "", suivantes: [sans("domaineId")] });
    expect(relations?.suivantes[0].domaineId).toBeNull();
  });

  it("écarte une ligne sans intitulé ou sans justification", () => {
    const lignes = [sans("intitule"), sans("justification"), RELATION];
    expect(valider({ resume: "", prerequis: lignes })?.prerequis).toHaveLength(1);
  });

  it("tronque au-delà de la borne, même si le fournisseur ignore maxItems", () => {
    const trop = Array.from({ length: MAX_RELATIONS_PROPOSEES + 3 }, (_, index) => ({
      ...RELATION,
      intitule: `${RELATION.intitule} numéro ${index}`,
    }));
    expect(valider({ resume: "", prerequis: trop })?.prerequis).toHaveLength(MAX_RELATIONS_PROPOSEES);
  });

  it("accepte deux listes vides : c'est une réponse, pas une panne", () => {
    /*
     * Une compétence peut n'avoir aucune relation à proposer. Rejeter renvoyait
     * « proposition arrivée incomplète », qui accuse le fournisseur à tort.
     */
    const relations = valider({ resume: "Rien à relier ici.", prerequis: [], suivantes: [] });
    expect(relations).toEqual({ resume: "Rien à relier ici.", prerequis: [], suivantes: [] });
  });

  it("rejette un appel où aucune des deux listes n'est un tableau", () => {
    /* Là, l'appel ne porte aucune des deux réponses que le schéma exige. */
    expect(valider({ resume: "Rien à dire." })).toBeNull();
  });
});

describe("construirePromptRelations", () => {
  const skill: Skill = {
    code: "LOG-01",
    domaine: "logistique",
    intitule: "Modéliser un problème de gestion de stock",
    palier: "intermediaire",
    prerequis: ["MAT-01"],
    importance: 1,
    ordre: 1,
    active: true,
    archive: false,
    origine: "utilisateur",
  };
  const autre: Skill = { ...skill, code: "LOG-02", intitule: "Optimiser un flux", prerequis: [] };

  const prompt = construirePromptRelations({
    skill,
    domaineNom: "Logistique",
    actifs: [skill, autre],
    domaines: [
      { id: "logistique", nom: "Logistique" },
      { id: "maths", nom: "Mathématiques" },
    ],
    suivantes: ["LOG-02"],
  });

  it("liste les domaines par identifiant et par nom", () => {
    expect(prompt).toContain("- maths — Mathématiques");
  });

  it("n'inclut pas la compétence lue dans les compétences désignables", () => {
    /*
     * Elle ne peut être son propre prérequis : la proposer serait proposer un
     * cycle. Elle n'apparaît donc qu'une fois, sous « LA COMPÉTENCE LUE » —
     * d'où le compte plutôt qu'une absence.
     */
    expect(prompt.split("- LOG-01 — ")).toHaveLength(2);
    expect(prompt).toContain("- LOG-02 — Optimiser un flux (palier");
  });

  it("rappelle les relations déjà déclarées", () => {
    expect(prompt).toContain("- prérequis : MAT-01");
    expect(prompt).toContain("- suite : LOG-02");
  });

  it("interdit d'inventer un domaine et de ranger par défaut", () => {
    expect(prompt).toContain("N'invente pas de domaine");
    expect(prompt).toContain("ne range pas par défaut dans le domaine de la compétence lue");
  });
});

describe("proposerRelations — aucune panne ne se déguise en silence", () => {
  const skill: Skill = {
    code: "LOG-01",
    domaine: "logistique",
    intitule: "Modéliser un problème de gestion de stock",
    palier: "intermediaire",
    prerequis: [],
    importance: 1,
    ordre: 1,
    active: true,
    archive: false,
    origine: "utilisateur",
  };

  /**
   * Un moteur qui rejoue une suite d'événements, et rien d'autre.
   *
   * `MoteurTuteur.repondre` « ne lève jamais » : une panne est un événement.
   * C'est précisément ce contrat qui rendait le diagnostic muet quand on ne
   * lisait que les propositions.
   */
  function moteurQuiEmet(evenements: Array<[string, unknown]>): MoteurTuteur {
    return {
      nom: "faux",
      modele: "faux-modele",
      async repondre({ envoyer }) {
        for (const [evenement, donnees] of evenements) envoyer(evenement, donnees);
      },
    };
  }

  const entree = {
    skill,
    domaineNom: "Logistique",
    actifs: [skill],
    domaines: [{ id: "logistique", nom: "Logistique" }],
    suivantes: [],
  };

  it("remonte l'erreur du fournisseur plutôt qu'un silence du tuteur", async () => {
    const resultat = await proposerRelations(
      moteurQuiEmet([["erreur", { message: "Clé refusée par le fournisseur." }]]),
      entree,
    );
    expect(resultat.erreur).toBe("Clé refusée par le fournisseur.");
  });

  it("remonte un JSON tronqué", async () => {
    const resultat = await proposerRelations(
      moteurQuiEmet([["tronque", { message: "Réponse interrompue par la limite de longueur." }]]),
      entree,
    );
    expect(resultat.erreur).toContain("limite de longueur");
  });

  it("remonte une proposition rejetée", async () => {
    const resultat = await proposerRelations(
      moteurQuiEmet([["proposition-rejetee", { message: "Une proposition est arrivée incomplète." }]]),
      entree,
    );
    expect(resultat.erreur).toBe("Une proposition est arrivée incomplète.");
  });

  it("dit que le fournisseur n'outille pas quand l'événement fin l'annonce", async () => {
    const resultat = await proposerRelations(
      moteurQuiEmet([["fin", { outils: { actifs: false } }]]),
      entree,
    );
    expect(resultat.outilsActifs).toBe(false);
    expect(resultat.erreur).toContain("n'accepte pas les appels d'outil");
  });

  it("fait passer l'erreur de transport devant le rejet qu'elle explique", async () => {
    const resultat = await proposerRelations(
      moteurQuiEmet([
        ["proposition-rejetee", { message: "Arrivée incomplète." }],
        ["erreur", { message: "Quota atteint chez le fournisseur." }],
      ]),
      entree,
    );
    expect(resultat.erreur).toBe("Quota atteint chez le fournisseur.");
  });

  it("rend la proposition sans erreur quand elle arrive", async () => {
    const relations = { resume: "Une progression.", prerequis: [], suivantes: [] };
    const resultat = await proposerRelations(
      moteurQuiEmet([["proposition", { genre: "relations", relations }]]),
      entree,
    );
    expect(resultat.erreur).toBeNull();
    expect(resultat.relations).toEqual(relations);
  });
});
