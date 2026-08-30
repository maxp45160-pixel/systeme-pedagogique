import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./vue-seance-detail.tsx", import.meta.url), "utf8");

describe("composition de la suite après une séance", () => {
  it("exclut toutes les activités déjà traversées avant de proposer la suite", () => {
    expect(source).toContain("const exercicesDejaTraverses = new Set([\n    ...avancement.menes,\n    ...avancement.abandonnes,\n  ]);");

    const appels = source.match(/suiteApresTravail\(\{[\s\S]*?\n      \}\)/g) ?? [];
    expect(appels.length).toBeGreaterThanOrEqual(2);
    for (const appel of appels) {
      expect(appel).toContain("exercicesExclus: exercicesDejaTraverses");
    }
  });

  it("permet de relire une activité traversée sans ouvrir une nouvelle tentative", () => {
    expect(source).toContain("const explicite = demandeDansSeance;");
    expect(source).toContain("const relecture = Boolean(\n    explicite &&\n    !close &&\n    exercicesDejaTraverses.has(explicite),\n  );");
    expect(source).toContain("lectureSeule={relecture}");
    expect(source).toContain("Revenir au déroulé de la séance");
  });

  it("permet de circuler entre les exercices dans leur ordre de séance", () => {
    expect(source).toContain("Naviguer entre les exercices de la séance");
    expect(source).toContain("Exercice précédent :");
    expect(source).toContain("Exercice suivant :");
  });
});
