"use server";

/**
 * Point d'entrée serveur unique pour accepter un plan affiché.
 *
 * La proposition complète ne franchit jamais la frontière Supabase : elle est
 * relue, revalidée contre le compte courant puis réduite à une commande qui
 * contient seulement les séances acceptées et les ajustements demandés. La
 * RPC porte la transaction et l'idempotence ; aucun chemin de repli ne fait
 * des insertions une par une.
 */

import { revalidatePath } from "next/cache";
import { estOuvert } from "@/lib/domain/engagement";
import {
  preparerCommandeAcceptationPlan,
  type ChoixPlan,
  type CommandeAcceptationPlan,
  type ContexteAcceptationPlan,
} from "@/lib/domain/acceptation-plan";
import type { PlanPropose } from "@/lib/engine/planification-temporelle";
import { dorsaleCompte, lire } from "./db";
import { lireReferentiel } from "./referentiel";
import { verifier } from "./supabase-backend";

export interface ResultatAcceptationPlan {
  acceptedSessionIds: string[];
  adjustedSessionIds: string[];
  ignoredCandidateIds: string[];
}

function tableauTexte(valeur: unknown, chemin: string): string[] {
  if (!Array.isArray(valeur) || valeur.some((item) => typeof item !== "string" || item.trim() === "")) {
    throw new Error(`Supabase (acceptation du plan) : ${chemin} invalide.`);
  }
  return [...valeur];
}

function resultatDepuisRPC(valeur: unknown): ResultatAcceptationPlan {
  if (!valeur || typeof valeur !== "object" || Array.isArray(valeur)) {
    throw new Error("Supabase (acceptation du plan) : résultat JSON invalide.");
  }
  const resultat = valeur as Record<string, unknown>;
  return {
    acceptedSessionIds: tableauTexte(resultat.acceptedSessionIds, "acceptedSessionIds"),
    adjustedSessionIds: tableauTexte(resultat.adjustedSessionIds, "adjustedSessionIds"),
    ignoredCandidateIds: tableauTexte(resultat.ignoredCandidateIds, "ignoredCandidateIds"),
  };
}

function contexteDepuisReferentiel(
  referentiel: Awaited<ReturnType<typeof lireReferentiel>>,
): Pick<ContexteAcceptationPlan, "competences" | "domaines"> {
  return {
    competences: new Map(
      referentiel.skills.map((skill) => [skill.code, {
        code: skill.code,
        domaine: skill.domaine,
        active: skill.active,
        archive: skill.archive,
      }]),
    ),
    domaines: new Map(
      referentiel.domaines.map((domaine) => [domaine.id, {
        id: domaine.id,
        archive: domaine.archive,
      }]),
    ),
  };
}

function payloadCommande(command: CommandeAcceptationPlan): Record<string, unknown> {
  // Projection volontairement étroite : `PlanPropose` n'est jamais inclus.
  return {
    propositionRef: command.propositionRef,
    accepted: command.accepted.map((session) => ({
      sessionId: session.sessionId,
      candidateId: session.origineProposition.candidateId,
      source: session.origineProposition.source,
      plannedFor: session.planifieePour,
      durationMinutes: session.durationMinutes,
      domaines: session.domaines,
      skillCodes: session.skillCodes,
      activites: session.activites,
      interventions: session.interventions,
      origineProposition: session.origineProposition,
    })),
    ignoredCandidateIds: command.ignoredCandidateIds,
    adjustments: command.adjustments,
  };
}

/**
 * Accepte le choix explicite associé à une proposition affichée.
 *
 * Les lectures revalident le référentiel, les engagements et les séances du
 * compte avant l'appel transactionnel. La RPC refait les contrôles de compte,
 * de cibles et de conflits sous verrou ; elle est donc la seule écriture de
 * cette frontière.
 */
export async function accepterPlan(
  proposition: PlanPropose,
  choix: ChoixPlan,
): Promise<ResultatAcceptationPlan> {
  try {
    const dorsale = await dorsaleCompte();
    const [referentiel, engagements, sessions] = await Promise.all([
      lireReferentiel(dorsale),
      lire("engagements", dorsale),
      lire("sessions", dorsale),
    ]);
    const contexte: ContexteAcceptationPlan = {
      ...contexteDepuisReferentiel(referentiel),
      engagementsOuverts: new Set(engagements.filter(estOuvert).map((engagement) => engagement.id)),
      sessionsExistantes: sessions,
    };
    const commande = preparerCommandeAcceptationPlan(proposition, choix, contexte);
    const { data, error } = await dorsale.supabase.rpc("accepter_plan", {
      p_request_id: commande.requestId,
      p_payload: payloadCommande(commande),
    });
    verifier("acceptation atomique du plan", error);
    const resultat = resultatDepuisRPC(data);
    revalidatePath("/", "layout");
    return resultat;
  } catch (cause) {
    console.error("[plan] acceptation de proposition :", cause);
    throw cause;
  }
}

/**
 * Déclare le refus de la proposition entière dans le journal déjà existant.
 * L'identifiant déterministe rend les doubles clics et les reprises réseau
 * idempotents, sans persister le plan lui-même.
 */
export async function refuserPropositionPlan(propositionRef: string): Promise<void> {
  if (typeof propositionRef !== "string" || propositionRef.trim() === "" || propositionRef.length > 200) {
    throw new Error("Référence de proposition invalide.");
  }

  try {
    const dorsale = await dorsaleCompte();
    const { error } = await dorsale.supabase.from("refus_recommandations").insert({
      id: `plan-refus:${propositionRef}`,
      user_id: dorsale.userId,
      code: null,
      exercice_id: null,
      proposition_ref: propositionRef,
      date: new Date().toISOString(),
    });
    if (error && error.code !== "23505") verifier("refus de proposition de plan", error);
    revalidatePath("/", "layout");
  } catch (cause) {
    console.error("[plan] refus de proposition :", cause);
    throw cause;
  }
}
