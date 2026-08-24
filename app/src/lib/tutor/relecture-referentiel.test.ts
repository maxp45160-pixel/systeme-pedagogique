import { describe, expect, it } from "vitest";

import {
  MAX_MANQUES_PROPOSES,
  MAX_RELATIONS_PROPOSEES,
  MAX_SCISSIONS_PROPOSEES,
  OUTIL_RELECTURE,
  outilsRelecture,
  validerAppelOutil,
} from "./outils";
import type { MoteurTuteur } from "./moteurs";
import {
  construirePromptRelecture,
  relireReferentiel,
  type EntreeRelecture,
} from "./relecture-referentiel";

/**
 * Ce que fige ce fichier : le tuteur relit le référentiel ENTIER et ne peut
 * désigner que des codes et des domaines que l'application a déjà attribués.
 * Un identifiant inventé est écarté par la seconde couche de validation, pas
 * seulement par l'`enum` du schéma (ADR-031) — c'est le test exigé avant merge
 * d'ADR-108.
 */

const OUTILS = [
  outilsRelecture(["LOG-01", "LOG-02", "STA-01"], ["logistique", "stats"], {
    codesMaitrises: ["LOG-01"],
    intentions: ["moyen"],
  }),
];

function valider(entree: unknown) {
  const recue = validerAppelOutil(OUTIL_RELECTURE, entree, OUTILS);
  return recue?.genre === "relecture" ? recue.relecture : null;
}

const SCISSON = {
  parentId: "logistique",
  nom: "Gestion kanban",
  description: "Les cartes, les flux tirés et les WIP.",
  codes: ["LOG-01", "LOG-02"],
  justification: "Quatre compétences portent toutes sur le pilotage visuel.",
};

const DESIGNEE_EXISTANTE = {
  codeExistant: "LOG-01",
  intitule: "Calculer un stock de sécurité",
  palier: "fondamentaux",
};

const MANQUE = {
  domaineId: "logistique",
  intitule: "Dimensionner un supermarché de pièces",
  palier: "intermediaire",
  ancrage: "Tu as travaillé trois fois sur le pilotage des flux.",
  justification: "C'est le pas suivant après le kanban.",
  sourceProgression: { type: "maitrise", codeExistant: "LOG-01" },
};

describe("outilsRelecture — ce que le schéma laisse exprimer", () => {
  it("ferme l'enum des codes sur les compétences vivantes du compte", () => {
    const scission = OUTILS[0].schema.properties?.scissions?.items;
    expect(scission?.properties?.codes?.items?.enum).toEqual(["LOG-01", "LOG-02", "STA-01"]);
  });

  it("ferme l'enum des domaines sur les domaines vivants", () => {
    const scission = OUTILS[0].schema.properties?.scissions?.items;
    expect(scission?.properties?.parentId?.enum).toEqual(["logistique", "stats"]);
  });

  it("n'offre aucun champ pour frapper un code neuf", () => {
    /*
     * ADR-026/031 : la frappe d'un identifiant neuf doit rester inexprimable,
     * y compris dans une compétence décrite en clair par le genre `relation`.
     */
    const relation = OUTILS[0].schema.properties?.relations?.items;
    expect(Object.keys(relation?.properties?.amont?.properties ?? {})).not.toContain("code");
    expect(Object.keys(relation?.properties?.aval?.properties ?? {})).not.toContain("code");
  });

  it("borne les trois listes aux plafonds de lecture du lot", () => {
    const schema = OUTILS[0].schema.properties;
    expect(schema?.scissions?.maxItems).toBe(MAX_SCISSIONS_PROPOSEES);
    expect(schema?.relations?.maxItems).toBe(MAX_RELATIONS_PROPOSEES);
    expect(schema?.manques?.maxItems).toBe(MAX_MANQUES_PROPOSES);
  });

  it("exige les quatre listes, quitte à être vides", () => {
    expect(OUTILS[0].schema.required).toEqual(["scissions", "relations", "manques", "rattachements"]);
  });
});

describe("validerRelecture — la seconde couche écarte l'inventé (ADR-031)", () => {
  it("retient un lot complet dont tout est connu", () => {
    const lot = valider({
      scissions: [SCISSON],
      relations: [{ amont: DESIGNEE_EXISTANTE, aval: { ...DESIGNEE_EXISTANTE, codeExistant: "STA-01" }, justification: "L'un prépare l'autre." }],
      manques: [MANQUE],
    });
    expect(lot?.scissions).toHaveLength(1);
    expect(lot?.scissions[0].codes).toEqual(["LOG-01", "LOG-02"]);
    expect(lot?.relations).toHaveLength(1);
    expect(lot?.manques).toEqual([MANQUE]);
  });

  it("fait tomber une scission dont le parent est inventé", () => {
    /*
     * Il n'y a nulle part où accrocher le sous-domaine : la ligne entière
     * tombe, pas seulement le champ fautif.
     */
    const lot = valider({
      scissions: [{ ...SCISSON, parentId: "domaine-invente" }, SCISSON],
      relations: [],
      manques: [],
    });
    expect(lot?.scissions).toHaveLength(1);
    expect(lot?.scissions[0].parentId).toBe("logistique");
  });

  it("retire un code inventé d'une scission, et fait tomber la ligne s'il ne reste rien", () => {
    const lot = valider({
      scissions: [
        { ...SCISSON, codes: ["LOG-01", "KANBAN-99"] },
        { ...SCISSON, nom: "Vide", codes: ["INVENTE-01"] },
      ],
      relations: [],
      manques: [],
    });
    expect(lot?.scissions[0].codes).toEqual(["LOG-01"]);
    /* Un sous-domaine vide n'est pas une scission : c'est une branche créée pour classer. */
    expect(lot?.scissions).toHaveLength(1);
  });

  it("ignore un code désigné hors enum sans perdre la relation", () => {
    const lot = valider({
      scissions: [],
      relations: [
        {
          amont: { ...DESIGNEE_EXISTANTE, codeExistant: "FAUX-99" },
          aval: { codeExistant: "STA-01", intitule: "Lire un tableau", palier: "fondamentaux" },
          justification: "L'un prépare l'autre.",
          sourceProgression: { type: "maitrise", codeExistant: "LOG-01" },
        },
      ],
      manques: [],
    });
    /* Le champ est ignoré, pas la ligne : l'intitulé reste exploitable à l'écriture. */
    expect(lot?.relations[0].amont.codeExistant).toBeUndefined();
    expect(lot?.relations[0].amont.intitule).toBeTruthy();
    expect(lot?.relations[0].aval.codeExistant).toBe("STA-01");
  });

  it("fait tomber une relation dont AUCUN côté n'existe au référentiel", () => {
    /*
     * Créer les deux exigerait un domaine où les placer, que ce schéma ne porte
     * pas. Mieux vaut ne pas proposer qu'une ligne au bouton « accepter » vide.
     */
    const lot = valider({
      scissions: [],
      relations: [
        {
          amont: { intitule: "Inconnue un", palier: "fondamentaux" },
          aval: { intitule: "Inconnue deux", palier: "fondamentaux" },
          justification: "…",
        },
      ],
      manques: [],
    });
    expect(lot?.relations).toHaveLength(0);
  });

  it("fait tomber une compétence qui se préparerait elle-même", () => {
    const lot = valider({
      scissions: [],
      relations: [
        {
          amont: DESIGNEE_EXISTANTE,
          aval: { ...DESIGNEE_EXISTANTE, intitule: "Autre formulation" },
          justification: "…",
        },
      ],
      manques: [],
    });
    expect(lot?.relations).toHaveLength(0);
  });

  it("fait tomber un manque placé dans un domaine inventé", () => {
    /*
     * Placer au hasard une compétence qui n'existe pas encore ferait grossir un
     * domaine que personne n'a désigné.
     */
    const lot = valider({
      scissions: [],
      relations: [],
      manques: [{ ...MANQUE, domaineId: "physique-inventee" }, MANQUE],
    });
    expect(lot?.manques).toHaveLength(1);
    expect(lot?.manques[0].domaineId).toBe("logistique");
  });

  it("fait tomber un manque sans ancrage : sans lui, c'est un programme, pas une proposition", () => {
    const lot = valider({
      scissions: [],
      relations: [],
      manques: [{ ...MANQUE, ancrage: "" }, { ...MANQUE, intitule: "Autre savoir-faire" }],
    });
    expect(lot?.manques).toHaveLength(1);
  });

  it("tronque chaque liste au plafond même si le fournisseur ignore maxItems", () => {
    const lot = valider({
      scissions: Array.from({ length: MAX_SCISSIONS_PROPOSEES + 2 }, (_, i) => ({
        ...SCISSON,
        nom: `Scission ${i}`,
      })),
      relations: Array.from({ length: MAX_RELATIONS_PROPOSEES + 2 }, (_, i) => ({
        amont: DESIGNEE_EXISTANTE,
        aval: { ...DESIGNEE_EXISTANTE, codeExistant: "STA-01" },
        justification: `motif ${i}`,
      })),
      manques: Array.from({ length: MAX_MANQUES_PROPOSES + 2 }, (_, i) => ({
        ...MANQUE,
        intitule: `Manque ${i}`,
      })),
    });
    expect(lot?.scissions).toHaveLength(MAX_SCISSIONS_PROPOSEES);
    expect(lot?.relations).toHaveLength(MAX_RELATIONS_PROPOSEES);
    expect(lot?.manques).toHaveLength(MAX_MANQUES_PROPOSES);
  });

  /*
   * Le rattachement ne crée rien : il désigne un existant de chaque côté. Les
   * DEUX identifiants doivent donc être dans leur `enum`, et une ligne dont
   * l'un manque tombe entière — il n'y a rien à récupérer, à la différence
   * d'une relation où l'intitulé reste exploitable.
   */
  it("retient un rattachement dont le code et le domaine sont connus", () => {
    const recu = validerAppelOutil(
      OUTIL_RELECTURE,
      {
        scissions: [], relations: [], manques: [],
        rattachements: [
          { codeExistant: "LOG-01", domaineId: "stats", justification: "Elle sert à lire un tableau." },
        ],
      },
      OUTILS,
    );
    expect(recu).toMatchObject({
      genre: "relecture",
      relecture: { rattachements: [{ codeExistant: "LOG-01", domaineId: "stats" }] },
    });
  });

  it("fait tomber un rattachement dont le code est inventé", () => {
    const recu = validerAppelOutil(
      OUTIL_RELECTURE,
      {
        scissions: [], relations: [], manques: [],
        rattachements: [{ codeExistant: "INVENTE-1", domaineId: "stats", justification: "…" }],
      },
      OUTILS,
    );
    expect(recu).toMatchObject({ genre: "relecture", relecture: { rattachements: [] } });
  });

  it("fait tomber un rattachement dont le domaine est inventé", () => {
    const recu = validerAppelOutil(
      OUTIL_RELECTURE,
      {
        scissions: [], relations: [], manques: [],
        rattachements: [{ codeExistant: "LOG-01", domaineId: "domaine-invente", justification: "…" }],
      },
      OUTILS,
    );
    expect(recu).toMatchObject({ genre: "relecture", relecture: { rattachements: [] } });
  });

  it("déduplique deux fois le même rattachement", () => {
    const ligne = { codeExistant: "LOG-01", domaineId: "stats", justification: "…" };
    const recu = validerAppelOutil(
      OUTIL_RELECTURE,
      { scissions: [], relations: [], manques: [], rattachements: [ligne, { ...ligne }] },
      OUTILS,
    );
    expect(
      (recu as { relecture: { rattachements: unknown[] } }).relecture.rattachements,
    ).toHaveLength(1);
  });

  it("accepte quatre listes vides : « rien à proposer » est une réponse", () => {
    expect(valider({ scissions: [], relations: [], manques: [], rattachements: [] })).toEqual({
      scissions: [],
      relations: [],
      manques: [],
      rattachements: [],
    });
  });

  it("rejette un appel où aucune des trois listes n'est présente", () => {
    expect(valider({ resume: "Je n'ai rien dit." })).toBeNull();
  });
});

describe("construirePromptRelecture", () => {
  const base: EntreeRelecture = {
    familles: ["structure", "progression"],
    domaines: [
      {
        id: "logistique",
        chemin: "Logistique",
        description: "Flux et stocks.",
        competences: [{ code: "LOG-01", intitule: "Calculer un stock de sécurité", palier: "fondamentaux" }],
      },
    ],
    aClasser: [{ code: "STA-01", intitule: "Lire un tableau de données", palier: "fondamentaux" }],
    relationsDeclarees: [{ amont: "LOG-01", aval: "STA-01" }],
    travailRecent: [{ code: "LOG-01", intitule: "Calculer un stock de sécurité", mobilisations: 3 }],
    intentions: { moyenTerme: "Piloter une production.", longTerme: "" },
    maitrisesNouvelles: [],
    intentionsNouvelles: [],
    elargissementActif: true,
  };

  it("dit au tuteur qu'il n'applique rien", () => {
    expect(construirePromptRelecture(base)).toContain("TU N'APPLIQUES RIEN.");
  });

  it("montre l'arbre par chemins lisibles, pas par identifiants seuls", () => {
    expect(construirePromptRelecture(base)).toContain("- logistique — Logistique : Flux et stocks.");
  });

  it("rappelle les prérequis déjà déclarés pour ne pas les reproposer", () => {
    expect(construirePromptRelecture(base)).toContain("- LOG-01 prépare STA-01");
  });

  it("exige un ancrage cité pour chaque manque", () => {
    expect(construirePromptRelecture(base)).toContain("L'ANCRAGE EST OBLIGATOIRE");
  });

  it("ferme le genre manque côté consigne quand l'élargissement est inactif", () => {
    const prompt = construirePromptRelecture({ ...base, elargissementActif: false });
    expect(prompt).toContain("DÉSACTIVÉ pour ce compte");
  });

  it("n'écrit aucun mot de la mécanique interne dans le prompt adressé au compte", () => {
    /*
     * Les mots de la mécanique sont du vocabulaire interne ; le prompt part
     * chez un fournisseur tiers et revient potentiellement dans les
     * justifications affichées. Les genres gardent leur nom technique ici —
     * ce sont des étiquettes de structure, pas des promesses sur le compte.
     */
    const prompt = construirePromptRelecture(base);
    expect(prompt).not.toContain("arete");
    expect(prompt).not.toContain("dormance");
  });
});

describe("relireReferentiel — aucune panne ne se déguise en silence", () => {
  function moteurQuiEmet(evenements: Array<[string, unknown]>): MoteurTuteur {
    return {
      nom: "faux",
      modele: "faux-modele",
      async repondre({ envoyer }) {
        for (const [evenement, donnees] of evenements) envoyer(evenement, donnees);
      },
    };
  }

  const entree: EntreeRelecture = {
    familles: ["structure", "progression"],
    domaines: [],
    aClasser: [],
    relationsDeclarees: [],
    travailRecent: [],
    intentions: { moyenTerme: "", longTerme: "" },
    maitrisesNouvelles: [],
    intentionsNouvelles: [],
    elargissementActif: true,
  };

  it("rend le lot quand il arrive", async () => {
    const lot = { scissions: [SCISSON], relations: [], manques: [] };
    const resultat = await relireReferentiel(
      moteurQuiEmet([["proposition", { genre: "relecture", relecture: lot }]]),
      entree,
    );
    expect(resultat.erreur).toBeNull();
    expect(resultat.lot).toEqual(lot);
  });

  it("remonte l'erreur du fournisseur plutôt qu'un lot fantôme", async () => {
    const resultat = await relireReferentiel(
      moteurQuiEmet([["erreur", { message: "Quota atteint." }]]),
      entree,
    );
    expect(resultat.lot).toEqual({ scissions: [], relations: [], manques: [], rattachements: [] });
    expect(resultat.erreur).toBe("Quota atteint.");
  });

  it("vide les manques côté serveur quand l'élargissement est inactif, quoi que le modèle rende", async () => {
    /*
     * La consigne du prompt suffit rarement : c'est la seconde barrière, la
     * même logique que l'`enum` fermé relu côté serveur.
     */
    const resultat = await relireReferentiel(
      moteurQuiEmet([
        ["proposition", { genre: "relecture", relecture: { scissions: [], relations: [], manques: [MANQUE] } }],
      ]),
      { ...entree, elargissementActif: false },
    );
    expect(resultat.lot.manques).toHaveLength(0);
  });

  it("une relecture de structure ne laisse passer aucune création", async () => {
    const resultat = await relireReferentiel(
      moteurQuiEmet([
        ["proposition", { genre: "relecture", relecture: {
          scissions: [SCISSON], relations: [], manques: [MANQUE], rattachements: [],
        } }],
      ]),
      {
        ...entree,
        familles: ["structure"],
        maitrisesNouvelles: [{ code: "LOG-01", intitule: "Stock", franchiLe: "2026-08-24" }],
      },
    );
    expect(resultat.lot.scissions).toHaveLength(1);
    expect(resultat.lot.manques).toEqual([]);
  });

  it("une relecture de progression exige une source réellement nouvelle", async () => {
    const resultat = await relireReferentiel(
      moteurQuiEmet([
        ["proposition", { genre: "relecture", relecture: {
          scissions: [SCISSON], relations: [], manques: [MANQUE], rattachements: [],
        } }],
      ]),
      { ...entree, familles: ["progression"], maitrisesNouvelles: [] },
    );
    expect(resultat.lot.scissions).toEqual([]);
    expect(resultat.lot.manques).toEqual([]);
  });
});
