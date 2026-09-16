import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Collections } from "./db";
import type { Referentiel } from "@/lib/domain/types";
import type { ApercuDocument } from "@/lib/documents/types-documents";

const m = vi.hoisted(() => ({ donnees: vi.fn(), referentiel: vi.fn(), documents: vi.fn(), journal: vi.fn() }));
vi.mock("./db", () => ({ dorsaleCompte: async () => ({ userId: "qa-compte-vide" }), chargerToutRPC: async () => null, lireTout: m.donnees }));
vi.mock("./referentiel", () => ({ chargerReferentiel: m.referentiel }));
vi.mock("./documents", () => ({ lireApercusDocuments: m.documents, lireApercusSnapshots: async () => [] }));
vi.mock("./journal-moteur", () => ({ journaliserEmission: m.journal }));
vi.mock("./reglages-moteur", async () => {
  const { REGLAGES_PAR_DEFAUT } = await import("@/lib/engine/reglages");
  return { chargerReglagesMoteur: async () => REGLAGES_PAR_DEFAUT };
});

import { chargerContexte } from "./context";
import { chargerActionProposee } from "./adaptive-learning";

beforeEach(() => {
  vi.clearAllMocks();
  const donnees: Collections = {
    user: { id: "qa-compte-vide", prenom: "QA", formation: "", objectifMoyenTerme: "", objectifLongTerme: "", debutSuivi: "2026-09-15", preferencesPedagogiques: [] },
    observations: [], observationRectifications: [], exercises: [], attempts: [], sessions: [], refusRecommandations: [], engagements: [],
  };
  const referentiel: Referentiel = { domaines: [], skills: [], actifs: [], parCode: new Map(), codesActifs: new Set(), domainesParId: new Map() };
  m.donnees.mockResolvedValue(donnees);
  m.referentiel.mockResolvedValue(referentiel);
  m.documents.mockResolvedValue([]);
});

describe("tableau de bord pilote avant la première compétence", () => {
  it("traverse les chargeurs réels sans produire de niveau ni de recommandation inventés", async () => {
    const contexte = await chargerContexte();
    expect(contexte.etats).toEqual([]);
    expect(contexte.observationsEffectives).toEqual([]);
    expect(contexte.recommandations).toEqual([]);
    expect(await chargerActionProposee(contexte, { tempsMin: 25, capacite: "standard" })).toBeNull();
    expect(m.journal).not.toHaveBeenCalled();
  });

  it.each([
    { type: "cours", tempsMin: 25, attendue: false },
    { type: "cours", tempsMin: 30, attendue: true },
    { type: "reference", tempsMin: 25, attendue: true },
  ])("ressource $type sans compétence, créneau $tempsMin minutes : proposition $attendue", async ({ type, tempsMin, attendue }) => {
    const document: ApercuDocument = {
      id: "qa-ressource", titre: "Ressource à découvrir", type, tags: [], schema: "pedagogie/v1", schemaCompatible: true,
      frontMatter: { role: "support", depot_version: 2 }, liens: [], createdAt: "2026-09-15T10:00:00Z", updatedAt: "2026-09-15T10:00:00Z",
    };
    m.documents.mockResolvedValue([document]);
    const contexte = await chargerContexte();
    const proposition = await chargerActionProposee(contexte, { tempsMin, capacite: "standard" });
    if (attendue) {
      expect(proposition?.kind).toBe("note");
      if (proposition?.kind !== "note") throw new Error("La ressource devrait être proposée.");
      expect(proposition.action.target.skillCodes).toEqual([]);
      expect(proposition.facteurs.some((facteur) => facteur.kind === "ressource-documentaire")).toBe(true);
    } else expect(proposition).toBeNull();
    expect(contexte.etats).toEqual([]);
    expect(contexte.observationsEffectives).toEqual([]);
    expect(m.journal).not.toHaveBeenCalled();
  });
});
