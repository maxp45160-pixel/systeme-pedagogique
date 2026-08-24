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

/**
 * Le premier parcours après validation d'un axe.
 *
 * Cinq minutes est le minimum honnête d'un exercice dans le domaine
 * (`DUREE_ESTIMEE_MIN`). Le parcours peut atteindre l'exercice en deux
 * minutes ; il ne prétend pas que l'exercice lui-même en dure deux.
 */
export function urlPremierTest(code?: string): string {
  const params = new URLSearchParams({ composer: "1", amorce: "1", temps: "5" });
  if (code) params.set("code", code);
  return `/seances?${params.toString()}`;
}

/**
 * L'infobulle du lien « Générer puis commencer ».
 *
 * Une seule déclaration parce qu'elle vivait en double, mot pour mot, dans la
 * carte d'action et dans les pistes alternatives — deux surfaces qui posent le
 * même lien vers le compositeur. Les deux copies portaient la même faute
 * (« Aucun exercice existe »), preuve qu'elles avaient été recopiées et non
 * réécrites : une chaîne dupliquée se corrige une fois sur deux.
 *
 * Elle vit ici, avec `urlComposerAutonome`, parce qu'elle dit exactement ce
 * que cette URL fait — proposer la génération avant le démarrage.
 */
export const INFOBULLE_GENERER_PUIS_COMMENCER =
  "Aucun exercice n'existe encore : vous pourrez les générer puis commencer";
