import { MAX_PAGES_ANALYSE_DEPOT, MAX_SORTIE_RESTITUTION, type PreparationAnalyseDepot } from "./depot";
import { coutDepotMicroEuros } from "./depot-validation";
import { coutQwen, QWEN_SORTIE } from "@/lib/tutor/qwen-config";

export type AutorisationAnalyseDepot = { fournisseur: "mistral" | "qwen"; coutMaximum: number };

/** Borne montrée AVANT l'envoi : chaque fichier a au plus une tranche, la note est distincte. */
export function autorisationDepot(fournisseur: AutorisationAnalyseDepot["fournisseur"], fichiers: number, avecNote: boolean): AutorisationAnalyseDepot {
  if (!Number.isSafeInteger(fichiers) || fichiers < 0 || fichiers > 100) throw new Error("Sélection de fichiers invalide.");
  const synthese = fournisseur === "qwen" ? coutQwen(100_000,MAX_SORTIE_RESTITUTION) : coutDepotMicroEuros(0,100_000,MAX_SORTIE_RESTITUTION);
  const ocr = fournisseur === "qwen" ? MAX_PAGES_ANALYSE_DEPOT * coutQwen(20_000,QWEN_SORTIE) : coutDepotMicroEuros(MAX_PAGES_ANALYSE_DEPOT);
  return {fournisseur,coutMaximum:fichiers*(ocr+synthese)+(avecNote?synthese:0)};
}

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
