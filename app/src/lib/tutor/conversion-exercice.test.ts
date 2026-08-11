import { describe, expect, it } from "vitest";

import {
  convertirProposition,
  versDifficulte,
  versDimension,
  versDuree,
  versIntention,
  versType,
} from "./conversion-exercice";
import {
  DIFFICULTE_MAX,
  DIFFICULTE_MIN,
  DUREE_ESTIMEE_MAX,
  DUREE_ESTIMEE_MIN,
} from "@/lib/domain/exercice";
import type { PropositionExercice } from "./proposition";

/** Une proposition entièrement valide — chaque test n'en dégrade qu'un champ. */
function proposition(surcharge: Partial<PropositionExercice> = {}): PropositionExercice {
  return {
    titre: "Analyser un flux logistique",
    domaine: "logistique",
    type: "probleme",
    difficulte: "3",
    competences: ["LOG-10"],
    dureeEstimeeMin: "30",
    enonce: "Voici un schéma de flux…",
    indices: ["Regarde les files d'attente."],
    correction: "Le goulot est au poste 3.",
    criteres: [{ dimension: "application", libelle: "Identifie le goulot" }],
    ...surcharge,
  };
}

describe("versDifficulte", () => {
  it("accepte les entiers de 1 à 5", () => {
    expect(versDifficulte("1")).toBe(1);
    expect(versDifficulte(" 5 ")).toBe(5);
  });

  /*
   * Le cœur d'ADR-034. `Number("abc") || 2` valait 2 : un nombre que personne
   * n'a mesuré, écrit sans le dire. Ici, l'illisible ne produit rien.
   */
  it("refuse ce qui n'est pas lisible, au lieu de retomber sur un défaut", () => {
    expect(versDifficulte("abc")).toBeNull();
    expect(versDifficulte("")).toBeNull();
  });

  it("refuse les valeurs hors bornes au lieu de les borner", () => {
    expect(versDifficulte("0")).toBeNull();
    expect(versDifficulte("9")).toBeNull();
    expect(versDifficulte("-2")).toBeNull();
  });
});

describe("versDuree", () => {
  it("accepte une durée positive plausible", () => {
    expect(versDuree("30")).toBe(30);
  });

  /*
   * `tentativeMenee` divise la durée réelle par la durée estimée. Une durée
   * nulle la fait retomber sur « toute tentative a eu lieu » : le garde-fou
   * d'ADR-030 est désarmé au lieu d'être déclenché.
   */
  it("refuse zéro, le négatif et l'aberrant", () => {
    expect(versDuree("0")).toBeNull();
    expect(versDuree("-10")).toBeNull();
    expect(versDuree(String(DUREE_ESTIMEE_MAX + 1))).toBeNull();
    expect(versDuree("bientôt")).toBeNull();
  });

  /*
   * Les trois couches doivent refuser la MÊME chose (ADR-045).
   *
   * Le schéma de `proposer_exercice` bornait à 240, la conversion à 480, et
   * `creerExercice` ne bornait rien : ce qui entrait en base pouvait dépasser
   * ce que le tuteur avait le droit de proposer, et cette durée devenait
   * l'unité de mesure de `tentativeMenee`. Les bornes vivent désormais dans
   * `lib/domain/exercice.ts`, importées par les trois.
   */
  it("refuse ce que le schéma de l'outil refuse — mêmes bornes, une seule autorité", () => {
    expect(versDuree(String(DUREE_ESTIMEE_MIN - 1))).toBeNull();
    expect(versDuree(String(DUREE_ESTIMEE_MIN))).toBe(DUREE_ESTIMEE_MIN);
    expect(versDuree(String(DUREE_ESTIMEE_MAX))).toBe(DUREE_ESTIMEE_MAX);
    expect(versDuree(String(DUREE_ESTIMEE_MAX + 1))).toBeNull();

    expect(versDifficulte(String(DIFFICULTE_MIN - 1))).toBeNull();
    expect(versDifficulte(String(DIFFICULTE_MIN))).toBe(DIFFICULTE_MIN);
    expect(versDifficulte(String(DIFFICULTE_MAX))).toBe(DIFFICULTE_MAX);
    expect(versDifficulte(String(DIFFICULTE_MAX + 1))).toBeNull();
  });
});

describe("versType et versDimension", () => {
  it("acceptent les valeurs du domaine, accents et casse compris", () => {
    expect(versType("Probleme")).toBe("probleme");
    expect(versType("étude de cas")).toBe("etude-de-cas");
    expect(versDimension("Compréhension")).toBe("comprehension");
  });

  it("refusent ce qui n'appartient pas au domaine", () => {
    expect(versType("quiz")).toBeNull();
    expect(versDimension("créativité")).toBeNull();
  });
});

describe("versIntention", () => {
  it("accepte les quatre valeurs, insensible à la casse et aux accents", () => {
    expect(versIntention("decouverte")).toBe("decouverte");
    expect(versIntention("Consolidation")).toBe("consolidation");
    expect(versIntention("transfert")).toBe("transfert");
    expect(versIntention("Révision")).toBe("revision");
  });

  it("rend undefined pour une valeur absente — ce n'est pas une erreur", () => {
    expect(versIntention("")).toBeUndefined();
    expect(versIntention("   ")).toBeUndefined();
  });

  it("rend null, jamais une valeur déduite, pour une valeur hors liste", () => {
    expect(versIntention("motivation")).toBeNull();
  });
});

describe("convertirProposition", () => {
  it("convertit une proposition complète", () => {
    const r = convertirProposition(proposition());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.valeur.difficulte).toBe(3);
    expect(r.valeur.dureeEstimeeMin).toBe(30);
    expect(r.valeur.type).toBe("probleme");
    expect(r.valeur.criteres).toEqual([
      { dimension: "application", libelle: "Identifie le goulot" },
    ]);
  });

  it("refuse une difficulté illisible plutôt que d'en fabriquer une", () => {
    const r = convertirProposition(proposition({ difficulte: "moyenne" }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erreurs.join(" ")).toContain("Difficulté illisible");
  });

  it("refuse une durée illisible — c'est elle qui juge qu'une tentative a eu lieu", () => {
    const r = convertirProposition(proposition({ dureeEstimeeMin: "une heure" }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erreurs.join(" ")).toContain("Durée estimée illisible");
  });

  it("collecte toutes les erreurs, pas seulement la première", () => {
    const r = convertirProposition(
      proposition({ difficulte: "?", dureeEstimeeMin: "?", titre: "  " }),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erreurs.length).toBeGreaterThanOrEqual(3);
  });

  it("écarte un critère à dimension inconnue en le signalant, sans rejeter le reste", () => {
    const r = convertirProposition(
      proposition({
        criteres: [
          { dimension: "créativité", libelle: "Trouve une idée" },
          { dimension: "application", libelle: "Identifie le goulot" },
        ],
      }),
    );
    // La dimension inconnue est signalée : la conversion échoue, mais l'erreur
    // nomme le critère en cause plutôt que de le laisser disparaître.
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erreurs.join(" ")).toContain("dimension inconnue");
  });

  it("refuse une proposition sans aucun critère exploitable", () => {
    const r = convertirProposition(
      proposition({ criteres: [{ dimension: "application", libelle: "   " }] }),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erreurs.join(" ")).toContain("Aucun critère exploitable");
  });

  it("nettoie les indices vides sans les compter comme une erreur", () => {
    const r = convertirProposition(proposition({ indices: ["Un indice", "   ", ""] }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.valeur.indices).toEqual(["Un indice"]);
  });

  it("passe l'intention quand elle est renseignée", () => {
    const r = convertirProposition(proposition({ intention: "consolidation" }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.valeur.intention).toBe("consolidation");
  });

  it("n'écrit aucune intention par défaut — absence, pas une valeur fabriquée", () => {
    const r = convertirProposition(proposition());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.valeur.intention).toBeUndefined();
  });

  it("refuse une intention hors liste plutôt que de l'ignorer", () => {
    const r = convertirProposition(proposition({ intention: "motivation" }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erreurs.join(" ")).toContain("Intention illisible");
  });
});
