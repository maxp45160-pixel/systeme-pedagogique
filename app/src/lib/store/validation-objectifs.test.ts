import { describe, expect, it } from "vitest";
import {
  DonneeObjectifInvalide,
  cibleObjectifVersColonnes,
  validerEvenementLigne,
  validerObjectifLigne,
  validerResultatCommandeLot4,
} from "./validation-objectifs";

const ligneObjectif = {
  id: "objectif-1",
  formulation: "Comprendre les bases.",
  cible_type: "competence-locale",
  cible_element_global_id: null,
  cible_domaine_local_id: null,
  cible_competence_local_code: "DEV-01",
  cible_relation_globale_id: null,
  priorite: 2,
  horizon: "court-terme",
  echeance_le: "2026-09-30",
  statut: "brouillon",
  version: 1,
  archive_le: null,
  created_at: "2026-08-20T10:00:00.000Z",
  updated_at: "2026-08-20T10:00:00.000Z",
};

describe("validation Supabase du lot 4", () => {
  it("traduit une cible locale sans fabriquer de domaine", () => {
    expect(validerObjectifLigne(ligneObjectif).cible).toEqual({
      type: "competence-locale",
      code: "DEV-01",
    });
    expect(cibleObjectifVersColonnes({ type: "domaine-local", domaineId: "algo" })).toEqual({
      cible_type: "domaine-local",
      cible_element_global_id: null,
      cible_domaine_local_id: "algo",
      cible_competence_local_code: null,
      cible_relation_globale_id: null,
    });
  });

  it("refuse une ligne dont la cible est incomplète", () => {
    expect(() => validerObjectifLigne({ ...ligneObjectif, cible_competence_local_code: null }))
      .toThrow(DonneeObjectifInvalide);
  });

  it("valide un événement sourcé et le résultat RPC", () => {
    const evenement = validerEvenementLigne({
      id: "event-1",
      request_id: "req-1",
      type: "objectif-cree",
      acteur: "personne",
      consentement: true,
      survenu_le: "2026-08-20T10:00:00.000Z",
      objectif_id: "objectif-1",
      parcours_id: null,
      session_id: null,
      provenance: { type: "personne", reference: "declaration-1" },
      payload: { objectif: ligneObjectif },
    });
    expect(evenement.provenance.reference).toBe("declaration-1");
    expect(validerResultatCommandeLot4({
      requestId: "req-1",
      rejoue: false,
      eventId: evenement.id,
      eventType: evenement.type,
      objectifId: evenement.objectifId,
    }).eventType).toBe("objectif-cree");
  });
});
