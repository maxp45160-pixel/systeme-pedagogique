import { describe, expect, it } from "vitest";
import { aideBilan, libelleBilan, libelleMesureLisible } from "./mesures-lisibles";

describe("mesures lisibles", () => {
  it("présente la confiance comme un bilan actionnable", () => {
    expect(libelleBilan("faible")).toBe("À confirmer");
    expect(aideBilan("faible")).toContain("sans aide");
    expect(libelleBilan("forte")).toBe("Solide");
  });

  it("masque le vocabulaire statistique des facteurs affichés", () => {
    expect(libelleMesureLisible("Robustesse moyenne")).toBe("Ancrage dans la durée");
    expect(libelleMesureLisible("Confiance")).toBe("Solidité du bilan");
    expect(libelleMesureLisible("Couverture pondérée")).toBe("Partie déjà explorée");
    expect(libelleMesureLisible("Autonomie")).toBe("Autonomie");
  });
});
