import { describe, expect, it } from "vitest";
import type { LearningSession } from "@/lib/domain/types";
import { construireVueSeancesAVenir } from "./seances-a-venir";

function session(overrides: Partial<LearningSession> = {}): LearningSession {
  return {
    id: "ses-1",
    date: "2026-08-28T09:00:00.000Z",
    domaines: ["developpement"],
    skillCodes: ["DEV-01"],
    activites: [],
    genereAutomatiquement: false,
    statut: "planifiee",
    planifieePour: "2026-08-28T09:00:00.000Z",
    dureePlanifieeMin: 30,
    interventions: [{
      id: "int-1",
      type: "resolve",
      label: "Résoudre un cas",
      source: { kind: "exercise", ref: "ex-1" },
      expectedEffect: "measurement",
    }],
    ...overrides,
  };
}

describe("vue Séances — À venir", () => {
  it("produit le même résultat pour la même entrée et n'écrit rien", () => {
    const entree = [session()];
    const premiere = construireVueSeancesAVenir(entree);
    expect(construireVueSeancesAVenir(entree)).toEqual(premiere);
    expect(entree[0].statut).toBe("planifiee");
  });

  it("ne retient que les séances acceptées encore ouvertes", () => {
    const vue = construireVueSeancesAVenir([
      session({ id: "planifiee" }),
      session({ id: "active", statut: "en-cours", planifieePour: "2026-08-28T08:00:00.000Z" }),
      session({ id: "historique", statut: undefined, planifieePour: undefined }),
      session({ id: "terminee", statut: "terminee" }),
      session({ id: "abandonnee", statut: "abandonnee" }),
    ]);

    expect(vue.seances.map((seance) => seance.sessionId)).toEqual(["active", "planifiee"]);
    expect(vue.seances.find((seance) => seance.sessionId === "active")?.statutLabel).toBe("En cours");
  });

  it("ordonne les créneaux dans le temps et les groupe par jour", () => {
    const vue = construireVueSeancesAVenir([
      session({ id: "soir", planifieePour: "2026-08-29T18:00:00.000Z" }),
      session({ id: "matin", planifieePour: "2026-08-28T08:00:00.000Z" }),
      session({ id: "midi", planifieePour: "2026-08-28T12:00:00.000Z" }),
    ]);

    expect(vue.seances.map((seance) => seance.sessionId)).toEqual(["matin", "midi", "soir"]);
    expect(vue.groupes.map((groupe) => groupe.jour)).toEqual(["2026-08-28", "2026-08-29"]);
    expect(vue.groupes[0].seances).toHaveLength(2);
  });

  it("garde les anciennes séances planifiées sans planifieePour lisibles", () => {
    const vue = construireVueSeancesAVenir([session({
      planifieePour: undefined,
      date: "2026-08-30T10:15:00.000Z",
    })]);

    expect(vue.seances[0]).toMatchObject({ jour: "2026-08-30", heure: expect.stringMatching(/:15$/) });
  });

  it("ne fabrique ni intervention, ni domaine, ni effet manquants", () => {
    const vue = construireVueSeancesAVenir([session({
      interventions: undefined,
      domaines: [],
      activites: [{ type: "lecture", ref: "doc-1", libelle: "Lire le support" }],
    })]);
    const ligne = vue.seances[0];

    expect(ligne.intervention).toBeNull();
    expect(ligne.effetAttendu).toBeNull();
    expect(ligne.libelleIntervention).toBe("Lire le support");
    expect(ligne.reservations.join(" ")).toMatch(/intervention|domaine/);
  });

  it("réserve une date invalide au lieu de l'ordonner comme un jour réel", () => {
    const vue = construireVueSeancesAVenir([session({ planifieePour: "date-invalide" })]);
    expect(vue.groupes[0].jour).toBeNull();
    expect(vue.groupes[0].libelle).toBe("Date à préciser");
    expect(vue.reservations.join(" ")).toContain("date");
  });
});
