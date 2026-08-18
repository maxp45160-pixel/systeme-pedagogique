import "server-only";

/**
 * Écriture et lecture du journal du moteur — ADR-084.
 *
 * Deux tables append-only, hors de `Collections` : elles ne doivent PAS entrer
 * dans `lireTout` ni dans la RPC `charger_tout`. Le chemin chaud des pages n'a
 * aucune raison de les lire — seule l'auto-évaluation le fait, dans `/admin`
 * (même souci qu'ADR-064 pour le chargement documentaire).
 *
 * Aucune fonction ici ne met à jour ni ne supprime : la base le refuserait deux
 * fois (absence de politique RLS, puis déclencheur).
 */

import { dorsaleCompte, type DorsaleCompte } from "./db";
import { verifier } from "./supabase-backend";
import { mesurer } from "@/lib/profiling/server";
import type {
  DecisionMoteur,
  EmissionMoteur,
  PredictionMoteur,
  TypePrediction,
} from "@/lib/engine/prediction";

/** `unique_violation` — la décision du jour est déjà au journal. */
const CODE_DOUBLON = "23505";

/* ------------------------------------------------------------------ */
/* Écriture                                                            */
/* ------------------------------------------------------------------ */

function ligneDecision(decision: DecisionMoteur, userId: string) {
  return {
    user_id: userId,
    request_id: decision.requestId,
    type: decision.type,
    politique_version: decision.politiqueVersion,
    cible_code: decision.cibleCode,
    cible_ref: decision.cibleRef,
    facteurs: decision.facteurs,
    etat_entree: decision.etatEntree,
  };
}

function lignePrediction(
  prediction: PredictionMoteur,
  userId: string,
  decisionId: string | null,
) {
  return {
    user_id: userId,
    request_id: prediction.requestId,
    type: prediction.type,
    cible_code: prediction.cibleCode,
    cible_ref: prediction.cibleRef,
    valeur: prediction.valeur,
    horizon_le: prediction.horizonLe,
    modele_version: prediction.modeleVersion,
    entrees: prediction.entrees,
    decision_id: decisionId,
  };
}

/**
 * Inscrit une décision et ses prédictions, une fois par jour et par cible.
 *
 * ## Le doublon est le cas NORMAL
 *
 * `request_id` vaut `jour|type|cible|politique` : le premier affichage du
 * tableau de bord écrit, tous les suivants entrent en conflit et ne font rien.
 * C'est voulu — sans cela, le journal mesurerait le nombre de rafraîchissements
 * de page et non le nombre de décisions.
 *
 * ## Ce qui est délibérément accepté
 *
 * En cas de conflit sur la décision, les prédictions ne sont **pas** tentées.
 * Un `select` pour retrouver l'identifiant existant coûterait un aller-retour à
 * *chaque* rendu du tableau de bord, alors que le seul cas qu'il couvrirait est
 * une panne réseau survenue entre les deux insertions du même rendu. Le prix de
 * ce cas : une décision sans prédiction, soit un échantillon de moins pour la
 * métrique. Il ne corrompt rien.
 *
 * ## Pourquoi rien ne remonte
 *
 * Une panne du journal ne doit pas emporter le tableau de bord : le journal
 * sert à observer le moteur, il n'est pas le produit. L'erreur est écrite dans
 * les logs serveur — visible pour qui exploite, invisible pour qui apprend.
 */
export async function journaliserEmission(
  emission: EmissionMoteur,
  dorsaleFournie?: DorsaleCompte,
): Promise<void> {
  try {
    const { supabase, userId } = dorsaleFournie ?? (await dorsaleCompte());

    const { data, error } = await mesurer("supabase:moteur_decisions:insert", () =>
      supabase
        .from("moteur_decisions")
        .insert(ligneDecision(emission.decision, userId))
        .select("id")
        .maybeSingle(),
    );

    // Déjà journalisée aujourd'hui : rien à faire, et ce n'est pas une erreur.
    if (error?.code === CODE_DOUBLON) return;
    verifier("écriture d'une décision du moteur", error);

    const decisionId = (data as { id: string } | null)?.id ?? null;
    if (emission.predictions.length === 0) return;

    const { error: erreurPredictions } = await mesurer(
      "supabase:moteur_predictions:insert",
      () =>
        supabase
          .from("moteur_predictions")
          .insert(
            emission.predictions.map((p) => lignePrediction(p, userId, decisionId)),
          ),
    );
    if (erreurPredictions?.code === CODE_DOUBLON) return;
    verifier("écriture des prédictions du moteur", erreurPredictions);
  } catch (erreur) {
    console.error("[journal-moteur] écriture ignorée :", erreur);
  }
}

/* ------------------------------------------------------------------ */
/* Lecture                                                             */
/* ------------------------------------------------------------------ */

/** Une décision telle qu'elle a été inscrite. Rien n'est recalculé. */
export interface DecisionJournalisee {
  id: string;
  requestId: string;
  priseLe: string;
  type: string;
  politiqueVersion: string;
  cibleCode: string | null;
  cibleRef: string | null;
  facteurs: unknown;
  etatEntree: Record<string, unknown>;
}

/** Une prédiction telle qu'elle a été inscrite. Sa résolution est dérivée. */
export interface PredictionJournalisee {
  id: string;
  requestId: string;
  emiseLe: string;
  type: TypePrediction;
  cibleCode: string;
  cibleRef: string | null;
  valeur: number;
  horizonLe: string | null;
  modeleVersion: string;
  entrees: Record<string, unknown>;
  decisionId: string | null;
}

export async function lireDecisionsMoteur(
  dorsaleFournie?: DorsaleCompte,
): Promise<DecisionJournalisee[]> {
  const { supabase, userId } = dorsaleFournie ?? (await dorsaleCompte());
  const { data, error } = await mesurer("supabase:moteur_decisions", () =>
    supabase
      .from("moteur_decisions")
      .select("*")
      .eq("user_id", userId)
      .order("prise_le", { ascending: true }),
  );
  verifier("lecture des décisions du moteur", error);

  return ((data ?? []) as Record<string, unknown>[]).map((l) => ({
    id: String(l.id),
    requestId: String(l.request_id),
    priseLe: String(l.prise_le),
    type: String(l.type),
    politiqueVersion: String(l.politique_version),
    cibleCode: l.cible_code === null ? null : String(l.cible_code),
    cibleRef: l.cible_ref === null ? null : String(l.cible_ref),
    facteurs: l.facteurs,
    etatEntree: (l.etat_entree ?? {}) as Record<string, unknown>,
  }));
}

export async function lirePredictionsMoteur(
  dorsaleFournie?: DorsaleCompte,
): Promise<PredictionJournalisee[]> {
  const { supabase, userId } = dorsaleFournie ?? (await dorsaleCompte());
  const { data, error } = await mesurer("supabase:moteur_predictions", () =>
    supabase
      .from("moteur_predictions")
      .select("*")
      .eq("user_id", userId)
      .order("emise_le", { ascending: true }),
  );
  verifier("lecture des prédictions du moteur", error);

  return ((data ?? []) as Record<string, unknown>[]).map((l) => ({
    id: String(l.id),
    requestId: String(l.request_id),
    emiseLe: String(l.emise_le),
    type: l.type as TypePrediction,
    cibleCode: String(l.cible_code),
    cibleRef: l.cible_ref === null ? null : String(l.cible_ref),
    valeur: Number(l.valeur),
    horizonLe: l.horizon_le === null ? null : String(l.horizon_le),
    modeleVersion: String(l.modele_version),
    entrees: (l.entrees ?? {}) as Record<string, unknown>,
    decisionId: l.decision_id === null ? null : String(l.decision_id),
  }));
}
