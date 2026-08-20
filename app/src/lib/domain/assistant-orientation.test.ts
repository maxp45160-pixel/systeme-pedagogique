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
      niveauId: "debutant",
      preferencesChoisies: ["Pratiquer d'abord", "Pas à pas"],
      rythmeHebdoHeures: 3,
    });

    expect(res.sujet).toBe("React & TypeScript");
    expect(res.formation).toContain("Débutant complet");
    expect(res.intentionDeDepart).toContain("fondamentaux");
    expect(res.preferencesPedagogiques).toEqual(["Pratiquer d'abord", "Pas à pas"]);
    expect(res.rythmePropose).toContain("3h par semaine");
  });

  it("synthétise un profil avec point de départ personnalisé", () => {
    const res = synthetiserProfilDeterministe({
      sujet: "Droit fiscal",
      niveauId: "professionnel",
      pointDeDepartPersonnalise: "Juriste d'entreprise en reconversion",
      preferencesChoisies: ["Des cas concrets"],
    });

    expect(res.formation).toBe("Juriste d'entreprise en reconversion");
    expect(res.intentionDeDepart).toContain("opérationnels");
    expect(res.preferencesPedagogiques).toEqual(["Des cas concrets"]);
  });

  it("gère les cas limites sans crash ni valeur absente", () => {
    const res = synthetiserProfilDeterministe({
      sujet: "",
      preferencesChoisies: [],
    });

    expect(res.formation).toBe("Point de départ en cours de définition");
    expect(res.intentionDeDepart).not.toBe("");
    expect(res.preferencesPedagogiques.length).toBeGreaterThan(0);
    expect(res.rythmePropose).toContain("par semaine");
  });
});
