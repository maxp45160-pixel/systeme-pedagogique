import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

describe("composition du tableau de bord", () => {
  it("place Aujourd'hui avant la configuration et garde la recommandation séparée", () => {
    const aujourdHui = page.indexOf("<BlocAujourdHui");
    const configuration = page.indexOf("<BoutonIntentionDashboard");
    const recommandation = page.indexOf("<CarteProchaineAction");

    expect(aujourdHui).toBeGreaterThan(-1);
    expect(configuration).toBeGreaterThan(aujourdHui);
    expect(recommandation).toBeGreaterThan(configuration);
  });

  it("ne rend plus l'ancienne carte active en plus du bloc du jour", () => {
    expect(page).not.toContain("CarteSeanceActive");
    expect(page).toContain("<CarteProchaineAction");
  });

  it("identifie chaque tentative ouverte par son identifiant propre", () => {
    expect(page).toContain("{enCours.map(({ id, exercice, depuis }) => (");
    expect(page).toContain("key={id}");
    expect(page).not.toContain("key={exercice.id}");
  });

  it("garde une seule surface dédiée aux échéances", () => {
    expect(page).toContain("<CarteEcheances");
    expect(page).not.toContain("BlocEcheancePrioritaire");
    expect(page).not.toContain("Avant vos échéances");
    expect((page.match(/<CarteEcheances/g) ?? []).length).toBe(1);
  });

  it("garde la recommandation séparée tout en offrant la planification explicite", () => {
    const carte = readFileSync(
      new URL("../../../components/dashboard/prochaine-action.tsx", import.meta.url),
      "utf8",
    );
    expect(carte).toContain("ActionPlanifierRecommandation");
    expect(carte).toContain("<ActionPlanifierRecommandation key={exercice.id} exerciceId={exercice.id} />");
    expect(carte).toContain("Commencer l’exercice");
  });

  it("confie les deux voies d'apprentissage au point d'entrée actionnable", () => {
    expect(page).toContain("<VoiesApprentissageDashboard");
    expect(page).toContain("nombreModules={domainesParUsage.modulesActifs.length}");
    expect(page).toContain("nombreProgressions={domainesParUsage.continues.length}");
    expect(page).not.toContain('href="/atelier?document=domaines"\n          className="group rounded-xl');
  });

  it("génère directement un exercice ciblé quand la file n'a plus de candidate", () => {
    const carte = readFileSync(
      new URL("../../../components/dashboard/prochaine-action.tsx", import.meta.url),
      "utf8",
    );
    expect(carte).toContain("<BoutonGenerer");
    expect(carte).toContain('libelle="Générer puis commencer"');
    expect(carte).toContain("ouvrirEnFocusApresAcceptation");
    expect(page).toContain("competencesGeneration={competencesGeneration}");
    expect(page).toContain("calibragesGeneration={calibragesGeneration}");
  });
});
