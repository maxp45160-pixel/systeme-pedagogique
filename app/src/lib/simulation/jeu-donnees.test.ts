import { describe, expect, it } from "vitest";
import { JEUX_LIVRES, jeuLivreParId } from "./catalogue";
import { ecrireJeuDonnees, lireJeuDonnees } from "./jeu-donnees";
import { executerJeu } from "./execution";

/*
 * Ce que ces tests protègent : un jeu invalide ne doit JAMAIS produire de
 * chiffres. Le simulateur existe pour débusquer les valeurs fabriquées ; s'il
 * en fabriquait lui-même à partir d'un fichier bancal, il ne servirait plus à
 * rien. La lecture échoue, dit pourquoi, et ne complète aucun champ manquant.
 */

function jeuValide() {
  return JSON.parse(ecrireJeuDonnees(jeuLivreParId("regulier")!)) as Record<string, unknown>;
}

describe("lireJeuDonnees", () => {
  it("relit tous les jeux livrés à l'identique", () => {
    for (const jeu of JEUX_LIVRES) {
      const lecture = lireJeuDonnees(JSON.parse(ecrireJeuDonnees(jeu)));
      expect(lecture.ok, `${jeu.id} : ${lecture.ok ? "" : lecture.erreurs.join(" / ")}`).toBe(
        true,
      );
      if (lecture.ok) expect(lecture.jeu).toEqual(jeu);
    }
  });

  it("un jeu relu produit exactement la même simulation", () => {
    const jeu = jeuLivreParId("assidu")!;
    const relu = lireJeuDonnees(JSON.parse(ecrireJeuDonnees(jeu)));
    expect(relu.ok).toBe(true);
    if (!relu.ok) return;
    expect(executerJeu(relu.jeu).metriques).toEqual(executerJeu(jeu).metriques);
  });

  it("refuse un format ou une version inconnus", () => {
    const lecture = lireJeuDonnees({ ...jeuValide(), format: "autre-chose", version: 9 });
    expect(lecture.ok).toBe(false);
    if (!lecture.ok) {
      expect(lecture.erreurs.join(" ")).toContain("format");
      expect(lecture.erreurs.join(" ")).toContain("version");
    }
  });

  it("refuse un exercice qui vise une compétence inconnue", () => {
    const jeu = jeuValide();
    (jeu.exercices as Record<string, unknown>[])[0].competences = ["LOG-INCONNUE"];
    const lecture = lireJeuDonnees(jeu);
    expect(lecture.ok).toBe(false);
    if (!lecture.ok) expect(lecture.erreurs.join(" ")).toContain("LOG-INCONNUE");
  });

  it("refuse un événement qui cite un exercice absent du catalogue", () => {
    const jeu = jeuValide();
    const deroule = jeu.deroule as { evenements: Record<string, unknown>[] };
    deroule.evenements[0].exercice = "EX-FANTOME";
    const lecture = lireJeuDonnees(jeu);
    expect(lecture.ok).toBe(false);
    if (!lecture.ok) expect(lecture.erreurs.join(" ")).toContain("EX-FANTOME");
  });

  it("refuse une difficulté hors bornes", () => {
    const jeu = jeuValide();
    (jeu.exercices as Record<string, unknown>[])[0].difficulte = 9;
    const lecture = lireJeuDonnees(jeu);
    expect(lecture.ok).toBe(false);
    if (!lecture.ok) expect(lecture.erreurs.join(" ")).toContain("difficulte");
  });

  it("refuse une aptitude portant sur une compétence inconnue", () => {
    const jeu = JSON.parse(ecrireJeuDonnees(jeuLivreParId("assidu")!));
    jeu.deroule.profil.aptitude = { "PAS-UN-CODE": 3 };
    const lecture = lireJeuDonnees(jeu);
    expect(lecture.ok).toBe(false);
    if (!lecture.ok) expect(lecture.erreurs.join(" ")).toContain("PAS-UN-CODE");
  });

  it("remonte toutes les erreurs d'un coup, pas seulement la première", () => {
    const lecture = lireJeuDonnees({ format: "simulation-parcours", version: 1 });
    expect(lecture.ok).toBe(false);
    if (!lecture.ok) expect(lecture.erreurs.length).toBeGreaterThan(3);
  });

  it("complète les champs de forme sans inventer de mesure", () => {
    const lecture = lireJeuDonnees({
      format: "simulation-parcours",
      version: 1,
      id: "minimal",
      nom: "Minimal",
      domaines: [{ id: "d", nom: "Domaine" }],
      competences: [{ code: "C-01", intitule: "Une compétence", domaine: "d", importance: 1 }],
      exercices: [
        {
          id: "X-01",
          titre: "Un exercice",
          domaine: "d",
          difficulte: 2,
          dureeEstimeeMin: 20,
          competences: ["C-01"],
          indices: [],
        },
      ],
      deroule: {
        mode: "evenements",
        evenements: [
          {
            type: "tentative",
            date: "2026-03-02T09:00:00.000Z",
            exercice: "X-01",
            resultat: "reussi",
            indicesUtilises: 0,
            dureeMin: 18,
          },
        ],
      },
    });

    expect(lecture.ok).toBe(true);
    if (!lecture.ok) return;
    expect(lecture.jeu.competences[0].active).toBe(true);
    expect(lecture.jeu.competences[0].prerequis).toEqual([]);

    // Aucune évaluation fournie : la tentative n'invente aucune dimension.
    const resultat = executerJeu(lecture.jeu);
    const etat = resultat.pas.at(-1)!.etats[0];
    expect(etat.observations).toHaveLength(1);
    expect(etat.observations[0].dimensions).toEqual({});
  });
});
