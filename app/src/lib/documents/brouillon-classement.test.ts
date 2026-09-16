import { expect, it } from "vitest";
import { encoderBrouillonClassement, lireBrouillonClassement, validerEntreeBrouillonClassement, type EntreeBrouillonClassement } from "./brouillon-classement";
import { validerChoixClassementRessources } from "./classement-ressources";
import { definirChampsFrontMatter, parserFrontMatter } from "./markdown";
import { appliquerRangementDepot } from "./organisation-depot";

const entree: EntreeBrouillonClassement = { documentId: "doc", updatedAtAttendu: "v1", analyseId: "a", domaine: { mode: "nouveau", nom: "Mathématiques" }, codes: [], propositions: [] };

it("conserve un choix humain incomplet sans le rendre confirmable", () => {
  const brouillon = validerEntreeBrouillonClassement(entree);
  expect(brouillon.domaine).toEqual({ mode: "nouveau", nom: "Mathématiques" });
  expect(() => validerChoixClassementRessources([brouillon])).toThrow();
  const choixModule = { ...entree, domaine: { mode: "nouveau", nom: "Cours", usage: { type: "module" } } };
  expect(validerEntreeBrouillonClassement(choixModule).domaine).toEqual(choixModule.domaine);
  expect(() => validerChoixClassementRessources([choixModule])).toThrow("année");
});
it("conserve un rejet explicite du domaine et n'en fabrique pas un", () => {
  expect(validerEntreeBrouillonClassement({ ...entree, domaine: null }).domaine).toBeNull();
});
it("passe réellement dans le frontmatter sans perdre les caractères ni toucher le texte source", () => {
  const brouillon = { analyseId: entree.analyseId, domaine: entree.domaine, codes: [], propositions: [], modifieLe: "2026-09-15T22:00:00Z", origine: "personne" as const };
  const md = definirChampsFrontMatter("---\ntitle: Original\n---\nTexte source inchangé.", { classement_brouillon: encoderBrouillonClassement(brouillon) });
  expect(lireBrouillonClassement(parserFrontMatter(md).frontMatter.classement_brouillon)).toEqual(brouillon);
  expect(md).toContain("Texte source inchangé.");
});
it("refuse les brouillons altérés au lieu de revenir silencieusement à l'IA", () => {
  for (const v of [123, "%zz", "[]", encoderBrouillonClassement({ analyseId: "a", domaine: null, codes: [], propositions: [], modifieLe: "invalide", origine: "personne" })]) expect(() => lireBrouillonClassement(v)).toThrow("pas été remplacé");
  expect(lireBrouillonClassement(undefined)).toBeUndefined();
  expect(lireBrouillonClassement("")).toBeUndefined();
});
it("refuse indices, sélections et usages invalides avant écriture", () => {
  for (const v of [{ ...entree, propositions: [-1] }, { ...entree, codes: ["MAT-01", "MAT-01"] }, { ...entree, domaine: { mode: "nouveau", nom: "Maths", usage: { type: "inventé" } } }]) expect(() => validerEntreeBrouillonClassement(v)).toThrow();
});
it("une correction effective remplace le brouillon même hors de la fenêtre de confirmation", () => {
  const md = appliquerRangementDepot("---\ntitle: Livret\nclassement_brouillon: ancien\n---\n# Livret\n", { titre: "Livret", type: "cours", domaineId: "domaine-corrige", codes: [], analyseId: "a" }, "2026-09-15T22:00:00Z", "empreinte");
  expect(parserFrontMatter(md).frontMatter.classement_brouillon).toBe("");
  expect(parserFrontMatter(md).frontMatter.domaine).toBe("domaine-corrige");
});
