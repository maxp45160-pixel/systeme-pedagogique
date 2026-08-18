/**
 * Ce que ces tests protègent.
 *
 * C'est le seul module d'où un seuil du moteur peut bouger. Il est écrit pour
 * empêcher, et ce sont les empêchements qu'il faut vérifier — un garde-fou qui
 * ne se déclenche jamais ne se remarque pas :
 *
 * - **bouger sans données.** `CLAUDE.md` l'interdit explicitement. Une métrique
 *   sous son seuil rend `valeur: null`, et rien ne doit alors être proposé ;
 * - **sauter au lieu de marcher.** Un seuil qui traverse sa borne d'un coup rend
 *   l'effet du changement inobservable, ce qui ruine le lot 3 ;
 * - **bouger deux paramètres à la fois.** Leurs effets deviendraient
 *   indiscernables ;
 * - **s'emballer.** Sans fenêtre d'observation, deux calculs successifs
 *   pousseraient deux fois dans le même sens sur la même mesure — le défaut
 *   qu'ADR-045 a corrigé pour la difficulté conseillée.
 *
 * Et une garantie de forme : le journal seul doit reconstituer n'importe quel
 * état passé, sans qu'aucune ligne ne soit jamais effacée.
 */

import { describe, expect, it } from "vitest";

import type { MetriqueMoteur } from "./auto-evaluation";
import {
  borner,
  FENETRE_OBSERVATION_JOURS,
  MARGE_RAPIDITE,
  PARAMETRE_PAR_NOM,
  PARAMETRES_REGLABLES,
  proposerAjustements,
  reglagesEffectifs,
  REGLAGES_PAR_DEFAUT,
  type AjustementInscrit,
} from "./reglages";

const MAINTENANT = new Date("2026-09-30T09:00:00.000Z");
const JOUR = 86_400_000;

function ilYa(jours: number): string {
  return new Date(MAINTENANT.getTime() - jours * JOUR).toISOString();
}

let compteur = 0;
function ajustement(options: Partial<AjustementInscrit>): AjustementInscrit {
  return {
    id: `r-${++compteur}`,
    appliqueLe: ilYa(60),
    parametre: "fractionTropFacile",
    valeurAvant: 0.6,
    valeurApres: 0.52,
    metrique: "erreur-duree",
    n: 25,
    valeurMetrique: 0.48,
    motif: "motif",
    ...options,
  };
}

/** Une métrique de durée qui a franchi son seuil. */
function metriqueDuree(ratio: number, n = 25): MetriqueMoteur {
  return {
    nom: "erreur-duree",
    libelle: "Justesse des durées annoncées",
    valeur: ratio,
    unite: "ratio",
    n,
    seuil: 20,
    enAttente: 0,
    reference: 1,
    lecture: "",
    detail: [],
    agregats: { preditMoyen: 30, observeMoyen: 30 * ratio },
  };
}

/** Une métrique de rétention sous ou au-dessus de son seuil. */
function metriqueRetention(options: {
  predit: number;
  observe: number;
  n?: number;
  valeur?: number | null;
}): MetriqueMoteur {
  return {
    nom: "brier-retention",
    libelle: "Justesse de la répétition espacée",
    valeur: options.valeur === undefined ? 0.2 : options.valeur,
    unite: "score",
    n: options.n ?? 35,
    seuil: 30,
    enAttente: 0,
    reference: 0.21,
    lecture: "",
    detail: [],
    agregats: { preditMoyen: options.predit, observeMoyen: options.observe },
  };
}

/* ------------------------------------------------------------------ */

describe("le registre", () => {
  it("ne contient que des paramètres bornés, dont le défaut tient dans sa borne", () => {
    for (const p of PARAMETRES_REGLABLES) {
      expect(p.min).toBeLessThan(p.max);
      expect(p.defaut).toBeGreaterThanOrEqual(p.min);
      expect(p.defaut).toBeLessThanOrEqual(p.max);
      expect(p.pasMaximal).toBeGreaterThan(0);
      expect(p.pasMaximal).toBeLessThanOrEqual(1);
    }
  });

  it("les défauts sont ceux du code, pas des copies", () => {
    // Si quelqu'un change `FRACTION_TROP_FACILE`, le registre doit suivre — une
    // valeur recopiée ici divergerait en silence.
    expect(REGLAGES_PAR_DEFAUT.fractionTropFacile).toBe(
      PARAMETRE_PAR_NOM.get("fractionTropFacile")!.defaut,
    );
  });
});

describe("borner", () => {
  it("ramène dans la borne et arrondit ce qui doit être entier", () => {
    const fraction = PARAMETRE_PAR_NOM.get("fractionTropFacile")!;
    expect(borner(fraction, 0.1)).toBe(0.4);
    expect(borner(fraction, 9)).toBe(0.8);

    const signaux = PARAMETRE_PAR_NOM.get("signauxConcordants")!;
    expect(borner(signaux, 2.4)).toBe(2);
    expect(borner(signaux, 3.6)).toBe(4);
  });
});

describe("reglagesEffectifs — le rejeu", () => {
  it("rend les valeurs livrées sur un journal vide", () => {
    expect(reglagesEffectifs([])).toEqual(REGLAGES_PAR_DEFAUT);
  });

  it("rejoue dans l'ordre chronologique, quel que soit l'ordre reçu", () => {
    const journal = [
      ajustement({ appliqueLe: ilYa(10), valeurApres: 0.45 }),
      ajustement({ appliqueLe: ilYa(50), valeurApres: 0.55 }),
    ];
    expect(reglagesEffectifs(journal).fractionTropFacile).toBe(0.45);
    expect(reglagesEffectifs([...journal].reverse()).fractionTropFacile).toBe(0.45);
  });

  it("reconstitue un état passé en ne rejouant que jusqu'à sa date", () => {
    // C'est ce qui rend le journal suffisant, et l'annulation possible sans
    // qu'aucune ligne ne soit effacée.
    const journal = [
      ajustement({ appliqueLe: ilYa(50), valeurApres: 0.55 }),
      ajustement({ appliqueLe: ilYa(10), valeurApres: 0.45 }),
    ];
    const avant = journal.filter((l) => l.appliqueLe < ilYa(20));
    expect(reglagesEffectifs(avant).fractionTropFacile).toBe(0.55);
  });

  it("ignore une ligne dont le paramètre n'existe plus, sans échouer", () => {
    const journal = [ajustement({ parametre: "parametreRetire" as never })];
    expect(reglagesEffectifs(journal)).toEqual(REGLAGES_PAR_DEFAUT);
  });

  it("reborne une valeur journalisée hors borne", () => {
    const journal = [ajustement({ valeurApres: 99 })];
    expect(reglagesEffectifs(journal).fractionTropFacile).toBe(0.8);
  });
});

describe("proposerAjustements — les empêchements", () => {
  const base = { journal: [] as AjustementInscrit[], maintenant: MAINTENANT };

  it("ne propose RIEN sans métrique", () => {
    expect(proposerAjustements({ ...base, metriques: [] })).toBeNull();
  });

  it("ne propose RIEN quand la métrique est sous son seuil", () => {
    // La garantie que « sans données justifiant le changement » est tenue.
    const sousSeuil: MetriqueMoteur = { ...metriqueDuree(0.48, 7), valeur: null };
    expect(proposerAjustements({ ...base, metriques: [sousSeuil] })).toBeNull();
  });

  it("ne propose RIEN quand la mesure confirme le réglage en place", () => {
    // Ratio 0,75 → cible 0,60, soit exactement la valeur livrée.
    const cible = 0.6 / MARGE_RAPIDITE;
    expect(proposerAjustements({ ...base, metriques: [metriqueDuree(cible)] })).toBeNull();
  });

  it("propose de baisser le seuil quand le moteur surestime les durées", () => {
    // Le cas d'ADR-045 : réel = 0,48 × annoncé.
    const proposition = proposerAjustements({
      ...base,
      metriques: [metriqueDuree(0.48)],
    })!;
    expect(proposition.parametre).toBe("fractionTropFacile");
    expect(proposition.valeurApres).toBeLessThan(proposition.valeurAvant);
    expect(proposition.motif).toContain("0.48");
    expect(proposition.motif).toContain("25 durées");
  });

  it("marche vers la cible, sans jamais y sauter", () => {
    // Cible = 0,2 × 0,8 = 0,16, très en dessous de la borne basse (0,4).
    // Le pas vaut 20 % de (0,8 − 0,4), soit 0,08.
    const proposition = proposerAjustements({
      ...base,
      metriques: [metriqueDuree(0.2)],
    })!;
    expect(proposition.valeurAvant).toBe(0.6);
    expect(proposition.valeurApres).toBeCloseTo(0.52, 5);
  });

  it("ne sort jamais de la borne, même après plusieurs pas", () => {
    let journal: AjustementInscrit[] = [];
    for (let i = 0; i < 10; i++) {
      const proposition = proposerAjustements({
        metriques: [metriqueDuree(0.2)],
        journal,
        // Chaque tour au-delà de la fenêtre d'observation.
        maintenant: new Date(MAINTENANT.getTime() + i * 30 * JOUR),
      });
      if (!proposition) break;
      journal = [
        ...journal,
        ajustement({
          appliqueLe: new Date(MAINTENANT.getTime() + i * 30 * JOUR).toISOString(),
          valeurAvant: proposition.valeurAvant,
          valeurApres: proposition.valeurApres,
        }),
      ];
    }
    const fraction = PARAMETRE_PAR_NOM.get("fractionTropFacile")!;
    expect(reglagesEffectifs(journal).fractionTropFacile).toBeGreaterThanOrEqual(
      fraction.min,
    );
  });

  it("refuse de rebouger un paramètre pendant sa fenêtre d'observation", () => {
    const recent = [ajustement({ appliqueLe: ilYa(FENETRE_OBSERVATION_JOURS - 1) })];
    expect(
      proposerAjustements({ metriques: [metriqueDuree(0.2)], journal: recent, maintenant: MAINTENANT }),
    ).toBeNull();

    const ancien = [ajustement({ appliqueLe: ilYa(FENETRE_OBSERVATION_JOURS + 1) })];
    expect(
      proposerAjustements({ metriques: [metriqueDuree(0.2)], journal: ancien, maintenant: MAINTENANT }),
    ).not.toBeNull();
  });

  it("ne propose QU'UN paramètre à la fois, même quand deux le méritent", () => {
    const proposition = proposerAjustements({
      ...base,
      metriques: [
        metriqueDuree(0.2),
        metriqueRetention({ predit: 0.9, observe: 0.4 }),
      ],
    });
    expect(proposition).not.toBeNull();
    // Une seule proposition, pas un tableau : le type l'impose déjà, et c'est
    // le point — deux réglages bougés ensemble sont indiscernables.
    expect(Array.isArray(proposition)).toBe(false);
  });

  it("resserre les intervalles quand le moteur est trop optimiste sur la rétention", () => {
    const proposition = proposerAjustements({
      ...base,
      metriques: [metriqueRetention({ predit: 0.9, observe: 0.4 })],
    })!;
    expect(proposition.parametre).toBe("amplitudeRobustesse");
    expect(proposition.valeurApres).toBeLessThan(proposition.valeurAvant);
    expect(proposition.motif).toContain("trop longs");
  });

  it("desserre les intervalles quand le moteur est trop pessimiste", () => {
    const proposition = proposerAjustements({
      ...base,
      metriques: [metriqueRetention({ predit: 0.5, observe: 0.95 })],
    })!;
    expect(proposition.parametre).toBe("amplitudeRobustesse");
    expect(proposition.valeurApres).toBeGreaterThan(proposition.valeurAvant);
    expect(proposition.motif).toContain("trop courts");
  });

  it("ne touche JAMAIS un paramètre sans métrique déclenchante", () => {
    // `signauxConcordants` et `bonusActionnable` sont réglables à la main, dans
    // leur borne et au journal, mais aucune mesure ne dit dans quel sens les
    // pousser. On n'invente pas la règle.
    for (const nom of ["signauxConcordants", "bonusActionnable"] as const) {
      expect(PARAMETRE_PAR_NOM.get(nom)!.metrique).toBeNull();
    }
    const propositions = [
      metriqueDuree(0.2),
      metriqueRetention({ predit: 0.9, observe: 0.4 }),
    ].map((m) => proposerAjustements({ ...base, metriques: [m] })?.parametre);
    expect(propositions).not.toContain("signauxConcordants");
    expect(propositions).not.toContain("bonusActionnable");
  });
});
