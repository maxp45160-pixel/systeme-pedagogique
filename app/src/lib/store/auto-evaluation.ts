import "server-only";

/**
 * Les entrées de l'auto-évaluation, assemblées côté serveur — ADR-085.
 *
 * Chargé UNIQUEMENT par `/admin`, jamais par `chargerContexte` : le chemin
 * chaud des pages n'a rien à faire du journal du moteur, et le lui faire payer
 * serait exactement ce qu'ADR-064 refuse pour le chargement documentaire.
 *
 * Rien n'est calculé ici. Ce module lit et convertit ; `lib/engine/auto-evaluation.ts`
 * fait le travail, sans dépendre d'aucune persistance.
 */

import { dorsaleCompte, lire } from "./db";
import { lireDecisionsMoteur, lirePredictionsMoteur } from "./journal-moteur";
import { EXERCICES_DIAGNOSTIC } from "@/lib/seed/exercises";
import { evaluerMoteur, type MetriqueMoteur } from "@/lib/engine/auto-evaluation";
import {
  proposerAjustements,
  reglagesEffectifs,
  type AjustementInscrit,
  type PropositionAjustement,
  type Reglages,
} from "@/lib/engine/reglages";
import { lireJournalReglages } from "./reglages-moteur";
import type { Exercise } from "@/lib/domain/types";

export type { MetriqueMoteur };

/** Ce que l'onglet « Moteur » affiche : les mesures, l'état, et le pas suivant. */
export interface EtatMoteur {
  metriques: MetriqueMoteur[];
  reglages: Reglages;
  journal: AjustementInscrit[];
  /** `null` = rien à ajuster, ou pas encore assez de données pour le dire. */
  proposition: PropositionAjustement | null;
}

/**
 * Les quatre métriques du moteur, recalculées de bout en bout.
 *
 * Les exercices sont pris **bruts**, seed compris : une prédiction peut porter
 * sur un exercice archivé ou sorti du périmètre, et ne pas le résoudre
 * fausserait la métrique dans le sens le plus trompeur — celui qui fait
 * disparaître les cas ratés. Même raison qu'ADR-071 pour `tableDureesEstimees`
 * et qu'ADR-083 pour le catalogue de situations.
 */
export async function chargerMetriquesMoteur(): Promise<MetriqueMoteur[]> {
  const dorsale = await dorsaleCompte();

  const [predictions, decisions, tentatives, preuves, exercices] = await Promise.all([
    lirePredictionsMoteur(dorsale),
    lireDecisionsMoteur(dorsale),
    lire("attempts", dorsale),
    lire("evidence", dorsale),
    lire("exercises", dorsale),
  ]);

  const exercicesParId = new Map<string, Pick<Exercise, "dureeEstimeeMin">>();
  for (const e of [...exercices, ...EXERCICES_DIAGNOSTIC]) {
    if (!exercicesParId.has(e.id)) {
      exercicesParId.set(e.id, { dureeEstimeeMin: e.dureeEstimeeMin });
    }
  }

  return evaluerMoteur({
    predictions,
    decisions,
    tentatives,
    preuves,
    exercicesParId,
  });
}

/**
 * L'état complet du moteur pour `/admin` : mesures, réglages effectifs,
 * journal des ajustements, et le pas suivant s'il y en a un.
 */
export async function chargerEtatMoteur(): Promise<EtatMoteur> {
  const [metriques, journal] = await Promise.all([
    chargerMetriquesMoteur(),
    lireJournalReglages(),
  ]);

  return {
    metriques,
    reglages: reglagesEffectifs(journal),
    journal,
    proposition: proposerAjustements({ metriques, journal, maintenant: new Date() }),
  };
}
