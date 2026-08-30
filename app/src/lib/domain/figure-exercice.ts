/**
 * Contrat minimal d'une figure portée par un exercice.
 *
 * Ce type est volontairement indépendant de `Exercise` tant que le modèle
 * persistant n'a pas été validé : il décrit ce que l'interface sait rendre,
 * sans inventer une colonne ni un stockage média.
 */
export interface FigureExercice {
  /** Version minimale du contrat : une image déjà disponible. */
  type: "image";
  /** URL résolue et autorisée, par exemple celle d'une pièce jointe existante. */
  source: string;
  /** Description de ce que la figure apporte, obligatoire. */
  alt: string;
  /** Texte visible sous la figure. */
  legende?: string;
  /** Dimensions intrinsèques facultatives, en pixels CSS positifs. */
  largeur?: number;
  hauteur?: number;
}

export function estFigureExercice(valeur: unknown): valeur is FigureExercice {
  if (!valeur || typeof valeur !== "object" || Array.isArray(valeur)) return false;
  const figure = valeur as Record<string, unknown>;
  if (figure.type !== "image" || typeof figure.source !== "string" || !figure.source.trim()) return false;
  if (typeof figure.alt !== "string" || !figure.alt.trim()) return false;
  for (const cle of ["largeur", "hauteur"] as const) {
    if (figure[cle] !== undefined && (!Number.isInteger(figure[cle]) || Number(figure[cle]) <= 0)) {
      return false;
    }
  }
  return figure.legende === undefined || typeof figure.legende === "string";
}
