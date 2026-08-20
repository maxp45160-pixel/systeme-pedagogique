import { describe, expect, it } from "vitest";
import type { Exercise, ExerciseAttempt } from "@/lib/domain/types";
import { analyserDocumentMarkdown } from "./markdown";
import { construireDocumentProductionPreuve, memeProductionHorsHorodatage } from "./production";

const exercice: Exercise = {
  id: "exo-transport",
  titre: "Optimiser un flux de transport",
  domaine: "logistique",
  type: "etude-de-cas",
  difficulte: 3,
  competences: ["LOG-01", "LOG-04"],
  dureeEstimeeMin: 30,
  enonce: "Analyse le flux et propose une amélioration.",
  indices: [],
  correction: "",
  criteres: [{ dimension: "application", libelle: "Une solution est proposée" }],
  origine: "manuel",
};

const tentative: ExerciseAttempt = {
  id: "att-transport",
  exerciseId: exercice.id,
  debut: "2026-08-12T09:00:00.000Z",
  fin: "2026-08-12T09:24:00.000Z",
  dureeMin: 24,
  indicesUtilises: 0,
  reponse: "J'ai commencé par cartographier les étapes.\n\nLa contrainte principale est le délai.",
  evaluation: { application: 1 },
  resultat: "reussi",
  statut: "terminee",
  notes: "À reprendre avec des données réelles.",
};

describe("document de production devenu preuve", () => {
  it("conserve la production, le support et les compétences sans copier la mesure", () => {
    const production = construireDocumentProductionPreuve(
      exercice,
      tentative,
      "2026-08-12T09:24:00.000Z",
    );
    const document = analyserDocumentMarkdown(production.id, production.contenuMd);

    expect(production.id).toBe("preuve-att-transport");
    expect(document.type).toBe("preuve");
    expect(document.frontMatter.source_attempt).toBe("att-transport");
    expect(document.frontMatter.competencies).toEqual(["LOG-01", "LOG-04"]);
    expect(document.liens.map((lien) => lien.cible)).toEqual([
      "LOG-01",
      "LOG-04",
      "exercice:exo-transport",
    ]);
    expect(document.corps).toContain(tentative.reponse);
    expect(document.corps).toContain(tentative.notes ?? "");
    expect(document.contenuMd).not.toContain("application: 1");
    expect(document.contenuMd).not.toContain("resultat: reussi");
  });

  it("réutilise une capture rejouée seulement si le contenu hors date est identique", () => {
    const premier = "created_at: 2026-08-20T10:00:00Z\nproduced_at: 2026-08-20T10:00:00Z\nRéponse A";
    const rejeu = "created_at: 2026-08-20T10:01:00Z\nproduced_at: 2026-08-20T10:01:00Z\nRéponse A";
    const different = "created_at: 2026-08-20T10:01:00Z\nproduced_at: 2026-08-20T10:01:00Z\nRéponse B";

    expect(memeProductionHorsHorodatage(premier, rejeu)).toBe(true);
    expect(memeProductionHorsHorodatage(premier, different)).toBe(false);
  });
});

