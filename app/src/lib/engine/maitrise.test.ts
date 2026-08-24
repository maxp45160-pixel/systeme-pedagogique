/**
 * Ce que ces tests protègent.
 *
 * La maîtrise est le premier prédicat du système à décider qu'une compétence
 * **sort** du cycle d'acquisition. Deux risques symétriques, et le second est
 * le plus grave :
 *
 * - trop strict, il ne se déclenche jamais et la fonctionnalité est morte à la
 *   naissance — c'est ce qui serait arrivé avec un seuil à 5 (voir le module) ;
 * - trop laxiste, il déclare « sue » une compétence dont la dernière observation a
 *   six mois, ou qui porte une observation contradictoire. Ce serait P4 renversé :
 *   une faiblesse disparaîtrait sans démonstration.
 *
 * Les fixtures ne sont pas inventées. Elles reproduisent les observations réelles de
 * `DEB-01` et `RO-01` lues en base le 07/08/2026 — les deux seules compétences
 * du compte qui atteignent le niveau 4. C'est la méthode d'ADR-028 : un seuil
 * calé sur des observations tient, un seuil calé sur une intuition se déplace
 * au premier désaccord.
 */

import { describe, expect, it } from "vitest";

import { computeSkillState } from "./skill-state";
import { estMaitrisee, evaluerMaitrise, evaluerMaitrises, NIVEAU_MAITRISE } from "./maitrise";
import { franchissementsMaitriseCourants } from "./historique";
import type { Dimension, Skill, SkillObservation } from "@/lib/domain/types";

const MAINTENANT = new Date("2026-08-07T12:00:00.000Z");
const JOUR = 86_400_000;

function ilYa(jours: number): string {
  return new Date(MAINTENANT.getTime() - jours * JOUR).toISOString();
}

const DEB_01 = {
  code: "DEB-01",
  intitule: "Organiser une séquence d'actions sous contrainte",
  domaine: "debutant",
  palier: "fondamentaux",
  prerequis: [],
  importance: 0.6,
} as unknown as Skill;

let compteur = 0;

function observation(options: {
  jours?: number;
  autonomie?: SkillObservation["autonomie"];
  resultat?: SkillObservation["resultat"];
  contexte?: string;
  dims?: Partial<Record<Dimension, number>>;
}): SkillObservation {
  return {
    id: `obs-${++compteur}`,
    skillCode: "DEB-01",
    date: ilYa(options.jours ?? 1),
    type: "exercice",
    niveauObservation: "A",
    autonomie: options.autonomie ?? "A3",
    qualite: "moyenne",
    resultat: options.resultat ?? "reussi",
    contexte: options.contexte ?? "Contexte A",
    // Les valeurs réelles de DEB-01 : les quatre dimensions à 1.
    dimensions: options.dims ?? {
      comprehension: 1,
      application: 1,
      transfert: 1,
      justification: 1,
    },
    source: { kind: "exercice", ref: "ex-test" },
  } as SkillObservation;
}

/** Les deux observations réelles de DEB-01, au 07/08/2026. */
function observationsReellesDeb01(): SkillObservation[] {
  return [
    observation({
      jours: 4,
      contexte: "Organiser une rotation de champions dans une partie de League of Legends",
    }),
    observation({ jours: 1, contexte: "Organiser une quête dans le Royaume d'Eldoria" }),
  ];
}

function etat(observations: SkillObservation[], now = MAINTENANT) {
  return computeSkillState(DEB_01, observations, now);
}

/* ------------------------------------------------------------------ */

describe("estMaitrisee — le prédicat", () => {
  it("ne déclare jamais maîtrisée une compétence sans observation", () => {
    // L'absence de mesure n'est pas une maîtrise, comme elle n'est pas un zéro (P2).
    const e = etat([]);
    expect(e.niveau).toBeNull();
    expect(estMaitrisee(e)).toBe(false);
  });

  it("déclare maîtrisées les observations réelles de DEB-01", () => {
    /*
     * Le test qui justifie l'existence du module. Deux réussites autonomes A3
     * avec transfert 1 sur deux contextes distincts — le niveau 4 est atteint,
     * la confiance est « moyenne » (2 observations, 2 contextes). Si ce cas ne
     * passait pas, le prédicat ne se déclencherait sur AUCUNE donnée réelle du
     * compte, et la fonctionnalité serait morte à la naissance.
     */
    const e = etat(observationsReellesDeb01());
    expect(e.niveau).toBe(4);
    expect(e.confiance).toBe("moyenne");
    expect(estMaitrisee(e)).toBe(true);
  });

  it("ne déclare pas maîtrisée une compétence à un seul contexte", () => {
    // Un contexte unique ne peut donner ni le niveau 4 ni une confiance
    // ≥ moyenne : la clause de confiance l'absorbe sans qu'on l'écrive.
    const e = etat([
      observation({ jours: 4, contexte: "Même contexte" }),
      observation({ jours: 1, contexte: "Même contexte" }),
    ]);
    expect(estMaitrisee(e)).toBe(false);
  });

  it("ne déclare pas maîtrisée une compétence portant une observation contradictoire", () => {
    /*
     * P4 : une faiblesse ne disparaît pas sans démonstration. La contradiction
     * fait chuter l'échelon de confiance, pas le niveau — et c'est la clause de
     * confiance du prédicat qui en tire la conséquence, gratuitement.
     */
    const e = etat([
      ...observationsReellesDeb01(),
      observation({
        jours: 0,
        resultat: "echec",
        contexte: "Troisième contexte",
        dims: { comprehension: 0, application: 0 },
      }),
    ]);
    expect(e.contradictions.length).toBeGreaterThan(0);
    expect(e.confiance).toBe("faible");
    expect(estMaitrisee(e)).toBe(false);
  });

  it("ne déclare pas maîtrisée une compétence dont la dernière observation a plus de 120 jours", () => {
    // La péremption est gratuite : `calculerConfiance` abaisse déjà l'échelon.
    const e = etat([
      observation({ jours: 400, contexte: "Contexte A" }),
      observation({ jours: 300, contexte: "Contexte B" }),
    ]);
    expect(e.niveau).toBe(4);
    expect(e.confiance).toBe("faible");
    expect(estMaitrisee(e)).toBe(false);
  });

  it("traite le seuil comme un plancher, pas comme une égalité", () => {
    // Une compétence de niveau 5 est maîtrisée elle aussi. Écrire `=== 4`
    // aurait « démaîtrisé » une compétence en progressant.
    const e = etat(observationsReellesDeb01());
    expect(e.niveau).toBeGreaterThanOrEqual(NIVEAU_MAITRISE);
    expect(estMaitrisee({ ...e, niveau: 5 })).toBe(true);
  });
});

describe("franchissementsMaitriseCourants — le déclencheur dérivé", () => {
  it("date l'observation qui fait réellement franchir la maîtrise", () => {
    const observations = observationsReellesDeb01();
    expect(
      franchissementsMaitriseCourants(observations, new Map([[DEB_01.code, DEB_01]]), MAINTENANT),
    ).toEqual([
      { code: "DEB-01", intitule: DEB_01.intitule, franchiLe: observations[1].date },
    ]);
  });

  it("retire le déclencheur après une observation contradictoire", () => {
    const observations = [
      ...observationsReellesDeb01(),
      observation({ jours: 0, resultat: "echec", contexte: "Régression", dims: { comprehension: 0 } }),
    ];
    expect(
      franchissementsMaitriseCourants(observations, new Map([[DEB_01.code, DEB_01]]), MAINTENANT),
    ).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */

describe("evaluerMaitrise — ce qui est dit", () => {
  it("nomme ce qui manque plutôt que de dire « niveau insuffisant »", () => {
    const m = evaluerMaitrise(etat([observation({ jours: 1 })]));
    expect(m.maitrisee).toBe(false);
    expect(m.manque).not.toBeNull();
    expect(m.manque).toContain("deux contextes distincts");
  });

  it("dit qu'aucune observation n'a été apportée, sans parler de niveau", () => {
    // « Niveau 0 insuffisant » serait exact et faux d'esprit : il n'y a pas de
    // niveau 0, il y a une absence de mesure.
    const m = evaluerMaitrise(etat([]));
    expect(m.manque).toContain("Aucune observation directe");
  });

  it("distingue une confiance retombée d'un niveau non atteint", () => {
    const m = evaluerMaitrise(
      etat([
        observation({ jours: 400, contexte: "Contexte A" }),
        observation({ jours: 300, contexte: "Contexte B" }),
      ]),
    );
    expect(m.manque).toContain("est atteint");
    expect(m.manque).toContain("jours");
  });

  it("n'introduit aucun seuil qui lui soit propre", () => {
    /*
     * L'argument central du module au regard de CLAUDE.md §8. L'explication ne
     * doit citer que des valeurs déjà dérivées — niveau, confiance, contextes,
     * observations. Le seul nombre qu'elle nomme est `NIVEAU_MAITRISE`, qui n'est
     * pas un seuil de mesure mais le nom d'un palier existant.
     */
    const m = evaluerMaitrise(etat(observationsReellesDeb01()));
    const texte = [m.explication.resume, ...m.explication.facteurs.map((f) => `${f.valeur}`)].join(" ");
    const nombres = texte.match(/\d+(?:[.,]\d+)?/g) ?? [];
    const attendus = new Set(["4", "2", "1", String(NIVEAU_MAITRISE)]);
    for (const n of nombres) {
      expect(attendus.has(n), `nombre inattendu dans l'explication : ${n}`).toBe(true);
    }
  });

  it("cite la contradiction dans les facteurs quand il y en a une", () => {
    const m = evaluerMaitrise(
      etat([
        ...observationsReellesDeb01(),
        observation({ jours: 0, resultat: "echec", contexte: "C", dims: { comprehension: 0 } }),
      ]),
    );
    const libelles = m.explication.facteurs.map((f) => f.libelle);
    expect(libelles).toContain("Observations contradictoires");
  });
});

describe("evaluerMaitrises", () => {
  it("indexe par code", () => {
    const m = evaluerMaitrises([etat(observationsReellesDeb01())]);
    expect(m.get("DEB-01")?.maitrisee).toBe(true);
  });
});
