import { describe, expect, it } from "vitest";

import { assemblerReferentiel } from "./referentiel-compte";
import { preparerCreationDomaine, preparerRevisionDomaine } from "./gouvernance-referentiel";
import type { Domaine, Skill } from "./types";

const domaine = (id: string, nom: string, prefixe: string): Domaine => ({
  id, nom, prefixe, description: "", ordre: 0, version: 1, archive: false, origine: "utilisateur",
});

const skill = (code: string, intitule: string, domaineId: string): Skill => ({
  code, intitule, domaine: domaineId, palier: "fondamentaux", prerequis: [], importance: 0.5,
  ordre: 0, active: true, archive: false, origine: "utilisateur",
});

describe("gouvernance du référentiel", () => {
  it("produit une création atomique avec identifiant et préfixe normalisés", () => {
    const { commande } = preparerCreationDomaine({
      domaine: "Philosophie morale",
      prefixe: "phi",
      description: "Évaluer des raisonnements moraux.",
      origine: "utilisateur",
      competences: [{ intitule: "Reconstruire un argument moral explicite", palier: "fondamentaux", importance: "0,7" }],
    }, assemblerReferentiel([], []));
    expect(commande).toMatchObject({ type: "creer_domaine", domaine: { id: "philosophie-morale", prefixe: "PHI" }, competences: [{ importance: 0.7 }] });
  });

  it("rattache une branche à un domaine existant", () => {
    const domaineExistant = domaine("philosophie", "Philosophie", "PHI");
    const { commande } = preparerCreationDomaine({
      domaine: "philosophie",
      prefixe: "AUTRE",
      description: "",
      origine: "tuteur",
      competences: [{ intitule: "Comparer deux positions philosophiques", palier: "intermediaire", importance: 0.5 }],
    }, assemblerReferentiel([domaineExistant], []));
    expect(commande?.type).toBe("ajouter_competences");
  });

  /*
   * Le défaut que cette étape corrige : le contrôle de doublon était borné au
   * domaine, donc un savoir-faire déjà au référentiel repartait sous un second
   * code dès qu'on changeait de domaine — deux flux d'observations pour une seule
   * capacité.
   */
  it("ne recrée pas une compétence que le référentiel porte déjà dans un autre domaine", () => {
    const statistiques = domaine("statistiques", "Statistiques", "STA");
    const existante = skill("STA-01", "Lire un tableau de données", "statistiques");
    const { commande, dejaAuReferentiel } = preparerCreationDomaine({
      domaine: "Logistique",
      prefixe: "LOG",
      description: "Piloter une chaîne logistique.",
      origine: "tuteur",
      competences: [
        { intitule: "Lire un tableau de données", palier: "fondamentaux", importance: 0.6 },
        { intitule: "Dimensionner un stock de sécurité", palier: "intermediaire", importance: 0.8 },
      ],
    }, assemblerReferentiel([statistiques], [existante]));

    expect(commande).toMatchObject({ type: "creer_domaine" });
    const creation = commande?.type === "creer_domaine" ? commande : null;
    expect(creation?.competences.map((competence) => competence.intitule)).toEqual([
      "Dimensionner un stock de sécurité",
    ]);
    expect(dejaAuReferentiel).toEqual([
      {
        intitule: "Lire un tableau de données",
        code: "STA-01",
        domaineId: "statistiques",
        domaineNom: "Statistiques",
        archive: false,
        aRattacher: true,
      },
    ]);
  });

  it("refuse de faire naître un domaine sans aucune compétence à lui", () => {
    const statistiques = domaine("statistiques", "Statistiques", "STA");
    const existante = skill("STA-01", "Lire un tableau de données", "statistiques");
    expect(() => preparerCreationDomaine({
      domaine: "Logistique",
      prefixe: "LOG",
      description: "Piloter une chaîne logistique.",
      origine: "tuteur",
      competences: [{ intitule: "lire un tableau de données", palier: "fondamentaux", importance: 0.6 }],
    }, assemblerReferentiel([statistiques], [existante]))).toThrow("STA-01 (Statistiques)");
  });

  it("autorise explicitement un module à précéder sa première compétence", () => {
    const { commande, dejaAuReferentiel } = preparerCreationDomaine({
      domaine: "Macroéconomie L2",
      prefixe: "MAC",
      description: "Cours du premier semestre.",
      origine: "manuel",
      competences: [],
      usage: {
        type: "module",
        module: { anneeAcademique: "2026-2027", periode: "S1" },
      },
    }, assemblerReferentiel([], []));

    expect(commande).toMatchObject({
      type: "creer_domaine",
      domaine: { id: "macroeconomie-l2", prefixe: "MAC" },
      competences: [],
      usage: {
        type: "module",
        module: { anneeAcademique: "2026-2027", periode: "S1" },
      },
    });
    expect(dejaAuReferentiel).toEqual([]);
  });

  it("refuse toujours un domaine vide hors du parcours module", () => {
    expect(() => preparerCreationDomaine({
      domaine: "Macroéconomie L2",
      prefixe: "MAC",
      description: "Cours du premier semestre.",
      origine: "manuel",
      competences: [],
    }, assemblerReferentiel([], []))).toThrow("au moins une compétence");
  });

  it("refuse aussi un domaine continu vide", () => {
    expect(() => preparerCreationDomaine({
      domaine: "Culture générale",
      prefixe: "CUL",
      description: "Apprentissage sans échéance de fin.",
      origine: "manuel",
      competences: [],
      usage: { type: "continu" },
    }, assemblerReferentiel([], []))).toThrow("au moins une compétence");
  });

  /*
   * Le geste attendu : la personne demande ce savoir-faire dans ce domaine.
   * Il existe ailleurs, donc rien n'est écrit — et il n'y a rien non plus à
   * lui faire faire de plus. Le rattachement suit tout seul.
   */
  it("n'écrit aucune commande quand il ne reste qu'à rattacher", () => {
    const statistiques = domaine("statistiques", "Statistiques", "STA");
    const logistique = domaine("logistique", "Logistique", "LOG");
    const existante = skill("STA-01", "Lire un tableau de données", "statistiques");
    const { commande, dejaAuReferentiel } = preparerCreationDomaine({
      domaine: "Logistique",
      prefixe: "LOG",
      description: "",
      origine: "tuteur",
      competences: [{ intitule: "Lire un tableau de données", palier: "fondamentaux", importance: 0.6 }],
    }, assemblerReferentiel([statistiques, logistique], [existante]));

    expect(commande).toBeNull();
    expect(dejaAuReferentiel).toMatchObject([{ code: "STA-01", aRattacher: true }]);
  });

  /*
   * Une compétence déjà taguée sur CE domaine n'a rien à y ajouter : elle y
   * sert. La proposition se contente de la nommer, sans lever d'erreur.
   */
  it("ne tague rien quand la compétence sert déjà ce domaine (ADR-107)", () => {
    const logistique = domaine("logistique", "Logistique", "LOG");
    const existante = skill("LOG-01", "Dimensionner un stock de sécurité", "logistique");
    const { commande, dejaAuReferentiel } = preparerCreationDomaine({
      domaine: "Logistique",
      prefixe: "LOG",
      description: "",
      origine: "tuteur",
      competences: [{ intitule: "Dimensionner un stock de sécurité", palier: "fondamentaux", importance: 0.6 }],
    }, assemblerReferentiel([logistique], [existante], [{ code: "LOG-01", domaine: "logistique" }]));

    expect(commande).toBeNull();
    expect(dejaAuReferentiel).toMatchObject([{ code: "LOG-01", aRattacher: false }]);
  });

  /*
   * Une compétence archivée garde ses observations (ADR-027) et son intitulé reste
   * résoluble : la recréer sous un code neuf couperait l'historique en deux.
   */
  it("compte une compétence archivée comme déjà au référentiel", () => {
    const statistiques = domaine("statistiques", "Statistiques", "STA");
    const archivee = { ...skill("STA-01", "Lire un tableau de données", "statistiques"), archive: true };
    const { dejaAuReferentiel } = preparerCreationDomaine({
      domaine: "Logistique",
      prefixe: "LOG",
      description: "Piloter une chaîne logistique.",
      origine: "tuteur",
      competences: [
        { intitule: "Lire un tableau de données", palier: "fondamentaux", importance: 0.6 },
        { intitule: "Dimensionner un stock de sécurité", palier: "intermediaire", importance: 0.8 },
      ],
    }, assemblerReferentiel([statistiques], [archivee]));
    expect(dejaAuReferentiel).toMatchObject([{ code: "STA-01", archive: true }]);
  });

  it("refuse un ajout dépendant d'une compétence retirée dans le même geste", () => {
    const domaineExistant = domaine("logistique", "Logistique", "LOG");
    const competence = skill("LOG-01", "Analyser une chaîne logistique complète", "logistique");
    const referentiel = assemblerReferentiel([domaineExistant], [competence]);
    expect(() => preparerRevisionDomaine({
      domaineId: domaineExistant.id,
      ajouts: [{ intitule: "Optimiser une chaîne logistique existante", palier: "avance", importance: 0.8, prerequis: [competence.code] }],
      modifications: [],
      retraits: [competence.code],
    }, referentiel, "tuteur")).toThrow("retirée dans la même révision");
  });

  it("permet d'ajouter un prérequis à une compétence existante dont l'intitulé dépasse 80 caractères", () => {
    const domaineExistant = domaine("llm", "Grand modèle de langage", "LLM");
    const longIntitule = "Comprendre les enjeux de propriété intellectuelle et de droits d'auteur dans l'utilisation des LLM";
    const comp1 = skill("LLM-01", "Comprendre les fondamentaux", "llm");
    const comp2 = skill("LLM-02", longIntitule, "llm");
    const referentiel = assemblerReferentiel([domaineExistant], [comp1, comp2]);

    const revision = preparerRevisionDomaine({
      domaineId: domaineExistant.id,
      ajouts: [],
      modifications: [{ code: "LLM-02", prerequis: ["LLM-01"] }],
      retraits: [],
    }, referentiel, "utilisateur");

    expect(revision.commande).toMatchObject({
      type: "reviser_domaine",
      modifications: [{ code: "LLM-02", prerequis: ["LLM-01"] }],
    });
  });

  it("refuse la modification d'un intitulé si le nouvel intitulé n'est pas atomique", () => {
    const domaineExistant = domaine("llm", "Grand modèle de langage", "LLM");
    const comp1 = skill("LLM-01", "Comprendre les fondamentaux", "llm");
    const referentiel = assemblerReferentiel([domaineExistant], [comp1]);

    expect(() => preparerRevisionDomaine({
      domaineId: domaineExistant.id,
      ajouts: [],
      modifications: [{
        code: "LLM-01",
        intitule: "Comprendre les enjeux de propriété intellectuelle et de droits d'auteur dans l'utilisation des LLM",
      }],
      retraits: [],
    }, referentiel, "utilisateur")).toThrow();
  });
});

