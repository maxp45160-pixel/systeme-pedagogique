import { expect, it } from "vitest";
import { encoderCreationDomaineDeleguee, lireCreationDomaineDeleguee, prefixeCreationDeleguee, type CreationDomaineDeleguee } from "./creation-domaine-deleguee";
import { assemblerReferentiel } from "@/lib/domain/referentiel-compte";

const recu: CreationDomaineDeleguee = { version: 1, cle: "a".repeat(64), compteId: "compte", documentId: "doc", analyseId: "a", domaineId: "astronomie", nom: "Astronomie", statut: "reservee" };
it("décode une réservation et une création sans convertir une trace invalide en absence", () => {
  for (const statut of ["reservee", "cree"] as const) expect(lireCreationDomaineDeleguee(encoderCreationDomaineDeleguee({ ...recu, statut }))).toEqual({ ...recu, statut });
  for (const absent of [undefined, null, ""]) expect(lireCreationDomaineDeleguee(absent)).toBeUndefined();
  for (const value of ["illisible", {}, "%", encoderCreationDomaineDeleguee({ ...recu, domaineId: "autre" }), encoderCreationDomaineDeleguee({ ...recu, cle: "fausse" }), encodeURIComponent(JSON.stringify({ ...recu, statut: "terminee" }))]) {
    expect(() => lireCreationDomaineDeleguee(value)).toThrow("trace de création déléguée est invalide");
  }
});
it("réserve un préfixe serveur valide sans créer de compétence ni fusionner avec une archive", () => {
  expect(prefixeCreationDeleguee("Astronomie", assemblerReferentiel([], []))).toBe("ASTR");
  for (const d of [{ id: "astronomie", nom: "Espace", prefixe: "ESP" }, { id: "espace", nom: "  ASTRONOMIE  ", prefixe: "ESP" }, { id: "espace", nom: "Espace", prefixe: "ASTR" }]) {
    expect(() => prefixeCreationDeleguee("Astronomie", assemblerReferentiel([{ ...d, origine: "utilisateur", archive: true, description: "", version: 1, ordre: 0 }], []))).toThrow();
  }
  expect(() => prefixeCreationDeleguee("1234", assemblerReferentiel([], []))).toThrow("nom proposé");
});
