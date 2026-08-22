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

export type EtapeExercice = "evaluer" | "bilan" | "abandon";

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
  /*
   * Sans séance, un exercice n'a plus de fiche propre : la séance est le point
   * d'entrée unique (ADR-079). `etape` sans `session` ne se lit nulle part, et
   * l'ancienne route `/exercices/{id}` (un repli de redirection) a été retirée.
   */
  return "/seances";
}

/**
 * Le compositeur de séance prérempli par un exercice autonome.
 *
 * Un exercice n'ouvre plus de fiche : il demande une séance (ADR-079). Cette
 * URL garde le préremplissage que l'ancien repli `/exercices/{id}` assurait —
 * le code de la compétence visée et la durée estimée.
 */
export function urlComposerAutonome(
  code: string | undefined,
  dureeEstimeeMin: number | undefined,
): string {
  return `/seances?composer=1${code ? `&code=${encodeURIComponent(code)}` : ""}&temps=${dureeEstimeeMin ?? 45}`;
}
