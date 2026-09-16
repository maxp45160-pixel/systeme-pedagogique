import { expect, it } from "vitest";
import { referencesRessourcesConversation, bilanSelectionAnalyses, autorisationDepot } from "./conversation-ressources";
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
it("annonce avant envoi un plafond couvrant chaque fichier et la note distincte",()=>{
  expect(autorisationDepot("mistral",1,false)).toEqual({fournisseur:"mistral",coutMaximum:582880});
  expect(autorisationDepot("mistral",2,true).coutMaximum).toBe(2*582880+422880);
  expect(autorisationDepot("qwen",1,false).coutMaximum).toBe(20*(20000+8192*5)+100000+8192*5);
  expect(()=>autorisationDepot("mistral",101,false)).toThrow();
});
