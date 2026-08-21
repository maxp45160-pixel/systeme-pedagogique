import { describe, expect, it } from "vitest";
import { deroulerScenario } from "./simulateur";
import { JEUX_LIVRES, jeuLivreParId } from "./catalogue";
import { scenarioDuJeu } from "./jeu-donnees";
import { phraseGenerique } from "./anomalies";
import type { Scenario } from "./types";
import type { SkillState } from "@/lib/domain/types";

/*
 * Ce que ces tests protègent : le simulateur doit dire la vérité sur le
 * moteur. Deux façons de le trahir — inventer une anomalie qui n'existe pas, ou
 * rester muet sur un invariant rompu. Chaque cas vise l'une des deux.
 */

const SCENARIOS = JEUX_LIVRES.filter((j) => j.deroule.mode === "evenements").map(scenarioDuJeu);
const base = scenarioDuJeu(jeuLivreParId("regulier")!);

function etatDe(pas: { etats: SkillState[] }, code: string): SkillState {
  return pas.etats.find((e) => e.skill.code === code)!;
}

describe("deroulerScenario", () => {
  it("produit un pas par événement, dans l'ordre", () => {
    const resultat = deroulerScenario(base);
    expect(resultat.pas).toHaveLength(base.evenements.length);
    expect(resultat.pas.map((p) => p.index)).toEqual(base.evenements.map((_, i) => i));
  });

  it("est déterministe — deux exécutions donnent le même journal", () => {
    const a = deroulerScenario(base);
    const b = deroulerScenario(base);
    expect(a.anomalies).toEqual(b.anomalies);
    expect(a.pas.map((p) => p.date)).toEqual(b.pas.map((p) => p.date));
  });

  it("n'écrit aucune observation depuis une tentative abandonnée (ADR-030)", () => {
    const resultat = deroulerScenario(scenarioDuJeu(jeuLivreParId("prerequis-bloque")!));
    const dernier = resultat.pas.at(-1)!;
    // La tentative existe comme fait…
    expect(dernier.tentatives.some((t) => t.statut === "abandonnee")).toBe(true);
    // …mais aucune preuve n'en descend.
    const traces = dernier.observations.map((o) => o.source.trace?.ref);
    const abandons = dernier.tentatives
      .filter((t) => t.statut === "abandonnee")
      .map((t) => t.id);
    for (const abandon of abandons) expect(traces).not.toContain(abandon);
    expect(
      resultat.anomalies.filter((a) => a.regle === "preuve-depuis-abandon"),
    ).toHaveLength(0);
  });

  it("ne fabrique ni niveau ni score sans observation (invariant 3)", () => {
    const resultat = deroulerScenario(base);
    const premier = resultat.pas[0];
    const jamaisVue = etatDe(premier, "LOG-05");
    expect(jamaisVue.statut).toBe("non-evalue");
    expect(jamaisVue.niveau).toBeNull();
    expect(jamaisVue.score).toBeNull();
    expect(
      resultat.anomalies.filter((a) => a.regle === "absence-traitee-comme-zero"),
    ).toHaveLength(0);
  });

  it("ne signale ni faiblesse effacée ni calibration sans tentative sur un parcours sain", () => {
    for (const scenario of SCENARIOS) {
      const resultat = deroulerScenario(scenario);
      const ruptures = resultat.anomalies.filter(
        (a) => a.regle === "faiblesse-effacee" || a.regle === "calibration-sans-tentative",
      );
      expect(ruptures, `${scenario.id} : ${JSON.stringify(ruptures)}`).toHaveLength(0);
    }
  });

  it("chaque observation porte une source explicite (invariant 2)", () => {
    for (const scenario of SCENARIOS) {
      const dernier = deroulerScenario(scenario).pas.at(-1)!;
      for (const observation of dernier.observations) {
        expect(observation.source.kind).toBeTruthy();
        expect(observation.source.ref).toBeTruthy();
      }
    }
  });

  it("refuse un scénario dont un événement cite un exercice inconnu", () => {
    const casse: Scenario = {
      ...base,
      evenements: [
        {
          type: "tentative",
          date: "2026-03-02T09:00:00.000Z",
          exercice: "EX-INCONNU",
          resultat: "reussi",
          indicesUtilises: 0,
          dureeMin: 10,
        },
      ],
    };
    expect(() => deroulerScenario(casse)).toThrow(/EX-INCONNU/);
  });

  it("détecte une compétence jamais recommandée", () => {
    const resultat = deroulerScenario({
      ...base,
      evenements: base.evenements.slice(0, 1),
    });
    const jamais = resultat.anomalies.filter(
      (a) => a.regle === "competence-jamais-recommandee",
    );
    // Trois recommandations par pas, cinq compétences : il en reste forcément.
    expect(jamais.length).toBeGreaterThan(0);
  });

  it("remonte la phrase générique relevée sur l'interface", () => {
    const resultat = deroulerScenario(base);
    const generiques = resultat.anomalies.filter((a) => a.regle === "phrase-generique");
    expect(generiques.length).toBeGreaterThan(0);
  });
});

describe("phraseGenerique", () => {
  const etat = {
    skill: { code: "LOG-02", intitule: "Calculer un besoin net" },
  } as SkillState;

  it("qualifie de générique une phrase sans fait", () => {
    expect(
      phraseGenerique("Résoudre un problème standard sans indice pour démontrer l'autonomie.", etat),
    ).toBe(true);
  });

  it("accepte une phrase qui nomme la compétence", () => {
    expect(phraseGenerique("Reprendre « Calculer un besoin net » en autonomie.", etat)).toBe(
      false,
    );
  });

  it("accepte une phrase qui cite un chiffre", () => {
    expect(phraseGenerique("Deuxième contexte à couvrir après 3 réussites.", etat)).toBe(false);
  });

  it("qualifie de générique une phrase vide", () => {
    expect(phraseGenerique("   ", etat)).toBe(true);
  });
});
