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
    const commande = preparerCreationDomaine({
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
    const commande = preparerCreationDomaine({
      domaine: "philosophie",
      prefixe: "AUTRE",
      description: "",
      origine: "tuteur",
      competences: [{ intitule: "Comparer deux positions philosophiques", palier: "intermediaire", importance: 0.5 }],
    }, assemblerReferentiel([domaineExistant], []));
    expect(commande.type).toBe("ajouter_competences");
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
});
