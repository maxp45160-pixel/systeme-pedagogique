import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const progression = readFileSync(new URL("../progression/page.tsx", import.meta.url), "utf8");
const mesCours = readFileSync(new URL("../atelier/page.tsx", import.meta.url), "utf8");
const seances = readFileSync(new URL("../seances/page.tsx", import.meta.url), "utf8");

describe("composition du tableau de bord", () => {
  it("place l'organisation en haut puis la priorité avant les alternatives", () => {
    const organisation = page.indexOf("Organiser dans Mes cours");
    const aujourdHui = page.indexOf("<BlocAujourdHui");
    const recommandation = page.indexOf("<CarteProchaineAction");
    const alternatives = page.indexOf("<PistesAlternatives");

    expect(organisation).toBeGreaterThan(-1);
    expect(aujourdHui).toBeGreaterThan(-1);
    expect(organisation).toBeLessThan(aujourdHui);
    expect(recommandation).toBeGreaterThan(aujourdHui);
    expect(alternatives).toBeGreaterThan(recommandation);
  });

  it("remplace le grand vide du jour par un statut discret", () => {
    expect(page).toContain("!aUneSeanceAujourdhui");
    expect(page).toContain("Rien de planifié aujourd&apos;hui");
    expect(page).toContain("aUneSeanceAujourdhui && (");
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

  it("réserve les échéances à Séances", () => {
    expect(page).not.toContain("<CarteEcheances");
    expect(mesCours).not.toContain("<CarteEcheances");
    expect(seances).toContain("<CarteEcheances");
    expect(page).not.toContain("BlocEcheancePrioritaire");
    expect(page).not.toContain("Avant vos échéances");
    expect((seances.match(/<CarteEcheances/g) ?? []).length).toBe(1);
  });

  it("réserve la continuité à Progression", () => {
    expect(page).not.toContain("<MiniActivite");
    expect(progression).toContain("<MiniActivite");
  });

  it("place le bilan dans la colonne droite de Progression", () => {
    expect(progression).toMatch(
      /<TopCompetences etats=\{ctx\.etats\} \/>\s*<BilanCroissanceLie[\s\S]*?<\/div>\s*<\/div>/,
    );
  });

  it("garde la recommandation séparée tout en offrant la planification explicite", () => {
    const carte = readFileSync(
      new URL("../../../components/dashboard/prochaine-action.tsx", import.meta.url),
      "utf8",
    );
    expect(carte).toContain("ActionPlanifierRecommandation");
    expect(carte).toContain("<ActionPlanifierRecommandation key={exercice.id} exerciceId={exercice.id} />");
    expect(carte).toContain("Commencer l’exercice");
    const planification = readFileSync(
      new URL("../../../components/dashboard/action-planifier-recommandation.tsx", import.meta.url),
      "utf8",
    );
    expect(planification).toContain('className="!min-h-12 !px-5 !text-base"');
  });

  it("remonte l'organisation dans l'en-tête au profit de Mes cours", () => {
    expect(page).not.toContain("<BoutonIntentionDashboard");
    expect(page).not.toContain("<VoiesApprentissageDashboard");
    expect(page).not.toContain("<BoutonEcheance");
    expect(page).toContain("Organiser dans Mes cours");
    expect(page).toContain('href="/atelier"');
  });

  it("cadre la priorité et les alternatives", () => {
    const priorite = readFileSync(
      new URL("../../../components/dashboard/prochaine-action.tsx", import.meta.url),
      "utf8",
    );
    const alternatives = readFileSync(
      new URL("../../../components/dashboard/pistes-alternatives.tsx", import.meta.url),
      "utf8",
    );
    expect(priorite).toContain('<Carte accent className="relative h-full overflow-hidden">');
    expect(alternatives).toContain('<Carte className="h-full overflow-hidden">');
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
