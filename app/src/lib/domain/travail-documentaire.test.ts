import { describe, expect, it } from "vitest";
import { INTERVENTION_TYPES } from "./intervention-seance";
import {
  composerSeanceTravailDocumentaire,
  correspondAuTravailDocumentaire,
  LIBELLES_GESTES_TRAVAIL_DOCUMENTAIRE,
  validerEntreeTravailDocumentaire,
} from "./travail-documentaire";

const entree = {
  documentIds: ["depot-a", "depot-b"],
  geste: "synthesize" as const,
  note: "  J’ai travaillé ces deux textes.  ",
  cle: "00000000-0000-4000-8000-000000000001",
};

describe("travail documentaire déclaré", () => {
  it("garde le geste explicite, la note verbatim et les ressources sans produire de mesure", () => {
    const validee = validerEntreeTravailDocumentaire(entree);
    const seance = composerSeanceTravailDocumentaire("ses-travail-doc-a", "2026-09-24T15:42:00.000Z", validee, [
      { id: "depot-a", titre: "Cours de logique" },
      { id: "depot-b", titre: "Mes notes" },
    ]);

    expect(seance).toMatchObject({
      date: "2026-09-24T15:42:00.000Z",
      notePersonnelle: entree.note,
      statut: "terminee",
      domaines: [],
      skillCodes: [],
      activites: [],
      genereAutomatiquement: false,
    });
    expect(seance.dureeMin).toBeUndefined();
    expect(seance.interventions).toEqual([
      { id: "ses-travail-doc-a-1", type: "synthesize", label: "Synthétiser « Cours de logique »", source: { kind: "document", ref: "depot-a" }, expectedEffect: "preparation", statut: "completed" },
      { id: "ses-travail-doc-a-2", type: "synthesize", label: "Synthétiser « Mes notes »", source: { kind: "document", ref: "depot-b" }, expectedEffect: "preparation", statut: "completed" },
    ]);
    expect(correspondAuTravailDocumentaire(seance, validee)).toBe(true);
    expect(Object.keys(LIBELLES_GESTES_TRAVAIL_DOCUMENTAIRE).sort()).toEqual([...INTERVENTION_TYPES].sort());
  });

  it("refuse un geste vague, un doublon et une sélection trop grande", () => {
    expect(() => validerEntreeTravailDocumentaire({ ...entree, geste: "travailler" })).toThrow("geste");
    expect(() => validerEntreeTravailDocumentaire({ ...entree, documentIds: ["depot-a", "depot-a"] })).toThrow("distinctes");
    expect(() => validerEntreeTravailDocumentaire({ ...entree, documentIds: Array.from({ length: 31 }, (_, index) => `depot-${index}`) })).toThrow("30");
    expect(() => validerEntreeTravailDocumentaire({ ...entree, cle: "pas-uuid" })).toThrow("Clé");
  });

  it("détecte le rejeu d'une clé avec une autre déclaration", () => {
    const validee = validerEntreeTravailDocumentaire(entree);
    const seance = composerSeanceTravailDocumentaire("ses-travail-doc-a", "2026-09-24T15:42:00.000Z", validee, [
      { id: "depot-a", titre: "Cours" }, { id: "depot-b", titre: "Notes" },
    ]);
    expect(correspondAuTravailDocumentaire(seance, { ...validee, geste: "read" })).toBe(false);
    expect(correspondAuTravailDocumentaire(seance, { ...validee, documentIds: [...validee.documentIds].reverse() })).toBe(false);
    expect(correspondAuTravailDocumentaire(seance, { ...validee, note: "Autre note" })).toBe(false);
    seance.interventions![0].proofContract = { skillCodes: ["LOG-01"], protocolRef: "x", requiredArtifact: "x" };
    expect(correspondAuTravailDocumentaire(seance, validee)).toBe(false);
  });
});
