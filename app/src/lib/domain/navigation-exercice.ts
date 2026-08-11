export interface ContexteNavigationExercice {
  seanceId: string;
}

export type EtapeExercice = "correction" | "evaluer" | "bilan" | "abandon";

/** Construit l'URL canonique d'un exercice, autonome ou inclus dans une séance. */
export function urlExercice(
  exerciceId: string,
  contexte?: ContexteNavigationExercice,
  etape?: EtapeExercice,
): string {
  const params = new URLSearchParams();
  if (contexte) {
    params.set("session", contexte.seanceId);
    params.set("exercice", exerciceId);
  }
  if (etape) params.set(etape, "1");

  if (contexte) return `/seances?${params.toString()}`;
  const suffixe = params.toString();
  return `/exercices/${encodeURIComponent(exerciceId)}${suffixe ? `?${suffixe}` : ""}`;
}
