import { describe, expect, it } from "vitest";
import { construireContexte, fautChargerSyntheseEvaluation } from "./contexte";
import { SKILLS_ACTIFS } from "@/lib/domain/referentiel";
import { computeAllSkillStates } from "@/lib/engine/skill-state";
import { calculerEtatGlobal } from "@/lib/engine/progression";
import { recommander } from "@/lib/engine/recommend";
import type { Contexte } from "@/lib/store/context";

/*
 * ADR-021 : le protocole d'évaluation complet (§12-17 — score macro,
 * robustesse, synthèse périodique, priorisation, format de bilan) n'est
 * chargé que sur signal de synthèse probable, pour économiser des tokens sur
 * les moteurs à petite fenêtre de contexte. §1-11 restent toujours chargés
 * (non couverts ici, chargés inconditionnellement dans `construireContexte`).
 *
 * Deux déclencheurs indépendants : un mot-clé dans le dernier message, ou une
 * cadence de secours qui revient périodiquement même sans mot-clé reconnu —
 * pour qu'une formulation imprévue ne prive jamais durablement le tuteur du
 * protocole complet.
 */

describe("fautChargerSyntheseEvaluation", () => {
  it("ne charge pas le protocole complet sur un message ordinaire", () => {
    expect(fautChargerSyntheseEvaluation("Peux-tu m'expliquer la récursivité ?", 1)).toBe(false);
    expect(fautChargerSyntheseEvaluation("J'ai une erreur dans mon code, aide-moi", 3)).toBe(false);
  });

  it("charge le protocole complet sur un mot-clé de synthèse", () => {
    expect(fautChargerSyntheseEvaluation("Tu peux me faire un bilan ?", 2)).toBe(true);
    expect(fautChargerSyntheseEvaluation("Où j'en suis sur DEV-03 ?", 2)).toBe(true);
    expect(fautChargerSyntheseEvaluation("Quelle est ma prochaine priorité ?", 2)).toBe(true);
  });

  it("ignore la casse et les accents du mot-clé", () => {
    expect(fautChargerSyntheseEvaluation("BILAN stp", 2)).toBe(true);
    expect(fautChargerSyntheseEvaluation("un petit RÉSUMÉ ?", 2)).toBe(true);
  });

  it("revient au protocole complet par cadence, même sans mot-clé", () => {
    expect(fautChargerSyntheseEvaluation("continue", 5)).toBe(true);
    expect(fautChargerSyntheseEvaluation("continue", 10)).toBe(true);
    expect(fautChargerSyntheseEvaluation("continue", 4)).toBe(false);
    expect(fautChargerSyntheseEvaluation("continue", 6)).toBe(false);
  });

  it("ne déclenche pas la cadence au tour zéro", () => {
    expect(fautChargerSyntheseEvaluation("bonjour", 0)).toBe(false);
  });
});

function construireCtxDeTest(): Contexte {
  const now = new Date("2026-07-29T10:00:00.000Z");
  const etats = computeAllSkillStates(SKILLS_ACTIFS, [], now);
  const global = calculerEtatGlobal(etats, now);
  const recommandations = recommander(etats, [], [], 5);
  return {
    donnees: {
      user: {
        id: "test",
        prenom: "Test",
        formation: "BUT QLIO",
        objectifMoyenTerme: "Master ITI",
        objectifLongTerme: "Chercheur",
        debutSuivi: now.toISOString(),
      },
      evidence: [],
      exercises: [],
      attempts: [],
      sessions: [],
    },
    etats,
    etatsParCode: new Map(etats.map((e) => [e.skill.code, e])),
    global,
    recommandations,
    now,
  };
}

/*
 * Vérifie le comportement bout en bout de `construireContexte` (jamais
 * exercé avant ADR-021) : sans historique transmis, le protocole complet est
 * chargé par prudence ; avec un historique, l'heuristique décide, et le
 * manifeste — la seule garantie de transparence envers l'utilisateur sur ce
 * que le tuteur a réellement reçu — le reflète fidèlement.
 */
describe("construireContexte — chargement conditionnel (ADR-021)", () => {
  it("charge le protocole complet par défaut, sans historique (GET, copier le contexte)", async () => {
    const pedagogique = await construireContexte(construireCtxDeTest());
    const noms = pedagogique.manifeste.map((s) => s.nom);
    expect(noms).toContain("Protocole d'évaluation (essentiel)");
    expect(noms).toContain("Protocole d'évaluation (complet)");
  });

  it("n'ajoute pas le protocole complet sur un message ordinaire", async () => {
    const pedagogique = await construireContexte(construireCtxDeTest(), [
      { role: "user", content: "Peux-tu corriger cet exercice ?" },
    ]);
    const noms = pedagogique.manifeste.map((s) => s.nom);
    expect(noms).toContain("Protocole d'évaluation (essentiel)");
    expect(noms).not.toContain("Protocole d'évaluation (complet)");
  });

  it("ajoute le protocole complet sur une demande de bilan", async () => {
    const pedagogique = await construireContexte(construireCtxDeTest(), [
      { role: "user", content: "Fais-moi un bilan de ma progression" },
    ]);
    const noms = pedagogique.manifeste.map((s) => s.nom);
    expect(noms).toContain("Protocole d'évaluation (complet)");
  });
});
