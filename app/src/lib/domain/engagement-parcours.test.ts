import { describe, expect, it } from "vitest";
import {
  estOuvert,
  joursRestants,
  libelleCompte,
  triParUrgence,
  validerNouvelEngagement,
  type Engagement,
} from "./engagement";
import { recommander } from "@/lib/engine/recommend";
import { computeAllSkillStates } from "@/lib/engine/skill-state";
import { SKILLS_TEST } from "./referentiel.fixture";

/*
 * Parcours pur de bout en bout — chantier « fait daté / engagements » :
 *
 *   déclaration (validation) → recommandation réordonnée (bonus appliqué)
 *   → lecture carte (« À venir » triée, libellés honnêtes).
 *
 * Aucune base, aucune horloge réelle : tout passe par des entrées explicites,
 * exactement comme le moteur les reçoit en production.
 */

const MAINTENANT = new Date("2026-08-22T12:00:00.000Z");
const iso = (decalageJours: number) => {
  const date = new Date(MAINTENANT);
  date.setUTCDate(date.getUTCDate() + decalageJours);
  return date.toISOString().slice(0, 10);
};

describe("parcours : je déclare un examen, le suivi s'y adapte", () => {
  const CODES_COMPTE = new Set(["DEV-01", "DEV-02", "DEV-03"]);

  it("déclaration valide → la compétence ciblée gagne du score → la carte lit des faits", () => {
    // ── 1. Déclaration ────────────────────────────────────────────────
    // La personne écrit « examen de DEV-01 dans 5 jours ». Le formulaire
    // soumet ; la validation domaine renvoie les champs prêts à écrire.
    const engagement = validerNouvelEngagement(
      { type: "examen", libelle: "Contrôle DEV-01", echeanceLe: iso(5), codes: ["DEV-01"] },
      CODES_COMPTE,
    );
    const enregistre = { id: "eng-parcours", ...engagement };
    expect(estOuvert(enregistre)).toBe(true);

    // ── 2. Recommandation réordonnée ──────────────────────────────────
    // DEV-02 a été travaillée hier, DEV-01 jamais. Sans engagement, DEV-02
    // domine (jamais évaluée + fraîcheur relative). Avec l'examen à J-5,
    // DEV-01 porte le facteur « Proximité d'échéance » — sa valeur monte.
    const observations = [
      {
        id: "obs-dev02",
        skillCode: "DEV-02",
        date: iso(-1),
        type: "exercice",
        niveauObservation: "A",
        autonomie: "A3",
        qualite: "moyenne",
        resultat: "reussi",
        contexte: "Contexte A",
        dimensions: { comprehension: 0.9, application: 0.85 },
        source: { kind: "exercice", ref: "ex-test" },
      },
    ] as const;
    const etats = computeAllSkillStates(SKILLS_TEST, [...observations], MAINTENANT);
    const avant = recommander(etats, [], [], 10, undefined, MAINTENANT);
    const apres = recommander(etats, [], [], 10, undefined, MAINTENANT, undefined, undefined, undefined, [enregistre]);

    const valeurDev01 = (recs: ReturnType<typeof recommander>) =>
      recs.find((r) => r.etat.skill.code === "DEV-01")!.valeur;
    expect(valeurDev01(apres)).toBeGreaterThan(valeurDev01(avant));

    const recDev01 = apres.find((r) => r.etat.skill.code === "DEV-01")!;
    const facteur = recDev01.facteurs.find((f) => f.libelle === "Proximité d'échéance")!;
    expect(facteur.phrase).toContain("Contrôle DEV-01");

    // ── 3. Lecture carte ─────────────────────────────────────────────
    // Trois engagements déclarés : la carte « À venir » trie par urgence et
    // nomme chaque distance sans rien inventer.
    const declares: Engagement[] = [
      enregistre,
      { id: "b", type: "rendu", libelle: "Dossier", echeanceLe: iso(2), codes: [] },
      { id: "c", type: "examen", libelle: "Ancien", echeanceLe: iso(-4), codes: [] },
      { id: "d", type: "examen", libelle: "Clos", echeanceLe: iso(1), codes: [],
        clotureLe: "2026-08-22T09:00:00Z", clotureType: "reporte" },
    ];
    const ouverts = triParUrgence(declares.filter(estOuvert));
    expect(ouverts.map((e) => e.id)).toEqual(["c", "b", "eng-parcours"]);

    const aVenir = ouverts.filter((e) => joursRestants(e.echeanceLe, MAINTENANT) >= 0);
    const passes = ouverts.filter((e) => joursRestants(e.echeanceLe, MAINTENANT) < 0);
    expect(aVenir.map((e) => e.id)).toEqual(["b", "eng-parcours"]);
    expect(passes.map((e) => e.id)).toEqual(["c"]);

    const lignes = aVenir.map(
      (e) => `${e.libelle} — ${libelleCompte(joursRestants(e.echeanceLe, MAINTENANT))}`,
    );
    expect(lignes).toEqual([
      `Dossier — ${libelleCompte(2)}`,
      `Contrôle DEV-01 — ${libelleCompte(5)}`,
    ]);
  });

  it("une déclaration avec un code inconnu est refusée avant toute écriture", () => {
    expect(() =>
      validerNouvelEngagement(
        { type: "examen", libelle: "X", echeanceLe: iso(5), codes: ["ZZ-99"] },
        CODES_COMPTE,
      ),
    ).toThrow(/ZZ-99/);
  });
});
