import { describe, expect, it } from "vitest";
import { CORPUS_QUALITE_DOCUMENTAIRE } from "./fixtures/qualite-documentaire";
import { validerOrganisationDepot } from "./depot-validation";

describe("recette documentaire synthétique — validation, pas génération", () => {
  it.each(CORPUS_QUALITE_DOCUMENTAIRE)("$id : $controleTechnique techniquement ; jugement $jugementSemantique", (cas) => {
    const avant = structuredClone(cas.reponse);
    const documentId = cas.reponse.organisation.sources[0].documentId;
    const valider = () => validerOrganisationDepot(cas.reponse, documentId, cas.note, cas.pages, cas.referentiel);
    if (cas.controleTechnique === "refuse") {
      expect(valider).toThrow(cas.motifRefus);
    } else {
      const resultat = valider();
      expect(resultat.competences).toHaveLength(cas.reponse.organisation.competences.length);
      expect(resultat.domaine).toEqual(cas.reponse.organisation.domaine);
      expect(resultat).not.toHaveProperty("observations");
    }
    // Même un refus ne déduplique ni ne réécrit le contenu historique reçu.
    expect(cas.reponse).toEqual(avant);
  });

  it("rend visibles les limites sémantiques du validateur sur plusieurs matières", () => {
    const limites = CORPUS_QUALITE_DOCUMENTAIRE.filter((cas) => cas.controleTechnique === "accepte" && cas.jugementSemantique === "a-corriger");
    expect(limites.map((cas) => cas.id)).toEqual(["domaine-utilisateur-indu", "biologie-geste-invente", "recouvrement-semantique"]);
    // Ces sorties mal fondées PASSENT actuellement : une citation n'est pas un juge sémantique.
    for (const cas of limites) expect(() => validerOrganisationDepot(cas.reponse, cas.reponse.organisation.sources[0].documentId, cas.note, cas.pages, cas.referentiel)).not.toThrow();
  });
});
