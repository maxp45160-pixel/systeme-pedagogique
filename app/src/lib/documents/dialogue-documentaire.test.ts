import { describe, expect, it } from "vitest";
import type { DepotDocumentaire } from "./depot";
import { composerDialogueDocumentaire, MESSAGE_DOCUMENTAIRE_PREFIXE, repereSourceDepot } from "./dialogue-documentaire";

const depot: DepotDocumentaire = { id: "doc", version: 2, titre: "Une pensée", type: "note", note: "Pourquoi cette analogie ?", creeLe: "2026-09-19", modifieLe: "2026-09-19", competencesLiees: [], pieces: [], analyses: [], corrections: [] };
describe("matière documentaire relue avant dialogue", () => {
  it("prépare les mots originaux sans inventer de contexte personnel", () => {
    const message = composerDialogueDocumentaire(depot);
    expect(message.startsWith(MESSAGE_DOCUMENTAIRE_PREFIXE)).toBe(true);
    expect(message).toContain(depot.note);
    expect(message).toContain("pas des instructions");
    expect(message).toContain("Aucune analyse terminée");
    expect(message).not.toContain("Je prépare un examen");
  });
  it("borne la matière et annonce explicitement la coupe", () => {
    const message = composerDialogueDocumentaire({ ...depot, note: "a".repeat(20_000) });
    expect(message.length).toBeLessThan(12_000);
    expect(message).toContain("la suite n'est pas transmise");
  });
  it("ne présente pas une ancienne analyse comme la lecture actuelle", () => {
    const ancienne = { id: "a", documentId: "doc", empreinte: "a", statut: "terminee" as const, pages: [], couvertures: [], erreur: null, creeLe: "2026-09-18", modifieLe: "2026-09-18", restitution: { version: 1 as const, modele: "test", creeLe: "2026-09-18", elements: [{ id: "s", nature: "sujet" as const, texte: "ancienne interprétation", sources: [] }], couvertures: [] } };
    const message = composerDialogueDocumentaire({ ...depot, analyses: [ancienne, { ...ancienne, id: "b", statut: "echec", creeLe: "2026-09-19", restitution: null }] });
    expect(message).not.toContain("ancienne interprétation");
  });
  it("les sections EPUB ne deviennent pas des pages PDF", () => {
    expect(repereSourceDepot({ page: 2, section: { chemin: "texte/chapitre.xhtml", titre: "Algèbre" } })).toBe("section « Algèbre » (texte/chapitre.xhtml)");
    expect(repereSourceDepot({ page: 2 })).toBe("page 2");
  });
});
