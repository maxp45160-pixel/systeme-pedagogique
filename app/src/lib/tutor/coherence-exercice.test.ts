import { describe, expect, it } from "vitest";

import {
  construirePromptCoherenceExercice,
  construirePromptReparationCorrectionExercice,
  controlerCoherenceExercice,
  reparerCorrectionExercice,
} from "./coherence-exercice";
import {
  OUTIL_COHERENCE_EXERCICE,
  OUTIL_REPARATION_CORRECTION_EXERCICE,
} from "./outils";
import type { DemandeTuteur, MoteurTuteur } from "./moteurs";

const EXERCICE = {
  titre: "Analyser un incident",
  enonce: "Les défauts apparaissent uniquement la nuit. Les machines sont les mêmes le jour et la nuit.",
  correction: "La cause est nécessairement la fatigue des opérateurs.",
};

function moteurDeControle(
  resultat: { coherent: boolean; motifs: string[] } | null,
): MoteurTuteur {
  return {
    async repondre({ envoyer, outils }: DemandeTuteur) {
      if (!outils?.some((outil) => outil.nom === OUTIL_COHERENCE_EXERCICE)) return;
      if (resultat) {
        envoyer("proposition", { genre: "coherence-exercice", coherence: resultat });
      }
    },
  } as unknown as MoteurTuteur;
}

function moteurDeReparation(correction: string | null): MoteurTuteur {
  return {
    async repondre({ envoyer, outils }: DemandeTuteur) {
      if (!outils?.some((outil) => outil.nom === OUTIL_REPARATION_CORRECTION_EXERCICE)) return;
      if (correction) {
        envoyer("proposition", {
          genre: "reparation-correction-exercice",
          correction: { correction },
        });
      }
    },
  } as unknown as MoteurTuteur;
}

describe("contrôle de cohérence d'un exercice", () => {
  it("rappelle que les causes non données doivent rester des hypothèses", () => {
    const prompt = construirePromptCoherenceExercice(EXERCICE);
    expect(prompt.stable).toContain("Une corrélation observée ne prouve pas une causalité");
    expect(prompt.stable).toContain("En cas de doute, rends coherent=false");
    expect(prompt.variable).toContain("La cause est nécessairement la fatigue");
  });

  it("prépare une réparation silencieuse limitée à la correction", () => {
    const prompt = construirePromptReparationCorrectionExercice(EXERCICE);
    expect(prompt.stable).toContain("Réparez uniquement la correction");
    expect(prompt.stable).toContain("ne modifiez ni le titre ni l'énoncé");
    expect(prompt.variable).toContain(EXERCICE.enonce);
    expect(prompt.variable).toContain(EXERCICE.correction);
  });

  it("accepte une correction étayée", async () => {
    await expect(
      controlerCoherenceExercice(
        moteurDeControle({ coherent: true, motifs: [] }),
        EXERCICE,
      ),
    ).resolves.toEqual({ ok: true, motifs: [], erreur: null });
  });

  it("signale une correction qui affirme une cause absente", async () => {
    await expect(
      controlerCoherenceExercice(
        moteurDeControle({ coherent: false, motifs: ["La fatigue n'est pas donnée dans l'énoncé."] }),
        EXERCICE,
      ),
    ).resolves.toEqual({
      ok: false,
      motifs: ["La fatigue n'est pas donnée dans l'énoncé."],
      erreur: null,
    });
  });

  it("refuse de valider en l'absence de résultat structuré", async () => {
    const resultat = await controlerCoherenceExercice(moteurDeControle(null), EXERCICE);
    expect(resultat.ok).toBe(false);
    expect(resultat.erreur).toContain("n'a pas produit de résultat exploitable");
  });

  it("récupère la correction réparée sans diffuser de message", async () => {
    await expect(
      reparerCorrectionExercice(moteurDeReparation("La correction étayée."), EXERCICE),
    ).resolves.toBe("La correction étayée.");
  });
});
