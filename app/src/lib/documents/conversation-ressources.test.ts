import { expect, it } from "vitest";
import { referencesRessourcesConversation, bilanSelectionAnalyses } from "./conversation-ressources";
import type { PreparationAnalyseDepot } from "./depot";
it("ne fait pas de liens Markdown du modèle des commandes sur les ressources", () => {
  const id = `depot-${"a".repeat(32)}`;
  expect(referencesRessourcesConversation([id, id, "/atelier?document=autre", null, "autre"])).toEqual([id]);
  expect(referencesRessourcesConversation("[doc](/atelier?document=autre)")).toEqual([]);
  expect(referencesRessourcesConversation(Array(102).fill(id))).toEqual([]);
});
it("affiche le coût cumulé contre le budget global, pas un budget multiplié par fichier", () => {
  const p = { coutMaximumMicroEuros: 100, budgetRestantMicroEuros: 180, analyseExistante: null } as PreparationAnalyseDepot;
  expect(bilanSelectionAnalyses([p, p])).toEqual({ cout: 200, budget: 180, reprise: false });
  expect(bilanSelectionAnalyses([{ ...p, analyseExistante: { statut: "echec" } as NonNullable<PreparationAnalyseDepot["analyseExistante"]> }]).reprise).toBe(true);
});
