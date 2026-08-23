import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Qui paie décide de qui est décompté.
 *
 * `envTuteur` est le seul endroit où le quota de la clé serveur est consommé
 * (ADR-116). Deux garanties, et elles ont la même valeur :
 *
 *  - une clé apportée par l'utilisateur ne coûte **aucune** génération — il
 *    paie son fournisseur, il ne nous doit rien ;
 *  - sans clé, le quota est consommé **avant** l'appel — compter au succès
 *    rendrait gratuit tout appel abandonné.
 *
 * Le compteur espion est ce qui fait échouer un retour en arrière silencieux,
 * où quelqu'un déplacerait la consommation après la génération.
 */

const consommerQuotaTuteur = vi.fn();

vi.mock("@/lib/store/quota-tuteur", () => ({ consommerQuotaTuteur }));

const { envTuteur, messageQuotaEpuise } = await import("./env-requete");

const CLE_MISTRAL = "abcdefghijklmnopqrstuvwxyz012345";

beforeEach(() => {
  consommerQuotaTuteur.mockReset();
});

describe("envTuteur — clé apportée par l'utilisateur", () => {
  it("ne consomme aucune génération", async () => {
    const resultat = await envTuteur({ fournisseur: "mistral", cle: CLE_MISTRAL });

    expect(consommerQuotaTuteur).not.toHaveBeenCalled();
    expect(resultat.ok).toBe(true);
  });

  it("refuse une configuration invalide en 400, sans toucher au quota", async () => {
    const resultat = await envTuteur({ fournisseur: "anthropic", cle: "pas-une-cle-ant" });

    expect(consommerQuotaTuteur).not.toHaveBeenCalled();
    expect(resultat.ok).toBe(false);
    if (resultat.ok) return;
    expect(resultat.reponse.status).toBe(400);
    await expect(resultat.reponse.json()).resolves.toMatchObject({ erreur: "config-invalide" });
  });
});

describe("envTuteur — clé serveur partagée", () => {
  it("consomme une génération quand le quota le permet", async () => {
    consommerQuotaTuteur.mockResolvedValue({ autorise: true, restant: 149, plafond: 150 });

    const resultat = await envTuteur();

    expect(consommerQuotaTuteur).toHaveBeenCalledTimes(1);
    expect(resultat.ok).toBe(true);
  });

  it("refuse en 402 quand le quota est épuisé", async () => {
    consommerQuotaTuteur.mockResolvedValue({ autorise: false, restant: 0, plafond: 150 });

    const resultat = await envTuteur();

    expect(resultat.ok).toBe(false);
    if (resultat.ok) return;
    // 402 et non 429 : ce n'est pas une limite de débit mais une réserve
    // mensuelle consommée. Ni 503 : le moteur va très bien.
    expect(resultat.reponse.status).toBe(402);
    await expect(resultat.reponse.json()).resolves.toMatchObject({
      erreur: "quota-epuise",
      restant: 0,
      plafond: 150,
    });
  });

  it("porte dans le message le plafond réel du compte, et le geste qui débloque", async () => {
    consommerQuotaTuteur.mockResolvedValue({ autorise: false, restant: 0, plafond: 42 });

    const resultat = await envTuteur();
    if (resultat.ok) throw new Error("le quota épuisé doit refuser");
    const corps = (await resultat.reponse.json()) as { message: string };

    /*
     * Il n'existe aucun écran dédié au quota : les surfaces clientes affichent
     * ce champ tel quel. La phrase doit donc tenir seule — combien, quand ça
     * repart, et où aller pour continuer maintenant.
     */
    expect(corps.message).toContain("42");
    expect(corps.message).toContain("Compte et réglages");
    expect(corps.message).toBe(messageQuotaEpuise(42));
  });
});
