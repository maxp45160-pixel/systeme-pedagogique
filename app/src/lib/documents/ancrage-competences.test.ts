import { describe, expect, it } from "vitest";
import { filtrerAncragesCompetences } from "./ancrage-competences";
import { traduireSourcesRestitution } from "./sources-restitution";
import { validerElementsDepot, validerOrganisationDepot } from "./depot-validation";

// Scénarios de contrat annotés par l'agent : ils ne simulent pas une mesure de qualité LLM.
const note = "Recopiez le texte à la main.\nSynthétiser les consignes : sujet annoncé pour plus tard.\nCalculer la probabilité conditionnelle à partir de l'intersection donnée.\nLe code suivant trace un histogramme.\ngeom_histogram()";
const sources = (n: number) => [{ passageId: `passage-${n}` }];
const competence = (nature = "consigne", attendu = "Recopier le texte à la main") => ({
  ancrage: { nature, passageId: "passage-0", attendu },
  mode: "nouvelle", verbeAction: "écrire", objet: "un texte manuscrit", precision: null,
  palier: "fondamentaux", importance: 0.5, domaine: { mode: "nouveau", nom: "Écriture" },
  justification: "Recopier le texte est demandé.", sources: sources(0),
});
const restitution = (competences: unknown[]) => ({ elements: [], organisation: {
  titreSuggere: "Contribution", typeSuggere: "note", domaine: { mode: "nouveau", nom: "Écriture", description: "Écriture", parentId: null, justification: "Texte à recopier", sources: sources(0) },
  competences, justification: "Texte à recopier", sources: sources(0),
} });

describe("appui des nouvelles compétences", () => {
  it("préserve le geste demandé, retire l'appui temporaire et traverse les validations réelles", () => {
    const brut = restitution([competence()]);
    const avant = structuredClone(brut);
    const filtre = filtrerAncragesCompetences(brut, note, []);
    expect(filtre.organisation.competences).toHaveLength(1);
    expect(filtre.organisation.competences[0]).not.toHaveProperty("ancrage");
    const canonique = traduireSourcesRestitution(filtre, note, []);
    expect(validerOrganisationDepot(canonique, "doc", note, []).competences[0]).toMatchObject({ mode: "nouvelle", intitule: "Écrire un texte manuscrit", relationSupport: "demandee" });
    expect(brut).toEqual(avant);
  });

  it("préserve une démonstration répartie sur plusieurs passages sans impératif", () => {
    const c = { ...competence("demonstration", "Tracer un histogramme"), sources: [...sources(3), ...sources(4)] };
    c.ancrage.passageId = "passage-4";
    const filtre = filtrerAncragesCompetences(restitution([c]), note, []);
    expect(filtre.organisation.competences[0].sources).toEqual(c.sources);
    expect(filtre.organisation.competences[0].relationSupport).toBe("enseignee");
    expect(filtre.elements).toEqual([]);
  });

  it("garde une compétence principale seulement mentionnée avec sa source et sa relation exacte", () => {
    const c = { ...competence("mention", "Synthétiser les consignes"), verbeAction: "synthétiser", objet: "les consignes", sources: sources(1), ancrage: { nature: "mention", passageId: "passage-1", attendu: "Synthétiser les consignes" } };
    const filtre = filtrerAncragesCompetences(restitution([competence(), c]), note, []);
    expect(filtre.organisation.competences).toHaveLength(2);
    const canonique = traduireSourcesRestitution(filtre, note, []);
    expect(validerOrganisationDepot(canonique, "doc", note, []).competences[1]).toMatchObject({
      intitule: "Synthétiser les consignes", relationSupport: "mention",
      sources: [{ citation: "Synthétiser les consignes : sujet annoncé pour plus tard." }],
    });
    expect(filtre.elements).toEqual([]);
  });

  it("rend visible une compétence incertaine sans supprimer l'autre proposition", () => {
    const c = { ...competence("incertain", "Produire une synthèse des consignes"), verbeAction: "synthétiser", objet: "les consignes" };
    const filtre = filtrerAncragesCompetences(restitution([competence(), c]), note, []);
    expect(filtre.organisation.competences).toHaveLength(1);
    const canonique = traduireSourcesRestitution(filtre, note, []);
    const reserves = validerElementsDepot(canonique, "doc", note, [], "a");
    expect(reserves).toHaveLength(1);
    expect(reserves[0]).toMatchObject({ nature: "incertitude", sources: [{ citation: "Recopiez le texte à la main." }] });
    expect(reserves[0].texte).toContain("synthétiser les consignes");
    expect(reserves[0].texte).toContain("Produire une synthèse");
  });

  it("une compétence existante mentionnée conserve son code et sa relation", () => {
    const c = { ...competence("mention", "Recopiez le texte à la main."), mode: "existante", code: "ECR-01" };
    const filtre = filtrerAncragesCompetences(restitution([c]), note, []);
    expect(filtre.organisation.competences).toMatchObject([{ code: "ECR-01", relationSupport: "mention" }]);
    expect(filtre.elements).toEqual([]);
  });

  it.each([
    undefined, null, {}, { nature: "invente", passageId: "passage-0", attendu: "Recopier" },
    { nature: "consigne", passageId: "passage-0", attendu: " " },
    { nature: "consigne", passageId: "passage-0", attendu: "x".repeat(161) },
    { nature: "consigne", passageId: "passage-0", attendu: "Recopier", valide: true },
    { nature: "consigne", passageId: "invente", attendu: "Recopier" },
    { nature: "consigne", passageId: "passage-1", attendu: "Recopier" },
  ])("refuse l'appui absent/invalide/hors sources sans inventer une abstention : %j", (ancrage) => {
    expect(() => filtrerAncragesCompetences(restitution([{ ...competence(), ancrage }]), note, [])).toThrow();
  });

  it.each(["consigne", "mention"])("vérifie tous les repères même pour %s", (nature) => {
    expect(() => filtrerAncragesCompetences(restitution([{ ...competence(nature), sources: [...sources(0), { passageId: "invente" }] }]), note, [])).toThrow(/inconnu/);
    expect(() => filtrerAncragesCompetences(restitution([{ ...competence(nature), sources: [{ passageId: "passage-0", citation: "inventée" }] }]), note, [])).toThrow(/uniquement passageId/);
  });

  it("conserve le repère EPUB dans une compétence mentionnée", () => {
    const pages = [{ pieceId: "epub", page: 7, texte: "Sommaire : Écrire un texte manuscrit", incertain: false, section: { chemin: "chap.xhtml", titre: "Sommaire" } }];
    const filtre = filtrerAncragesCompetences(restitution([competence("mention", "Écrire un texte manuscrit")]), "", pages);
    const canonique = traduireSourcesRestitution(filtre, "", pages);
    expect(validerOrganisationDepot(canonique, "doc", "", pages).competences[0]).toMatchObject({ relationSupport: "mention", sources: [{ pieceId: "epub", page: 7, section: pages[0].section }] });
  });

  it("place en réserve une mention thématique qui ne formule pas le geste proposé", () => {
    const noteTheme = "Ce chapitre annonce une méthode de calcul.";
    const c = { ...competence("mention", "méthode de calcul"), verbeAction: "calculer", objet: "une valeur" };
    const filtre = filtrerAncragesCompetences(restitution([c]), noteTheme, []);
    expect(filtre.organisation.competences).toEqual([]);
    expect(filtre.elements).toMatchObject([{ nature: "incertitude", sources: [{ passageId: "passage-0" }] }]);
    expect(filtre.elements[0]).toMatchObject({ texte: expect.stringContaining("non retrouvé explicitement") });
  });

  it("place en réserve une formulation absente du passage cité", () => {
    const c = competence("mention", "Écrire un texte manuscrit");
    const filtre = filtrerAncragesCompetences(restitution([c]), note, []);
    expect(filtre.organisation.competences).toEqual([]);
    expect(filtre.elements).toHaveLength(1);
  });

  it("ne perd aucun libellé ni repère en regroupant les abstentions", () => {
    const liste = [0, 1, 2, 3].map((i) => ({ ...competence("incertain"), objet: `geste ${i}`, sources: sources(i), ancrage: { nature: "incertain", passageId: `passage-${i}`, attendu: `Résultat ${i}` } }));
    const filtre = filtrerAncragesCompetences(restitution(liste), note, []);
    const canonique = traduireSourcesRestitution(filtre, note, []);
    const reserves = validerElementsDepot(canonique, "doc", note, [], "a");
    expect(reserves).toHaveLength(2);
    for (let i = 0; i < 4; i++) expect(reserves.map((e) => e.texte).join("\n")).toContain(`geste ${i}`);
    expect(reserves.flatMap((e) => e.sources).map((s) => s.citation)).toEqual(note.split("\n").slice(0, 4));
  });

  it("refuse une accumulation de réserves plutôt que tronquer ou taire des omissions", () => {
    const liste = Array.from({ length: 30 }, (_, i) => ({ ...competence("incertain", "x".repeat(160)), objet: `un texte manuscrit ${i}` }));
    expect(() => filtrerAncragesCompetences(restitution(liste), note, [])).toThrow(/Aucune liste partielle/);
  });

  it("ne contourne pas les validations métier en retirant une proposition faible", () => {
    const referentiel = { domaines: [], competences: [] };
    for (const c of [
      { ...competence("mention"), mode: "impossible" },
      { ...competence("mention"), verbeAction: "inventer-un-verbe" },
      { ...competence("mention"), importance: 999 },
      { ...competence("mention"), palier: "invente" },
      { ...competence("mention"), mode: "existante", code: "INVENTE-01" },
    ]) expect(() => filtrerAncragesCompetences(restitution([c]), note, [], referentiel)).toThrow();
    expect(() => filtrerAncragesCompetences(restitution([competence("mention"), competence("mention")]), note, [])).toThrow(/plusieurs fois/);
  });

  it("ne transforme pas une auto-déclaration en preuve sémantique indépendante", () => {
    // Une déclaration mensongère du modèle traverse encore le contrôle structurel.
    const c = { ...competence("demonstration", "Produire une synthèse"), verbeAction: "synthétiser", objet: "les consignes" };
    expect(filtrerAncragesCompetences(restitution([c]), note, []).organisation.competences).toHaveLength(1);
  });
});
