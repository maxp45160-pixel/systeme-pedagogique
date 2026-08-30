import { describe, expect, it } from "vitest";
import type { LearningSession } from "@/lib/domain/types";
import { construireSeancesDuJour } from "./seances-du-jour";

function session(overrides: Partial<LearningSession> = {}): LearningSession {
  return {
    id: "ses-1",
    date: "2026-08-30T09:00:00.000Z",
    domaines: ["developpement"],
    skillCodes: ["DEV-01"],
    activites: [],
    genereAutomatiquement: false,
    statut: "planifiee",
    planifieePour: "2026-08-30T09:00:00.000Z",
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

describe("construireSeancesDuJour", () => {
  it("retient aujourd'hui, exclut la veille et le lendemain", () => {
    const vue = construireSeancesDuJour([
      session({ id: "veille", planifieePour: "2026-08-29T09:00:00.000Z" }),
      session({ id: "aujourdhui", planifieePour: "2026-08-30T09:00:00.000Z" }),
      session({ id: "lendemain", planifieePour: "2026-08-31T09:00:00.000Z" }),
    ], "2026-08-30");

    expect(vue.enCours).toHaveLength(0);
    expect(vue.planifiees.map((seance) => seance.sessionId)).toEqual(["aujourdhui"]);
  });

  it("garde une séance en cours commencée un jour précédent", () => {
    const vue = construireSeancesDuJour([
      session({
        id: "ancienne-active",
        statut: "en-cours",
        date: "2026-08-29T22:00:00.000Z",
        planifieePour: "2026-08-29T20:00:00.000Z",
      }),
    ], "2026-08-30");

    expect(vue.enCours.map((seance) => seance.sessionId)).toEqual(["ancienne-active"]);
  });

  it("exclut les séances terminées, abandonnées et historiques sans statut", () => {
    const vue = construireSeancesDuJour([
      session({ id: "terminee", statut: "terminee" }),
      session({ id: "abandonnee", statut: "abandonnee" }),
      session({ id: "historique", statut: undefined, planifieePour: undefined }),
    ], "2026-08-30");

    expect(vue).toEqual({ enCours: [], planifiees: [] });
  });

  it("ordonne les séances en cours puis les horaires et les identifiants", () => {
    const vue = construireSeancesDuJour([
      session({ id: "zulu", planifieePour: "2026-08-30T10:00:00.000Z" }),
      session({ id: "alpha", planifieePour: "2026-08-30T10:00:00.000Z" }),
      session({
        id: "active",
        statut: "en-cours",
        date: "2026-08-29T18:00:00.000Z",
        planifieePour: "2026-08-29T18:00:00.000Z",
      }),
      session({ id: "matin", planifieePour: "2026-08-30T08:00:00.000Z" }),
    ], "2026-08-30");

    expect(vue.enCours.map((seance) => seance.sessionId)).toEqual(["active"]);
    expect(vue.planifiees.map((seance) => seance.sessionId)).toEqual([
      "matin",
      "alpha",
      "zulu",
    ]);
  });

  it("utilise le champ date pour une ancienne planifiée sans planifieePour", () => {
    const vue = construireSeancesDuJour([
      session({
        planifieePour: undefined,
        date: "2026-08-30T11:15:00.000Z",
      }),
    ], "2026-08-30");

    expect(vue.planifiees[0]).toMatchObject({
      sessionId: "ses-1",
      heure: expect.stringMatching(/:15$/),
    });
  });

  it("réserve les dates invalides sans les rattacher à un jour", () => {
    const entree = [session({ id: "invalide", planifieePour: "pas-une-date" })];
    const vue = construireSeancesDuJour(entree, "2026-08-30");

    expect(vue.planifiees).toEqual([]);
    expect(construireSeancesDuJour(entree, "jour-invalide").planifiees).toEqual([]);
    expect(entree[0].planifieePour).toBe("pas-une-date");
  });

  it("ne mute pas les séances et reste déterministe", () => {
    const entree = [session({ id: "b" }), session({ id: "a" })];
    const avant = structuredClone(entree);
    const premiere = construireSeancesDuJour(entree, "2026-08-30");

    expect(construireSeancesDuJour(entree, "2026-08-30")).toEqual(premiere);
    expect(entree).toEqual(avant);
  });
});
