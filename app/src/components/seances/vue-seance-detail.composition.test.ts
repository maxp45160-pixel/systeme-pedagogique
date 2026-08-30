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
});
