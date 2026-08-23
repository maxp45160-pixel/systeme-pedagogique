import { describe, expect, it } from "vitest";
import {
  creerRepere,
  insererRepere,
  LONGUEUR_REPERE_MAX,
  retirerRepere,
  reperesValides,
  texteValide,
} from "./reperes-corpus";

/*
 * Ce que ces tests protègent : un repère est une NOTE. Aucun texte invalide
 * n'en fabrique un, aucune liste stockée douteuse ne se répare en silence, et
 * la structure reste celle d'une déclaration datée — rien qui ressemble à une
 * mesure ou à un état de complétion.
 */

describe("texteValide — ce qui a le droit d'être un repère", () => {
  it("rogne les espaces et retient un texte réel", () => {
    expect(texteValide("  Chapitre 1 … fait  ")).toBe("Chapitre 1 … fait");
  });

  it("refuse vide, non-texte et surdimensionné plutôt que de fabriquer", () => {
    expect(texteValide("   ")).toBeNull();
    expect(texteValide("")).toBeNull();
    expect(texteValide(42)).toBeNull();
    expect(texteValide(null)).toBeNull();
    expect(texteValide("a".repeat(LONGUEUR_REPERE_MAX + 1))).toBeNull();
    expect(texteValide("a".repeat(LONGUEUR_REPERE_MAX))).toBe(
      "a".repeat(LONGUEUR_REPERE_MAX),
    );
  });
});

describe("creerRepere / insererRepere / retirerRepere", () => {
  it("crée un repère daté, ou rien si le texte ne vaut pas", () => {
    const valide = creerRepere("r1", "Chapitre 2 relu", "2026-08-20T10:00:00.000Z");
    expect(valide).toEqual({ id: "r1", texte: "Chapitre 2 relu", creeLe: "2026-08-20T10:00:00.000Z" });

    expect(creerRepere("r2", "   ", "2026-08-20T10:00:00.000Z")).toBeNull();
  });

  it("insère en tête : la saisie la plus récente se lit en premier", () => {
    const premier = creerRepere("r1", "Chapitre 1 fait", "2026-08-19T09:00:00.000Z")!;
    const second = creerRepere("r2", "Chapitre 2 commencé", "2026-08-20T09:00:00.000Z")!;

    const liste = insererRepere(insererRepere([], premier), second);
    expect(liste.map((repere) => repere.id)).toEqual(["r2", "r1"]);
  });

  it("retire par identifiant sans toucher au reste", () => {
    const liste = [
      creerRepere("r1", "un", "2026-08-19T09:00:00.000Z")!,
      creerRepere("r2", "deux", "2026-08-20T09:00:00.000Z")!,
    ];
    expect(retirerRepere(liste, "r1").map((repere) => repere.id)).toEqual(["r2"]);
    // Retirer un id absent rend la liste intacte.
    expect(retirerRepere(liste, "absent")).toHaveLength(2);
  });
});

describe("reperesValides — assainissement de la liste stockée", () => {
  it("écarte ce qui n'est pas un repère complet, sans le réparer", () => {
    expect(reperesValides([
      { id: "r1", texte: "Chapitre 1 fait", creeLe: "2026-08-19T09:00:00.000Z" },
      { id: "", texte: "sans identifiant", creeLe: "2026-08-19T09:00:00.000Z" },
      { id: "r3", texte: "   ", creeLe: "2026-08-19T09:00:00.000Z" },
      { id: "r4", texte: "date illisible", creeLe: "pas-une-date" },
      "pas un objet",
      null,
    ])).toEqual([
      { id: "r1", texte: "Chapitre 1 fait", creeLe: "2026-08-19T09:00:00.000Z" },
    ]);
  });

  it("rend une liste vide sur du JSON inattendu", () => {
    expect(reperesValides(undefined)).toEqual([]);
    expect(reperesValides({})).toEqual([]);
    expect(reperesValides("texte")).toEqual([]);
  });
});
