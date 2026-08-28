/** Lectures disponibles sur la route `/seances`. Ce module reste serveur-compatible. */
export type VueSeances = "avenir" | "bureau" | "cahier";

/** Résout la lecture initiale à partir des paramètres explicites de l'URL. */
export function vueInitialeDepuisParametres({
  vueDemandee,
  recherche,
  jourExplicite = false,
  seanceOuverte = false,
}: {
  vueDemandee?: string;
  recherche?: string;
  jourExplicite?: boolean;
  seanceOuverte?: boolean;
}): VueSeances {
  if (vueDemandee === "cahier" || recherche?.trim()) return "cahier";
  if (vueDemandee === "bureau" || jourExplicite || seanceOuverte) return "bureau";
  return "avenir";
}
