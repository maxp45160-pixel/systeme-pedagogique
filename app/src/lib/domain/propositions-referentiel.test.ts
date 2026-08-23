import { describe, expect, it } from "vitest";

import {
  empreinteProposition,
  empreintesRefusees,
  estGenreProposition,
  estPerimee,
  estEncoreApplicable,
  lireRefutation,
  lotOuvert,
  type ReferentielLu,
  retentionParGenre,
  versionsCourantes,
  type ContenuProposition,
  type PropositionReferentielRelue,
} from "./propositions-referentiel";
import type { DomaineId } from "./types";

/**
 * Ce que fige ce fichier — les propriétés dont le test de réfutation d'ADR-108
 * dépend :
 *
 * - une proposition a une **identité stable**, l'empreinte, qui ne porte que ce
 *   qui est proposé et jamais la façon de le dire ;
 * - un **refus vaut pour tous les lots**, et pour toute reformulation de la
 *   même proposition ;
 * - une proposition sort du lot quand elle n'est **plus applicable**, jamais
 *   parce qu'une version a bougé (`estEncoreApplicable`, 24/08/2026) ;
 * - `estPerimee` survit, mais pour la seule question qui lui convient :
 *   **une relecture est-elle due**, pas si telle proposition tient encore ;
 * - la rétention **ne fabrique aucun taux** sans arbitrage, et aucun verdict
 *   sans les trois lots que l'ADR demande.
 */

function proposition(partielle: Partial<PropositionReferentielRelue>): PropositionReferentielRelue {
  return {
    id: "p1",
    lotId: "lot-1",
    genre: "scission",
    domaineId: "logistique",
    empreinte: "peu-importe",
    versionsLues: { logistique: 3 },
    contenu: {
      genre: "scission",
      parentId: "logistique",
      nom: "Gestion kanban",
      description: "",
      codes: ["LOG-01", "LOG-02"],
    },
    motifs: ["un motif"],
    creeLe: "2026-08-22T10:00:00.000Z",
    arbitrage: null,
    ...partielle,
  };
}

describe("empreinteProposition — l'identité stable", () => {
  const scission: ContenuProposition = {
    genre: "scission",
    parentId: "logistique",
    nom: "Gestion kanban",
    description: "",
    codes: ["LOG-02", "LOG-01"],
  };

  it("rend la même empreinte quel que soit l'ordre des codes", () => {
    const autre = { ...scission, codes: ["LOG-01", "LOG-02"] };
    expect(empreinteProposition(autre)).toBe(empreinteProposition(scission));
  });

  it("distingue deux noms de sous-domaine sur les mêmes compétences", () => {
    /*
     * Refuser « Gestion kanban » ne doit pas empêcher « Flux tirés » sur les
     * mêmes codes : le nom fait partie de ce qu'on accepte ou refuse.
     */
    const autre = { ...scission, nom: "Flux tirés" };
    expect(empreinteProposition(autre)).not.toBe(empreinteProposition(scission));
  });

  it("distingue deux parents", () => {
    const autre = { ...scission, parentId: "production" };
    expect(empreinteProposition(autre)).not.toBe(empreinteProposition(scission));
  });

  it("ignore la casse et les accents du nom", () => {
    const autre = { ...scission, nom: "gestion KANBAN" };
    expect(empreinteProposition(autre)).toBe(empreinteProposition(scission));
  });

  it("ne porte ni la description ni le motif : seulement ce qui est proposé", () => {
    /*
     * Deux relectures qui proposent le même découpage avec deux phrases
     * différentes proposent la même chose, et un refus doit valoir pour les
     * deux.
     */
    const autre = { ...scission, description: "Une autre façon de le dire." };
    expect(empreinteProposition(autre)).toBe(empreinteProposition(scission));
  });

  it("désigne une compétence inexistante par son intitulé normalisé, jamais par un code frappé", () => {
    const relation: ContenuProposition = {
      genre: "relation",
      amont: { code: "LOG-01", intitule: "", palier: "" },
      aval: { intitule: "Dimensionner un supermarché de pièces", palier: "intermediaire" },
    };
    const avecAccents: ContenuProposition = {
      ...relation,
      aval: { intitule: "Dimensionner un supermarché de pièces ", palier: "intermediaire" },
    };
    expect(empreinteProposition(avecAccents)).toBe(empreinteProposition(relation));
  });
});

describe("estPerimee — la version périme, jamais un nombre de jours", () => {
  const versions = versionsCourantes([
    { id: "logistique" as DomaineId, version: 4 },
    { id: "stats" as DomaineId, version: 2 },
  ]);

  it("reste valide quand toutes les versions lues sont courantes", () => {
    expect(estPerimee({ versionsLues: { logistique: 4, stats: 2 } }, versions)).toBe(false);
  });

  it("périme dès qu'une seule version lue a bougé", () => {
    expect(estPerimee({ versionsLues: { logistique: 4, stats: 2 }, }, versionsCourantes([{ id: "logistique" as DomaineId, version: 5 }, { id: "stats" as DomaineId, version: 2 }]))).toBe(true);
  });

  it("périme quand un domaine lu a disparu — absent n'est pas inchangé", () => {
    /* P2 : une valeur qu'on n'a pas ne se remplace pas par « inchangé ». */
    expect(estPerimee({ versionsLues: { disparu: 1 } }, versions)).toBe(true);
  });
});

/**
 * Le référentiel contre lequel l'applicabilité se juge.
 *
 * Il porte de quoi rendre la proposition par défaut de `proposition()` —
 * une scission de « Gestion kanban » sous `logistique`, emportant LOG-01 et
 * LOG-02 — encore faisable : le parent vit, aucun domaine ne porte déjà ce
 * nom, et les deux compétences existent.
 */
const REFERENTIEL: ReferentielLu = {
  domaines: [
    { id: "logistique", archive: false },
    { id: "stats", archive: false },
  ],
  competences: [
    { code: "LOG-01", intitule: "Lire un plan de flux", archive: false, prerequis: [] },
    { code: "LOG-02", intitule: "Régler une boucle", archive: false, prerequis: [] },
  ],
};

describe("lotOuvert — ce qui reste à arbitrer", () => {
  it("exclut les arbitrées et les refusées sous une autre identité de lot", () => {
    const ouvertes = lotOuvert(
      [
        proposition({ id: "a", empreinte: "e-a" }),
        proposition({ id: "b", empreinte: "e-b", arbitrage: { decision: "retenue", date: "2026-08-22T11:00:00.000Z" } }),
        proposition({
          id: "d",
          empreinte: "e-refusee",
          arbitrage: { decision: "refusee", date: "2026-08-22T12:00:00.000Z" },
        }),
      ],
      REFERENTIEL,
    );
    expect(ouvertes.map((p) => p.id)).toEqual(["a"]);
  });

  it("exclut ce qui n'est plus faisable — ici, la scission a déjà eu lieu", () => {
    const dejaScinde: ReferentielLu = {
      ...REFERENTIEL,
      domaines: [...REFERENTIEL.domaines, { id: "gestion-kanban", archive: false }],
    };
    expect(lotOuvert([proposition({ id: "a" })], dejaScinde)).toHaveLength(0);
  });

  /*
   * LE cas qui a motivé le remplacement du filtre par version, le 24/08/2026.
   *
   * Retenir une scission sur « Logistique industrielle » incrémentait la
   * version du parent, et périmait d'un bloc toutes les autres propositions
   * portant sur ce domaine — quarante, en l'occurrence. Une version qui bouge
   * ne dit rien de la faisabilité : ce qui compte est que la proposition
   * désigne encore quelque chose qui existe et reste à faire.
   */
  it("survit à une commande sur le domaine qui ne la rend pas infaisable", () => {
    const apresUneAutreCommande: ReferentielLu = {
      ...REFERENTIEL,
      // Une compétence taguée ailleurs, un domaine renommé, une version qui a
      // bougé : rien de tout cela n'empêche ce découpage.
      competences: [
        ...REFERENTIEL.competences,
        { code: "LOG-03", intitule: "Autre chose", archive: false, prerequis: [] },
      ],
    };
    expect(lotOuvert([proposition({ id: "a" })], apresUneAutreCommande)).toHaveLength(1);
  });

  it("fait valoir un refus pour le lot suivant qui reproposerait la même chose", () => {
    const ouvertes = lotOuvert(
      [
        proposition({
          id: "refus-lot-1",
          lotId: "lot-1",
          empreinte: "e-refusee",
          arbitrage: { decision: "refusee", date: "2026-08-21T09:00:00.000Z" },
        }),
        proposition({ id: "meme-lot-2", lotId: "lot-2", empreinte: "e-refusee" }),
      ],
      REFERENTIEL,
    );
    expect(ouvertes).toHaveLength(0);
  });

  it("affiche une fois seulement une proposition portée par plusieurs lots valides", () => {
    const ouvertes = lotOuvert(
      [
        proposition({ id: "lot-1", lotId: "lot-1", empreinte: "e-doublon", creeLe: "2026-08-20T09:00:00.000Z" }),
        proposition({ id: "lot-2", lotId: "lot-2", empreinte: "e-doublon", creeLe: "2026-08-22T09:00:00.000Z" }),
      ],
      REFERENTIEL,
    );
    expect(ouvertes).toHaveLength(1);
  });
});

describe("estEncoreApplicable, genre par genre", () => {
  it("écarte une arête dont le lien est déjà déclaré", () => {
    const relie: ReferentielLu = {
      ...REFERENTIEL,
      competences: [
        { code: "LOG-01", intitule: "A", archive: false, prerequis: [] },
        { code: "LOG-02", intitule: "B", archive: false, prerequis: ["LOG-01"] },
      ],
    };
    const arete = { genre: "arete", amont: "LOG-01", aval: "LOG-02", force: 1, source: "usage" } as const;
    expect(estEncoreApplicable(arete, REFERENTIEL)).toBe(true);
    expect(estEncoreApplicable(arete, relie)).toBe(false);
  });

  it("écarte une compétence archivée entre-temps", () => {
    const archivee: ReferentielLu = {
      ...REFERENTIEL,
      competences: [{ code: "LOG-01", intitule: "A", archive: true, prerequis: [] }],
    };
    const dormance = { genre: "dormance", code: "LOG-01", joursSansRien: 90 } as const;
    expect(estEncoreApplicable(dormance, REFERENTIEL)).toBe(true);
    expect(estEncoreApplicable(dormance, archivee)).toBe(false);
  });

  it("écarte un rangement dont le tag est déjà posé", () => {
    const tagee: ReferentielLu = {
      ...REFERENTIEL,
      competences: [
        { code: "LOG-01", intitule: "A", archive: false, prerequis: [], tagsDomaine: ["stats"] },
      ],
    };
    const rangement = {
      genre: "rangement", code: "LOG-01", domaineActuel: "logistique",
      domaineObserve: "stats", observations: 3,
    } as const;
    expect(estEncoreApplicable(rangement, REFERENTIEL)).toBe(true);
    expect(estEncoreApplicable(rangement, tagee)).toBe(false);
  });

  /* Créée entre-temps, ici ou ailleurs : il n'y a plus de manque à combler. */
  it("écarte un manque dont l'intitulé existe désormais, accents et casse ignorés", () => {
    const manque = {
      genre: "manque", domaineId: "logistique",
      intitule: "Dimensionner un supermarché de pièces",
      palier: "intermediaire", ancrage: "…",
    } as const;
    expect(estEncoreApplicable(manque, REFERENTIEL)).toBe(true);

    const creee: ReferentielLu = {
      ...REFERENTIEL,
      competences: [
        ...REFERENTIEL.competences,
        { code: "LOG-09", intitule: "DIMENSIONNER UN SUPERMARCHE DE PIECES", archive: false, prerequis: [] },
      ],
    };
    expect(estEncoreApplicable(manque, creee)).toBe(false);
  });

  /*
   * Le côté sans code n'existe pas encore, et c'est exactement ce que la
   * proposition offre de créer : son absence ne la rend pas caduque.
   */
  it("garde une relation dont un seul côté existe", () => {
    const relation = {
      genre: "relation",
      amont: { code: "LOG-01", intitule: "A", palier: "fondamentaux" },
      aval: { intitule: "Pas encore au référentiel", palier: "avance" },
    } as const;
    expect(estEncoreApplicable(relation, REFERENTIEL)).toBe(true);
  });
});

describe("empreintesRefusees", () => {
  it("ne retient que les refus — une retenue ne filtre rien", () => {
    const refusees = empreintesRefusees([
      proposition({ empreinte: "e-refusee", arbitrage: { decision: "refusee", date: "x" } }),
      proposition({ empreinte: "e-retenue", arbitrage: { decision: "retenue", date: "x" } }),
      proposition({ empreinte: "e-ouverte" }),
    ]);
    expect([...refusees]).toEqual(["e-refusee"]);
  });
});

describe("retentionParGenre — la mesure du test de réfutation", () => {
  it("rend null tant que rien n'a été arbitré : pas de taux sans arbitrage", () => {
    const [arete] = retentionParGenre([proposition({ genre: "arete", empreinte: "e" })]);
    expect(arete.proposees).toBe(1);
    expect(arete.taux).toBeNull();
  });

  it("compte le dénominateur en arbitrées, pas en proposées", () => {
    /*
     * Une proposition qu'on n'a pas regardée n'est ni un succès ni un échec ;
     * la compter comme un refus ferait baisser le taux à mesure que le lot
     * grossit.
     */
    const manque = retentionParGenre([
      proposition({
        genre: "manque",
        empreinte: "e-1",
        contenu: {
          genre: "manque",
          domaineId: "logistique",
          intitule: "A",
          palier: "fondamentaux",
          ancrage: "cité",
        },
        arbitrage: { decision: "retenue", date: "x" },
      }),
      proposition({
        genre: "manque",
        empreinte: "e-2",
        contenu: {
          genre: "manque",
          domaineId: "logistique",
          intitule: "B",
          palier: "fondamentaux",
          ancrage: "cité",
        },
        arbitrage: { decision: "refusee", date: "x" },
      }),
      proposition({
        genre: "manque",
        empreinte: "e-3",
        contenu: {
          genre: "manque",
          domaineId: "logistique",
          intitule: "C",
          palier: "fondamentaux",
          ancrage: "cité",
        },
      }),
    ]).find((r) => r.genre === "manque")!;
    expect(manque.proposees).toBe(3);
    expect(manque.arbitrees).toBe(2);
    expect(manque.retenues).toBe(1);
    expect(manque.taux).toBe(0.5);
  });

  it("couvre tous les genres déclarés, même ceux qui n'ont encore rien produit", () => {
    const retention = retentionParGenre([]);
    expect(retention.map((r) => r.genre)).toEqual([
      "arete",
      "dormance",
      "reformulation",
      "rangement",
      "scission",
      "relation",
      "manque",
    ]);
  });
});

describe("les genres", () => {
  it("reconnaît les sept genres et rejette tout le reste", () => {
    expect(estGenreProposition("scission")).toBe(true);
    expect(estGenreProposition("invention")).toBe(false);
    expect(estGenreProposition(null)).toBe(false);
  });
});

describe("la lecture du test de réfutation (ADR-108)", () => {
  /*
   * `proposition()` fixe `genre: "scission"` par defaut : ce helper le derive
   * du contenu, sans quoi toute ligne serait comptee comme une scission — et
   * le critere qui juge les seuls genres du tuteur ne mesurerait plus rien.
   */
  const lot = (id: string, contenu: ContenuProposition, decision?: "retenue" | "refusee") =>
    proposition({
      contenu,
      genre: contenu.genre,
      empreinte: empreinteProposition(contenu),
      lotId: id,
      ...(decision
        ? { arbitrage: { decision, date: "2026-08-24T10:00:00.000Z" } as const }
        : {}),
    });

  const dormance = (code: string): ContenuProposition => ({
    genre: "dormance",
    code,
    joursSansRien: 90,
  });

  it("ne rend aucun verdict tant que rien n'a été arbitré", () => {
    const lecture = lireRefutation([lot("l1", dormance("LOG-01"))]);
    expect(lecture.ensemble.taux).toBeNull();
    expect(lecture.criteres[0].verdict).toBe("insuffisant");
  });

  /*
   * Le cas réel du 24/08/2026 : un premier lot arbitré d'un bloc, 100 % retenu.
   * Un « tenu » ici serait une conclusion fabriquée — l'ADR demande trois lots,
   * et un premier lot enthousiaste ne dit rien d'une rétention installée.
   */
  it("refuse de conclure sur un seul lot, même retenu à 100 %", () => {
    const lecture = lireRefutation([
      lot("l1", dormance("LOG-01"), "retenue"),
      lot("l1", dormance("LOG-02"), "retenue"),
    ]);
    expect(lecture.lots).toBe(1);
    expect(lecture.ensemble.taux).toBe(1);
    expect(lecture.criteres[0].verdict).toBe("insuffisant");
    expect(lecture.criteres[0].constat).toContain("sur les 3 qu'ADR-108 demande");
  });

  it("tient le critère du bruit au-delà de trois lots majoritairement retenus", () => {
    const lecture = lireRefutation([
      lot("l1", dormance("LOG-01"), "retenue"),
      lot("l2", dormance("LOG-02"), "retenue"),
      lot("l3", dormance("LOG-03"), "refusee"),
    ]);
    expect(lecture.lots).toBe(3);
    expect(lecture.criteres[0].verdict).toBe("tenu");
  });

  it("réfute quand moins d'une proposition sur deux est retenue", () => {
    const lecture = lireRefutation([
      lot("l1", dormance("LOG-01"), "refusee"),
      lot("l2", dormance("LOG-02"), "refusee"),
      lot("l3", dormance("LOG-03"), "retenue"),
    ]);
    expect(lecture.criteres[0].verdict).toBe("refute");
  });

  /*
   * Le troisième critère ne regarde QUE les genres du tuteur : c'est lui qui
   * dit si l'appel modèle se justifie. Des déterministes massivement retenus ne
   * doivent pas le sauver.
   */
  it("juge l'appel modèle sur les seuls genres du tuteur", () => {
    const scission: ContenuProposition = {
      genre: "scission",
      parentId: "logistique",
      nom: "Gestion kanban",
      description: "",
      codes: ["LOG-01"],
    };
    const lecture = lireRefutation([
      lot("l1", dormance("LOG-01"), "retenue"),
      lot("l2", dormance("LOG-02"), "retenue"),
      lot("l3", dormance("LOG-03"), "retenue"),
      lot("l3", scission, "refusee"),
    ]);
    expect(lecture.criteres[0].verdict).toBe("tenu");
    expect(lecture.criteres[2].verdict).toBe("refute");
  });

  /*
   * « Non mesurable » plutôt qu'omis en silence : rien ne relie un archivage de
   * sous-domaine à la proposition qui l'a suggéré. Le dire vaut mieux que
   * d'afficher un verdict sans données derrière.
   */
  it("déclare non mesurable le critère de la scission défaite", () => {
    const lecture = lireRefutation([lot("l1", dormance("LOG-01"), "retenue")]);
    expect(lecture.criteres[1].verdict).toBe("non-mesurable");
  });
});
