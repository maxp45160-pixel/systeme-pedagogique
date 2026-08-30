import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { ContexteIntention } from "./contexte-intention";
import {
  BoutonIntentionDashboard,
  VoiesApprentissageDashboard,
} from "./bouton-intention";

function rendre(element: React.ReactNode): string {
  return renderToStaticMarkup(
    createElement(
      ContexteIntention.Provider,
      { value: { ouvrir: vi.fn(), ouverte: false } },
      element,
    ),
  );
}

describe("entrée d'apprentissage du tableau de bord", () => {
  it("présente les choix de la barre comme des actions compréhensibles", () => {
    const html = rendre(createElement(BoutonIntentionDashboard));

    expect(html).toContain("Je veux…");
    expect(html).toContain("Travailler maintenant");
    expect(html).toContain("Créer un module de cours");
    expect(html).toContain("Commencer un apprentissage personnel");
    expect(html).not.toContain("Besoin d’apprentissage");
  });

  it("propose directement les deux créations quand elles sont absentes", () => {
    const html = rendre(
      createElement(VoiesApprentissageDashboard, {
        nombreModules: 0,
        nombreProgressions: 0,
      }),
    );

    expect(html).toContain("Créer un module de cours");
    expect(html).toContain("Créer un apprentissage personnel");
    expect(html).toContain("une matière, une période, vos supports et vos échéances");
    expect(html).toContain("hors d’un cours ou d’un semestre");
    expect(html).not.toContain('href="/atelier?document=domaines"');

    const source = readFileSync(new URL("./bouton-intention.tsx", import.meta.url), "utf8");
    expect(source).toContain('ouvrir({ usageDomaine: "module" })');
    expect(source).toContain('ouvrir({ usageDomaine: "continu" })');
  });

  it("transforme les créations en résumés quand les voies existent", () => {
    const html = rendre(
      createElement(VoiesApprentissageDashboard, {
        nombreModules: 3,
        nombreProgressions: 2,
      }),
    );

    expect(html).toContain("Mes cours");
    expect(html).toContain("3 modules actifs");
    expect(html).toContain("Mes apprentissages");
    expect(html).toContain("2 sujets travaillés dans la durée");
    expect(html.match(/href="\/atelier\?document=domaines"/g)).toHaveLength(2);
  });
});
