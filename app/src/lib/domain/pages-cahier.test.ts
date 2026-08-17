import { describe, expect, it } from "vitest";
import {
  construirePage,
  extraireDocumentsOperationnels,
  feuilletsDeLaPage,
  feuilletsParJour,
  folioDuFeuillet,
  grilleMois,
  jourDeLaSeance,
  jourValide,
  joursDuCahier,
  moisDecale,
  moisValide,
  pageDOuverture,
  pageEstVide,
  rangDOuverture,
  rangValide,
  voisinesDeLaPage,
  voisinsDuFeuillet,
} from "./pages-cahier";
import type { LearningSession } from "./types";

const AUJOURDHUI = new Date("2026-08-16T10:00:00");

function seance(extra: Partial<LearningSession> = {}): LearningSession {
  return {
    id: "ses-1",
    date: "2026-08-14T09:00:00.000Z",
    domaines: ["developpement"],
    skillCodes: ["DEV-01"],
    activites: [{ type: "exercice", ref: "ex-a", libelle: "A" }],
    genereAutomatiquement: false,
    ...extra,
  };
}

import type { ApercuDocument } from "@/lib/documents/types-documents";

describe("extraireDocumentsOperationnels", () => {
  it("extrait uniquement les documents au rôle opérationnel", () => {
    const apercus: ApercuDocument[] = [
      {
        id: "doc-1",
        titre: "Projet LLM",
        type: "projet",
        tags: [],
        schema: "pedagogie/v1",
        schemaCompatible: true,
        frontMatter: {
          role: "operationnel",
          contexte: "Création simulateur",
          projet_duree_min: "45",
          projet_competences: "UPL-01, EES-01",
        },
        liens: [{ cible: "UPL-01" }, { cible: "EES-01" }],
        createdAt: "2026-08-16T12:00:00.000Z",
        updatedAt: "2026-08-16T12:00:00.000Z",
      },
      {
        id: "doc-2",
        titre: "Note de cours",
        type: "cours",
        tags: [],
        schema: "pedagogie/v1",
        schemaCompatible: true,
        frontMatter: { role: "support" },
        liens: [],
        createdAt: "2026-08-15T12:00:00.000Z",
        updatedAt: "2026-08-15T12:00:00.000Z",
      },
    ];

    const resultats = extraireDocumentsOperationnels(apercus, []);
    expect(resultats).toHaveLength(1);
    expect(resultats[0].id).toBe("doc-1");
    expect(resultats[0].titre).toBe("Projet LLM");
    expect(resultats[0].dureeMin).toBe(45);
    expect(resultats[0].competences).toEqual(["UPL-01", "EES-01"]);
    expect(resultats[0].fige).toBe(false);
  });
});

describe("jourDeLaSeance", () => {
  it("range une séance planifiée sur le jour prévu, pas sur sa date d'écriture", () => {
    // C'est ce qui donne au cahier des pages à venir : on va chercher une
    // séance prévue là où elle aura lieu.
    const prevue = seance({
      statut: "planifiee",
      date: "2026-08-14T09:00:00.000Z",
      planifieePour: "2026-08-20T09:00:00.000Z",
    });
    expect(jourDeLaSeance(prevue)).toBe("2026-08-20");
  });

  it("range toutes les autres sur leur date réelle", () => {
    expect(jourDeLaSeance(seance({ statut: "terminee" }))).toBe("2026-08-14");
    expect(jourDeLaSeance(seance({ statut: "en-cours" }))).toBe("2026-08-14");
  });
});

describe("jourValide", () => {
  it("accepte une clé bien formée et refuse le reste sans rien deviner", () => {
    expect(jourValide("2026-08-16")).toBe("2026-08-16");
    expect(jourValide("16/08/2026")).toBeNull();
    expect(jourValide("2026-8-1")).toBeNull();
    expect(jourValide(undefined)).toBeNull();
    expect(jourValide("2026-13-45")).toBeNull();
  });
});

describe("joursDuCahier", () => {
  it("inclut toujours le jour courant : c'est la page où l'on écrit", () => {
    expect(joursDuCahier({ seances: [], notes: [], aujourdHui: AUJOURDHUI })).toEqual([
      "2026-08-16",
    ]);
  });

  it("rassemble séances, notes et projets, sans doublon, du plus ancien au plus récent", () => {
    const jours = joursDuCahier({
      seances: [
        seance({ id: "a", date: "2026-08-14T09:00:00.000Z" }),
        seance({ id: "b", date: "2026-08-14T18:00:00.000Z" }),
        seance({ id: "c", statut: "planifiee", planifieePour: "2026-08-20T09:00:00.000Z" }),
      ],
      notes: [{ notee: "2026-08-11" }, { notee: "2026-08-14" }, {}],
      projets: [
        {
          id: "p-1",
          titre: "Projet 1",
          type: "projet",
          competences: [],
          createdAt: "2026-08-12T10:00:00.000Z",
        },
      ],
      aujourdHui: AUJOURDHUI,
    });
    expect(jours).toEqual(["2026-08-11", "2026-08-12", "2026-08-14", "2026-08-16", "2026-08-20"]);
  });
});

describe("construirePage", () => {
  const entrees = {
    seances: [
      seance({ id: "composee", date: "2026-08-14T09:00:00.000Z" }),
      seance({ id: "trace-1", date: "2026-08-14T11:00:00.000Z", genereAutomatiquement: true }),
      seance({ id: "trace-2", date: "2026-08-14T10:00:00.000Z", genereAutomatiquement: true }),
      seance({ id: "autre-jour", date: "2026-08-15T09:00:00.000Z" }),
    ],
    notes: [{ notee: "2026-08-14" }, { notee: "2026-08-15" }],
    projets: [
      {
        id: "proj-1",
        titre: "Simulateur",
        type: "projet",
        competences: ["DEV-01"],
        createdAt: "2026-08-14T14:00:00.000Z",
      },
    ],
  };

  it("sépare les séances composées des traces automatiques", () => {
    // 45 des 51 lignes de `sessions` sont des traces : les rendre comme des
    // séances noyait les vraies.
    const page = construirePage("2026-08-14", entrees);
    expect(page.seances.map((s) => s.id)).toEqual(["composee"]);
    expect(page.traces.map((s) => s.id)).toEqual(["trace-2", "trace-1"]);
  });

  it("ne retient que les notes et projets du jour", () => {
    const page = construirePage("2026-08-14", entrees);
    expect(page.notes).toEqual([{ notee: "2026-08-14" }]);
    expect(page.projets).toHaveLength(1);
    expect(page.projets[0].id).toBe("proj-1");
  });

  it("rend une page vide plutôt que rien, pour un jour sans contenu", () => {
    const page = construirePage("2026-08-01", entrees);
    expect(pageEstVide(page)).toBe(true);
    expect(page.jour).toBe("2026-08-01");
  });
});

describe("feuilletsDeLaPage", () => {
  const entrees = {
    seances: [
      seance({ id: "seance-matin", date: "2026-08-14T09:00:00.000Z" }),
      seance({ id: "seance-soir", date: "2026-08-14T18:00:00.000Z" }),
      seance({ id: "trace", date: "2026-08-14T11:00:00.000Z", genereAutomatiquement: true }),
    ],
    notes: [{ notee: "2026-08-14" }],
    projets: [],
  };

  it("donne un feuillet par séance, puis un feuillet de clôture", () => {
    // La coupe suit une frontière qui existe déjà dans les données : une
    // séance a un début, une fin, une durée.
    const feuillets = feuilletsDeLaPage(construirePage("2026-08-14", entrees));
    expect(feuillets.map((f) => f.type)).toEqual(["seance", "seance", "cloture"]);
    expect(feuillets.map((f) => f.rang)).toEqual([1, 2, 3]);
    expect(feuillets.every((f) => f.total === 3)).toBe(true);
    expect(feuillets.every((f) => f.jour === "2026-08-14")).toBe(true);
  });

  it("porte les traces, notes et projets sur le feuillet de clôture", () => {
    const feuillets = feuilletsDeLaPage(construirePage("2026-08-14", entrees));
    const cloture = feuillets.at(-1);
    if (cloture?.type !== "cloture") throw new Error("le dernier feuillet doit être la clôture");
    expect(cloture.traces.map((s) => s.id)).toEqual(["trace"]);
    expect(cloture.notes).toEqual([{ notee: "2026-08-14" }]);
    expect(cloture.projets).toEqual([]);
  });

  it("n'ajoute pas de clôture quand le jour n'a que ses séances", () => {
    const feuillets = feuilletsDeLaPage(
      construirePage("2026-08-14", { seances: [seance({ id: "seule" })], notes: [] }),
    );
    expect(feuillets).toHaveLength(1);
    expect(feuillets[0].type).toBe("seance");
  });

  it("rend un feuillet unique pour un jour vierge : c'est là qu'on écrit", () => {
    const feuillets = feuilletsDeLaPage(construirePage("2026-08-01", entrees));
    expect(feuillets).toHaveLength(1);
    expect(feuillets[0]).toMatchObject({ type: "cloture", rang: 1, total: 1 });
  });
});

describe("rangValide", () => {
  it("accepte un rang entier à partir de 1 et refuse le reste sans rien deviner", () => {
    expect(rangValide("1")).toBe(1);
    expect(rangValide("12")).toBe(12);
    expect(rangValide("0")).toBeNull();
    expect(rangValide("-2")).toBeNull();
    expect(rangValide("1.5")).toBeNull();
    expect(rangValide("dernier")).toBeNull();
    expect(rangValide(undefined)).toBeNull();
  });
});

describe("rangDOuverture", () => {
  it("ouvre au premier feuillet quand l'URL n'en désigne aucun", () => {
    expect(rangDOuverture(null, 3)).toBe(1);
  });

  it("ramène un rang hors bornes dans le jour plutôt que de rendre une page vide", () => {
    // Une séance supprimée depuis, ou un lien recopié à la main.
    expect(rangDOuverture(9, 3)).toBe(3);
    expect(rangDOuverture(1, 3)).toBe(1);
    expect(rangDOuverture(2, 1)).toBe(1);
  });
});

describe("voisinsDuFeuillet", () => {
  const jours = ["2026-08-11", "2026-08-14", "2026-08-16"];
  const nombres = new Map([
    ["2026-08-11", 2],
    ["2026-08-14", 3],
    ["2026-08-16", 1],
  ]);
  const compter = (jour: string) => nombres.get(jour) ?? 1;

  it("tourne à l'intérieur du jour tant qu'il reste des feuillets", () => {
    expect(voisinsDuFeuillet({ jour: "2026-08-14", rang: 2 }, jours, compter)).toEqual({
      precedent: { jour: "2026-08-14", rang: 1 },
      suivant: { jour: "2026-08-14", rang: 3 },
    });
  });

  it("passe au jour suivant après le dernier feuillet, et y entre par le premier", () => {
    expect(voisinsDuFeuillet({ jour: "2026-08-14", rang: 3 }, jours, compter).suivant).toEqual({
      jour: "2026-08-16",
      rang: 1,
    });
  });

  it("remonte au jour précédent par son dernier feuillet", () => {
    // On arrive par la fin, comme dans un cahier qu'on remonte.
    expect(voisinsDuFeuillet({ jour: "2026-08-14", rang: 1 }, jours, compter).precedent).toEqual({
      jour: "2026-08-11",
      rang: 2,
    });
  });

  it("n'a pas de voisin au-delà des bords du cahier", () => {
    expect(voisinsDuFeuillet({ jour: "2026-08-11", rang: 1 }, jours, compter).precedent).toBeNull();
    expect(voisinsDuFeuillet({ jour: "2026-08-16", rang: 1 }, jours, compter).suivant).toBeNull();
  });

  it("borne un rang hors limites avant de chercher les voisins", () => {
    expect(voisinsDuFeuillet({ jour: "2026-08-14", rang: 99 }, jours, compter)).toEqual({
      precedent: { jour: "2026-08-14", rang: 2 },
      suivant: { jour: "2026-08-16", rang: 1 },
    });
  });
});

describe("feuilletsParJour", () => {
  it("compte les feuillets de chaque jour en une seule construction", () => {
    const entrees = {
      seances: [
        seance({ id: "a", date: "2026-08-14T09:00:00.000Z" }),
        seance({ id: "b", date: "2026-08-14T18:00:00.000Z" }),
        seance({ id: "trace", date: "2026-08-14T11:00:00.000Z", genereAutomatiquement: true }),
        seance({ id: "c", date: "2026-08-16T09:00:00.000Z" }),
      ],
      notes: [{ notee: "2026-08-11" }],
    };
    expect(feuilletsParJour(["2026-08-11", "2026-08-14", "2026-08-16"], entrees)).toEqual(
      new Map([
        ["2026-08-11", 1],
        ["2026-08-14", 3],
        ["2026-08-16", 1],
      ]),
    );
  });
});

describe("folioDuFeuillet", () => {
  const jours = ["2026-08-11", "2026-08-14", "2026-08-16"];
  const nombres = new Map([
    ["2026-08-11", 2],
    ["2026-08-14", 3],
    ["2026-08-16", 1],
  ]);

  it("numérote le cahier entier, pas le jour", () => {
    expect(folioDuFeuillet({ jour: "2026-08-11", rang: 1 }, jours, nombres)).toEqual({
      folio: 1,
      total: 6,
    });
    expect(folioDuFeuillet({ jour: "2026-08-14", rang: 2 }, jours, nombres)).toEqual({
      folio: 4,
      total: 6,
    });
    expect(folioDuFeuillet({ jour: "2026-08-16", rang: 1 }, jours, nombres)).toEqual({
      folio: 6,
      total: 6,
    });
  });

  it("borne un rang hors limites au lieu de rendre un folio impossible", () => {
    expect(folioDuFeuillet({ jour: "2026-08-14", rang: 12 }, jours, nombres).folio).toBe(5);
  });
});

describe("voisinesDeLaPage", () => {
  const jours = ["2026-08-11", "2026-08-14", "2026-08-16"];

  it("saute les jours vides : un cahier n'est pas un calendrier", () => {
    expect(voisinesDeLaPage("2026-08-14", jours)).toEqual({
      precedente: "2026-08-11",
      suivante: "2026-08-16",
    });
  });

  it("n'a pas de voisine au-delà des bords", () => {
    expect(voisinesDeLaPage("2026-08-11", jours).precedente).toBeNull();
    expect(voisinesDeLaPage("2026-08-16", jours).suivante).toBeNull();
  });

  it("situe un jour absent de la liste entre ses voisins immédiats", () => {
    expect(voisinesDeLaPage("2026-08-12", jours)).toEqual({
      precedente: "2026-08-11",
      suivante: "2026-08-14",
    });
  });
});

describe("calendrier", () => {
  it("décale les mois en respectant le passage d'année", () => {
    expect(moisDecale("2026-08", 1)).toBe("2026-09");
    expect(moisDecale("2026-12", 1)).toBe("2027-01");
    expect(moisDecale("2026-01", -1)).toBe("2025-12");
    expect(moisDecale("2026-08", -13)).toBe("2025-07");
  });

  it("valide un mois et refuse le reste", () => {
    expect(moisValide("2026-08")).toBe("2026-08");
    expect(moisValide("2026-13")).toBeNull();
    expect(moisValide("2026-8")).toBeNull();
    expect(moisValide(undefined)).toBeNull();
  });

  it("commence les semaines le lundi", () => {
    // Le 1er août 2026 est un samedi : la première semaine commence donc le
    // lundi 27 juillet.
    const grille = grilleMois("2026-08", [], AUJOURDHUI);
    expect(grille[0][0].jour).toBe("2026-07-27");
    expect(grille[0][0].dansLeMois).toBe(false);
    expect(grille[0][5].jour).toBe("2026-08-01");
    expect(grille[0][5].dansLeMois).toBe(true);
  });

  it("marque les jours qui portent une page, et aujourd'hui", () => {
    const grille = grilleMois("2026-08", ["2026-08-14"], AUJOURDHUI).flat();
    expect(grille.find((c) => c.jour === "2026-08-14")?.aContenu).toBe(true);
    expect(grille.find((c) => c.jour === "2026-08-13")?.aContenu).toBe(false);
    expect(grille.find((c) => c.jour === "2026-08-16")?.estAujourdHui).toBe(true);
  });

  it("couvre tout le mois sans traîner une semaine entièrement vide", () => {
    for (const mois of ["2026-02", "2026-08", "2027-02", "2024-02"]) {
      const cases = grilleMois(mois, [], AUJOURDHUI).flat();
      const dedans = cases.filter((c) => c.dansLeMois);
      const dernier = new Date(`${moisDecale(mois, 1)}-01T12:00:00`);
      dernier.setDate(0);
      expect(dedans).toHaveLength(dernier.getDate());
      expect(cases.length % 7).toBe(0);
    }
  });
});

describe("pageDOuverture", () => {
  const jours = ["2026-08-11", "2026-08-16"];

  it("rouvre le marque-page", () => {
    expect(pageDOuverture("2026-08-11", jours, AUJOURDHUI)).toBe("2026-08-11");
  });

  it("ignore un marque-page périmé plutôt que d'ouvrir une page disparue", () => {
    expect(pageDOuverture("2026-07-02", jours, AUJOURDHUI)).toBe("2026-08-16");
    expect(pageDOuverture(null, jours, AUJOURDHUI)).toBe("2026-08-16");
  });
});
