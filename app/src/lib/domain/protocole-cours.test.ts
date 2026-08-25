import { describe, expect, it } from "vitest";
import {
  CODES_SEANCE_PROTOCOLE_MAX,
  INTENTIONS_COURS,
  SEANCES_PROTOCOLE_MAX,
  estDimensionSeance,
  estIntentionCours,
  exerciceExplicationPour,
  exerciceRappelPour,
  motifRefusIntentionLibre,
  motifRefusOrigineSeance,
  motifRefusProtocole,
  type ProtocoleCours,
} from "./protocole-cours";
import { motifRefusBlueprint } from "./seance";
import { motifRefusExercice } from "./exercice";
import type { BlueprintSeance } from "./types";

/*
 * Le protocole de traitement d'un cours (ADR-130).
 *
 * Ce que ces tests verrouillent en priorité : le tuteur ne désigne que des
 * codes du référentiel actif (garde-fou ADR-043, côté validateur cette fois),
 * et le plan ne porte aucune mesure — les dimensions sont des intentifs, la
 * seule chose stockée est un fait déclaré relu par la personne.
 */

const CODES_ACTIFS = new Set(["LOG-01", "LOG-02", "ALG-01"]);

function seanceValide(overrides: Partial<ProtocoleCours["seances"][number]> = {}): ProtocoleCours["seances"][number] {
  return {
    titre: "Comprendre les bases",
    dimension: "comprehension",
    codes: ["LOG-01"],
    consigne: "Reformulez les notions du chapitre 1 et montrez un exemple.",
    dureeCibleMin: 30,
    ...overrides,
  };
}

function protocole(seances = [seanceValide()]): ProtocoleCours {
  return { resume: "Un plan du plus fondamental au plus avancé.", seances };
}

describe("intentions et dimensions — des enums serveur", () => {
  it("ne reconnaît que les valeurs déclarées", () => {
    for (const intention of INTENTIONS_COURS) {
      expect(estIntentionCours(intention)).toBe(true);
    }
    expect(estIntentionCours("reussir")).toBe(false);
    expect(estIntentionCours(42)).toBe(false);
  });

  it("ne reconnaît que les quatre dimensions", () => {
    expect(estDimensionSeance("comprehension")).toBe(true);
    expect(estDimensionSeance("contextualisation")).toBe(true);
    expect(estDimensionSeance("creativite")).toBe(false);
    expect(estDimensionSeance(undefined)).toBe(false);
  });
});

describe("motifRefusIntentionLibre", () => {
  it("accepte une phrase courte et refuse un journal intime", () => {
    expect(motifRefusIntentionLibre("Examen dans deux semaines.")).toBeNull();
    expect(motifRefusIntentionLibre("a".repeat(501))).toContain("trop longue");
  });
});

describe("motifRefusProtocole", () => {
  it("accepte un plan valide", () => {
    expect(motifRefusProtocole(protocole(), CODES_ACTIFS)).toBeNull();
  });

  it("refuse un plan vide ou démesuré", () => {
    expect(motifRefusProtocole(protocole([]), CODES_ACTIFS)).toContain("1 à");
    expect(
      motifRefusProtocole(
        protocole(
          Array.from({ length: SEANCES_PROTOCOLE_MAX + 1 }, (_, i) =>
            seanceValide({ titre: `Séance ${i + 1}` }),
          ),
        ),
        CODES_ACTIFS,
      ),
    ).toContain("1 à");
  });

  it("refuse un code que le référentiel actif ne porte pas — le tuteur n'en frappe aucun", () => {
    const refuse = motifRefusProtocole(
      protocole([seanceValide({ codes: ["LOG-01", "INVENTE-99"] })]),
      CODES_ACTIFS,
    );
    expect(refuse).toContain("référentiel actif");
  });

  it("refuse une séance sans compétence, et au-delà du plafond de codes", () => {
    expect(motifRefusProtocole(protocole([seanceValide({ codes: [] })]), CODES_ACTIFS)).toContain(
      "référentiel actif",
    );
    expect(
      motifRefusProtocole(
        protocole([
          seanceValide({
            codes: Array.from(
              { length: CODES_SEANCE_PROTOCOLE_MAX + 1 },
              (_, i) => `LOG-0${(i % 9) + 1}`,
            ),
          }),
        ]),
        CODES_ACTIFS,
      ),
    ).toContain("référentiel actif");
  });

  it("refuse une durée inférieure à ce que les compétences visées rendent possible", () => {
    const refuse = motifRefusProtocole(
      protocole([seanceValide({ codes: ["LOG-01", "LOG-02"], dureeCibleMin: 5 })]),
      CODES_ACTIFS,
    );
    expect(refuse).toContain("durée cible hors bornes");
  });

  it("refuse une durée absurde et un titre vide", () => {
    expect(
      motifRefusProtocole(protocole([seanceValide({ dureeCibleMin: 481 })]), CODES_ACTIFS),
    ).toContain("durée cible hors bornes");
    expect(motifRefusProtocole(protocole([seanceValide({ titre: "  " })]), CODES_ACTIFS)).toContain(
      "titre est obligatoire",
    );
  });

  it("refuse une dimension inconnue et un résumé absent", () => {
    expect(
      motifRefusProtocole(
        protocole([seanceValide({ dimension: "magie" as ProtocoleCours["seances"][number]["dimension"] })]),
        CODES_ACTIFS,
      ),
    ).toContain("dimension inconnue");
    expect(
      motifRefusProtocole({ resume: "  ", seances: [seanceValide()] }, CODES_ACTIFS),
    ).toContain("une à trois phrases");
  });
});

describe("motifRefusOrigineSeance — l'origine protocole d'un blueprint", () => {
  it("accepte une origine complète", () => {
    expect(
      motifRefusOrigineSeance({
        genre: "protocole-cours",
        ficheId: "doc-1",
        titre: "Comprendre les bases",
        dimension: "comprehension",
      }),
    ).toBeNull();
  });

  it("refuse un autre genre, une fiche absente, un titre vide, une dimension inconnue", () => {
    expect(
      motifRefusOrigineSeance({
        genre: "autre",
        ficheId: "doc-1",
        titre: "X",
        dimension: "comprehension",
      }),
    ).toContain("protocole-cours");
    expect(
      motifRefusOrigineSeance({
        genre: "protocole-cours",
        ficheId: " ",
        titre: "X",
        dimension: "comprehension",
      }),
    ).toContain("fiche cours");
    expect(
      motifRefusOrigineSeance({
        genre: "protocole-cours",
        ficheId: "doc-1",
        titre: "",
        dimension: "comprehension",
      }),
    ).toContain("titre");
    expect(
      motifRefusOrigineSeance({
        genre: "protocole-cours",
        ficheId: "doc-1",
        titre: "X",
        dimension: "inconnue",
      }),
    ).toContain("dimension");
  });

  it("accepte une origine sans commande — les séances écrites avant ADR-131", () => {
    expect(
      motifRefusOrigineSeance({
        genre: "protocole-cours",
        ficheId: "doc-1",
        titre: "Comprendre les bases",
        dimension: "comprehension",
      }),
    ).toBeNull();
  });

  it("valide la commande différée quand elle est présente (ADR-131)", () => {
    const base = {
      genre: "protocole-cours",
      ficheId: "doc-1",
      titre: "Appliquer les notions",
      dimension: "application",
    };
    expect(
      motifRefusOrigineSeance({ ...base, codes: ["LOG-01", "LOG-02"], consigne: "Appliquez." }),
    ).toBeNull();
    // Codes : obligatoires, bornés, non vides, bien typés.
    expect(motifRefusOrigineSeance({ ...base, codes: [] })).toContain("compétences visées");
    expect(
      motifRefusOrigineSeance({
        ...base,
        codes: Array.from({ length: CODES_SEANCE_PROTOCOLE_MAX + 1 }, () => "LOG-01"),
      }),
    ).toContain("compétences visées");
    expect(motifRefusOrigineSeance({ ...base, codes: ["LOG-01", 42] })).toContain(
      "compétences visées",
    );
    expect(motifRefusOrigineSeance({ ...base, codes: ["LOG-01", " "] })).toContain(
      "compétences visées",
    );
    // Consigne : obligatoire dès que la commande est posée.
    expect(motifRefusOrigineSeance({ ...base, codes: ["LOG-01"], consigne: "   " })).toContain(
      "consigne",
    );
    expect(
      motifRefusOrigineSeance({ ...base, codes: ["LOG-01"], consigne: "a".repeat(601) }),
    ).toContain("consigne");
  });
});

describe("motifRefusBlueprint — l'origine est validée à l'écriture", () => {
  const blueprint: BlueprintSeance = {
    dureeCibleMin: 30,
    nombreExercices: 1,
    portee: { type: "mono", domaine: "logistique" },
    cibles: [{ code: "LOG-01", difficulte: 3, raison: "Visée par le protocole." }],
  };

  it("accepte un blueprint avec une origine bien formée", () => {
    expect(
      motifRefusBlueprint({
        ...blueprint,
        origine: {
          genre: "protocole-cours",
          ficheId: "doc-1",
          titre: "Comprendre les bases",
          dimension: "comprehension",
        },
      }),
    ).toBeNull();
  });

  it("refuse un blueprint qui se réclamerait d'un protocole mal formé", () => {
    expect(
      motifRefusBlueprint({
        ...blueprint,
        origine: {
          genre: "protocole-cours",
          ficheId: "",
          titre: "Comprendre les bases",
          dimension: "comprehension",
        },
      }),
    ).toContain("fiche cours");
  });
});

describe("exerciceExplicationPour — compréhension = reformulation (ADR-133)", () => {
  const modele = exerciceExplicationPour({
    code: "LOG-01",
    intitule: "Analyser un flux",
    consigne: "Cite les étapes du chapitre 1.",
    dureeEstimeeMin: 12,
  });

  it("écrit un exercice-Feynman complet, ancré dans la consigne de la séance", () => {
    expect(modele.titre).toContain("Analyser un flux");
    expect(modele.competences).toEqual(["LOG-01"]);
    expect(modele.type).toBe("rappel");
    expect(modele.enonce).toContain("vos propres mots");
    expect(modele.enonce).toContain("Cite les étapes du chapitre 1.");
    // La correction n'est pas vide : c'est une guidance d'auto-relecture,
    // pas un corrigé inventé — et motifRefusExercice l'exige.
    expect(modele.correction.trim()).not.toBe("");
    expect(modele.criteres.length).toBeGreaterThan(0);
  });

  it("passe la validation commune des exercices et borne la durée", () => {
    expect(motifRefusExercice(modele)).toBeNull();
    const borne = exerciceExplicationPour({
      code: "X",
      intitule: "Y",
      consigne: "",
      dureeEstimeeMin: 1,
    });
    expect(borne.dureeEstimeeMin).toBeGreaterThanOrEqual(5);
    expect(Number.isInteger(borne.dureeEstimeeMin)).toBe(true);
  });
});

describe("exerciceRappelPour — mémorisation = rappel actif (ADR-134)", () => {
  const modele = exerciceRappelPour({
    code: "LOG-02",
    intitule: "Calculer un taux de service",
    consigne: "Les formules du chapitre 3.",
    titreCours: "Logistique urbaine",
    dureeEstimeeMin: 10,
  });

  it("demande de restituer D'ABORD, et désigne le cours réel pour vérifier", () => {
    expect(modele.titre).toContain("Rappel de mémoire");
    expect(modele.titre).toContain("Calculer un taux de service");
    expect(modele.type).toBe("rappel");
    // L'ordre pédagogique : rappel sans le cours, vérification ensuite.
    expect(modele.enonce).toContain("SANS relire le cours");
    expect(modele.correction).toContain("Logistique urbaine");
    // Pas de corrigé fabriqué : la source de vérité est le cours déposé.
    expect(modele.correction).not.toContain("formules du chapitre 3");
  });

  it("passe la validation commune des exercices et borne la durée", () => {
    expect(motifRefusExercice(modele)).toBeNull();
    const borne = exerciceRappelPour({
      code: "X",
      intitule: "Y",
      consigne: "",
      titreCours: "",
      dureeEstimeeMin: 999,
    });
    expect(borne.dureeEstimeeMin).toBeLessThanOrEqual(240);
    // Titre de cours manquant : un repli honnête, jamais un nom inventé.
    expect(borne.correction).toContain("le cours attaché à cette fiche");
  });
});
