import { describe, expect, it } from "vitest";
import {
  SOURCE_DISPONIBILITE_PROFIL,
  normaliserDisponibilitesDeclarees,
  normaliserPeriodeDeclaree,
  progressionContexte,
} from "./contexte-orchestration";

describe("contexte d'orchestration progressif", () => {
  it("commence par la période quand aucun fait n'est confirmé", () => {
    expect(progressionContexte({
      nombreEcheancesOuvertes: 0,
    })).toMatchObject({ prochaineEtape: "periode", termine: false });
  });

  it("normalise une disponibilité avec une source explicite", () => {
    expect(normaliserDisponibilitesDeclarees([
      { startsAt: "2026-08-28T09:00:00.000Z", endsAt: "2026-08-28T10:00:00.000Z" },
    ])).toEqual([
      {
        startsAt: "2026-08-28T09:00:00.000Z",
        endsAt: "2026-08-28T10:00:00.000Z",
        sourceRef: SOURCE_DISPONIBILITE_PROFIL,
      },
    ]);
  });

  it("refuse une fenêtre inversée et une période vide", () => {
    expect(() => normaliserDisponibilitesDeclarees([
      { startsAt: "2026-08-28T10:00:00.000Z", endsAt: "2026-08-28T09:00:00.000Z" },
    ])).toThrow(/se terminer après/);
    expect(() => normaliserPeriodeDeclaree("  ")).toThrow(/non vide/);
  });

  it("reprend à la première étape encore inconnue sans redemander les modules", () => {
    expect(progressionContexte({
      periodeDeclaree: "2026-2027",
      disponibilitesDeclarees: [],
      nombreEcheancesOuvertes: 0,
      etapesIgnorees: ["disponibilites"],
    })).toMatchObject({ prochaineEtape: "echeances", termine: false });
  });

  it("ne demande pas une information déjà fiable", () => {
    expect(progressionContexte({
      periodeDeclaree: "2026-2027",
      disponibilitesDeclarees: [{ startsAt: "2026-08-28T09:00:00.000Z", endsAt: "2026-08-28T10:00:00.000Z", sourceRef: "declaree:profil" }],
      nombreEcheancesOuvertes: 1,
    })).toMatchObject({ prochaineEtape: null, termine: true });
  });

  it("laisse l'absence de disponibilité explicite tant que la personne n'a pas confirmé l'étape", () => {
    expect(progressionContexte({
      periodeDeclaree: "2026-2027",
      nombreEcheancesOuvertes: 0,
    })).toMatchObject({ prochaineEtape: "disponibilites", termine: false });
  });
});
