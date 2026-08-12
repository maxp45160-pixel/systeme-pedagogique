import { describe, expect, it } from "vitest";
import {
  CLES_RPC,
  convertirResultatRPC,
  entiteVersLigne,
  ligneVersEntite,
  profilVersUser,
  verifier,
  versChamp,
  versColonne,
} from "./supabase-backend";
import type { SkillEvidence, LearningSession, User } from "@/lib/domain/types";

/**
 * La traduction camelCase ↔ snake_case n'est vérifiée par aucun compilateur :
 * une colonne mal nommée n'échoue pas, elle écrit à côté. D'où ces tests sur
 * les champs réellement utilisés par le moteur.
 */

describe("conversion des noms", () => {
  it("traduit les champs du domaine en colonnes", () => {
    expect(versColonne("skillCode")).toBe("skill_code");
    expect(versColonne("niveauPreuve")).toBe("niveau_preuve");
    expect(versColonne("competencesCombinees")).toBe("competences_combinees");
    expect(versColonne("apprentissagePrincipal")).toBe("apprentissage_principal");
    expect(versColonne("genereAutomatiquement")).toBe("genere_automatiquement");
    expect(versColonne("id")).toBe("id");
  });

  it("est réversible sur tous les champs persistés", () => {
    const champs = [
      "skillCode", "skillCodes", "niveauPreuve", "competencesCombinees",
      "exerciseId", "indicesUtilises", "verdictTuteur", "causeProbable",
      "planifieePour", "besoinDeclare",
      "dureeMin", "dureeEstimeeMin", "apprentissagePrincipal", "prochaineAction",
      "notePersonnelle", "genereAutomatiquement", "dateCreation", "dateEcheance",
      "dateDebut", "dateFin", "exercicesGeneres", "comprehensionDeclaree", "id",
    ];
    for (const champ of champs) {
      expect(versChamp(versColonne(champ)), champ).toBe(champ);
    }
  });
});

describe("ligne SQL → entité", () => {
  it("restitue une preuve sans toucher au contenu imbriqué", () => {
    const preuve = ligneVersEntite<SkillEvidence>({
      id: "ev-1",
      user_id: "00000000-0000-0000-0000-000000000001",
      created_at: "2026-07-25T10:00:00Z",
      skill_code: "STAT-02",
      date: "2026-07-25",
      type: "exercice",
      niveau_preuve: "A",
      autonomie: "seul",
      qualite: "correcte",
      resultat: "reussi",
      contexte: "TD probabilités",
      // Les clés imbriquées restent en camelCase : le moteur les relit telles quelles.
      dimensions: { comprehension: 0.8, miseEnOeuvre: 0.6 },
      source: { kind: "exercice", ref: "att-9" },
    });

    expect(preuve.skillCode).toBe("STAT-02");
    expect(preuve.niveauPreuve).toBe("A");
    expect(preuve.source).toEqual({ kind: "exercice", ref: "att-9" });
    expect(preuve.dimensions).toEqual({ comprehension: 0.8, miseEnOeuvre: 0.6 });
  });

  it("écarte les colonnes techniques", () => {
    const entite = ligneVersEntite<Record<string, unknown>>({
      id: "x-1",
      user_id: "u",
      created_at: "now",
      updated_at: "now",
      titre: "T",
    });
    expect(Object.keys(entite).sort()).toEqual(["id", "titre"]);
  });

  it("supprime les NULL au lieu de les propager", () => {
    // `dureeMin: null` traverserait le moteur et s'afficherait comme une durée
    // mesurée à zéro — un chiffre que personne n'a observé.
    const seance = ligneVersEntite<LearningSession>({
      id: "s-1",
      user_id: "u",
      date: "2026-07-25",
      duree_min: null,
      domaines: ["stats"],
      skill_codes: [],
      activites: [],
      genere_automatiquement: false,
    });

    expect("dureeMin" in seance).toBe(false);
    expect(seance.dureeMin ?? null).toBeNull();
    expect(seance.genereAutomatiquement).toBe(false);
  });
});

describe("entité → ligne SQL", () => {
  it("rattache la ligne au compte et convertit les clés de premier niveau", () => {
    const ligne = entiteVersLigne(
      {
        id: "s-2",
        date: "2026-07-26",
        dureeMin: 45,
        skillCodes: ["STAT-02"],
        activites: [{ type: "exercice", ref: "ex-1", libelle: "Loi normale" }],
        genereAutomatiquement: true,
      },
      "compte-1",
    );

    expect(ligne).toMatchObject({
      user_id: "compte-1",
      id: "s-2",
      duree_min: 45,
      skill_codes: ["STAT-02"],
      genere_automatiquement: true,
    });
    // Le contenu imbriqué part verbatim en jsonb.
    expect(ligne.activites).toEqual([
      { type: "exercice", ref: "ex-1", libelle: "Loi normale" },
    ]);
  });

  it("omet les champs absents plutôt que d'écrire NULL", () => {
    const ligne = entiteVersLigne({ id: "e-1", commentaire: undefined }, "compte-1");
    expect("commentaire" in ligne).toBe(false);
  });

  it("fait l'aller-retour sans perte", () => {
    const origine = {
      id: "ev-7",
      skillCode: "SYS-01",
      date: "2026-07-26",
      type: "projet",
      niveauPreuve: "B",
      autonomie: "aide-ponctuelle",
      qualite: "partielle",
      resultat: "partiel",
      contexte: "Projet capteurs",
      dimensions: { comprehension: 0.5 },
      competencesCombinees: ["SYS-02"],
      source: { kind: "projet", ref: "pr-3" },
    };

    const ligne = entiteVersLigne(origine, "compte-1");
    // `user_id` est une colonne technique : le retour la retire de lui-même.
    expect(ligneVersEntite(ligne)).toEqual(origine);
  });

  it("préserve la provenance du document et de son snapshot", () => {
    const origine = {
      id: "ev-8",
      skillCode: "STAT-02",
      date: "2026-07-26",
      type: "exercice",
      niveauPreuve: "A",
      autonomie: "seul",
      qualite: "correcte",
      resultat: "reussi",
      contexte: "Étude de cas",
      source: {
        kind: "exercice",
        ref: "att-8",
        document: {
          documentId: "preuve-att-8",
          snapshotId: "snapshot-att-8-v1",
        },
      },
    };

    expect(ligneVersEntite(entiteVersLigne(origine, "compte-1"))).toEqual(origine);
  });
});

describe("profil", () => {
  const defaut: User = {
    id: "compte-1",
    prenom: "alice",
    formation: "Formation à renseigner",
    objectifMoyenTerme: "MT",
    objectifLongTerme: "LT",
    debutSuivi: "2026-07-26",
    preferencesPedagogiques: [],
  };

  it("retombe sur les valeurs par défaut quand la colonne est vide", () => {
    const user = profilVersUser(
      { id: "compte-1", prenom: "Alice", formation: "  ", preferences_pedagogiques: null },
      defaut,
    );
    expect(user.prenom).toBe("Alice");
    expect(user.formation).toBe("Formation à renseigner");
    expect(user.preferencesPedagogiques).toEqual([]);
  });

  it("préserve les valeurs renseignées", () => {
    const user = profilVersUser(
      {
        id: "compte-1",
        prenom: "Maxime",
        formation: "BUT QLIO",
        objectif_moyen_terme: "Master ITI",
        objectif_long_terme: "Recherche",
        debut_suivi: "2026-07-24",
        preferences_pedagogiques: ["Calcul manuel + Python"],
      },
      defaut,
    );
    expect(user).toEqual({
      id: "compte-1",
      prenom: "Maxime",
      formation: "BUT QLIO",
      objectifMoyenTerme: "Master ITI",
      objectifLongTerme: "Recherche",
      debutSuivi: "2026-07-24",
      preferencesPedagogiques: ["Calcul manuel + Python"],
    });
  });

  it("laisse le plan absent plutôt que de lui inventer un repli", () => {
    // Un plan vide en base n'est pas un plan : le tuteur ne doit pas recevoir
    // une intention que la personne n'a pas écrite.
    expect(profilVersUser({ id: "compte-1", plan: "   " }, defaut).plan).toBeUndefined();
    expect(profilVersUser({ id: "compte-1" }, defaut).plan).toBeUndefined();
  });

  it("remonte le plan déclaré", () => {
    const user = profilVersUser({ id: "compte-1", plan: "Consolider la logique." }, defaut);
    expect(user.plan).toBe("Consolider la logique.");
  });
});

/*
 * Chargement groupé — 07/08/2026.
 *
 * `charger_tout` a vécu deux mois sans renvoyer `refus_recommandations` : la
 * conversion fabriquait un `[]` pour la clé absente, le moteur n'excluait rien
 * et « Passer une suggestion » restait sans effet. Aucun test ne pouvait le
 * voir — la conversion vivait dans un module `server-only`.
 *
 * Ces tests tiennent le garde-fou : une charge utile amputée est refusée, pas
 * complétée. Un `[]` mesuré et un `[]` fabriqué doivent rester discernables.
 */
describe("charge utile de charger_tout", () => {
  const defautProfil: User = {
    id: "compte-1",
    prenom: "alice",
    formation: "Formation à renseigner",
    objectifMoyenTerme: "MT",
    objectifLongTerme: "LT",
    debutSuivi: "2026-07-26",
    preferencesPedagogiques: [],
  };

  const chargeComplete = (surcharge: Record<string, unknown> = {}) => ({
    profile: { id: "compte-1", prenom: "Maxime" },
    ...Object.fromEntries(CLES_RPC.map((cle) => [cle, []])),
    ...surcharge,
  });

  it("convertit une charge utile complète", () => {
    const resultat = convertirResultatRPC(
      chargeComplete({
        refus_recommandations: [
          { id: "ref-1", user_id: "compte-1", code: "DEV-01", exercice_id: "ex-1", date: "2026-08-07" },
        ],
      }),
      defautProfil,
    );

    expect(resultat).not.toBeNull();
    expect(resultat!.collections.user.prenom).toBe("Maxime");
    expect(resultat!.collections.refusRecommandations).toEqual([
      { id: "ref-1", code: "DEV-01", exerciceId: "ex-1", date: "2026-08-07" },
    ]);
  });

  it("refuse une charge utile amputée d'une clé plutôt que d'inventer une liste vide", () => {
    for (const cle of CLES_RPC) {
      const ampute = chargeComplete();
      delete (ampute as Record<string, unknown>)[cle];
      expect(convertirResultatRPC(ampute, defautProfil), `clé « ${cle} » absente`).toBeNull();
    }
  });

  it("accepte une liste vide quand la clé est présente — l'absence de donnée est une donnée", () => {
    const resultat = convertirResultatRPC(chargeComplete(), defautProfil);
    expect(resultat).not.toBeNull();
    expect(resultat!.collections.refusRecommandations).toEqual([]);
    expect(resultat!.competences).toEqual([]);
  });

  it("refuse ce qui n'est pas un objet", () => {
    expect(convertirResultatRPC(null, defautProfil)).toBeNull();
    expect(convertirResultatRPC([], defautProfil)).toBeNull();
    expect(convertirResultatRPC("{}", defautProfil)).toBeNull();
  });

  it("retombe sur le profil neutre quand la ligne `profiles` n'existe pas encore", () => {
    // Le trigger `handle_new_user` peut n'avoir pas encore écrit : ce n'est pas
    // une charge utile amputée, `profile` est bien présent, à null.
    const resultat = convertirResultatRPC(chargeComplete({ profile: null }), defautProfil);
    expect(resultat!.collections.user).toEqual(defautProfil);
  });
});

describe("remontée des erreurs", () => {
  it("laisse passer l'absence d'erreur", () => {
    expect(() => verifier("lecture", null)).not.toThrow();
  });

  it("relance en nommant le contexte — jamais d'échec silencieux", () => {
    const lever = () =>
      verifier("lecture de « evidence »", { message: "permission denied", code: "42501" });

    expect(lever).toThrow(Error);
    // Le message doit permettre de situer la panne sans relire le code.
    try {
      lever();
    } catch (e) {
      const message = (e as Error).message;
      expect(message).toContain("evidence");
      expect(message).toContain("42501");
      expect(message).toContain("permission denied");
    }
  });
});
