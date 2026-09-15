import type { PreparationAnalyseDepot } from "./depot";

/** Valide les références relues depuis la session navigateur, sans interpréter le Markdown du modèle. */
export function referencesRessourcesConversation(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 101) return [];
  return [...new Set(value.filter((id): id is string => typeof id === "string" && /^depot-[a-f0-9]{32}$/.test(id)))];
}

export function bilanSelectionAnalyses(preparations: PreparationAnalyseDepot[]) {
  return {
    cout: preparations.reduce((s, p) => s + (p.coutMaximumMicroDollars ?? p.coutMaximumMicroEuros), 0),
    budget: preparations.length ? Math.min(...preparations.map((p) => (p.budgetRestantMicroDollars ?? p.budgetRestantMicroEuros))) : 0,
    reprise: preparations.some((p) => p.analyseExistante?.statut === "echec" || p.analyseExistante?.statut === "interrompue"),
  };
}

export function eurosDocumentaires(microEuros: number): string {
  return (microEuros / 1_000_000).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 3 });
}
