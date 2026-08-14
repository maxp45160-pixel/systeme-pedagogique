import { describe, expect, it } from "vitest";
import type { Exercise, ExerciseAttempt } from "@/lib/domain/types";
import {
  ajouterPassageFiche,
  construireFicheExercice,
  idFicheExercice,
  lignePassage,
} from "./fiche-exercice";
import { analyserDocumentMarkdown } from "./markdown";
import { lireValeursSections } from "./sections-markdown";

const CREEE_LE = "2026-08-14T10:00:00.000Z";

function exercice(surcharge: Partial<Exercise> = {}): Exercise {
  return {
    id: "ex-1",
    titre: "Calculer un stock de sécurité",
    domaine: "logistique",
    type: "calcul",
    difficulte: 3,
    competences: ["LOG-1", "LOG-2"],
    dureeEstimeeMin: 20,
    enonce: "Quel stock de sécurité pour un délai de 5 jours ?",
    indices: ["Pense à l'écart-type de la demande."],
    correction: "On applique la formule z × σ × √L.",
    criteres: [],
    origine: "manuel",
    ...surcharge,
  } as Exercise;
}

function tentative(surcharge: Partial<ExerciseAttempt> = {}): ExerciseAttempt {
  return {
    id: "at-1",
    exerciseId: "ex-1",
    debut: "2026-08-14T09:30:00.000Z",
    fin: "2026-08-14T09:52:00.000Z",
    dureeMin: 22,
    indicesUtilises: 0,
    reponse: "42 unités",
    evaluation: {},
    resultat: "reussi",
    statut: "terminee",
    ...surcharge,
  } as ExerciseAttempt;
}

describe("fiche d'exercice", () => {
  it("porte l'énoncé, la correction et les compétences", () => {
    const fiche = construireFicheExercice(exercice(), tentative(), CREEE_LE);
    const sections = lireValeursSections(fiche.contenuMd, [
      "Énoncé",
      "Correction",
      "Compétences mobilisées",
    ]);
    expect(sections["Énoncé"]).toContain("délai de 5 jours");
    expect(sections["Correction"]).toContain("z × σ × √L");
    expect(sections["Compétences mobilisées"]).toBe("- [[LOG-1]]\n- [[LOG-2]]");
  });

  it("déclare sa source et son domaine dans le front-matter", () => {
    const fiche = construireFicheExercice(exercice(), tentative(), CREEE_LE);
    const analyse = analyserDocumentMarkdown(fiche.id, fiche.contenuMd);
    expect(analyse.type).toBe("exercice");
    expect(analyse.frontMatter.exercice).toBe("ex-1");
    expect(analyse.frontMatter.domaine).toBe("logistique");
  });

  it("dérive son identifiant de celui de l'exercice", () => {
    expect(idFicheExercice("ex-1")).toBe("exercice-ex-1");
    expect(construireFicheExercice(exercice(), tentative(), CREEE_LE).id).toBe("exercice-ex-1");
  });

  /*
   * La fiche est éditoriale, la preuve est la mesure. Recopier ici le niveau,
   * les dimensions ou l'autonomie ferait du Markdown une seconde autorité sur
   * ce qui a été mesuré.
   */
  it("ne recopie aucune mesure", () => {
    const fiche = construireFicheExercice(
      exercice(),
      tentative({ evaluation: { justification: 4 }, notes: "j'ai hésité" }),
      CREEE_LE,
    );
    expect(fiche.contenuMd).not.toContain("justification");
    expect(fiche.contenuMd).not.toContain("autonomie");
    expect(fiche.contenuMd).not.toContain("niveau");
  });

  it("renvoie vers la preuve figée du passage", () => {
    expect(lignePassage(tentative())).toContain("[[preuve-at-1]]");
    expect(lignePassage(tentative())).toContain("2026-08-14");
    expect(lignePassage(tentative())).toContain("reussi");
  });

  it("retombe sur la date de début quand la tentative n'a pas de fin", () => {
    expect(lignePassage(tentative({ fin: undefined, dureeMin: undefined }))).toContain("2026-08-14");
  });
});

describe("passages suivants", () => {
  it("ajoute un passage sans effacer les remarques", () => {
    const fiche = construireFicheExercice(exercice(), tentative(), CREEE_LE);
    const annotee = fiche.contenuMd.replace("## Remarques\n", "## Remarques\n\nÀ revoir.\n");
    const suivante = ajouterPassageFiche(annotee, tentative({ id: "at-2", resultat: "partiel" }));

    expect(lireValeursSections(suivante, ["Remarques"])["Remarques"]).toBe("À revoir.");
    const passages = lireValeursSections(suivante, ["Passages"])["Passages"];
    expect(passages).toContain("[[preuve-at-1]]");
    expect(passages).toContain("[[preuve-at-2]]");
  });

  /* Rejouer l'écriture — un retry, une double soumission — ne doit rien empiler. */
  it("reste sans effet si le passage est déjà inscrit", () => {
    const fiche = construireFicheExercice(exercice(), tentative(), CREEE_LE);
    expect(ajouterPassageFiche(fiche.contenuMd, tentative())).toBe(fiche.contenuMd);
  });
});
