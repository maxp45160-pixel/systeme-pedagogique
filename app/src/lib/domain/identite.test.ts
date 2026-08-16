import { describe, expect, it } from "vitest";
import { resoudreIdentite } from "./identite";

describe("resoudreIdentite", () => {
  it("extrait le nom et l'avatar depuis Google OAuth (picture + full_name)", () => {
    const compte = {
      email: "maxime.dupont@gmail.com",
      user_metadata: {
        full_name: "Maxime Dupont",
        picture: "https://lh3.googleusercontent.com/a/avatar123",
      },
    };
    const identite = resoudreIdentite(compte, null);
    expect(identite.nom).toBe("Maxime Dupont");
    expect(identite.avatarUrl).toBe("https://lh3.googleusercontent.com/a/avatar123");
    expect(identite.initiale).toBe("M");
  });

  it("gère les variantes OIDC Google (name, given_name + family_name, avatar_url)", () => {
    const compte1 = {
      email: "alex@gmail.com",
      user_metadata: {
        name: "Alexandre Martin",
        avatar_url: "https://lh3.googleusercontent.com/a/avatar456",
      },
    };
    const identite1 = resoudreIdentite(compte1, null);
    expect(identite1.nom).toBe("Alexandre Martin");
    expect(identite1.avatarUrl).toBe("https://lh3.googleusercontent.com/a/avatar456");
    expect(identite1.initiale).toBe("A");

    const compte2 = {
      email: "sophie.l@gmail.com",
      user_metadata: {
        given_name: "Sophie",
        family_name: "Laurent",
        picture: "https://example.com/sophie.png",
      },
    };
    const identite2 = resoudreIdentite(compte2, null);
    expect(identite2.nom).toBe("Sophie Laurent");
    expect(identite2.avatarUrl).toBe("https://example.com/sophie.png");
    expect(identite2.initiale).toBe("S");
  });

  it("priorise un profil explicite renseigné par l'utilisateur", () => {
    const compte = {
      email: "maxime@test.com",
      user_metadata: {
        full_name: "Maxime Google",
        picture: "https://google.com/pic.jpg",
      },
    };
    const profil = {
      prenom: "Maxou",
      avatarUrl: "https://custom.com/avatar.jpg",
    };
    const identite = resoudreIdentite(compte, profil);
    expect(identite.nom).toBe("Maxou");
    expect(identite.avatarUrl).toBe("https://custom.com/avatar.jpg");
    expect(identite.initiale).toBe("M");
  });

  it("ignore le profil par défaut 'Utilisateur' pour utiliser les métadonnées OAuth", () => {
    const compte = {
      email: "julie.b@gmail.com",
      user_metadata: {
        full_name: "Julie Bertin",
      },
    };
    const profil = {
      prenom: "Utilisateur",
      avatarUrl: null,
    };
    const identite = resoudreIdentite(compte, profil);
    expect(identite.nom).toBe("Julie Bertin");
    expect(identite.avatarUrl).toBeNull();
    expect(identite.initiale).toBe("J");
  });

  it("ignore le prénom en base s'il n'est que le préfixe du mail automatique issu de l'inscription", () => {
    const compte = {
      email: "cyril.hup2716@gmail.com",
      user_metadata: {
        full_name: "Cyril Hup",
        picture: "https://lh3.googleusercontent.com/a/cyril123",
      },
    };
    const profil = {
      prenom: "cyril.hup2716",
      avatarUrl: null,
    };
    const identite = resoudreIdentite(compte, profil);
    expect(identite.nom).toBe("Cyril Hup");
    expect(identite.avatarUrl).toBe("https://lh3.googleusercontent.com/a/cyril123");
    expect(identite.initiale).toBe("C");
  });

  it("retombe sur le préfixe email ou Compte en l'absence de métadonnées", () => {
    const compte = {
      email: "dev.test@exemple.org",
      user_metadata: {},
    };
    const identite = resoudreIdentite(compte, null);
    expect(identite.nom).toBe("dev.test");
    expect(identite.avatarUrl).toBeNull();
    expect(identite.initiale).toBe("D");

    const identiteVide = resoudreIdentite(null, null);
    expect(identiteVide.nom).toBe("Compte");
    expect(identiteVide.avatarUrl).toBeNull();
    expect(identiteVide.initiale).toBe("C");
  });
});
