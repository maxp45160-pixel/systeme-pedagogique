import { describe, expect, it } from "vitest";
import { cleJour } from "@/lib/engine/dates";
import { dernierDepotDuJour } from "./accueil-depot";

describe("accueil quotidien", () => {
  const jour = cleJour(new Date(2026, 8, 7, 12));
  const depot = (id: string, heure: number, date = 7) => ({ id, creeLe: new Date(2026, 8, date, heure).toISOString() });
  it("ouvre la saisie sans dépôt du jour, même avec des dépôts antérieurs", () => {
    expect(dernierDepotDuJour([], jour)).toBeUndefined();
    expect(dernierDepotDuJour([depot("hier", 23, 6)], jour)).toBeUndefined();
  });
  it("retrouve le plus récent du jour sans modifier l'ordre fourni", () => {
    const liste = [depot("matin", 8), depot("soir", 20), depot("hier", 23, 6)];
    expect(dernierDepotDuJour(liste, jour)).toBe("soir");
    expect(liste[0].id).toBe("matin");
  });
  it("respecte minuit local et ignore les dates invalides", () => {
    expect(dernierDepotDuJour([depot("minuit", 0), { id: "invalide", creeLe: "?" }], jour)).toBe("minuit");
    expect(dernierDepotDuJour([depot("minuit", 0)], cleJour(new Date(2026, 8, 8)))).toBeUndefined();
  });
  it("revient à la saisie après suppression du dernier dépôt du jour", () => {
    expect(dernierDepotDuJour([depot("hier", 12, 6)], jour)).toBeUndefined();
  });
});
