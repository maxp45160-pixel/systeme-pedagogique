/**
 * Ce que ces tests protègent.
 *
 * Le protocole du référentiel §2 pose depuis l'origine cinq conditions
 * nécessaires pour qu'une compétence entre au référentiel. Rien ne les
 * appliquait : 67 des 115 compétences du compte (58 %) échouent à au moins
 * l'une des quatre règles vérifiables ci-dessous.
 *
 * Deux risques symétriques, et le second est le plus coûteux :
 *
 * - **trop laxiste**, la règle ne se déclenche jamais — c'était le cas de
 *   `INTITULE_MAX = 200`, calibré deux fois au-dessus de la moyenne observée
 *   (97 caractères), dont le message d'erreur disait pourtant déjà « la
 *   compétence est sans doute à découper » ;
 * - **trop stricte ou mal ciblée**, elle refuse des intitulés légitimes, et le
 *   tuteur boucle sans jamais produire de branche acceptable.
 *
 * Les fixtures ne sont pas inventées : ce sont les intitulés réels du compte,
 * relus en base le 18/08/2026.
 */

import { describe, expect, it } from "vitest";

import {
  composerIntitule,
  INTITULE_MAX_ATOMIQUE,
  motifsNonAtomique,
  motifsRefusStructure,
  OBJET_MAX,
  PRECISION_MAX,
  VERBES_ACTION,
  VERBES_NON_OBSERVABLES,
} from "./atomicite";

/** Les intitulés réels du compte, au 18/08/2026. */
const LOG_01 =
  "Modéliser et résoudre un problème de gestion de stock à demande déterministe ou variable (quantité économique, point de commande, stock de sécurité) et évaluer l'impact des paramètres choisis.";
const LOG_10 =
  "Lire, interpréter et analyser un schéma de flux logistique (nœuds, arcs, stocks, délais) pour identifier les goulots d'étranglement, les points de risque et proposer des améliorations.";
const DEV_06 =
  "Tracer le trajet complet d'une donnée dans une architecture client → serveur → base, en identifiant la frontière exacte entre les deux mondes";

function regles(intitule: string): string[] {
  return motifsNonAtomique(intitule).map((m) => m.regle);
}

/* ------------------------------------------------------------------ */

describe("motifsNonAtomique — sur les intitulés réels du compte", () => {
  it("attrape les trois défauts de LOG-01, la compétence la mieux mesurée", () => {
    // Cinq preuves, un seul niveau affiché, cinq savoir-faire dedans.
    expect(regles(LOG_01).sort()).toEqual(
      ["deux-verbes", "enumeration", "longueur"].sort(),
    );
  });

  it("attrape LOG-10, trois verbes en tête de phrase", () => {
    expect(regles(LOG_10)).toContain("deux-verbes");
    expect(regles(LOG_10)).toContain("enumeration");
  });

  it("laisse passer un intitulé long mais mono-verbe et sans énumération", () => {
    // DEV-06 fait 141 caractères : il tombe sur la longueur, et sur elle seule.
    expect(regles(DEV_06)).toEqual(["longueur"]);
  });

  it("accepte un intitulé atomique", () => {
    expect(motifsNonAtomique("Calculer un stock de sécurité sous demande variable")).toEqual([]);
  });
});

describe("règle de longueur", () => {
  it("accepte exactement la borne et refuse un caractère de plus", () => {
    const juste = "a".repeat(INTITULE_MAX_ATOMIQUE);
    expect(regles(juste)).toEqual([]);
    expect(regles(juste + "a")).toEqual(["longueur"]);
  });

  it("ignore les espaces de bord", () => {
    expect(regles(`  ${"a".repeat(INTITULE_MAX_ATOMIQUE)}  `)).toEqual([]);
  });
});

describe("règle des deux verbes", () => {
  it("refuse « et » comme « ou » devant un verbe d'action", () => {
    expect(regles("Modéliser et résoudre un flux")).toContain("deux-verbes");
    expect(regles("Modéliser ou résoudre un flux")).toContain("deux-verbes");
  });

  it("ne se déclenche PAS sur un nom qui ressemble à un infinitif", () => {
    // Le piège d'une règle « tout mot en -er / -re / -oir » : « ordre »,
    // « devoir », « hiver » se termineraient comme des infinitifs. La liste
    // fermée n'en attrape aucun.
    for (const intitule of [
      "Identifier un ordre de fabrication",
      "Calculer un besoin et un délai",
      "Décrire le pouvoir d'un acteur",
      "Analyser un plan de production et de distribution",
    ]) {
      expect(regles(intitule)).not.toContain("deux-verbes");
    }
  });

  it("ne se déclenche pas sur le verbe de tête seul", () => {
    expect(regles("Analyser un réseau logistique")).toEqual([]);
  });
});

describe("règle de l'énumération", () => {
  it("refuse une parenthèse de trois éléments ou plus", () => {
    expect(regles("Calculer un paramètre (a, b, c)")).toContain("enumeration");
  });

  it("accepte une parenthèse de deux éléments — souvent une vraie précision", () => {
    expect(regles("Formuler un programme linéaire (variables, contraintes)")).toEqual([]);
  });

  it("ne confond pas deux parenthèses successives avec une énumération", () => {
    expect(regles("Analyser un flux (amont) puis un autre (aval)")).toEqual([]);
  });
});

describe("règle du verbe non observable", () => {
  it("refuse ce que le protocole §2a donne en contre-exemple", () => {
    // Trois compétences du compte commencent par « Comprendre ». Ce sont
    // exactement celles qu'aucun exercice ne peut démontrer.
    expect(regles("Comprendre les principes de la logistique")).toContain(
      "verbe-non-observable",
    );
    expect(regles("Maîtriser le calcul des besoins")).toContain("verbe-non-observable");
  });

  it("ne se déclenche que sur le PREMIER mot", () => {
    // « … pour comprendre … » décrit une finalité, pas le savoir-faire mesuré.
    expect(regles("Analyser un flux pour comprendre un goulot")).not.toContain(
      "verbe-non-observable",
    );
  });

  it("n'a aucun verbe en commun avec la liste des verbes d'action", () => {
    const action = new Set<string>(VERBES_ACTION);
    for (const verbe of VERBES_NON_OBSERVABLES) {
      expect(action.has(verbe)).toBe(false);
    }
  });
});

describe("composerIntitule — la phrase est écrite par l'application", () => {
  it("met la majuscule et assemble verbe, objet et précision", () => {
    expect(
      composerIntitule({
        verbeAction: "calculer",
        objet: "un stock de sécurité",
        precision: "demande variable",
      }),
    ).toBe("Calculer un stock de sécurité (demande variable)");
  });

  it("omet la parenthèse quand il n'y a pas de précision", () => {
    expect(composerIntitule({ verbeAction: "analyser", objet: "un réseau logistique" })).toBe(
      "Analyser un réseau logistique",
    );
  });

  it("produit un intitulé qui passe ses propres règles, même au pire cas", () => {
    /*
     * La garantie de bout en bout, et elle a failli manquer.
     *
     * Avec des bornes posées à la main (objet 60, précision 40), le schéma
     * d'outil autorisait un intitulé de 96 caractères que le validateur
     * refusait : le tuteur pouvait remplir des champs valides et se faire
     * rejeter, donc boucler indéfiniment. `OBJET_MAX` est désormais DÉRIVÉ de
     * `INTITULE_MAX_ATOMIQUE`, et ce test tient l'accord.
     *
     * Pire cas : le verbe le plus long de la liste fermée, objet plein,
     * précision pleine.
     */
    const verbeLePlusLong = [...VERBES_ACTION].sort((a, b) => b.length - a.length)[0];
    const intitule = composerIntitule({
      verbeAction: verbeLePlusLong,
      objet: "a".repeat(OBJET_MAX),
      precision: "b".repeat(PRECISION_MAX),
    });
    expect(intitule.length).toBe(INTITULE_MAX_ATOMIQUE);
    expect(motifsNonAtomique(intitule)).toEqual([]);
  });
});

describe("motifsRefusStructure", () => {
  it("refuse un verbe hors de la liste fermée", () => {
    expect(
      motifsRefusStructure({ verbeAction: "comprendre", objet: "un flux" }),
    ).toHaveLength(1);
  });

  it("refuse un objet vide ou trop long", () => {
    expect(motifsRefusStructure({ verbeAction: "analyser", objet: "  " })).toHaveLength(1);
    expect(
      motifsRefusStructure({ verbeAction: "analyser", objet: "a".repeat(OBJET_MAX + 1) }),
    ).toHaveLength(1);
  });

  it("accepte une proposition bien formée", () => {
    expect(
      motifsRefusStructure({ verbeAction: "calculer", objet: "un stock de sécurité" }),
    ).toEqual([]);
  });
});
