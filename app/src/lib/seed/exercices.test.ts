/**
 * Ce que ces tests protègent.
 *
 * `tableDureesEstimees` est la seule source d'estimation pour le plafond de
 * `dureeRetenue` (ADR-071). Le défaut qu'elle corrige était invisible : les
 * diagnostics ne vivent pas en base, la liste d'exercices du contexte est
 * filtrée par périmètre, et une tentative abandonnée sur un diagnostic sorti du
 * référentiel se retrouvait donc plafonnée à 240 min au lieu de son estimation.
 * Trois des cinq tentatives à durée aberrante corrigées le 15/08/2026 étaient
 * exactement dans ce cas.
 */

import { describe, expect, it } from "vitest";

import { EXERCICES_DIAGNOSTIC, tableDureesEstimees } from "./exercises";
import { dureeRetenue } from "@/lib/domain/tentative";
import { DUREE_ESTIMEE_MAX } from "@/lib/domain/exercice";

describe("tableDureesEstimees", () => {
  it("couvre tous les diagnostics, sans qu'aucun ne soit en base", () => {
    const table = tableDureesEstimees([]);
    for (const exercice of EXERCICES_DIAGNOSTIC) {
      expect(table.get(exercice.id)).toBe(exercice.dureeEstimeeMin);
    }
  });

  it("couvre les exercices stockés", () => {
    const table = tableDureesEstimees([{ id: "ex-1", dureeEstimeeMin: 45 }]);
    expect(table.get("ex-1")).toBe(45);
  });

  it("laisse la base l'emporter sur le seed pour un même identifiant", () => {
    // Un diagnostic recopié en base porte l'estimation que le compte lui
    // connaît, pas celle du seed.
    const table = tableDureesEstimees([{ id: "diag-dev-02", dureeEstimeeMin: 99 }]);
    expect(table.get("diag-dev-02")).toBe(99);
  });

  it("donne à un abandon sur diagnostic son vrai plafond, pas le garde-fou", () => {
    /*
     * `att-msnh82t2-l8ls6` portait 3065 min sur `diag-dev-02`, estimé 15 min.
     * Sans cette table, l'exercice était introuvable et le plafond retombait à
     * `DUREE_ESTIMEE_MAX` — 240 min de travail affichées pour un abandon.
     */
    const estimee = tableDureesEstimees([]).get("diag-dev-02");
    expect(estimee).toBe(15);
    const retenue = dureeRetenue({ statut: "abandonnee", dureeMin: 3065 }, estimee);
    expect(retenue).toBe(15);
    expect(retenue).not.toBe(DUREE_ESTIMEE_MAX);
  });
});
