import { describe, expect, it } from "vitest";
import {
  NIVEAUX_DEPART,
  PREFERENCES_APPRENTISSAGE,
  SUGGESTIONS_DOMAINES,
  synthetiserProfilDeterministe,
} from "./assistant-orientation";

describe("Assistant d'orientation — diagnostic et synthèse", () => {
  it("expose les constantes d'options sans libellé vide", () => {
    expect(NIVEAUX_DEPART.length).toBeGreaterThanOrEqual(4);
    expect(PREFERENCES_APPRENTISSAGE.length).toBeGreaterThanOrEqual(5);
    expect(SUGGESTIONS_DOMAINES.length).toBeGreaterThanOrEqual(4);

    for (const n of NIVEAUX_DEPART) {
      expect(n.titre.trim()).not.toBe("");
      expect(n.formationType.trim()).not.toBe("");
    }
  });

  it("synthétise un profil complet pour un débutant", () => {
    const res = synthetiserProfilDeterministe({
      sujet: "React & TypeScript",
      intention: "Créer une application web accessible de bout en bout",
      niveauId: "debutant",
      preferencesChoisies: ["Pratiquer d'abord", "Pas à pas"],
    });

    expect(res.sujet).toBe("React & TypeScript");
    expect(res.formation).toContain("Débutant complet");
    expect(res.intentionDeDepart).toBe("Créer une application web accessible de bout en bout");
    expect(res.preferencesPedagogiques).toEqual(["Pratiquer d'abord", "Pas à pas"]);
  });

  it("synthétise un profil avec point de départ personnalisé", () => {
    const res = synthetiserProfilDeterministe({
      sujet: "Droit fiscal",
      intention: "Sécuriser les déclarations de TVA de mon entreprise",
      niveauId: "professionnel",
      pointDeDepartPersonnalise: "Juriste d'entreprise en reconversion",
      preferencesChoisies: ["Des cas concrets"],
    });

    expect(res.formation).toBe("Juriste d'entreprise en reconversion");
    expect(res.intentionDeDepart).toBe("Sécuriser les déclarations de TVA de mon entreprise");
    expect(res.preferencesPedagogiques).toEqual(["Des cas concrets"]);
  });

  it("ne fabrique aucune déclaration absente", () => {
    const res = synthetiserProfilDeterministe({
      sujet: "",
      intention: "",
      preferencesChoisies: [],
    });

    expect(res.formation).toBe("");
    expect(res.intentionDeDepart).toBe("");
    expect(res.preferencesPedagogiques).toEqual([]);
  });

  it("normalise sans reformuler les réponses déclarées", () => {
    const res = synthetiserProfilDeterministe({
      sujet: "  Analyse de données  ",
      intention: "  Automatiser mes rapports mensuels  ",
      pointDeDepartPersonnalise: "  Bases Python  ",
      preferencesChoisies: [" Des cas concrets ", ""],
    });

    expect(res).toEqual({
      sujet: "Analyse de données",
      formation: "Bases Python",
      intentionDeDepart: "Automatiser mes rapports mensuels",
      preferencesPedagogiques: ["Des cas concrets"],
    });
  });
});
