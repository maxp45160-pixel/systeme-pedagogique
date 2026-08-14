import { describe, expect, it } from "vitest";
import { ajouterDansSection, lireValeursSections, mettreAJourSections } from "./sections-markdown";

const FICHE = [
  "---",
  "type: seance",
  "id: seance-1",
  "---",
  "",
  "# Ma séance",
  "",
  "## Intention",
  "",
  "Travailler les flux tirés.",
  "",
  "## Déroulé",
  "",
  "- [[ex-1]] — Premier exercice",
  "",
  "## Bilan",
  "",
].join("\n");

describe("lecture des sections", () => {
  it("rend le corps de chaque section demandée", () => {
    const valeurs = lireValeursSections(FICHE, ["Intention", "Déroulé", "Bilan"]);
    expect(valeurs["Intention"]).toBe("Travailler les flux tirés.");
    expect(valeurs["Déroulé"]).toBe("- [[ex-1]] — Premier exercice");
    expect(valeurs["Bilan"]).toBe("");
  });

  it("rend une chaîne vide pour une section absente du document", () => {
    expect(lireValeursSections(FICHE, ["Protocole"])["Protocole"]).toBe("");
  });

  it("ignore la casse et les espaces de bord de l'en-tête", () => {
    expect(lireValeursSections("## INTENTION  \n\ntexte", ["Intention"])["Intention"]).toBe("texte");
  });
});

describe("écriture des sections", () => {
  it("remplace le corps sans toucher au front-matter ni au titre", () => {
    const resultat = mettreAJourSections(FICHE, ["Bilan"], { Bilan: "Séance utile." });
    expect(resultat).toContain("type: seance");
    expect(resultat).toContain("# Ma séance");
    expect(lireValeursSections(resultat, ["Bilan"])["Bilan"]).toBe("Séance utile.");
    expect(lireValeursSections(resultat, ["Intention"])["Intention"]).toBe(
      "Travailler les flux tirés.",
    );
  });

  it("ajoute en fin de document une section absente", () => {
    const resultat = mettreAJourSections(FICHE, ["Protocole"], { Protocole: "Trois essais." });
    expect(resultat).toContain("## Protocole");
    expect(lireValeursSections(resultat, ["Protocole"])["Protocole"]).toBe("Trois essais.");
  });

  /*
   * Une section inconnue s'intercale entre deux sections visées. Borner la fin
   * d'une section au prochain en-tête *visé* l'engloberait et l'effacerait.
   */
  it("préserve une section inconnue intercalée", () => {
    const avec = FICHE.replace("## Bilan", "## Notes libres\n\nÀ garder.\n\n## Bilan");
    const resultat = mettreAJourSections(avec, ["Intention", "Bilan"], {
      Intention: "Autre chose.",
      Bilan: "Fini.",
    });
    expect(resultat).toContain("## Notes libres");
    expect(lireValeursSections(resultat, ["Notes libres"])["Notes libres"]).toBe("À garder.");
  });

  it("vide une section sans supprimer son en-tête", () => {
    const resultat = mettreAJourSections(FICHE, ["Intention"], { Intention: "" });
    expect(resultat).toContain("## Intention");
    expect(lireValeursSections(resultat, ["Intention"])["Intention"]).toBe("");
  });
});

describe("ajout dans une section", () => {
  it("ajoute à la suite sans effacer l'existant", () => {
    const resultat = ajouterDansSection(FICHE, "Déroulé", ["- [[ex-2]] — Deuxième exercice"]);
    const deroule = lireValeursSections(resultat, ["Déroulé"])["Déroulé"];
    expect(deroule).toContain("- [[ex-1]] — Premier exercice");
    expect(deroule).toContain("- [[ex-2]] — Deuxième exercice");
  });

  /* Rejouer l'écriture ne doit pas empiler les doublons. */
  it("n'ajoute pas deux fois la même ligne", () => {
    const resultat = ajouterDansSection(FICHE, "Déroulé", ["- [[ex-1]] — Premier exercice"]);
    expect(resultat).toBe(FICHE);
  });

  it("rend le document inchangé quand il n'y a rien à ajouter", () => {
    expect(ajouterDansSection(FICHE, "Déroulé", ["", "   "])).toBe(FICHE);
  });

  it("crée la section si elle manque", () => {
    const resultat = ajouterDansSection(FICHE, "Passages", ["- 2026-08-14 — réussi"]);
    expect(lireValeursSections(resultat, ["Passages"])["Passages"]).toBe("- 2026-08-14 — réussi");
  });
});
