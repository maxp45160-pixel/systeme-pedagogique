/**
 * Contrat de reprise du parcours de correction d'un exercice.
 *
 * Ce module ne persiste rien et ne connaît ni React ni Supabase. Il fixe les
 * deux délais déjà exposés par le parcours et la forme minimale du cache de
 * session qui permet de distinguer une correction en cours d'une demande
 * interrompue par un rechargement.
 */

export const DELAI_SORTIE_CORRECTION_MS = 10_000;
export const DELAI_INTERRUPTION_CORRECTION_MS = 25_000;

export type CauseCorrectionIndisponible =
  | "expiration"
  | "erreur"
  | "rechargement";

export type EtatCorrectionPersiste<T> =
  | { phase: "en-cours"; lanceeLe: number }
  | { phase: "prete"; correction: T }
  | {
      phase: "indisponible";
      cause: CauseCorrectionIndisponible;
      raison: string;
    };

export type EtatCorrectionRepris<T> =
  | { phase: "prete"; correction: T }
  | {
      phase: "indisponible";
      cause: CauseCorrectionIndisponible;
      raison: string;
    };

/**
 * Reconstitue un état sûr après un rechargement.
 *
 * Une demande « en cours » ne peut pas être reprise silencieusement : le
 * navigateur a peut-être interrompu le flux, et relancer automatiquement
 * pourrait consommer une seconde génération. Elle devient donc une reprise
 * explicite. Les autres états sont réutilisables tels quels.
 */
export function reprendreCorrection<T>(
  etat: EtatCorrectionPersiste<T> | null | undefined,
): EtatCorrectionRepris<T> | null {
  if (!etat || typeof etat !== "object" || Array.isArray(etat)) return null;

  if (etat.phase === "prete" && etat.correction !== null && etat.correction !== undefined) {
    return { phase: "prete", correction: etat.correction };
  }

  if (
    etat.phase === "indisponible" &&
    (etat.cause === "expiration" || etat.cause === "erreur" || etat.cause === "rechargement") &&
    typeof etat.raison === "string" &&
    etat.raison.length > 0
  ) {
    return {
      phase: "indisponible",
      cause: etat.cause,
      raison: etat.raison,
    };
  }

  if (etat.phase === "en-cours") {
    return {
      phase: "indisponible",
      cause: "rechargement",
      raison:
        "La demande de correction a été interrompue par le rechargement. Elle n'est pas relancée automatiquement.",
    };
  }

  return null;
}
