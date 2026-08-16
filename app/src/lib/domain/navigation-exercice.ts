export interface ContexteNavigationExercice {
  seanceId: string;
  /**
   * Le déroulé est en plein écran, et doit le rester.
   *
   * Purement d'affichage : **rien** ici n'entre dans une mesure ni dans une
   * autorisation. Le serveur ne valide que `seanceId` (`destinationApresExercice`),
   * et ce drapeau n'ouvre donc aucun accès.
   *
   * Il voyage avec le contexte parce que c'est le contexte qui reconstruit
   * l'URL après une clôture d'exercice : sans lui, terminer un exercice faisait
   * retomber le travail hors du plein écran, au milieu d'une séance — un mode
   * choisi que l'application défaisait toute seule.
   */
  plein?: boolean;
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
    if (contexte.plein) params.set("focus", "1");
  }
  if (etape) params.set(etape, "1");

  if (contexte) return `/seances?${params.toString()}`;
  const suffixe = params.toString();
  return `/exercices/${encodeURIComponent(exerciceId)}${suffixe ? `?${suffixe}` : ""}`;
}
