import { expect, it } from "vitest";
import { estActif, hrefNavigation, NAV_MOBILE, NAVIGATION } from "./navigation";

it("le tableau de bord mène aux propositions sur desktop et mobile pour le pilote", () => {
  const bureau = NAVIGATION.flatMap(g => g.entrees).find(e => e.libelle === "Tableau de bord")!;
  const mobile = NAV_MOBILE.find(e => e.libelle === "Tableau de bord")!;
  expect(hrefNavigation(bureau.href, true)).toBe("/app?classique=1");
  expect(hrefNavigation(mobile.href, true)).toBe("/app?classique=1");
  expect(hrefNavigation(bureau.href, false)).toBe("/app");
  expect(hrefNavigation("/seances", true)).toBe("/seances");
});
it("ne présente pas Ma journée comme le tableau de bord actif", () => {
  expect(estActif("/app", "/app", true)).toBe(false);
  expect(estActif("/app", "/app", false)).toBe(true);
  expect(estActif("/seances", "/seances", true)).toBe(true);
});
