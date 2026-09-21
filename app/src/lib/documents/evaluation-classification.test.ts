import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { CORPUS_QUALITE_DOCUMENTAIRE } from "./fixtures/qualite-documentaire";
import { evaluerClassification, lireCorpusClassification, type CasEvaluationClassification } from "./evaluation-classification";

/** Données arithmétiques fictives : le marqueur humaine exerce le contrat du
 * calcul, sans constituer un corpus humain réel ni une sortie de fournisseur. */
function casNombre(total = 20, incorrectes = 0): CasEvaluationClassification {
  return {
    id: "cas-arithmetique", format: "pdf", fonction: "competences",
    reference: {
      origine: "humaine", source: "Référence fictive de test unitaire", couverture: "entiere",
      attendus: Array.from({ length: total }, (_, i) => ({ id: `attendu-${i}`, optionnel: false })),
    },
    sortie: {
      source: "Sortie fictive", couverture: "entiere", inventaireComplet: true,
      annotationHumaine: "Annotation fictive de test unitaire",
      propositions: Array.from({ length: total }, (_, i) => ({
        id: `proposition-${i}`, jugement: i < incorrectes ? "incorrecte" : "correcte",
        attendusCouverts: i < incorrectes ? [] : [`attendu-${i}`],
      })),
    },
  };
}
function cellule(corpus: CasEvaluationClassification[], format = "pdf", fonction = "competences") {
  return evaluerClassification(corpus).find((r) => r.format === format && r.fonction === fonction)!;
}

describe("évaluation offline : calculs séparés, pas jugement sémantique", () => {
  it("échoue à exactement 5 %, réussit en dessous, sans arrondi", () => {
    const limite = cellule([casNombre(20, 1)]);
    expect(limite.erreursPropositions).toEqual({ erreurs: 1, total: 20, tauxErreurs: 0.05, verdict: "HORS_SEUIL" });
    expect(limite.omissionsCompetences).toEqual(limite.erreursPropositions);
    expect(limite.verdict).toBe("HORS_SEUIL");
    expect(cellule([casNombre(21, 1)]).verdict).toBe("SOUS_SEUIL");
  });

  it("une mauvaise proposition ne se dilue pas dans le nombre d'attendus", () => {
    const cas = casNombre(100);
    cas.sortie!.propositions = [{ id: "inventee", jugement: "incorrecte", attendusCouverts: [] }];
    const resultat = cellule([cas]);
    expect(resultat.erreursPropositions).toMatchObject({ erreurs: 1, total: 1, tauxErreurs: 1 });
    expect(resultat.omissionsCompetences).toMatchObject({ erreurs: 100, total: 100, tauxErreurs: 1 });
  });

  it("compte les omissions même avec toutes les propositions correctes", () => {
    const cas = casNombre(20);
    cas.sortie!.propositions.pop();
    const resultat = cellule([cas]);
    expect(resultat.erreursPropositions.verdict).toBe("SOUS_SEUIL");
    expect(resultat.omissionsCompetences).toMatchObject({ erreurs: 1, total: 20, verdict: "HORS_SEUIL" });
    expect(resultat.verdict).toBe("HORS_SEUIL");
  });

  it("exclut les attendus optionnels des omissions, mais pas les ajouts incorrects", () => {
    const cas = casNombre(1);
    cas.reference!.attendus.push({ id: "prerequis", optionnel: true });
    expect(cellule([cas]).omissionsCompetences).toMatchObject({ erreurs: 0, total: 1 });
    cas.sortie!.propositions.push({ id: "prerequis-indu", jugement: "incorrecte", attendusCouverts: [] });
    expect(cellule([cas]).erreursPropositions).toMatchObject({ erreurs: 1, total: 2, verdict: "HORS_SEUIL" });
  });

  it("ne masque pas l'échec d'un format ou d'une fonction par un autre", () => {
    const pdf = casNombre(100);
    const manuscrit = { ...casNombre(1, 1), id: "manuscrit", format: "manuscrit" as const };
    const domaine = { ...casNombre(1, 1), id: "domaine", fonction: "domaine" as const };
    const corpus = [pdf, manuscrit, domaine];
    expect(cellule(corpus).verdict).toBe("SOUS_SEUIL");
    expect(cellule(corpus, "manuscrit").verdict).toBe("HORS_SEUIL");
    expect(cellule(corpus, "pdf", "domaine").verdict).toBe("HORS_SEUIL");
    expect(cellule(corpus, "pdf", "domaine").omissionsCompetences).toBeNull();
    expect(evaluerClassification(corpus)).toHaveLength(25);
    expect(cellule(corpus, "epub").verdict).toBe("UNKNOWN");
  });

  it("agrège les effectifs plutôt qu'une moyenne de pourcentages de documents", () => {
    const petits = casNombre(1, 1);
    const grands = { ...casNombre(100), id: "grand" };
    expect(cellule([petits, grands]).erreursPropositions).toMatchObject({ erreurs: 1, total: 101, tauxErreurs: 1 / 101 });
  });

  it.each(["reference", "sortie", "synthese", "annotation", "inventaire", "jugement", "reference-partielle"])("reste UNKNOWN si %s manque", (manque) => {
    const cas = casNombre();
    if (manque === "reference") cas.reference = null;
    if (manque === "sortie") cas.sortie = null;
    if (manque === "synthese") cas.reference!.origine = "synthetique";
    if (manque === "annotation") cas.sortie!.annotationHumaine = null;
    if (manque === "inventaire") cas.sortie!.inventaireComplet = false;
    if (manque === "jugement") {
      cas.sortie!.propositions[0].jugement = "UNKNOWN";
      cas.sortie!.propositions[0].attendusCouverts = [];
    }
    if (manque === "reference-partielle") cas.reference!.couverture = "partielle";
    const resultat = cellule([cas, { ...casNombre(), id: "cas-complet" }]);
    expect(resultat.verdict).toBe("UNKNOWN");
    expect(resultat.erreursPropositions.tauxErreurs).toBeNull();
    expect(resultat.omissionsCompetences?.tauxErreurs).toBeNull();
    expect(resultat.inconnues.length).toBeGreaterThan(0);
  });

  it("ne certifie pas une sortie partielle et compte les attendus du document entier", () => {
    const cas = casNombre();
    cas.sortie!.couverture = "partielle";
    expect(cellule([cas]).verdict).toBe("UNKNOWN");
    cas.sortie!.propositions.pop();
    expect(cellule([cas]).omissionsCompetences).toMatchObject({ erreurs: 1, total: 20, verdict: "HORS_SEUIL" });
  });

  it("distingue une sortie vide d'une sortie absente sans attribuer 100 % de précision", () => {
    const cas = casNombre(2);
    cas.sortie!.propositions = [];
    const resultat = cellule([cas]);
    expect(resultat.erreursPropositions).toMatchObject({ total: 0, tauxErreurs: null, verdict: "UNKNOWN" });
    expect(resultat.omissionsCompetences).toMatchObject({ erreurs: 2, total: 2, tauxErreurs: 1 });
    expect(cellule([casNombre(0)]).omissionsCompetences?.verdict).toBe("UNKNOWN");
  });

  it("garde les 12 fixtures existantes synthétiques et sans verdict de réussite", () => {
    const corpus: CasEvaluationClassification[] = CORPUS_QUALITE_DOCUMENTAIRE.map((cas) => ({
      id: cas.id, format: cas.support === "page-pdf" ? "pdf" : cas.support === "note" ? "texte-libre" : "image",
      fonction: "competences", reference: null, sortie: null,
    }));
    expect(corpus).toHaveLength(12);
    expect(evaluerClassification(corpus).every((r) => r.verdict === "UNKNOWN")).toBe(true);
  });

  it("refuse les données mal formées et identifiants incohérents sans les corriger", () => {
    const cas = casNombre(2);
    expect(() => lireCorpusClassification([{ ...cas, format: "docx" }])).toThrow();
    expect(() => lireCorpusClassification([cas, cas])).toThrow("répété");
    expect(() => lireCorpusClassification([{ ...cas, reference: undefined }])).toThrow();
    cas.sortie!.propositions[0].attendusCouverts = ["absent"];
    expect(() => evaluerClassification([cas])).toThrow("Attendu inconnu");
    cas.sortie!.propositions[0].attendusCouverts = ["attendu-0"];
    cas.sortie!.propositions[0].jugement = "incorrecte";
    expect(() => evaluerClassification([cas])).toThrow("non correcte");
  });

  it("ne modifie ni annotations ni sorties", () => {
    const corpus = [casNombre()];
    const avant = structuredClone(corpus);
    evaluerClassification(corpus);
    expect(corpus).toEqual(avant);
  });

  it("refuse de créditer deux propositions correctes au même attendu", () => {
    const cas = casNombre(1);
    cas.sortie!.propositions.push({ id: "repetition", jugement: "correcte", attendusCouverts: ["attendu-0"] });
    expect(() => evaluerClassification([cas])).toThrow("correspondance des attendus");
  });
});

describe("CLI offline reproductible", () => {
  const script = fileURLToPath(new URL("../../../scripts/evaluer-classification.mjs", import.meta.url));
  it("évalue le gabarit via stdin sans inventer de référence humaine", () => {
    const exemple = spawnSync(process.execPath, [script, "--exemple"], { encoding: "utf8" });
    expect(exemple.status, exemple.stderr).toBe(0);
    expect(JSON.parse(exemple.stdout)[0].reference.origine).toBe("synthetique");
    const resultat = spawnSync(process.execPath, [script, "-"], { input: exemple.stdout, encoding: "utf8" });
    expect(resultat.status, resultat.stderr).toBe(0);
    const rapport = JSON.parse(resultat.stdout);
    expect(rapport.resultats).toHaveLength(25);
    expect(rapport.resultats.every((r: { verdict: string }) => r.verdict === "UNKNOWN")).toBe(true);
  });

  it("refuse un corpus invalide avec un code d'échec", () => {
    const resultat = spawnSync(process.execPath, [script, "-"], { input: "{}", encoding: "utf8" });
    expect(resultat.status).toBe(1);
    expect(resultat.stdout).toBe("");
    expect(resultat.stderr).toContain("Liste attendue");
  });
});
