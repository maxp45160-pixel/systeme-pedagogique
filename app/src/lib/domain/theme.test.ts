import { describe, expect, it } from "vitest";
import {
  idTheme,
  motifRefusTheme,
  themeVersThemeSeance,
  themesEnregistres,
  CODES_PAR_THEME_MAX,
  LIBELLE_THEME_MAX,
  LIBELLE_THEME_MIN,
  type Theme,
} from "./theme";
import { REFERENTIEL_TEST, referentielDe, skillDeTest } from "./referentiel.fixture";

/*
 * Le thème (ADR-053) : une portée modulaire, alternative aux domaines.
 *
 * Trois propriétés font tout le raisonnement du chantier :
 *   1. un thème sans code n'a pas de sens ;
 *   2. un code archivé ou disparu est écarté, jamais le thème entier
 *      (même charte que `prerequis` dans `creerBranche`) ;
 *   3. `detail` ne ment jamais sur ce qui reste réellement actif.
 */

const theme = (codes: string[], extra: Partial<Theme> = {}): Theme => ({
  id: "theme-test",
  libelle: "Thème de test",
  codes,
  origine: "utilisateur",
  creeLe: "2026-08-10T09:00:00.000Z",
  archive: false,
  ...extra,
});

describe("motifRefusTheme", () => {
  it("refuse un libellé trop court", () => {
    expect(motifRefusTheme({ libelle: "Ab", codes: ["DEV-01"], origine: "utilisateur" })).toMatch(
      /Libellé hors bornes/,
    );
  });

  it("refuse un libellé trop long", () => {
    const libelle = "x".repeat(LIBELLE_THEME_MAX + 1);
    expect(motifRefusTheme({ libelle, codes: ["DEV-01"], origine: "utilisateur" })).toMatch(
      /Libellé hors bornes/,
    );
  });

  it("accepte un libellé à la borne basse", () => {
    const libelle = "x".repeat(LIBELLE_THEME_MIN);
    expect(motifRefusTheme({ libelle, codes: ["DEV-01"], origine: "utilisateur" })).toBeNull();
  });

  it("refuse un thème sans aucune compétence", () => {
    expect(
      motifRefusTheme({ libelle: "Thème vide", codes: [], origine: "utilisateur" }),
    ).toMatch(/rien à composer/);
  });

  it("refuse au-delà du plafond de compétences", () => {
    const codes = Array.from({ length: CODES_PAR_THEME_MAX + 1 }, (_, i) => `DEV-${i}`);
    expect(
      motifRefusTheme({ libelle: "Trop grand", codes, origine: "utilisateur" }),
    ).toMatch(/Trop de compétences/);
  });

  it("refuse une intention trop longue", () => {
    expect(
      motifRefusTheme({
        libelle: "Intention longue",
        intention: "x".repeat(501),
        codes: ["DEV-01"],
        origine: "utilisateur",
      }),
    ).toMatch(/Intention trop longue/);
  });

  it("accepte sans intention — facultative comme BesoinDeclare.intention", () => {
    expect(
      motifRefusTheme({ libelle: "Sans intention", codes: ["DEV-01"], origine: "utilisateur" }),
    ).toBeNull();
  });
});

describe("idTheme", () => {
  it("dérive un slug du libellé", () => {
    expect(idTheme("Histoire de l'industrie japonaise", new Set())).toBe(
      "histoire-de-l-industrie-japonaise",
    );
  });

  it("résout une collision par suffixe numérique déterministe", () => {
    const pris = new Set(["stoicisme", "stoicisme-2"]);
    expect(idTheme("Stoïcisme", pris)).toBe("stoicisme-3");
  });
});

describe("themeVersThemeSeance — le pont vers composerSeance", () => {
  it("produit une portée 'theme' portant les codes actifs", () => {
    const ts = themeVersThemeSeance(theme(["DEV-01", "DEV-02"]), REFERENTIEL_TEST);
    expect(ts?.portee).toEqual({ type: "theme", themeId: "theme-test", codes: ["DEV-01", "DEV-02"] });
    expect(ts?.cle).toBe("theme:theme-test");
    expect(ts?.codesImposes).toEqual([]);
  });

  it("écarte un code archivé ou disparu SANS rejeter le thème (précédent creerBranche)", () => {
    const referentiel = referentielDe([
      skillDeTest("DEV-01", "developpement", "fondamentaux", 1, 0),
      skillDeTest("DEV-02", "developpement", "fondamentaux", 1, 1, [], { archive: true }),
    ]);
    const ts = themeVersThemeSeance(theme(["DEV-01", "DEV-02", "DEV-99"]), referentiel);
    expect(ts?.portee).toEqual({ type: "theme", themeId: "theme-test", codes: ["DEV-01"] });
  });

  it("rend null si plus aucun code n'est actif — pas une portée vide silencieuse", () => {
    const referentiel = referentielDe([
      skillDeTest("DEV-01", "developpement", "fondamentaux", 1, 0, [], { archive: true }),
    ]);
    expect(themeVersThemeSeance(theme(["DEV-01"]), referentiel)).toBeNull();
  });

  it("le detail compte les compétences ET les domaines distincts, jamais un nombre inventé", () => {
    const ts = themeVersThemeSeance(theme(["DEV-01", "STAT-01"]), REFERENTIEL_TEST);
    // STAT-01 est active: false dans le fixture — donc hors codesActifs.
    expect(ts?.detail).toBe("1 compétence · 1 domaine");
  });
});

describe("themesEnregistres", () => {
  it("exclut les thèmes archivés", () => {
    const themes = [theme(["DEV-01"]), theme(["DEV-02"], { id: "t2", archive: true })];
    const rendus = themesEnregistres(themes, REFERENTIEL_TEST);
    expect(rendus.map((t) => t.cle)).toEqual(["theme:theme-test"]);
  });

  it("exclut un thème dont aucun code n'est plus actif", () => {
    const referentiel = referentielDe([
      skillDeTest("DEV-01", "developpement", "fondamentaux", 1, 0, [], { archive: true }),
    ]);
    expect(themesEnregistres([theme(["DEV-01"])], referentiel)).toEqual([]);
  });
});
