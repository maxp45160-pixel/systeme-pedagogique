import { expect, it } from "vitest";
import { evaluerDelegationClassement } from "./delegation-classement";
import type { DepotDocumentaire } from "./depot";
import type { ContexteOrganisationDepot } from "./organisation-depot";

const contexte: ContexteOrganisationDepot = { compteId: "compte", domaines: [{ id: "maths", nom: "Mathématiques", prefixe: "MAT", description: "" }], competences: [] };
function ressource(): DepotDocumentaire {
  return { id: "doc", version: 2, titre: "Source", type: "support", note: "Une équation", creeLe: "2026-09-16", modifieLe: "v1", pieces: [], corrections: [], competencesLiees: [], analyses: [{
    id: "a", documentId: "doc", empreinte: "source", statut: "terminee", pages: [], couvertures: [], erreur: null, creeLe: "2026-09-16", modifieLe: "2026-09-16", restitution: {
      version: 2, modele: "modele", creeLe: "2026-09-16", elements: [], couvertures: [], organisation: { titreSuggere: "Autre titre", typeSuggere: "cours", justification: "Équation", sources: [{ documentId: "doc", citation: "Une équation" }], domaine: { mode: "existant", id: "maths", justification: "Une équation", sources: [{ documentId: "doc", citation: "Une équation" }] }, competences: [{ mode: "existante", code: "MAT-01", justification: "Équation", sources: [{ documentId: "doc", citation: "Une équation" }] }] },
    },
  }] };
}

it("autorise uniquement l'identifiant explicite vivant, sans consommer les propositions de compétences", () => {
  const depot = ressource(); const avant = structuredClone(depot);
  expect(evaluerDelegationClassement(depot, "a", contexte)).toEqual({ statut: "eligible", domaineId: "maths" });
  expect(depot).toEqual(avant);
  expect(evaluerDelegationClassement(depot, "a", { ...contexte, domaines: [{ ...contexte.domaines[0], id: "autre" }] }).statut).toBe("a-controler");
});
it("garde le nouveau domaine, l'absence de domaine et les justifications insuffisantes au contrôle", () => {
  for (const domaine of [null, { mode: "nouveau" as const, nom: "Mathématiques", description: "", justification: "Oui", sources: [{ documentId: "doc", citation: "équation" }] }, { mode: "existant" as const, id: "maths", justification: " ", sources: [] }, { mode: "existant" as const, id: "maths", justification: "Oui", sources: [{ documentId: "autre", citation: "équation" }] }]) {
    const depot = ressource(); const restitution = depot.analyses[0].restitution!;
    if (restitution.version === 2) restitution.organisation.domaine = domaine;
    expect(evaluerDelegationClassement(depot, "a", contexte).statut).toBe("a-controler");
  }
});
it("refuse V1, réanalyses, analyse remplacée ou inachevée", () => {
  const depot = ressource();
  expect(evaluerDelegationClassement({ ...depot, version: 1 }, "a", contexte).statut).toBe("a-controler");
  expect(evaluerDelegationClassement(depot, "ancienne", contexte).statut).toBe("a-controler");
  expect(evaluerDelegationClassement({ ...depot, analyses: [...depot.analyses, { ...depot.analyses[0], id: "b" }] }, "a", contexte).statut).toBe("a-controler");
  for (const statut of ["en-cours", "interrompue", "echec"] as const) {
    expect(evaluerDelegationClassement({ ...depot, analyses: [{ ...depot.analyses[0], statut }] }, "a", contexte).statut).toBe("a-controler");
  }
});
it("refuse une incertitude signalée ou une page incertaine", () => {
  const depot = ressource();
  depot.analyses[0].pages = [{ pieceId: "p", page: 1, texte: "équation ?", incertain: true }];
  expect(evaluerDelegationClassement(depot, "a", contexte).statut).toBe("a-controler");
  depot.analyses[0].pages = [];
  depot.analyses[0].restitution!.elements = [{ id: "i", nature: "incertitude", texte: "Sujet ambigu", sources: [] }];
  expect(evaluerDelegationClassement(depot, "a", contexte).statut).toBe("a-controler");
});
it("préserve domaines, corrections, liens et choix précédents, y compris métadonnées non interprétables", () => {
  const depot = ressource();
  const changements: Partial<DepotDocumentaire>[] = [{ domaineId: "maths" }, { rangementStatut: "a-trier" }, { rangementOrigine: "personne" }, { referentielAnalyseId: "a" }, { competencesLiees: ["MAT-01"] }, { corrections: [{ id: "c", elementId: null, texte: "Autre sujet", creeLe: "maintenant" }] }, { brouillonClassement: { analyseId: "a", domaine: null, codes: [], propositions: [], modifieLe: "maintenant", origine: "personne" } }];
  for (const changement of changements) expect(evaluerDelegationClassement({ ...depot, ...changement }, "a", contexte).statut).toBe("preserve");
  for (const cle of ["classement_confirmation", "classement_brouillon", "rangement_empreinte", "rangement_origine", "domaine"] ) {
    expect(evaluerDelegationClassement(depot, "a", contexte, { [cle]: "valeur non interprétable" }).statut).toBe("preserve");
  }
});
it("reconnaît un reçu sans rétablir le domaine après un choix humain ultérieur", () => {
  const depot: DepotDocumentaire = { ...ressource(), domaineId: "maths", rangementOrigine: "assistant", rangementAnalyseId: "a", rangementRevuLe: "maintenant", rangementStatut: "rangee" };
  expect(evaluerDelegationClassement(depot, "a", contexte).statut).toBe("rattache");
  expect(evaluerDelegationClassement({ ...depot, domaineId: "autre" }, "a", contexte).statut).toBe("preserve");
  expect(evaluerDelegationClassement({ ...depot, rangementOrigine: "personne" }, "a", contexte).statut).toBe("preserve");
  expect(evaluerDelegationClassement(depot, "a", contexte, { classement_confirmation: "en cours" }).statut).toBe("preserve");
});
