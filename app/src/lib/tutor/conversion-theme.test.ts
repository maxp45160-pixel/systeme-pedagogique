import { describe, expect, it } from "vitest";
import { convertirTheme } from "./conversion-theme";
import { LIBELLE_THEME_MIN, CODES_PAR_THEME_MAX } from "@/lib/domain/theme";
import type { PropositionTheme } from "./outils";

/*
 * Ce module ne fait qu'une chose : refuser ce qui est hors bornes plutôt que
 * le réparer. `validerTheme` (outils.ts) a déjà garanti que `codes` ne contient
 * que des codes désignés — jamais frappés — donc ces tests portent sur les
 * bornes métier, pas sur la frappe.
 */

const P = (extra: Partial<PropositionTheme> = {}): PropositionTheme => ({
  libelle: "Histoire de l'industrie japonaise",
  codes: ["LOG-01", "TECH-03"],
  justification: "Les deux compétences couvrent le sujet.",
  ...extra,
});

describe("convertirTheme", () => {
  it("convertit une proposition valide", () => {
    const c = convertirTheme(P());
    expect(c.ok).toBe(true);
    if (!c.ok) throw new Error("attendu ok");
    expect(c.valeur.libelle).toBe("Histoire de l'industrie japonaise");
    expect(c.valeur.codes).toEqual(["LOG-01", "TECH-03"]);
    expect(c.valeur.origine).toBe("tuteur");
  });

  it("rejette un libellé hors bornes, sans le tronquer", () => {
    const c = convertirTheme(P({ libelle: "Ab" }));
    expect(c.ok).toBe(false);
  });

  it("accepte un libellé à la borne basse", () => {
    const c = convertirTheme(P({ libelle: "x".repeat(LIBELLE_THEME_MIN) }));
    expect(c.ok).toBe(true);
  });

  it("rejette une proposition sans aucun code désigné — pas le chemin du refus « aucune correspondance »", () => {
    // Ce cas ne devrait jamais atteindre convertirTheme en usage normal :
    // l'appelant détecte codes.length === 0 avant. On vérifie ici que le
    // module refuse plutôt que d'écrire un thème vide si on l'appelle quand
    // même.
    const c = convertirTheme(P({ codes: [] }));
    expect(c.ok).toBe(false);
  });

  it("rejette au-delà du plafond de compétences", () => {
    const codes = Array.from({ length: CODES_PAR_THEME_MAX + 1 }, (_, i) => `DEV-${i}`);
    const c = convertirTheme(P({ codes }));
    expect(c.ok).toBe(false);
  });

  it("déduplique les codes avant conversion", () => {
    const c = convertirTheme(P({ codes: ["LOG-01", "LOG-01", "TECH-03"] }));
    if (!c.ok) throw new Error("attendu ok");
    expect(c.valeur.codes).toEqual(["LOG-01", "TECH-03"]);
  });
});
