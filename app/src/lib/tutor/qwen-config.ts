export const QWEN_URL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
export const QWEN_MODELE = "qwen3-vl-plus-2025-12-19";
export const QWEN_BUDGET = 5_000_000;
export const QWEN_SORTIE = 8192;
/** Réservation majorée en micro-dollars, sans remise à zéro automatique. */
export function coutQwen(entree: number, sortie: number): number {
  if (!Number.isSafeInteger(entree) || entree < 1 || entree > 120000 || !Number.isSafeInteger(sortie) || sortie < 1 || sortie > QWEN_SORTIE) throw new Error("Demande trop volumineuse pour l’essai Qwen.");
  return entree + sortie * 5;
}
export function estUrlQwen(url?: string): boolean {
  try { return new URL(url ?? "").hostname.endsWith("aliyuncs.com"); } catch { return false; }
}
