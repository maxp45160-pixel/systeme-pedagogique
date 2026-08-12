import { describe, expect, it } from "vitest";
import { cleConversationTuteur, cleParCompte } from "./stockage-session";

/*
 * Ce que ce fichier protège :
 *
 *  1. Toute clé reste isolée par compte (ADR-029) — deux comptes sur le même
 *     navigateur ne doivent jamais se voir.
 *  2. Le fil du tuteur est distinct par exercice : l'historique affiché et le
 *     contexte envoyé au serveur doivent parler du même exercice.
 *  3. Le fil général garde sa clé historique — la renommer viderait les
 *     conversations ouvertes au moment du déploiement.
 */

describe("cleParCompte", () => {
  it("préfixe l'usage et suffixe le compte", () => {
    expect(cleParCompte("conversation", "c1")).toBe("systeme-pedagogique:conversation:c1");
  });

  it("sépare deux comptes pour un même usage", () => {
    expect(cleParCompte("conversation", "c1")).not.toBe(cleParCompte("conversation", "c2"));
  });
});

describe("cleConversationTuteur", () => {
  it("sans exercice, garde la clé historique du fil général", () => {
    expect(cleConversationTuteur("c1")).toBe(cleParCompte("conversation", "c1"));
  });

  it("donne un fil distinct à chaque exercice", () => {
    const a = cleConversationTuteur("c1", "ex-a");
    const b = cleConversationTuteur("c1", "ex-b");
    expect(a).not.toBe(b);
    expect(a).not.toBe(cleConversationTuteur("c1"));
  });

  it("reste isolé par compte, exercice identique", () => {
    expect(cleConversationTuteur("c1", "ex-a")).not.toBe(cleConversationTuteur("c2", "ex-a"));
  });

  it("est stable : deux appels identiques donnent la même clé", () => {
    // C'est ce qui permet de retrouver le fil en revenant sur l'exercice.
    expect(cleConversationTuteur("c1", "ex-a")).toBe(cleConversationTuteur("c1", "ex-a"));
  });

  it("ne peut pas collisionner avec le fil général d'un autre compte", () => {
    /*
     * Le compte est en dernier dans la clé : un identifiant d'exercice qui
     * contiendrait un « : » ne doit pas pouvoir reconstituer la clé d'un
     * voisin. Ce test échouerait si l'ordre des segments changeait.
     */
    expect(cleConversationTuteur("c1", "c2")).not.toBe(cleConversationTuteur("c2"));
  });
});
