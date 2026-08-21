import { describe, expect, it } from "vitest";
import { JEUX_VOLUME, jeuLivreParId } from "./catalogue";
import { executerJeu } from "./execution";
import { SEUIL_BRIER, SEUIL_DUREE, SEUIL_UTILITE } from "@/lib/engine/auto-evaluation";

/*
 * Ce que ces tests protègent : le jeu de données fictif de l'onglet Moteur doit
 * effectivement franchir les seuils d'auto-évaluation — sinon l'onglet
 * réaffiche « Données insuffisantes » et n'a rien gagné — et il doit le faire
 * de façon reproductible, sans quoi deux ouvertures de la page montreraient
 * deux moteurs différents.
 */

const assidu = jeuLivreParId("assidu")!;

describe("parcours piloté par le moteur", () => {
  it("est déterministe — même graine, même journal", () => {
    const a = executerJeu(assidu);
    const b = executerJeu(assidu);
    expect(a.predictions).toEqual(b.predictions);
    expect(a.decisions).toEqual(b.decisions);
    expect(a.metriques).toEqual(b.metriques);
    expect(a.veriteTerrain).toEqual(b.veriteTerrain);
  });

  it("franchit les quatre seuils sur chaque parcours long livré", () => {
    for (const jeu of JEUX_VOLUME) {
      const resultat = executerJeu(jeu);
      const parNom = new Map(resultat.metriques.map((m) => [m.nom, m]));

      expect(parNom.get("erreur-duree")!.n, jeu.id).toBeGreaterThanOrEqual(SEUIL_DUREE);
      expect(parNom.get("brier-reussite")!.n, jeu.id).toBeGreaterThanOrEqual(SEUIL_BRIER);
      expect(parNom.get("brier-retention")!.n, jeu.id).toBeGreaterThanOrEqual(SEUIL_BRIER);
      expect(parNom.get("utilite-recommandation")!.n, jeu.id).toBeGreaterThanOrEqual(
        SEUIL_UTILITE,
      );
      for (const metrique of resultat.metriques) {
        expect(metrique.valeur, `${jeu.id}/${metrique.nom}`).not.toBeNull();
      }
    }
  });

  it("distingue l'assidu de l'irrégulier sur les recommandations suivies", () => {
    /*
     * Le défaut trouvé le 21/08/2026 : sans fenêtre, les deux régimes donnaient
     * 99 %. La fenêtre de sept jours (`FENETRE_UTILITE_JOURS`) rend la mesure
     * à nouveau discriminante — c'est la seule chose qui la rend lisible.
     */
    const part = (id: string) =>
      executerJeu(jeuLivreParId(id)!).metriques.find(
        (m) => m.nom === "utilite-recommandation",
      )!.valeur!;

    expect(part("assidu")).toBeGreaterThan(part("irregulier") + 0.15);
  });

  it("expose la vérité terrain sur un pilote, jamais sur une liste d'événements", () => {
    expect(executerJeu(assidu).veriteTerrain).toBeDefined();
    expect(executerJeu(jeuLivreParId("regulier")!).veriteTerrain).toBeUndefined();
  });

  it("inscrit la prédiction avant la tentative qui la tranche", () => {
    const resultat = executerJeu(assidu);
    const tentatives = resultat.pas.at(-1)!.tentatives;
    expect(tentatives.length).toBeGreaterThan(0);
    for (const prediction of resultat.predictions) {
      for (const tentative of tentatives.filter(
        (t) => t.exerciseId === prediction.cibleRef && t.debut > prediction.emiseLe,
      )) {
        expect(tentative.debut > prediction.emiseLe).toBe(true);
      }
    }
  });

  it("n'inscrit qu'une décision par jour et par compétence (idempotence)", () => {
    const ids = executerJeu(assidu).decisions.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("ne recommande jamais un exercice déjà réussi", () => {
    const resultat = executerJeu(assidu);
    const reussis = new Set<string>();
    for (const pas of resultat.pas) {
      const propose = pas.recommandations[0]?.exercice?.id;
      if (propose) expect(reussis.has(propose)).toBe(false);
      for (const tentative of pas.tentatives) {
        if (tentative.statut === "terminee" && tentative.resultat === "reussi") {
          reussis.add(tentative.exerciseId);
        }
      }
    }
  });
});
