import { describe, expect, it } from "vitest";
import { choisirConfiguration, creerMoteur, decrireChoix } from "./index";
import { jetonsLusEnCache } from "./compatible-openai";

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

  it("donne priorité à Anthropic quand TUTEUR_MOTEUR=anthropic même si le serveur a un palier gratuit", () => {
    const choix = choisirConfiguration({
      ...GRATUIT,
      TUTEUR_MOTEUR: "anthropic",
      ANTHROPIC_API_KEY: "sk-ant-test",
    });
    expect(choix.kind).toBe("anthropic");
    if (choix.kind === "anthropic") {
      expect(choix.cle).toBe("sk-ant-test");
    }
  });
});

/*
 * Abandon du client (02/08/2026).
 *
 * Rien ne le portait : la route n'avait pas de `cancel()`, `request.signal`
 * n'était jamais lu, et `DemandeTuteur` n'avait pas de champ `signal`. Couper
 * l'onglet — ou enchaîner un second message — laissait la génération courir
 * jusqu'au bout chez le fournisseur, facturée, pour un texte que plus personne
 * n'affichait ; N envois rapprochés donnaient N générations simultanées, donc
 * un 429 qui coupait la réponse en cours.
 *
 * Ce cas-ci pose la marche la plus élémentaire du contrat, et la seule
 * testable sans réseau : un signal DÉJÀ abandonné ne doit produire ni appel ni
 * événement. Émettre « erreur » ici afficherait un incident là où la personne a
 * simplement cliqué « Arrêter ».
 */
describe("abandon — le moteur compatible n'appelle rien sur un signal déjà coupé", () => {
  it("ne fait aucun fetch et n'émet aucun événement", async () => {
    const moteur = creerMoteur(choisirConfiguration(GRATUIT));
    expect(moteur).not.toBeNull();

    const appels: string[] = [];
    const fetchOriginal = globalThis.fetch;
    globalThis.fetch = (() => {
      appels.push("fetch");
      throw new Error("le moteur n'aurait pas dû appeler le fournisseur");
    }) as typeof fetch;

    const evenements: string[] = [];
    try {
      await moteur!.repondre({
        systemeStable: "…",
        systemeProfil: "…",
        messages: [{ role: "user", content: "bonjour" }],
        outils: [],
        signal: AbortSignal.abort(),
        envoyer: (nom) => evenements.push(nom),
      });
    } finally {
      globalThis.fetch = fetchOriginal;
    }

    expect(appels).toHaveLength(0);
    expect(evenements).toHaveLength(0);
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

/**
 * Le zéro fabriqué de l'indicateur de cache.
 *
 * Le moteur lisait `prompt_cache_hit_tokens`, décrit en commentaire comme
 * « Mistral-specific ». Il ne l'est pas : c'est un champ DeepSeek. Sur Mistral
 * il est absent, le `?? 0` le rendait nul, et l'interface affichait « dont 0
 * lus en cache » — un chiffre qu'aucune API n'avait jamais dit, dans l'écran
 * même où le produit promet de n'en afficher aucun (P2, P3).
 */
describe("jetonsLusEnCache", () => {
  it("lit la forme standard OpenAI / Mistral", () => {
    expect(jetonsLusEnCache({ prompt_tokens: 100, prompt_tokens_details: { cached_tokens: 64 } })).toBe(64);
  });

  it("lit la forme plate de DeepSeek", () => {
    expect(jetonsLusEnCache({ prompt_tokens: 100, prompt_cache_hit_tokens: 32 })).toBe(32);
  });

  it("rend null — jamais zéro — quand le fournisseur ne dit rien du cache", () => {
    // Le cas de Mistral avant ce correctif. `null` fait afficher « non
    // renseigné » ; `0` affirmerait un cache qui n'a servi à rien.
    expect(jetonsLusEnCache({ prompt_tokens: 100, completion_tokens: 20 })).toBeNull();
    expect(jetonsLusEnCache(null)).toBeNull();
  });

  it("distingue un cache réellement vide d'un cache non renseigné", () => {
    expect(jetonsLusEnCache({ prompt_tokens_details: { cached_tokens: 0 } })).toBe(0);
  });
});
