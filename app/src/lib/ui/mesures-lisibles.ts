import type { Confiance } from "@/lib/domain/types";

/**
 * Traduction d'affichage des mesures du moteur.
 *
 * Les noms statistiques restent dans le domaine et dans les explications
 * techniques. L'interface courante dit ce que la mesure signifie et surtout
 * quel geste permet de la renforcer, sans changer aucun calcul.
 */
const LIBELLES_BILAN: Record<Confiance, string> = {
  nulle: "À découvrir",
  faible: "À confirmer",
  moyenne: "Bien étayé",
  forte: "Solide",
};

const AIDES_BILAN: Record<Confiance, string> = {
  nulle: "Aucun exercice terminé ne permet encore de poser un bilan.",
  faible:
    "Ce bilan repose encore sur peu de résultats. Un nouvel exercice mené sans aide permettra de mieux le confirmer.",
  moyenne:
    "Plusieurs résultats vont dans le même sens. Un exercice dans un contexte différent renforcera encore ce bilan.",
  forte:
    "Ce bilan repose sur plusieurs résultats cohérents, variés et suffisamment récents.",
};

export function libelleBilan(confiance: Confiance): string {
  return LIBELLES_BILAN[confiance];
}

export function aideBilan(confiance: Confiance): string {
  return AIDES_BILAN[confiance];
}

/** Traduit les facteurs techniques uniquement au bord de l'interface. */
export function libelleMesureLisible(libelle: string): string {
  const cle = libelle.trim().toLocaleLowerCase("fr-FR");
  if (cle.includes("robustesse")) return "Ancrage dans la durée";
  if (cle.includes("confiance")) return "Solidité du bilan";
  if (cle.includes("couverture")) return "Partie déjà explorée";
  if (cle.includes("niveau")) return "Ce que vous avez montré";
  if (cle.includes("observation")) return "Résultats pris en compte";
  return libelle;
}
