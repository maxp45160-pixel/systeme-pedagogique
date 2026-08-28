/**
 * Frontière pure entre un `PlanPropose` éphémère et les faits qu'une
 * acceptation peut demander à la persistance.
 *
 * Le plan complet reste dans Décide. Ce module ne renvoie que des séances
 * acceptées et des ajustements explicites ; aucune observation, aucun score et
 * aucune réserve recalculable ne franchissent cette frontière.
 */

import {
  INTERVENTION_EFFECTS,
  INTERVENTION_TYPES,
  type InterventionSeance,
  type InterventionSource,
} from "./intervention-seance";
import type { LearningSession, OrigineProposition } from "./types";
import {
  motifRefusActionCandidate,
  type ActionCandidate,
} from "@/lib/engine/action-candidate";
import type { CreneauPropose, PlanPropose } from "@/lib/engine/planification-temporelle";

export type ActionAjustementSeance = "move" | "shorten" | "cancel";

export interface AjustementSeance {
  sessionId: string;
  action: ActionAjustementSeance;
  /** Requis pour un déplacement ou un raccourcissement déplacé. */
  plannedFor?: string;
  /** Requis pour un raccourcissement ; ne peut dépasser la durée actuelle (rejeu idempotent égal accepté). */
  durationMinutes?: number;
}

/** Choix explicite de la personne, reçu avec la proposition affichée. */
export interface ChoixPlan {
  /** Identifiant stable fourni par l'application appelante pour l'idempotence. */
  requestId: string;
  /** Identité de la proposition affichée, conservée comme provenance compacte. */
  propositionRef: string;
  acceptedCandidateIds: readonly string[];
  ignoredCandidateIds: readonly string[];
  adjustments?: readonly AjustementSeance[];
}

export interface CompetencePourAcceptation {
  code: string;
  domaine: string;
  active: boolean;
  archive: boolean;
}

export interface DomainePourAcceptation {
  id: string;
  archive: boolean;
}

export interface ContexteAcceptationPlan {
  competences: ReadonlyMap<string, CompetencePourAcceptation>;
  domaines: ReadonlyMap<string, DomainePourAcceptation>;
  /** Engagements encore ouverts au moment du clic. */
  engagementsOuverts?: ReadonlySet<string>;
  /** Séances existantes relues par le serveur, pour protéger les séances en cours. */
  sessionsExistantes?: readonly LearningSession[];
}

export interface SessionPlanifieeDepuisProposition {
  sessionId: string;
  planifieePour: string;
  durationMinutes: number;
  domaines: string[];
  skillCodes: string[];
  activites: LearningSession["activites"];
  interventions: InterventionSeance[];
  origineProposition: OrigineProposition;
}

export interface AjustementPlanifie {
  sessionId: string;
  action: ActionAjustementSeance;
  plannedFor?: string;
  durationMinutes?: number;
}

/** Charge utile minimale de la commande RPC ; elle ne contient pas le plan. */
export interface CommandeAcceptationPlan {
  requestId: string;
  propositionRef: string;
  accepted: SessionPlanifieeDepuisProposition[];
  ignoredCandidateIds: string[];
  adjustments: AjustementPlanifie[];
}

function refuser(message: string): never {
  throw new Error(`Acceptation de plan refusée : ${message}.`);
}

function texteNonVide(valeur: unknown): valeur is string {
  return typeof valeur === "string" && valeur.trim().length > 0;
}

function dateValide(valeur: unknown, chemin: string): string {
  if (!texteNonVide(valeur) || !Number.isFinite(Date.parse(valeur))) {
    refuser(`${chemin} invalide`);
  }
  return valeur;
}

function idsUniques(ids: readonly string[], chemin: string): Set<string> {
  const resultat = new Set<string>();
  for (const id of ids) {
    if (!texteNonVide(id)) refuser(`${chemin} contient une identité vide`);
    if (resultat.has(id)) refuser(`${chemin} contient « ${id} » deux fois`);
    resultat.add(id);
  }
  return resultat;
}

function sourceDepuisCandidate(candidate: ActionCandidate): InterventionSource {
  if (candidate.source === "legacy-exercise") {
    const ref = candidate.candidateId.slice("legacy-exercise:".length);
    if (!texteNonVide(ref)) refuser(`candidate ${candidate.candidateId} sans exercice source`);
    return { kind: "exercise", ref };
  }
  if (candidate.source === "course-protocol") return { kind: "course", ref: candidate.candidateId };
  if (candidate.source === "resource") return { kind: "document", ref: candidate.candidateId };
  if (candidate.source === "declared-need") return { kind: "declared-need", ref: candidate.candidateId };
  return { kind: "session", ref: candidate.candidateId };
}

function interventionDepuisCandidate(candidate: ActionCandidate): InterventionSeance {
  return {
    id: `intervention:${candidate.candidateId}`,
    type: candidate.intervention,
    label: candidate.title,
    estimatedDurationMinutes: candidate.durationMinutes,
    source: sourceDepuisCandidate(candidate),
    ...(candidate.target.skillCodes.length > 0
      ? { targetSkillCodes: [...candidate.target.skillCodes] }
      : {}),
    expectedEffect: candidate.expectedEffect,
    // `proofMode` n'est pas un contrat de preuve : inventer un protocole ou un
    // artefact ici transformerait une intention de mesure en preuve recevable.
  };
}

function activitesDepuisCandidate(candidate: ActionCandidate): LearningSession["activites"] {
  if (candidate.source !== "legacy-exercise") return [];
  const ref = candidate.candidateId.slice("legacy-exercise:".length);
  if (!texteNonVide(ref)) refuser(`candidate ${candidate.candidateId} sans exercice source`);
  return [{ type: "exercice", ref, libelle: candidate.title }];
}

function validerCreneau(
  slot: CreneauPropose,
  index: number,
): void {
  const chemin = `slots[${index}]`;
  const motif = motifRefusActionCandidate(slot.candidate);
  if (motif) refuser(`${chemin}.candidate : ${motif}`);
  if (!INTERVENTION_TYPES.includes(slot.intervention)) refuser(`${chemin}.intervention inconnue`);
  if (!INTERVENTION_EFFECTS.includes(slot.expectedEffect)) refuser(`${chemin}.expectedEffect inconnu`);
  if (slot.intervention !== slot.candidate.intervention) refuser(`${chemin}.intervention incohérente`);
  if (slot.expectedEffect !== slot.candidate.expectedEffect) refuser(`${chemin}.expectedEffect incohérent`);
  if (!Number.isInteger(slot.durationMinutes) || slot.durationMinutes <= 0) {
    refuser(`${chemin}.durationMinutes invalide`);
  }
  if (slot.durationMinutes !== slot.candidate.durationMinutes) {
    refuser(`${chemin}.durationMinutes ne correspond pas à la candidate`);
  }
  const debut = dateValide(slot.plannedFor, `${chemin}.plannedFor`);
  const fin = dateValide(slot.endsAt, `${chemin}.endsAt`);
  const duree = Date.parse(fin) - Date.parse(debut);
  if (duree !== slot.durationMinutes * 60_000) {
    refuser(`${chemin}.endsAt ne correspond pas à la durée annoncée`);
  }
}

function validerPasDeChevauchement(slots: readonly CreneauPropose[]): void {
  const tries = [...slots].sort((a, b) => Date.parse(a.plannedFor) - Date.parse(b.plannedFor));
  for (let index = 1; index < tries.length; index += 1) {
    if (Date.parse(tries[index].plannedFor) < Date.parse(tries[index - 1].endsAt)) {
      refuser(`les créneaux acceptés se chevauchent (${tries[index - 1].candidate.candidateId} / ${tries[index].candidate.candidateId})`);
    }
  }
}

interface FenetreDisponibilite {
  debut: number;
  fin: number;
}

function fenetresDisponibilites(plan: PlanPropose): FenetreDisponibilite[] {
  const disponibilites = plan.availability;
  if (!Array.isArray(disponibilites)) refuser("disponibilités déclarées absentes de la proposition");
  return disponibilites.map((window, index) => {
    const debut = Date.parse(dateValide(window.startsAt, `availability[${index}].startsAt`));
    const fin = Date.parse(dateValide(window.endsAt, `availability[${index}].endsAt`));
    if (!texteNonVide(window.sourceRef) || fin <= debut) {
      refuser(`availability[${index}] invalide`);
    }
    return { debut, fin };
  });
}

function validerDisponibilites(plan: PlanPropose, fenetres: readonly FenetreDisponibilite[]): void {
  for (const slot of plan.slots) {
    const debut = Date.parse(slot.plannedFor);
    const fin = Date.parse(slot.endsAt);
    if (!fenetres.some((fenetre) => fenetre.debut <= debut && fin <= fenetre.fin)) {
      refuser(`le créneau ${slot.candidate.candidateId} sort des disponibilités déclarées`);
    }
  }
}

function dureeSessionEstimee(session: LearningSession): number | null {
  if (typeof session.dureePlanifieeMin === "number" && Number.isInteger(session.dureePlanifieeMin) && session.dureePlanifieeMin > 0) {
    return session.dureePlanifieeMin;
  }
  const dureeMin = session.dureeMin;
  if (typeof dureeMin === "number" && Number.isInteger(dureeMin) && dureeMin > 0) return dureeMin;
  const durees = (session.interventions ?? []).map((intervention) => intervention.estimatedDurationMinutes);
  if (durees.length === 0) {
    return null;
  }
  let total = 0;
  for (const duree of durees) {
    if (typeof duree !== "number" || !Number.isInteger(duree) || duree < 0) return null;
    total += duree;
  }
  return total > 0 ? total : null;
}

function validerCibles(
  candidate: ActionCandidate,
  contexte: ContexteAcceptationPlan,
): string[] {
  const codes = [...new Set(candidate.target.skillCodes)];
  const domaines = new Set<string>();
  for (const code of codes) {
    const competence = contexte.competences.get(code);
    if (!competence || !competence.active || competence.archive) {
      refuser(`compétence « ${code} » inconnue, inactive ou archivée`);
    }
    if (!contexte.domaines.has(competence.domaine)) {
      refuser(`domaine « ${competence.domaine} » absent du compte`);
    }
    if (contexte.domaines.get(competence.domaine)?.archive) {
      refuser(`domaine « ${competence.domaine} » archivé`);
    }
    domaines.add(competence.domaine);
  }
  for (const engagementId of candidate.target.engagementIds ?? []) {
    if (contexte.engagementsOuverts && !contexte.engagementsOuverts.has(engagementId)) {
      refuser(`engagement « ${engagementId} » fermé ou inconnu`);
    }
  }
  return [...domaines].sort();
}

function validerAjustements(
  ajustements: readonly AjustementSeance[],
  sessionsExistantes: readonly LearningSession[] = [],
  fenetres: readonly FenetreDisponibilite[] = [],
): AjustementPlanifie[] {
  idsUniques(ajustements.map((item) => item.sessionId), "adjustments.sessionId");
  const parId = new Map(sessionsExistantes.map((session) => [session.id, session]));
  return ajustements.map((item) => {
    if (item.action !== "move" && item.action !== "shorten" && item.action !== "cancel") refuser(`action d'ajustement inconnue pour ${item.sessionId}`);
    const existante = parId.get(item.sessionId);
    if (sessionsExistantes && !existante) {
      refuser(`séance ${item.sessionId} introuvable dans le compte`);
    }
    if (existante) {
      const statut = existante.statut ?? "terminee";
      if (statut === "en-cours" || statut === "terminee") {
        refuser(`séance ${item.sessionId} déjà ${statut}, elle est protégée`);
      }
    }
    if (item.action === "move" || item.action === "shorten") {
      if (item.action === "move" && item.durationMinutes !== undefined) {
        refuser(`un déplacement ne modifie pas la durée (${item.sessionId})`);
      }
      if (!existante) refuser(`séance ${item.sessionId} sans fait de durée pour le déplacement`);
      const duration = dureeSessionEstimee(existante);
      if (duration === null) refuser(`séance ${item.sessionId} sans durée revalidable pour le déplacement`);
      const plannedFor = dateValide(
        item.plannedFor ?? existante.planifieePour ?? existante.date,
        `adjustments.${item.sessionId}.plannedFor`,
      );
      const nouvelleDuree = item.action === "shorten" ? item.durationMinutes : duration;
      if (item.action === "shorten" && (!Number.isInteger(nouvelleDuree) || (nouvelleDuree ?? 0) <= 0 || (nouvelleDuree ?? 0) > duration)) {
        refuser(`séance ${item.sessionId} sans durée de raccourcissement valide`);
      }
      const start = Date.parse(plannedFor);
      const end = start + (nouvelleDuree ?? duration) * 60_000;
      if (!fenetres.some((fenetre) => fenetre.debut <= start && end <= fenetre.fin)) {
        refuser(`déplacement de ${item.sessionId} hors des disponibilités déclarées`);
      }
      return {
        sessionId: item.sessionId,
        action: item.action,
        plannedFor,
        ...(item.action === "shorten" ? { durationMinutes: nouvelleDuree } : {}),
      };
    }
    if (item.plannedFor !== undefined || item.durationMinutes !== undefined) refuser(`une annulation ne porte ni créneau ni durée (${item.sessionId})`);
    return { sessionId: item.sessionId, action: item.action };
  }).sort((a, b) => a.sessionId.localeCompare(b.sessionId));
}

/** Identité stable d'une séance, réutilisée par les rejouements idempotents. */
export function identifiantSessionProposition(propositionRef: string, candidateId: string): string {
  if (!texteNonVide(propositionRef) || !texteNonVide(candidateId)) {
    refuser("propositionRef et candidateId sont obligatoires");
  }
  return `plan:${propositionRef}:${candidateId}`;
}

/**
 * Revalide un choix affiché et prépare la charge utile transactionnelle.
 * Aucun appel d'entrée/sortie, aucune horloge et aucune mutation ici.
 */
export function preparerCommandeAcceptationPlan(
  plan: PlanPropose,
  choix: ChoixPlan,
  contexte: ContexteAcceptationPlan,
): CommandeAcceptationPlan {
  if (!plan || !Array.isArray(plan.slots)) refuser("proposition illisible");
  if (!texteNonVide(choix.requestId)) refuser("requestId obligatoire");
  if (!texteNonVide(choix.propositionRef)) refuser("propositionRef obligatoire");
  if (choix.requestId.length > 200 || choix.propositionRef.length > 200) {
    refuser("requestId et propositionRef sont limités à 200 caractères");
  }

  const slots = plan.slots;
  const fenetres = fenetresDisponibilites(plan);
  validerDisponibilites(plan, fenetres);
  slots.forEach(validerCreneau);
  const parCandidate = new Map<string, CreneauPropose>();
  for (const slot of slots) {
    if (parCandidate.has(slot.candidate.candidateId)) refuser(`candidate ${slot.candidate.candidateId} proposée deux fois`);
    parCandidate.set(slot.candidate.candidateId, slot);
  }
  const acceptes = idsUniques(choix.acceptedCandidateIds, "acceptedCandidateIds");
  const ignores = idsUniques(choix.ignoredCandidateIds, "ignoredCandidateIds");
  for (const id of acceptes) if (!parCandidate.has(id)) refuser(`candidate acceptée absente du plan : ${id}`);
  for (const id of ignores) if (!parCandidate.has(id)) refuser(`candidate ignorée absente du plan : ${id}`);
  for (const id of acceptes) if (ignores.has(id)) refuser(`candidate à la fois acceptée et ignorée : ${id}`);
  for (const id of parCandidate.keys()) {
    if (!acceptes.has(id) && !ignores.has(id)) refuser(`le choix ne tranche pas la candidate ${id}`);
  }
  const slotsAcceptes = slots.filter((slot) => acceptes.has(slot.candidate.candidateId));
  validerPasDeChevauchement(slotsAcceptes);

  const accepted = slotsAcceptes.map((slot) => {
    const domaines = validerCibles(slot.candidate, contexte);
    return {
      sessionId: identifiantSessionProposition(choix.propositionRef, slot.candidate.candidateId),
      planifieePour: slot.plannedFor,
      durationMinutes: slot.durationMinutes,
      domaines,
      skillCodes: [...new Set(slot.candidate.target.skillCodes)],
      activites: activitesDepuisCandidate(slot.candidate),
      interventions: [interventionDepuisCandidate(slot.candidate)],
      origineProposition: {
        propositionRef: choix.propositionRef,
        candidateId: slot.candidate.candidateId,
        source: slot.candidate.source,
      },
    } satisfies SessionPlanifieeDepuisProposition;
  });

  return {
    requestId: choix.requestId,
    propositionRef: choix.propositionRef,
    accepted,
    ignoredCandidateIds: [...ignores].sort(),
    adjustments: validerAjustements(choix.adjustments ?? [], contexte.sessionsExistantes, fenetres),
  };
}
