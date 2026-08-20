/**
 * Ce que ces tests protègent.
 *
 * Cette conversion est la dernière barrière avant qu'un verdict du tuteur ne
 * remplisse le formulaire qui écrit une observation. Le défaut qu'elle doit rendre
 * impossible a un nom et une date : le 02/08/2026, une valeur venue de la
 * dorsale a été rabattue sur un nombre plausible, et deux compétences se sont
 * vu conseiller la difficulté 5 sur la foi d'un partiel obtenu à difficulté 1
 * (ADR-034). Aucun test ne pouvait le voir : ils passaient tous des valeurs
 * déjà typées.
 *
 * Ici le défaut évident serait de rabattre sur `0`. Or `0` n'est pas neutre :
 * c'est la mesure « non démontré ». D'où le cas central ci-dessous.
 */

import { describe, expect, it } from "vitest";

import { convertirCorrection, versAppreciation, versResultat } from "./conversion-correction";
import type { PropositionCorrection } from "./outils";

const BILAN: PropositionCorrection["bilan"] = {
  pointsForts: "La méthode est posée.",
  pointsBloquants: "Le seuil n'est pas justifié, donc le résultat n'est pas défendable.",
  aRetravailler: ["Justifier un seuil avant de l'employer"],
};

function correction(
  appreciations: PropositionCorrection["appreciations"],
  resultat = "partiel",
): PropositionCorrection {
  return { resultat, appreciations, bilan: BILAN };
}

/* ------------------------------------------------------------------ */
/* Les lecteurs                                                        */
/* ------------------------------------------------------------------ */

describe("versAppreciation", () => {
  it("lit les trois positions de l'échelle", () => {
    expect(versAppreciation("0")).toBe(0);
    expect(versAppreciation("0.5")).toBe(0.5);
    expect(versAppreciation("1")).toBe(1);
  });

  it("lit la virgule décimale — un modèle francophone écrit « 0,5 »", () => {
    expect(versAppreciation("0,5")).toBe(0.5);
  });

  it("refuse 0.75 : l'échelle n'a que trois positions", () => {
    // Arrondir choisirait à la place du tuteur ET de l'utilisateur.
    expect(versAppreciation("0.75")).toBeNull();
  });

  it("refuse une valeur illisible plutôt que de la ramener à 0", () => {
    /*
     * Le cas central. `0` est la mesure « non démontré » : le fabriquer à
     * partir de « oui » ou de « bien » écrirait un jugement négatif que
     * personne n'a porté, et rien à l'écran ne le distinguerait d'un vrai.
     */
    expect(versAppreciation("oui")).toBeNull();
    expect(versAppreciation("")).toBeNull();
    expect(versAppreciation("bien")).toBeNull();
  });
});

describe("versResultat", () => {
  it("lit les trois résultats", () => {
    expect(versResultat("reussi")).toBe("reussi");
    expect(versResultat(" PARTIEL ")).toBe("partiel");
    expect(versResultat("echec")).toBe("echec");
  });

  it("refuse un résultat hors des trois valeurs", () => {
    expect(versResultat("excellent")).toBeNull();
    expect(versResultat("réussi")).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* La conversion                                                       */
/* ------------------------------------------------------------------ */

describe("convertirCorrection", () => {
  it("accepte un verdict complet", () => {
    const r = convertirCorrection(
      correction([
        { critere: "1", valeur: "1", justification: "La formule est là." },
        { critere: "2", valeur: "0.5", justification: "Le seuil n'est pas justifié." },
      ]),
      2,
    );
    if (!r.ok) throw new Error(r.erreurs.join(" · "));
    expect(r.valeur.resultat).toBe("partiel");
    expect(r.valeur.appreciations).toEqual({ 0: 1, 1: 0.5 });
    expect(r.valeur.justifications).toEqual({
      0: "La formule est là.",
      1: "Le seuil n'est pas justifié.",
    });
  });

  it("rend les index en base 0 alors que le tuteur numérote en base 1", () => {
    // `exercice.criteres` est un tableau : le critère « 1 » du prompt est
    // l'index 0 du formulaire. La bascule vit ici et nulle part ailleurs.
    const r = convertirCorrection(correction([{ critere: "1", valeur: "1", justification: "x" }]), 1);
    if (!r.ok) throw new Error("conversion refusée");
    expect(Object.keys(r.valeur.appreciations)).toEqual(["0"]);
  });

  it("refuse quand un critère n'est pas couvert", () => {
    /*
     * Une correction partielle ne se distingue pas d'une correction complète
     * une fois affichée : le bouton « Accepter » écrirait une observation dont les
     * dimensions manquent. C'est le demi-exercice d'ADR-031, au bilan.
     */
    const r = convertirCorrection(correction([{ critere: "1", valeur: "1", justification: "x" }]), 3);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erreurs.join(" ")).toContain("2, 3");
  });

  it("refuse un numéro de critère hors de la liste", () => {
    const r = convertirCorrection(
      correction([
        { critere: "1", valeur: "1", justification: "x" },
        { critere: "7", valeur: "1", justification: "y" },
      ]),
      1,
    );
    expect(r.ok).toBe(false);
  });

  it("refuse deux appréciations pour le même critère", () => {
    // Laquelle serait la bonne ? En garder une serait choisir au hasard.
    const r = convertirCorrection(
      correction([
        { critere: "1", valeur: "1", justification: "x" },
        { critere: "1", valeur: "0", justification: "y" },
      ]),
      1,
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erreurs.join(" ")).toContain("deux fois");
  });

  it("refuse une valeur illisible plutôt que de la ramener à 0", () => {
    const r = convertirCorrection(correction([{ critere: "1", valeur: "oui", justification: "x" }]), 1);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erreurs.join(" ")).toContain("trois positions");
  });

  it("collecte toutes les erreurs, pas seulement la première", () => {
    // L'utilisateur — ou le journal — doit voir d'un coup ce qui cloche.
    const r = convertirCorrection(
      correction([{ critere: "9", valeur: "oui", justification: "x" }], "excellent"),
      2,
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erreurs.length).toBeGreaterThanOrEqual(2);
  });

  it("refuse un exercice sans critère plutôt que de rendre un bilan vide", () => {
    const r = convertirCorrection(correction([]), 1);
    expect(r.ok).toBe(false);
  });

  it("gère de manière défensive un objet de correction mal formé sans lever d'exception", () => {
    const r1 = convertirCorrection(null as unknown as PropositionCorrection, 1);
    expect(r1.ok).toBe(false);

    const r2 = convertirCorrection({
      resultat: "reussi",
      appreciations: null as unknown as { critere: string; valeur: string; justification: string }[],
      bilan: null as unknown as { pointsForts: string; pointsBloquants: string; aRetravailler: string[] },
    } as unknown as PropositionCorrection, 1);
    expect(r2.ok).toBe(false);
  });
});

