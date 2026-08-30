import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { LearningSession } from "@/lib/domain/types";
import { construireSeancesDuJour } from "@/lib/engine/seances-du-jour";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/store/seance-actions", () => ({
  demarrerSeance: vi.fn(async () => "/seances?session=ses-planifiee"),
}));
vi.mock("@/lib/store/protocole-actions", () => ({
  preparerSeancePlanifieeAction: vi.fn(async () => undefined),
}));
vi.mock("@/lib/tutor/cle-client", () => ({
  lireConfigTuteur: vi.fn(() => undefined),
}));

import { BlocAujourdHui } from "./bloc-aujourd-hui";

function session(overrides: Partial<LearningSession> = {}): LearningSession {
  return {
    id: "ses-planifiee",
    date: "2026-08-30T09:00:00.000Z",
    domaines: ["developpement"],
    skillCodes: ["DEV-01"],
    activites: [],
    genereAutomatiquement: false,
    statut: "planifiee",
    planifieePour: "2026-08-30T09:00:00.000Z",
    interventions: [],
    ...overrides,
  };
}

function rendu(
  sessions: readonly LearningSession[],
  jour = "2026-08-30",
): string {
  return renderToStaticMarkup(createElement(BlocAujourdHui, {
    sessions,
    initialView: construireSeancesDuJour(sessions, jour),
    compteId: "compte-1",
    domaines: [{ id: "developpement", nom: "Développement" }],
  }));
}

describe("BlocAujourdHui", () => {
  it("reste discret quand aucune séance n'est planifiée", () => {
    const html = rendu([]);

    expect(html).toContain("Aujourd’hui");
    expect(html).toContain("Aucune séance planifiée aujourd’hui");
    expect(html).not.toContain("Commencer");
    expect(html).not.toContain("Continuer");
  });

  it("affiche une planifiée, ses détails et son action de démarrage", () => {
    const html = rendu([session()]);

    expect(html).toContain("Planifiée");
    expect(html).toContain("Commencer");
    expect(html).toContain("Détails");
    expect(html).toContain("Intervention à préciser");
    expect(html).toContain("Développement");
    expect(html).toContain("min-h-11");
    expect(html).toContain('type="button"');
  });

  it("affiche une active ancienne avec Continuer, sans duplicata d'action", () => {
    const active = session({
      id: "ses-active",
      statut: "en-cours",
      date: "2026-08-29T20:00:00.000Z",
      planifieePour: "2026-08-29T20:00:00.000Z",
    });
    const html = rendu([active]);

    expect(html).toContain("En cours");
    expect(html).toContain("Continuer");
    expect(html).not.toContain("Commencer");
  });

  it("regroupe plusieurs séances dans un ordre stable et n'ajoute ni déplacement ni annulation", () => {
    const html = rendu([
      session({ id: "ses-b", planifieePour: "2026-08-30T11:00:00.000Z" }),
      session({ id: "ses-a", planifieePour: "2026-08-30T08:00:00.000Z" }),
    ]);

    expect(html.indexOf("ses-a")).toBeLessThan(html.indexOf("ses-b"));
    expect(html).not.toContain("Déplacer");
    expect(html).not.toContain("Annuler");
  });
});
