/**
 * Ce que ces tests protègent.
 *
 * Une seule ligne du moteur décide de ce que « deux contextes distincts »
 * signifie, et deux portes en dépendent : le niveau 4 « transfert » et la
 * confiance moyenne puis forte. Jusqu'au 18/08/2026 cette ligne comptait des
 * **titres d'exercice** — 42 valeurs distinctes pour 52 observations en base. Les
 * portes s'ouvraient donc d'elles-mêmes à la deuxième observation.
 *
 * Les fixtures ne sont pas inventées : ce sont les exercices et les observations
 * réels du compte, relus en base le 18/08/2026. DEB-02 est le cas qui garde
 * son transfert (deux types d'exercice), LOG-03 celui qui le perd (deux titres,
 * une seule famille).
 */

import { describe, expect, it } from "vitest";

import type { Exercise, SkillObservation } from "@/lib/domain/types";
import {
  attacherFamilles,
  cleContexte,
  construireCatalogueSituation,
  familleIndeterminee,
  familleSituation,
  libelleContexte,
} from "./contexte-situation";

/* ------------------------------------------------------------------ */
/* Fixtures — exercices réels du compte, au 18/08/2026                 */
/* ------------------------------------------------------------------ */

function exercice(
  id: string,
  domaine: string,
  type: Exercise["type"],
): Pick<Exercise, "id" | "domaine" | "type"> {
  return { id, domaine, type };
}

const CATALOGUE = construireCatalogueSituation([
  // DEB-02 : deux types distincts dans le même domaine.
  exercice("ex-deb-a", "developpement-logiciel-pour-debutants", "probleme"),
  exercice("ex-deb-b", "developpement-logiciel-pour-debutants", "programmation"),
  // LOG-03 : deux exercices de calcul en logistique, deux titres différents.
  exercice("diag-log-01", "logistique", "calcul"),
  exercice("ex-log-b", "logistique", "calcul"),
]);

let compteur = 0;

function observation(ref: string, contexte: string): SkillObservation {
  return {
    id: `obs-${++compteur}`,
    skillCode: "TEST-01",
    date: "2026-08-01T10:00:00.000Z",
    type: "exercice",
    niveauObservation: "A",
    autonomie: "A3",
    qualite: "moyenne",
    resultat: "reussi",
    contexte,
    dimensions: {},
    source: { kind: "exercice", ref },
  } as SkillObservation;
}

/* ------------------------------------------------------------------ */

describe("construireCatalogueSituation", () => {
  it("garde le premier vu — l'exercice du compte l'emporte sur celui livré", () => {
    const catalogue = construireCatalogueSituation([
      exercice("diag-log-01", "logistique", "probleme"), // recopié en base
      exercice("diag-log-01", "logistique", "calcul"), // version d'origine
    ]);
    expect(catalogue.get("diag-log-01")).toEqual({
      domaine: "logistique",
      type: "probleme",
    });
  });

  it("ignore les identifiants absents plutôt que d'inventer une entrée", () => {
    expect(CATALOGUE.get("inexistant")).toBeUndefined();
  });
});

describe("familleSituation", () => {
  it("dérive la famille du couple domaine / type de l'exercice source", () => {
    const famille = familleSituation(observation("ex-deb-a", "Un titre quelconque"), CATALOGUE);
    expect(famille.derivee).toBe(true);
    expect(famille.cle).toBe("exercice:developpement-logiciel-pour-debutants/probleme");
  });

  it("donne la MÊME clé à deux exercices de même domaine et même type", () => {
    // Le cœur d'ADR-083 : deux titres différents, une seule situation.
    const a = familleSituation(
      observation("diag-log-01", "Quantité économique et point de commande"),
      CATALOGUE,
    );
    const b = familleSituation(
      observation("ex-log-b", "Stock de sécurité sous demande variable"),
      CATALOGUE,
    );
    expect(a.cle).toBe(b.cle);
  });

  it("distingue deux types d'exercice du même domaine", () => {
    const a = familleSituation(observation("ex-deb-a", "T1"), CATALOGUE);
    const b = familleSituation(observation("ex-deb-b", "T2"), CATALOGUE);
    expect(a.cle).not.toBe(b.cle);
  });

  it("se replie sur le libellé quand l'exercice source est introuvable", () => {
    // Les 7 observations `manuel` du compte réel : leur `source.ref` est un fichier
    // de synthèse. On ne leur fabrique pas une famille (précédent ADR-033).
    const famille = familleSituation(
      observation("synthese_profil_competences_2026-07-25.md", "Rappel actif — z-score"),
      CATALOGUE,
    );
    expect(famille.derivee).toBe(false);
    expect(famille.libelle).toBe("Rappel actif — z-score");
  });

  it("normalise la casse et les espaces du repli, sans les confondre avec une famille dérivée", () => {
    const a = familleSituation(observation("absent", "  Analyse D'un Flux  "), CATALOGUE);
    const b = familleSituation(observation("absent", "analyse d'un flux"), CATALOGUE);
    expect(a.cle).toBe(b.cle);
    expect(a.cle.startsWith("libre:")).toBe(true);
  });
});

describe("attacherFamilles", () => {
  it("copie l'observation au lieu de la muter — rien d'ajouté ici ne doit pouvoir être réécrit", () => {
    const origine = observation("ex-deb-a", "T");
    const [enrichie] = attacherFamilles([origine], CATALOGUE);
    expect(origine.familleSituation).toBeUndefined();
    expect(enrichie.familleSituation?.derivee).toBe(true);
  });
});

describe("cleContexte", () => {
  it("retombe sur le libellé quand aucune famille n'a été attachée", () => {
    // Le comportement d'avant ADR-083, conservé pour ce qu'on ne sait pas
    // expliquer — et signalé par `familleIndeterminee`.
    const nue = observation("ex-deb-a", "Un titre");
    expect(cleContexte(nue)).toBe("libre:un titre");
    expect(familleIndeterminee(nue)).toBe(true);
    expect(libelleContexte(nue)).toBe("Un titre");
  });

  it("préfère la famille attachée au libellé", () => {
    const [enrichie] = attacherFamilles([observation("ex-deb-a", "Un titre")], CATALOGUE);
    expect(cleContexte(enrichie)).toBe(
      "exercice:developpement-logiciel-pour-debutants/probleme",
    );
    expect(familleIndeterminee(enrichie)).toBe(false);
  });
});
