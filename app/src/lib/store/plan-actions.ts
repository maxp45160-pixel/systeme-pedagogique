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
import type { PlanDiff } from "@/lib/engine/revision-plan";
import { dorsaleCompte, lire, type Collections, type DorsaleCompte } from "./db";
import { lireReferentiel } from "./referentiel";
import { verifier } from "./supabase-backend";
import type { DisponibiliteDeclaree } from "@/lib/domain/types";

type SessionCompte = Collections["sessions"][number];

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
      ...(session.blueprint ? { blueprint: session.blueprint } : {}),
      origineProposition: session.origineProposition,
    })),
    ignoredCandidateIds: command.ignoredCandidateIds,
    adjustments: command.adjustments,
  };
}

function dureeSession(session: SessionCompte): number | null {
  if (Number.isInteger(session.dureePlanifieeMin) && (session.dureePlanifieeMin ?? 0) > 0) {
    return session.dureePlanifieeMin ?? null;
  }
  if (Number.isInteger(session.dureeMin) && (session.dureeMin ?? 0) > 0) {
    return session.dureeMin ?? null;
  }
  const dureeBlueprint = session.blueprint?.dureeCibleMin;
  if (Number.isInteger(dureeBlueprint) && (dureeBlueprint ?? 0) > 0) {
    return dureeBlueprint ?? null;
  }
  const durees: Array<number | undefined> = (session.interventions ?? []).map((intervention) => intervention.estimatedDurationMinutes);
  if (durees.length === 0 || durees.some((duree) => !Number.isInteger(duree) || (duree ?? 0) < 0)) return null;
  const total = durees.reduce<number>((somme, duree) => somme + (duree ?? 0), 0);
  return total > 0 ? total : null;
}

function debutSession(session: SessionCompte): string | null {
  const valeur = session.planifieePour ?? session.date;
  return Number.isFinite(Date.parse(valeur)) ? new Date(valeur).toISOString() : null;
}

function chaineNonVide(valeur: unknown, nom: string): string {
  if (typeof valeur !== "string" || valeur.trim() === "") throw new Error(`${nom} invalide.`);
  return valeur;
}

function verifierEtatAvant(
  session: SessionCompte,
  before: { plannedFor?: string; durationMinutes?: number } | undefined,
): void {
  if (!before?.plannedFor) throw new Error("La revue ne contient pas l'état initial de la séance.");
  const avant = Date.parse(before.plannedFor);
  if (!Number.isFinite(avant)) throw new Error("La revue ne contient pas un état initial lisible.");
  const actuel = debutSession(session);
  if (actuel === null || actuel !== new Date(avant).toISOString()) {
    throw new Error("La séance a changé depuis l'ouverture de la revue. Actualisez la page puis réessayez.");
  }
  if (before.durationMinutes !== undefined && dureeSession(session) !== before.durationMinutes) {
    throw new Error("La durée de la séance a changé depuis l'ouverture de la revue. Actualisez la page puis réessayez.");
  }
}

function ajustementsDepuisDiff(
  diff: PlanDiff,
  sessions: Collections["sessions"],
): CommandeAcceptationPlan["adjustments"] {
  if (!diff || !Array.isArray(diff.changes) || !Array.isArray(diff.conflicts)) {
    throw new Error("La revue du plan est illisible. Actualisez la page puis réessayez.");
  }
  if (diff.conflicts.length > 0 || diff.changes.some((change) => change.kind === "conflit-impossible")) {
    throw new Error("La revue contient un conflit qui doit être résolu avant son application.");
  }
  const parId = new Map(sessions.map((session) => [session.id, session]));
  return diff.changes
    .filter((change) => change.kind === "deplacer" || change.kind === "raccourcir" || change.kind === "annuler")
    .map((change) => {
      const sessionId = chaineNonVide(change.sessionId, "Identité de séance");
      const session = parId.get(sessionId);
      if (!session) throw new Error("Une séance de la revue n'est plus disponible. Actualisez la page puis réessayez.");
      verifierEtatAvant(session, change.before);
      if (change.kind === "annuler") return { sessionId, action: "cancel" as const };
      const plannedFor = change.after?.plannedFor;
      if (!plannedFor || !Number.isFinite(Date.parse(plannedFor))) {
        throw new Error("Le nouveau créneau est invalide. Actualisez la page puis réessayez.");
      }
      if (change.kind === "raccourcir") {
        const durationMinutes = change.after?.durationMinutes;
        if (!Number.isInteger(durationMinutes) || (durationMinutes ?? 0) <= 0) {
          throw new Error("La nouvelle durée est invalide. Actualisez la page puis réessayez.");
        }
        return { sessionId, action: "shorten" as const, plannedFor, durationMinutes };
      }
      return { sessionId, action: "move" as const, plannedFor };
    });
}

async function appliquerAjustements(
  dorsale: DorsaleCompte,
  sessions: Collections["sessions"],
  disponibilites: DisponibiliteDeclaree[],
  requestId: string,
  propositionRef: string,
  adjustments: CommandeAcceptationPlan["adjustments"],
): Promise<ResultatAcceptationPlan> {
  const planSansCandidates: PlanPropose = {
    slots: [],
    availability: disponibilites,
    readiness: [],
    constraints: [],
    reservations: [],
  };
  const commande = preparerCommandeAcceptationPlan(
    planSansCandidates,
    {
      requestId,
      propositionRef,
      acceptedCandidateIds: [],
      ignoredCandidateIds: [],
      adjustments,
    },
    {
      competences: new Map(),
      domaines: new Map(),
      sessionsExistantes: sessions,
    },
  );
  const { data, error } = await dorsale.supabase.rpc("accepter_plan", {
    p_request_id: commande.requestId,
    p_payload: payloadCommande(commande),
  });
  verifier("application atomique des ajustements", error);
  const resultat = resultatDepuisRPC(data);
  revalidatePath("/", "layout");
  revalidatePath("/seances", "page");
  return resultat;
}

/**
 * Applique une revue déjà affichée dans une seule commande RPC.
 *
 * Le diff reste une donnée dérivée et n'est jamais envoyé à Supabase. Le
 * serveur relit les séances et les disponibilités, vérifie l'état observé à
 * l'ouverture de la revue, puis ne transmet que les ajustements explicites.
 */
export async function appliquerDiffPlan(
  diff: PlanDiff,
  requestId: string,
): Promise<ResultatAcceptationPlan> {
  const idempotence = chaineNonVide(requestId, "requestId");
  if (idempotence.length > 200) throw new Error("requestId limité à 200 caractères.");
  try {
    const dorsale = await dorsaleCompte();
    const [user, sessions] = await Promise.all([lire("user", dorsale), lire("sessions", dorsale)]);
    const adjustments = ajustementsDepuisDiff(diff, sessions);
    return appliquerAjustements(
      dorsale,
      sessions,
      user.disponibilitesDeclarees ?? [],
      idempotence,
      `revision:${idempotence}`,
      adjustments,
    );
  } catch (cause) {
    console.error("[plan] application de la revue :", cause);
    throw cause;
  }
}

/**
 * Déplace une séance planifiée en conservant son identité, sa provenance et
 * toutes ses interventions. La RPC existante ne reçoit qu'un ajustement de
 * date : aucune compétence, observation ou nouvelle séance n'est créée.
 */
export async function deplacerSeance(
  sessionId: string,
  ancienneDate: string,
  nouvelleDate: string,
  requestId?: string,
): Promise<ResultatAcceptationPlan> {
  const id = chaineNonVide(sessionId, "sessionId");
  const avant = chaineNonVide(ancienneDate, "ancienneDate");
  const apres = chaineNonVide(nouvelleDate, "nouvelleDate");
  if (!Number.isFinite(Date.parse(avant)) || !Number.isFinite(Date.parse(apres))) {
    throw new Error("Le créneau de déplacement est invalide.");
  }
  const cle = requestId?.trim() || `move:${id}:${new Date(apres).toISOString()}`;
  if (cle.length > 200) throw new Error("requestId limité à 200 caractères.");

  try {
    const dorsale = await dorsaleCompte();
    const [user, sessions] = await Promise.all([lire("user", dorsale), lire("sessions", dorsale)]);
    const session = sessions.find((candidate) => candidate.id === id);
    if (!session) throw new Error("Cette séance n'est plus disponible. Actualisez la page puis réessayez.");
    verifierEtatAvant(session, { plannedFor: avant });
    return appliquerAjustements(
      dorsale,
      sessions,
      user.disponibilitesDeclarees ?? [],
      cle,
      `deplacement:${id}`,
      [{ sessionId: id, action: "move", plannedFor: new Date(apres).toISOString() }],
    );
  } catch (cause) {
    console.error("[plan] déplacement de séance :", cause);
    throw cause;
  }
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
