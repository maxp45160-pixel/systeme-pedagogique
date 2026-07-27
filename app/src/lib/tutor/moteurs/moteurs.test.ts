import { describe, expect, it } from "vitest";
import { choisirConfiguration, creerMoteur, decrireChoix } from "./index";

/**
 * La sélection du moteur est une fonction pure : elle se teste sans clé, sans
 * réseau et sans fournisseur. C'est la seule partie d'ADR-007 qui puisse être
 * garantie par un test — la fidélité au protocole d'un modèle donné, elle, se
 * mesure par le test de réfutation décrit dans l'ADR, pas ici.
 */

const GRATUIT = {
  TUTEUR_CLE: "gsk_test",
  TUTEUR_URL_BASE: "https://api.groq.com/openai/v1",
  TUTEUR_MODELE: "llama-3.3-70b-versatile",
};

describe("choisirConfiguration — détection automatique", () => {
  it("ne choisit aucun moteur quand rien n'est configuré", () => {
    const choix = choisirConfiguration({});
    expect(choix.kind).toBe("aucun");
    // La raison doit être actionnable : elle est affichée à l'utilisateur.
    expect(choix.kind === "aucun" && choix.raison).toMatch(/TUTEUR_CLE|ANTHROPIC_API_KEY/);
  });

  it("privilégie le palier gratuit sur la clé Anthropic (contrainte du 27/07)", () => {
    const choix = choisirConfiguration({ ...GRATUIT, ANTHROPIC_API_KEY: "sk-ant-test" });
    expect(choix.kind).toBe("compatible-openai");
  });

  it("retombe sur Anthropic si aucun fournisseur gratuit n'est configuré", () => {
    const choix = choisirConfiguration({ ANTHROPIC_API_KEY: "sk-ant-test" });
    expect(choix).toMatchObject({ kind: "anthropic", modele: "claude-opus-4-8" });
  });

  it("ignore une configuration gratuite incomplète", () => {
    const choix = choisirConfiguration({
      TUTEUR_CLE: "gsk_test",
      ANTHROPIC_API_KEY: "sk-ant-test",
    });
    expect(choix.kind).toBe("anthropic");
  });

  it("traite une variable vide comme absente", () => {
    const choix = choisirConfiguration({ ...GRATUIT, TUTEUR_MODELE: "   " });
    expect(choix.kind).toBe("aucun");
  });
});

describe("choisirConfiguration — moteur imposé", () => {
  it("accepte les alias courants du moteur compatible", () => {
    for (const alias of ["compatible-openai", "openai-compatible", "gratuit", "OPENAI"]) {
      const choix = choisirConfiguration({ ...GRATUIT, TUTEUR_MOTEUR: alias });
      expect(choix.kind, `alias « ${alias} »`).toBe("compatible-openai");
    }
  });

  it("refuse Anthropic sans clé, et le dit précisément", () => {
    const choix = choisirConfiguration({ ...GRATUIT, TUTEUR_MOTEUR: "anthropic" });
    expect(choix.kind).toBe("aucun");
    expect(choix.kind === "aucun" && choix.raison).toContain("ANTHROPIC_API_KEY");
  });

  it("énumère les variables manquantes du moteur compatible", () => {
    const choix = choisirConfiguration({
      TUTEUR_MOTEUR: "compatible-openai",
      TUTEUR_CLE: "gsk_test",
    });
    expect(choix.kind).toBe("aucun");
    const raison = choix.kind === "aucun" ? choix.raison : "";
    expect(raison).toContain("TUTEUR_URL_BASE");
    expect(raison).toContain("TUTEUR_MODELE");
  });

  it("signale une valeur inconnue plutôt que de deviner", () => {
    const choix = choisirConfiguration({ ...GRATUIT, TUTEUR_MOTEUR: "mistral-maison" });
    expect(choix.kind).toBe("aucun");
    expect(choix.kind === "aucun" && choix.raison).toContain("mistral-maison");
  });

  it("permet de surcharger le modèle Anthropic", () => {
    const choix = choisirConfiguration({
      TUTEUR_MOTEUR: "anthropic",
      ANTHROPIC_API_KEY: "sk-ant-test",
      TUTEUR_MODELE: "claude-haiku-4-5",
    });
    expect(choix).toMatchObject({ kind: "anthropic", modele: "claude-haiku-4-5" });
  });
});

describe("creerMoteur et decrireChoix", () => {
  it("instancie un moteur pour chaque configuration valide", () => {
    expect(creerMoteur(choisirConfiguration(GRATUIT))?.nom).toBe("compatible-openai");
    expect(creerMoteur(choisirConfiguration({ ANTHROPIC_API_KEY: "sk" }))?.nom).toBe("anthropic");
    expect(creerMoteur(choisirConfiguration({}))).toBeNull();
  });

  it("ne divulgue jamais la clé dans le libellé affiché", () => {
    const libelle = decrireChoix(choisirConfiguration(GRATUIT));
    expect(libelle).toContain("llama-3.3-70b-versatile");
    expect(libelle).not.toContain("gsk_test");
  });
});
