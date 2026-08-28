import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { PlanDiff } from "@/lib/engine/revision-plan";

vi.mock("@/lib/ui/hydratation", () => ({ useEstHydrate: () => true }));
vi.mock("react-dom", () => ({ createPortal: (children: unknown) => children }));
vi.stubGlobal("document", { body: {} });

import { ModaleRevuePlan } from "./modale-revue-plan";

const diff: PlanDiff = {
  changes: [{
    kind: "deplacer",
    sessionId: "session-1",
    candidateId: "candidate-1",
    before: {
      plannedFor: "2026-08-28T09:00:00.000Z",
      endsAt: "2026-08-28T09:30:00.000Z",
      durationMinutes: 30,
      label: "Réviser les bases",
      intervention: "resolve",
      expectedEffect: "measurement",
    },
    after: {
      plannedFor: "2026-08-28T11:00:00.000Z",
      endsAt: "2026-08-28T11:30:00.000Z",
      durationMinutes: 30,
      label: "Réviser les bases",
      intervention: "resolve",
      expectedEffect: "measurement",
    },
    reason: "Une disponibilité déclarée favorise un autre créneau.",
    reservations: ["Le déplacement reste soumis à votre confirmation."],
  }],
  silentCandidateIds: ["candidate-silent"],
  conflicts: [],
  constraints: ["Séance acceptée protégée"],
  reservations: ["Aucune observation n'est produite par le déplacement."],
};

describe("modale de revue du plan", () => {
  it("présente une revue groupée accessible avec ses trois actions", () => {
    const markup = renderToStaticMarkup(createElement(ModaleRevuePlan, {
      diff,
      ouverte: true,
      onFermer: () => undefined,
      onAppliquer: () => undefined,
      onModifier: () => undefined,
      onGarder: () => undefined,
    }));

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain("Raison principale");
    expect(markup).toContain("Avant :");
    expect(markup).toContain("Après :");
    expect(markup).toContain("Réserves");
    expect(markup).toContain("Appliquer ces ajustements");
    expect(markup).toContain("Modifier");
    expect(markup).toContain("Garder mon plan");
    expect(markup).toContain("min-h-11");
    expect(markup).not.toContain("candidate-silent");
  });
});
