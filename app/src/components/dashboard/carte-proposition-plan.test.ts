import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ActionCandidate } from "@/lib/engine/action-candidate";
import type { PlanPropose } from "@/lib/engine/planification-temporelle";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import {
  CartePropositionPlan,
  traduireErreurProposition,
} from "./carte-proposition-plan";

const candidate: ActionCandidate = {
  candidateId: "identifiant-interne",
  source: "existing-activity",
  target: { skillCodes: ["DEV-01"], engagementIds: [] },
  intervention: "resolve",
  expectedEffect: "measurement",
  title: "Réviser une notion",
  durationMinutes: 30,
  reasons: ["pour consolider les bases"],
  constraints: [],
  reservations: [],
};

const plan: PlanPropose = {
  slots: [{
    candidate,
    plannedFor: "2026-08-29T09:00:00.000Z",
    endsAt: "2026-08-29T09:30:00.000Z",
    durationMinutes: 30,
    intervention: "resolve",
    expectedEffect: "measurement",
    reasons: candidate.reasons,
    constraints: [],
    reservations: [],
  }],
  readiness: [],
  constraints: [],
  reservations: [],
};

function rendu(propositionPlan: PlanPropose = plan): string {
  return renderToStaticMarkup(createElement(CartePropositionPlan, {
    proposition: { plan: propositionPlan, propositionRef: "plan-ab12" },
  }));
}

describe("carte de proposition de plan", () => {
  it("affiche les commandes d'arbitrage et masque la provenance technique", () => {
    const html = rendu({
      ...plan,
      slots: [
        plan.slots[0],
        {
          ...plan.slots[0],
          candidate: { ...candidate, candidateId: "autre-identifiant-interne" },
          plannedFor: "2026-08-29T10:00:00.000Z",
          endsAt: "2026-08-29T10:30:00.000Z",
        },
      ],
    });

    expect(html).toContain("Tout sélectionner");
    expect(html).toContain("Tout désélectionner");
    expect(html).toContain("Ignorer cette proposition");
    expect(html).toContain("Accepter les séances sélectionnées");
    expect(html).not.toContain("identifiant-interne");
    expect(html).not.toContain("candidate diagnose");
    expect(html).not.toContain("plan-ab12");
  });

  it("explique un état vide en langage courant sans exposer les réserves internes", () => {
    const html = rendu({
      ...plan,
      slots: [],
      constraints: ["aucune disponibilité déclarée exploitable"],
      reservations: ["candidate diagnose non planifiée : aucun créneau compatible"],
    });

    expect(html).toContain("Aucune séance à confirmer pour le moment");
    expect(html).toContain("Aucun créneau déclaré");
    expect(html).not.toContain("candidate diagnose");
    expect(html).not.toContain("identifiant-interne");
  });

  it("traduit les erreurs réseau et Supabase en messages réessayables", () => {
    expect(traduireErreurProposition(new Error("Failed to fetch"))).toContain("réessayez");
    expect(traduireErreurProposition(new Error("40001 conflit"))).toContain("Actualisez");
    expect(traduireErreurProposition(new Error("column proposition_ref does not exist"))).toContain("mise à jour du service");
    expect(traduireErreurProposition(new Error("candidateId interne"))).not.toContain("candidateId");
  });
});
