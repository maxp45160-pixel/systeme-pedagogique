import { estOuvert, type Engagement } from "@/lib/domain/engagement";
import type { LearningSession, SkillState } from "@/lib/domain/types";
import {
  INTERVENTION_EFFECTS,
  INTERVENTION_TYPES,
  type InterventionEffect,
  type InterventionType,
} from "@/lib/domain/intervention-seance";
import {
  motifRefusActionCandidate,
  type ActionCandidate,
  type RefusObserve,
} from "./action-candidate";

export interface AvailabilityWindow {
  startsAt: string;
  endsAt: string;
  sourceRef: string;
}

export type PreparationState =
  | "non-estimable"
  | "a-eclaircir"
  | "a-renforcer"
  | "en-bonne-voie"
  | "pret-d-apres-les-preuves-disponibles";

export interface PreparationEcheance {
  engagementId: string;
  state: PreparationState;
  evidenceRefs: string[];
  reasons: string[];
  reservations: string[];
}

export interface CreneauPropose {
  candidate: ActionCandidate;
  plannedFor: string;
  endsAt: string;
  durationMinutes: number;
  intervention: InterventionType;
  expectedEffect: InterventionEffect;
  reasons: string[];
  constraints: string[];
  reservations: string[];
}

export interface PlanPropose {
  slots: CreneauPropose[];
  /** Disponibilités déclarées utilisées pour placer les créneaux (transitoire). */
  availability?: AvailabilityWindow[];
  readiness: PreparationEcheance[];
  constraints: string[];
  reservations: string[];
}

export interface PlanificateurTemporelInput {
  /** Instant de référence fourni par l'appelant ; le moteur n'appelle jamais Date.now(). */
  now: string;
  engagements: readonly Engagement[];
  availability: readonly AvailabilityWindow[];
  skillStates: readonly SkillState[];
  candidates: readonly ActionCandidate[];
  refusObserved: readonly RefusObserve[];
  acceptedSessions: readonly LearningSession[];
  /** Référence stable de la proposition courante, hors refus de cette proposition. */
  propositionRef?: string;
}

type EntreesReferenceProposition = Pick<
  PlanificateurTemporelInput,
  "engagements" | "availability" | "skillStates" | "candidates" | "acceptedSessions"
>;

function serialiserStable(valeur: unknown): string {
  if (valeur === null) return "null";
  if (typeof valeur === "string") return JSON.stringify(valeur);
  if (typeof valeur === "number" || typeof valeur === "boolean") return String(valeur);
  if (typeof valeur === "undefined") return "undefined";
  if (Array.isArray(valeur)) return `[${valeur.map(serialiserStable).join(",")}]`;
  if (typeof valeur === "object") {
    return `{${Object.entries(valeur as Record<string, unknown>)
      .sort(([gauche], [droite]) => gauche.localeCompare(droite))
      .map(([cle, contenu]) => `${JSON.stringify(cle)}:${serialiserStable(contenu)}`)
      .join(",")}}`;
  }
  return JSON.stringify(String(valeur));
}

function empreinteStable(texte: string): string {
  let hash = 2_166_136_261;
  for (let index = 0; index < texte.length; index += 1) {
    hash ^= texte.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Référence opaque et déterministe d'une même proposition.
 *
 * L'horloge et les refus sont volontairement hors empreinte : le temps qui
 * passe ou le fait d'avoir écarté la proposition ne doivent pas la rallumer.
 * Les entrées qui composent réellement le plan, elles, changent la référence.
 */
export function referenceStableProposition(input: EntreesReferenceProposition): string {
  return `plan-${empreinteStable(serialiserStable(input))}`;
}

interface Intervalle {
  start: number;
  end: number;
  sourceRefs: string[];
}

interface Occupation extends Intervalle {
  reason: string;
}

interface CandidateClasse {
  candidate: ActionCandidate;
  urgence: string;
  diagnostic: boolean;
  continu: boolean;
  engagementIds: string[];
}

const PREPARATION_ETAT_5: PreparationState = "pret-d-apres-les-preuves-disponibles";

function instant(valeur: string): number | null {
  const resultat = Date.parse(valeur);
  return Number.isFinite(resultat) ? resultat : null;
}

function dateRefusActive(refus: RefusObserve, now: number): boolean {
  const observe = instant(refus.observedAt);
  if (observe === null || observe > now) return false;
  if (refus.propositionRef) return true;
  if (!refus.expiresAt) return true;
  const expiration = instant(refus.expiresAt);
  return expiration !== null && expiration > now;
}

function codesCibles(candidate: ActionCandidate): Set<string> {
  return new Set(candidate.target.skillCodes);
}

function engagementsCibles(
  candidate: ActionCandidate,
  engagements: readonly Engagement[],
): Engagement[] {
  const ids = new Set(candidate.target.engagementIds ?? []);
  const codes = codesCibles(candidate);
  return engagements.filter((engagement) =>
    ids.has(engagement.id)
    || (engagement.codes.length > 0 && engagement.codes.some((code) => codes.has(code))),
  );
}

function stateForEngagement(
  engagement: Engagement,
  states: readonly SkillState[],
): PreparationEcheance {
  const parCode = new Map(states.map((state) => [state.skill.code, state]));
  const codes = [...new Set(engagement.codes)];
  if (codes.length === 0) {
    return {
      engagementId: engagement.id,
      state: "non-estimable",
      evidenceRefs: [],
      reasons: ["aucune compétence cible n'a été déclarée pour cette échéance"],
      reservations: ["préparation non estimable sans cible déclarée"],
    };
  }

  const manquants = codes.filter((code) => !parCode.has(code));
  const etats = codes.flatMap((code) => {
    const etat = parCode.get(code);
    return etat ? [etat] : [];
  });
  const evidenceRefs = etats.flatMap((etat) => etat.observations.map((observation) => observation.id));
  if (manquants.length > 0 || etats.length === 0) {
    return {
      engagementId: engagement.id,
      state: "non-estimable",
      evidenceRefs,
      reasons: ["une compétence ciblée n'est pas présente dans les états reçus"],
      reservations: [`compétences absentes : ${manquants.join(", ") || "inconnues"}`],
    };
  }

  const contradictions = etats.filter((etat) => etat.contradictions.length > 0);
  if (contradictions.length > 0) {
    return {
      engagementId: engagement.id,
      state: "a-eclaircir",
      evidenceRefs,
      reasons: ["des observations contradictoires demandent une clarification"],
      reservations: ["les observations contradictoires ne sont pas résolues par le plan"],
    };
  }

  const sansObservation = etats.filter((etat) => etat.observations.length === 0);
  if (sansObservation.length > 0) {
    return {
      engagementId: engagement.id,
      state: "non-estimable",
      evidenceRefs,
      reasons: ["absence de preuve sur une compétence ciblée : un diagnostic est préférable"],
      reservations: ["absence de preuve ≠ niveau nul"],
    };
  }

  if (etats.some((etat) => etat.niveau === null)) {
    return {
      engagementId: engagement.id,
      state: "a-renforcer",
      evidenceRefs,
      reasons: ["des observations existent, mais le niveau n'est pas encore établi"],
      reservations: ["la préparation ne transforme pas l'absence de niveau en zéro"],
    };
  }

  // Hypothèse v0, explicitement révisable : le dernier palier existant (5),
  // et lui seul, autorise le libellé « prêt d'après les preuves disponibles ».
  if (etats.every((etat) => etat.niveau === 5)) {
    return {
      engagementId: engagement.id,
      state: PREPARATION_ETAT_5,
      evidenceRefs,
      reasons: ["toutes les compétences ciblées ont des preuves et le palier maximal existant"],
      reservations: ["prêt d'après les preuves disponibles ne prédit pas la réussite"],
    };
  }

  return {
    engagementId: engagement.id,
    state: "en-bonne-voie",
    evidenceRefs,
    reasons: ["des preuves existent sur toutes les compétences ciblées"],
    reservations: ["la préparation reste une lecture qualitative, sans score ni pourcentage"],
  };
}

function readinessFor(
  engagements: readonly Engagement[],
  states: readonly SkillState[],
): PreparationEcheance[] {
  return engagements
    .filter(estOuvert)
    .slice()
    .sort((left, right) => left.echeanceLe.localeCompare(right.echeanceLe) || left.id.localeCompare(right.id))
    .map((engagement) => stateForEngagement(engagement, states));
}

/**
 * Lecture qualitative réutilisable par les écrans qui affichent une échéance.
 * La préparation reste dérivée : ce point d'entrée ne persiste ni plan ni score.
 */
export function evaluerPreparationEcheances(
  engagements: readonly Engagement[],
  states: readonly SkillState[],
): PreparationEcheance[] {
  return readinessFor(engagements, states);
}

function dureeSessionAcceptee(session: LearningSession): number | null {
  if (session.dureePlanifieeMin !== undefined && Number.isInteger(session.dureePlanifieeMin) && session.dureePlanifieeMin > 0) {
    return session.dureePlanifieeMin;
  }
  if (session.dureeMin !== undefined && Number.isInteger(session.dureeMin) && session.dureeMin > 0) {
    return session.dureeMin;
  }
  if (session.blueprint?.dureeCibleMin !== undefined
    && Number.isInteger(session.blueprint.dureeCibleMin)
    && session.blueprint.dureeCibleMin > 0) {
    return session.blueprint.dureeCibleMin;
  }
  const interventions = session.interventions ?? [];
  const durees = interventions.map((intervention) => intervention.estimatedDurationMinutes);
  const dureesValides = durees.filter((duree): duree is number =>
    typeof duree === "number" && duree > 0,
  );
  if (durees.length > 0 && dureesValides.length === durees.length) {
    return dureesValides.reduce((total, duree) => total + duree, 0);
  }
  return null;
}

function occupationsAcceptees(
  sessions: readonly LearningSession[],
  contraintes: string[],
  reserves: string[],
): { occupations: Occupation[]; pointsOccupes: number[] } {
  const occupations: Occupation[] = [];
  const pointsOccupes: number[] = [];
  for (const session of sessions) {
    if (session.statut !== "planifiee" && session.statut !== "en-cours") continue;
    const start = instant(session.planifieePour ?? session.date);
    if (start === null) {
      reserves.push(`séance acceptée ${session.id} ignorée : date invalide`);
      continue;
    }
    const duree = dureeSessionAcceptee(session);
    if (duree === null) {
      pointsOccupes.push(start);
      reserves.push(`séance acceptée ${session.id} protégée, durée inconnue`);
      continue;
    }
    occupations.push({
      start,
      end: start + duree * 60_000,
      sourceRefs: [session.id],
      reason: "séance acceptée protégée",
    });
    contraintes.push(`séance acceptée protégée : ${session.id}`);
  }
  return { occupations, pointsOccupes };
}

function disponibilitesFusionnees(
  availability: readonly AvailabilityWindow[],
  reserves: string[],
  now: number | null,
): Intervalle[] {
  const valides: Intervalle[] = [];
  for (const [index, window] of availability.entries()) {
    const start = instant(window.startsAt);
    const end = instant(window.endsAt);
    if (!window.sourceRef.trim() || start === null || end === null || end <= start) {
      reserves.push(`disponibilité ${index} ignorée : intervalle invalide`);
      continue;
    }
    if (now !== null && end <= now) {
      reserves.push(`disponibilité ${index} ignorée : intervalle déjà passé`);
      continue;
    }
    valides.push({ start: now === null ? start : Math.max(start, now), end, sourceRefs: [window.sourceRef] });
  }
  valides.sort((left, right) => left.start - right.start || left.end - right.end);
  const fusionnees: Intervalle[] = [];
  for (const intervalle of valides) {
    const precedente = fusionnees[fusionnees.length - 1];
    if (!precedente || intervalle.start > precedente.end) {
      fusionnees.push({ ...intervalle, sourceRefs: [...intervalle.sourceRefs] });
      continue;
    }
    precedente.end = Math.max(precedente.end, intervalle.end);
    precedente.sourceRefs.push(...intervalle.sourceRefs);
  }
  return fusionnees;
}

function libre(
  disponibilites: readonly Intervalle[],
  occupations: readonly Occupation[],
  pointsOccupes: readonly number[],
): Intervalle[] {
  const triees = [...occupations].sort((left, right) => left.start - right.start || left.end - right.end);
  const sorties: Intervalle[] = [];
  for (const disponibilite of disponibilites) {
    let curseur = disponibilite.start;
    for (const occupation of triees) {
      if (occupation.end <= curseur || occupation.start >= disponibilite.end) continue;
      if (occupation.start > curseur) {
        sorties.push({ start: curseur, end: Math.min(occupation.start, disponibilite.end), sourceRefs: disponibilite.sourceRefs });
      }
      curseur = Math.max(curseur, occupation.end);
      if (curseur >= disponibilite.end) break;
    }
    if (curseur < disponibilite.end) {
      sorties.push({ start: curseur, end: disponibilite.end, sourceRefs: disponibilite.sourceRefs });
    }
  }
  return sorties.filter((intervalle) =>
    !pointsOccupes.some((point) => point >= intervalle.start && point < intervalle.end),
  );
}

function refusalMatch(
  candidate: ActionCandidate,
  refus: readonly RefusObserve[],
  now: number,
  propositionRef?: string,
): RefusObserve | null {
  return refus.find((item) => {
    if (!dateRefusActive(item, now)) return false;
    if (item.propositionRef) return item.propositionRef === propositionRef;
    // Une portée activité ne devient jamais un refus de compétence : le fait
    // historique porte l'un ou l'autre, et la présence de `candidateId`
    // l'emporte sur un éventuel code recopié par l'adaptateur.
    if (item.candidateId) return item.candidateId === candidate.candidateId;
    return item.skillCode !== undefined && candidate.target.skillCodes.includes(item.skillCode);
  }) ?? null;
}

function classerCandidats(
  candidates: readonly ActionCandidate[],
  engagements: readonly Engagement[],
  readiness: readonly PreparationEcheance[],
  refus: readonly RefusObserve[],
  now: number,
  propositionRef: string | undefined,
  reserves: string[],
): CandidateClasse[] {
  const parPreparation = new Map(readiness.map((item) => [item.engagementId, item]));
  const vus = new Set<string>();
  const classes: CandidateClasse[] = [];
  for (const candidate of candidates) {
    if (vus.has(candidate.candidateId)) {
      reserves.push(`candidate dupliquée réservée : ${candidate.candidateId}`);
      continue;
    }
    vus.add(candidate.candidateId);
    const motif = motifRefusActionCandidate(candidate);
    if (motif) {
      reserves.push(`${candidate.candidateId} exclue : ${motif}`);
      continue;
    }
    const refusActif = refusalMatch(candidate, refus, now, propositionRef);
    if (refusActif) {
      reserves.push(`${candidate.candidateId} refusée selon ${refusActif.sourceRef}`);
      continue;
    }
    const cibles = engagementsCibles(candidate, engagements);
    const readinessCibles = cibles
      .map((engagement) => parPreparation.get(engagement.id))
      .filter((item): item is PreparationEcheance => item !== undefined);
    const diagnostic = candidate.intervention === "diagnose"
      && readinessCibles.some((item) => item.state === "a-eclaircir" || item.state === "non-estimable");
    const continu = candidate.source === "declared-need" && (candidate.target.engagementIds?.length ?? 0) === 0;
    classes.push({
      candidate,
      urgence: cibles.map((engagement) => engagement.echeanceLe).sort()[0] ?? "9999-12-31",
      diagnostic,
      continu,
      engagementIds: cibles.map((engagement) => engagement.id).sort(),
    });
  }
  return classes.sort((left, right) => {
    if (left.diagnostic !== right.diagnostic) return left.diagnostic ? -1 : 1;
    if (left.urgence !== right.urgence) return left.urgence.localeCompare(right.urgence);
    if (left.continu !== right.continu) return left.continu ? -1 : 1;
    return left.candidate.candidateId.localeCompare(right.candidate.candidateId);
  });
}

function iso(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

/**
 * Planificateur v0 : pur, déterministe et non persistant.
 *
 * Hypothèses explicites v0 :
 * - une candidate est servie au plus une fois ;
 * - les échéances sont départagées par date puis identifiant, sans score ;
 * - une candidate `declared-need` sans engagement représente le besoin
 *   continu et passe après les échéances, mais est conservée si un créneau
 *   reste disponible ;
 * - le niveau existant 5 est le seul repère pour le libellé « prêt ».
 */
export function planifierTemps(
  input: PlanificateurTemporelInput,
): PlanPropose {
  const constraints: string[] = [];
  const reservations: string[] = [];
  const now = instant(input.now);
  if (now === null) {
    constraints.push("instant de référence invalide : aucune candidate ne peut être placée");
  }
  const engagements = input.engagements.filter(estOuvert);
  const readiness = readinessFor(engagements, input.skillStates);
  const nowTimestamp = now ?? Number.POSITIVE_INFINITY;
  const classes = classerCandidats(
    input.candidates,
    engagements,
    readiness,
    input.refusObserved,
    nowTimestamp,
    input.propositionRef,
    reservations,
  );
  const diagnosticRequis = readiness.some((item) =>
    item.state === "a-eclaircir" || item.state === "non-estimable",
  );
  if (diagnosticRequis && !classes.some((classe) => classe.diagnostic)) {
    reservations.push("diagnostic requis mais aucune candidate diagnose recevable n'a été fournie");
  }

  const disponibilites = disponibilitesFusionnees(input.availability, reservations, now);
  if (disponibilites.length === 0) constraints.push("aucune disponibilité déclarée exploitable");
  const accepted = occupationsAcceptees(input.acceptedSessions, constraints, reservations);
  const occupations = [...accepted.occupations];
  const slots: CreneauPropose[] = [];

  if (now === null) {
    for (const classe of classes) reservations.push(`${classe.candidate.candidateId} non planifiée : instant invalide`);
    return { slots, availability: input.availability.map((window) => ({ ...window })), readiness, constraints, reservations };
  }

  for (const classe of classes) {
    const libreRestant = libre(disponibilites, occupations, accepted.pointsOccupes);
    const choisi = libreRestant.find((intervalle) =>
      intervalle.end - intervalle.start >= classe.candidate.durationMinutes * 60_000,
    );
    if (!choisi) {
      reservations.push(`${classe.candidate.candidateId} non planifiée : aucun créneau compatible`);
      continue;
    }
    const debut = choisi.start;
    const fin = debut + classe.candidate.durationMinutes * 60_000;
    const raisons = [...classe.candidate.reasons];
    if (classe.diagnostic) raisons.push("diagnostic préféré : absence de preuve estimable");
    if (classe.engagementIds.length > 0) raisons.push(`échéance ciblée : ${classe.engagementIds.join(", ")}`);
    if (classe.continu) raisons.push("besoin continu conservé quand la capacité le permet");
    const contraintesCreneau = [
      ...classe.candidate.constraints,
      ...choisi.sourceRefs.map((sourceRef) => `disponibilité déclarée : ${sourceRef}`),
    ];
    const reservationsCreneau = [...classe.candidate.reservations];
    slots.push({
      candidate: classe.candidate,
      plannedFor: iso(debut),
      endsAt: iso(fin),
      durationMinutes: classe.candidate.durationMinutes,
      intervention: classe.candidate.intervention,
      expectedEffect: classe.candidate.expectedEffect,
      reasons: raisons,
      constraints: contraintesCreneau,
      reservations: reservationsCreneau,
    });
    occupations.push({
      start: debut,
      end: fin,
      sourceRefs: [classe.candidate.candidateId],
      reason: "candidate déjà placée dans le plan",
    });
  }

  if (classes.some((classe) => classe.continu) && !slots.some((slot) =>
    slot.candidate.source === "declared-need" && (slot.candidate.target.engagementIds?.length ?? 0) === 0,
  )) {
    reservations.push("besoin continu non placé : capacité occupée ou indisponible");
  }

  return {
    slots,
    availability: input.availability.map((window) => ({ ...window })),
    readiness,
    constraints,
    reservations,
  };
}

export type PlanProposal = PlanPropose;

export {
  INTERVENTION_EFFECTS,
  INTERVENTION_TYPES,
};
