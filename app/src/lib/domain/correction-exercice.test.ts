import { describe, expect, it } from "vitest";
import {
  DELAI_INTERRUPTION_CORRECTION_MS,
  DELAI_SORTIE_CORRECTION_MS,
  reprendreCorrection,
} from "./correction-exercice";

describe("reprise de correction d'exercice", () => {
  it("conserve les deux délais du parcours", () => {
    expect(DELAI_SORTIE_CORRECTION_MS).toBe(10_000);
    expect(DELAI_INTERRUPTION_CORRECTION_MS).toBe(25_000);
  });

  it("ne relance pas automatiquement une demande en cours après rechargement", () => {
    expect(
      reprendreCorrection({ phase: "en-cours", lanceeLe: Date.now() }),
    ).toEqual({
      phase: "indisponible",
      cause: "rechargement",
      raison:
        "La demande de correction a été interrompue par le rechargement. Elle n'est pas relancée automatiquement.",
    });
  });

  it("retrouve une correction reçue sans nouvel appel", () => {
    const correction = { resultat: "partiel" };
    expect(reprendreCorrection({ phase: "prete", correction })).toEqual({
      phase: "prete",
      correction,
    });
  });

  it("retrouve une expiration et conserve son explication", () => {
    expect(
      reprendreCorrection({
        phase: "indisponible",
        cause: "expiration",
        raison: "La correction a dépassé le délai.",
      }),
    ).toEqual({
      phase: "indisponible",
      cause: "expiration",
      raison: "La correction a dépassé le délai.",
    });
  });

  it("écarte un état de session mal formé", () => {
    expect(reprendreCorrection({ phase: "indisponible", cause: "inconnue", raison: "x" } as never)).toBeNull();
  });
});
