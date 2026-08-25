import { describe, expect, it } from "vitest";
import { classerInscription } from "./inscription";

/**
 * Les quatre situations du parcours d'inscription (chantier du 25/08/2026) :
 * compte nouveau, compte existant confirmé (erreur explicite), compte existant
 * non confirmé / masqué par Supabase — et Google, qui ne passe PAS par cette
 * classification : OAuth redirige via `/auth/callback`, il n'y a rien à
 * classer côté formulaire.
 */
describe("classerInscription", () => {
  it("un nouveau compte avec confirmation active porte une identité en attente", () => {
    expect(
      classerInscription({ user: { identities: [{ provider: "email" }] } }),
    ).toEqual({ cas: "confirmation-envoyee" });
  });

  it("une session posée directement signifie connecté (confirmations désactivées)", () => {
    expect(classerInscription({ session: { access_token: "x" }, user: null })).toEqual({
      cas: "connecte",
    });
  });

  it("l'erreur explicite de doublon bascule vers le compte existant", () => {
    expect(
      classerInscription({ error: { message: "User already registered" } }),
    ).toEqual({ cas: "compte-existant" });
    expect(
      classerInscription({ error: { message: "Un compte existe déjà avec cet e-mail." } }),
    ).toEqual({ cas: "compte-existant" });
  });

  it("le compte existant masqué revient SANS identité — signal ambigu, jamais tranché", () => {
    // Comportement documenté de Supabase : succès sans session, utilisateur
    // avec `identities: []` pour ne pas révéler l'existence du compte.
    expect(classerInscription({ user: { identities: [] } })).toEqual({
      cas: "existe-peut-etre",
    });
  });

  it("une réponse atypique reste dans le cas neutre, pas un succès affirmé", () => {
    expect(classerInscription({ user: null })).toEqual({ cas: "existe-peut-etre" });
    expect(classerInscription({})).toEqual({ cas: "existe-peut-etre" });
  });

  it("toute autre erreur est transmise telle quelle", () => {
    expect(
      classerInscription({
        error: { message: "Password should be at least 8 characters." },
      }),
    ).toEqual({ cas: "erreur", message: "Password should be at least 8 characters." });
  });

  it("une erreur de mot de passe faible n'est PAS prise pour un doublon", () => {
    // « already » peut apparaître dans un message quelconque : le motif exige
    // la formulation complète.
    expect(
      classerInscription({ error: { message: "Signup requires a valid password" } }),
    ).toEqual({ cas: "erreur", message: "Signup requires a valid password" });
  });
});
