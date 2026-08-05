import { describe, expect, it } from "vitest";
import { estRenseigne, profilDeclare, serialiserProfilDeclare, valeurDeclaree } from "./profil";
import type { User } from "./types";

/*
 * ADR-029 — jusqu'au 31/07/2026 le tuteur recevait un profil écrit en dur dans
 * les instructions principales (« Révise et approfondit son BUT QLIO, prépare
 * un Master ITI… »), fichier chargé sans condition pour TOUS les comptes. Un
 * utilisateur tiers se voyait donc attribuer un diplôme et des objectifs qui
 * n'étaient pas les siens, et le tuteur initialisait son profil là-dessus.
 *
 * Ces tests protègent les deux moitiés de la correction : ce qui est déclaré
 * est transmis, ce qui ne l'est pas est nommé comme tel plutôt que comblé.
 */

function utilisateur(champs: Partial<User> = {}): User {
  return {
    id: "u1",
    prenom: "Test",
    formation: "Formation à renseigner",
    objectifMoyenTerme: "Objectif à moyen terme à renseigner",
    objectifLongTerme: "Objectif à long terme à renseigner",
    debutSuivi: "2026-07-31",
    preferencesPedagogiques: [],
    ...champs,
  };
}

describe("estRenseigne — un libellé d'invite n'est pas une réponse", () => {
  it("rejette les valeurs par défaut du schéma", () => {
    expect(estRenseigne("Formation à renseigner")).toBe(false);
    expect(estRenseigne("Objectif à moyen terme à renseigner")).toBe(false);
    expect(estRenseigne("Objectif à long terme à renseigner")).toBe(false);
  });

  it("rejette le vide et les espaces", () => {
    expect(estRenseigne("")).toBe(false);
    expect(estRenseigne("   ")).toBe(false);
    expect(estRenseigne(undefined)).toBe(false);
  });

  it("accepte une réponse réelle", () => {
    expect(estRenseigne("BUT QLIO")).toBe(true);
    expect(estRenseigne("Licence de philosophie")).toBe(true);
  });
});

describe("profilDeclare", () => {
  it("reconnaît un compte qui n'a rien déclaré", () => {
    expect(profilDeclare(utilisateur()).vide).toBe(true);
  });

  it("ne se dit pas vide dès qu'une seule chose est déclarée", () => {
    const p = profilDeclare(utilisateur({ formation: "Licence de philosophie" }));
    expect(p.vide).toBe(false);
    expect(p.formation).toBe("Licence de philosophie");
    expect(p.objectifMoyenTerme).toBeNull();
  });

  it("écarte les préférences vides", () => {
    const p = profilDeclare(utilisateur({ preferencesPedagogiques: ["  ", "Partir d'un cas"] }));
    expect(p.preferencesPedagogiques).toEqual(["Partir d'un cas"]);
  });
});

describe("serialiserProfilDeclare — la place qu'occupait un profil écrit en dur", () => {
  it("sur un compte vierge, interdit explicitement d'inventer un diplôme", () => {
    const texte = serialiserProfilDeclare(utilisateur());
    expect(texte).toContain("Rien n'a encore été déclaré");
    expect(texte).toContain("N'INVENTE NI DIPLÔME NI OBJECTIF");
    // Et surtout : interdit de le déduire du référentiel, l'autre chemin par
    // lequel un profil peut être fabriqué.
    expect(texte).toContain("n'en déduis aucun de ses compétences");
  });

  it("ne transmet JAMAIS un libellé d'invite comme une donnée", () => {
    // Le défaut qu'il faut empêcher de revenir : « Formation à renseigner »
    // transmis tel quel se lit comme une formation nommée « à renseigner ».
    const texte = serialiserProfilDeclare(utilisateur());
    expect(texte).not.toContain("Formation à renseigner");
    expect(texte).not.toContain("Objectif à moyen terme à renseigner");
  });

  it("transmet ce qui est déclaré, et nomme ce qui ne l'est pas", () => {
    const texte = serialiserProfilDeclare(
      utilisateur({ formation: "Licence de philosophie" }),
    );
    expect(texte).toContain("Licence de philosophie");
    expect(texte).toContain("Objectif à moyen terme : non déclaré — à demander");
  });

  it("transmet les préférences comme un fait déclaré, jamais à inférer", () => {
    const texte = serialiserProfilDeclare(
      utilisateur({
        formation: "Licence de philosophie",
        preferencesPedagogiques: ["Reformuler avant de corriger."],
      }),
    );
    expect(texte).toContain("Reformuler avant de corriger.");
    expect(texte).toContain("jamais à inférer");
  });

  it("transmet le plan de travail quand il est déclaré, et rien sinon", () => {
    const avec = serialiserProfilDeclare(utilisateur({ plan: "D'abord la logique." }));
    expect(avec).toContain("PLAN DE TRAVAIL DÉCLARÉ");
    expect(avec).toContain("D'abord la logique.");

    // Ni titre de section ni consigne : un plan absent ne se devine pas.
    for (const vide of [undefined, "   "]) {
      expect(serialiserProfilDeclare(utilisateur({ plan: vide }))).not.toContain(
        "PLAN DE TRAVAIL",
      );
    }
  });

  it("ne mentionne aucun profil d'un autre compte, quel que soit l'utilisateur", () => {
    for (const u of [utilisateur(), utilisateur({ formation: "Licence de philosophie" })]) {
      const texte = serialiserProfilDeclare(u);
      expect(texte).not.toContain("QLIO");
      expect(texte).not.toContain("ITI");
    }
  });
});

/*
 * L'amorce de `/demarrer` relaie le point de départ au tuteur (lot 4).
 *
 * Le champ « ton point de départ » a été retiré de cet écran : il écrivait
 * `profiles.formation`, que `/profil` édite déjà via la même action. L'amorce
 * reprend donc la valeur en base — et c'est là que le piège se referme, parce
 * que cette colonne n'est jamais vide : elle vaut « Formation à renseigner »
 * par défaut (`schema.sql` § 1). Un test de chaîne non vide laisse passer ce
 * libellé, et le tuteur s'entend dire que le point de départ de la personne
 * est « Formation à renseigner ».
 */
describe("valeurDeclaree — le garde-fou de l'amorçage", () => {
  it("refuse les libellés d'invite du schéma", () => {
    expect(valeurDeclaree("Formation à renseigner")).toBeNull();
    expect(valeurDeclaree("Objectif à moyen terme à renseigner")).toBeNull();
    expect(valeurDeclaree("Objectif à long terme à renseigner")).toBeNull();
  });

  it("refuse le vide et l'espace, sans les confondre avec une invite", () => {
    expect(valeurDeclaree("")).toBeNull();
    expect(valeurDeclaree("   ")).toBeNull();
    expect(valeurDeclaree(undefined)).toBeNull();
    expect(valeurDeclaree(null)).toBeNull();
  });

  it("rend la valeur réelle, débarrassée de ses espaces", () => {
    expect(valeurDeclaree("  Licence de philosophie  ")).toBe("Licence de philosophie");
  });
});
