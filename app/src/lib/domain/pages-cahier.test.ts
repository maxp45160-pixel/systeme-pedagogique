import { describe, expect, it } from "vitest";
import {
  construirePage,
  grilleMois,
  jourDeLaSeance,
  jourValide,
  joursDuCahier,
  moisDecale,
  moisValide,
  pageDOuverture,
  pageEstVide,
  voisinesDeLaPage,
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

  it("rassemble séances et notes, sans doublon, du plus ancien au plus récent", () => {
    const jours = joursDuCahier({
      seances: [
        seance({ id: "a", date: "2026-08-14T09:00:00.000Z" }),
        seance({ id: "b", date: "2026-08-14T18:00:00.000Z" }),
        seance({ id: "c", statut: "planifiee", planifieePour: "2026-08-20T09:00:00.000Z" }),
      ],
      notes: [{ notee: "2026-08-11" }, { notee: "2026-08-14" }, {}],
      aujourdHui: AUJOURDHUI,
    });
    expect(jours).toEqual(["2026-08-11", "2026-08-14", "2026-08-16", "2026-08-20"]);
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
  };

  it("sépare les séances composées des traces automatiques", () => {
    // 45 des 51 lignes de `sessions` sont des traces : les rendre comme des
    // séances noyait les vraies.
    const page = construirePage("2026-08-14", entrees);
    expect(page.seances.map((s) => s.id)).toEqual(["composee"]);
    expect(page.traces.map((s) => s.id)).toEqual(["trace-2", "trace-1"]);
  });

  it("ne retient que les notes du jour", () => {
    expect(construirePage("2026-08-14", entrees).notes).toEqual([{ notee: "2026-08-14" }]);
  });

  it("rend une page vide plutôt que rien, pour un jour sans contenu", () => {
    const page = construirePage("2026-08-01", entrees);
    expect(pageEstVide(page)).toBe(true);
    expect(page.jour).toBe("2026-08-01");
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
