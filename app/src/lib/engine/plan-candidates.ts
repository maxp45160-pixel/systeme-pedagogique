import type { Engagement } from "@/lib/domain/engagement";
import { motifRefusBesoin, exercicesDeLaSeance, statutSeance } from "@/lib/domain/seance";
import type { ExerciseAttempt, LearningSession, SkillState } from "@/lib/domain/types";
import type { Recommandation } from "./recommend";
import {
  actionCandidateDepuisRecommandation,
  motifRefusActionCandidate,
  type ActionCandidate,
} from "./action-candidate";

export interface EntreesCandidatsPlan {
  recommandations: readonly Recommandation[];
  sessions: readonly LearningSession[];
  tentatives?: readonly ExerciseAttempt[];
  engagements?: readonly Engagement[];
  etats?: readonly SkillState[];
  /** Seul l'appelant qui possède un protocole relu renseigne cette liste. */
  candidatsProtocole?: readonly ActionCandidate[];
  /** Seul le bord serveur fournit l'ensemble des codes du référentiel actif. */
  codesCompetenceActifs: ReadonlySet<string>;
}

export interface ResultatCandidatsPlan {
  candidates: ActionCandidate[];
  /** Raisons de mise en réserve d'une source invalide ou déjà couverte. */
  reservations: string[];
}

const PRIORITE_SOURCE: Record<ActionCandidate["source"], number> = {
  "course-protocol": 40,
  "declared-need": 30,
  "existing-activity": 20,
  resume: 20,
  resource: 20,
  generation: 20,
  "legacy-exercise": 10,
};

function codesUniques(candidate: ActionCandidate): string[] {
  return [...new Set(candidate.target.skillCodes)];
}

function idsEngagementsPourCodes(
  codes: readonly string[],
  engagements: readonly Engagement[],
): string[] {
  const cibles = new Set(codes);
  return engagements
    .filter((engagement) =>
      !engagement.clotureLe
      && !engagement.clotureType
      && engagement.codes.some((code) => cibles.has(code)),
    )
    .map((engagement) => engagement.id)
    .sort();
}

function sessionActive(session: LearningSession): boolean {
  return session.statut === "planifiee" || session.statut === "en-cours";
}

function candidateCouverteParSessionActive(
  candidate: ActionCandidate,
  sessions: readonly LearningSession[],
): boolean {
  const exerciceId = candidate.source === "legacy-exercise"
    ? candidate.candidateId.slice("legacy-exercise:".length)
    : null;
  return sessions.some((session) => {
    if (!sessionActive(session)) return false;
    if (session.origineProposition?.candidateId === candidate.candidateId) return true;
    if (exerciceId && exercicesDeLaSeance(session).includes(exerciceId)) return true;
    const origine = session.blueprint?.origine;
    const protocole = candidate.courseProtocolOrigin;
    if (candidate.source !== "course-protocol" || !protocole) return false;
    return origine?.genre === "protocole-cours"
      && origine.ficheId === protocole.courseDocumentId
      && origine.pieceId === protocole.sourceAttachmentId
      && origine.titre === candidate.title;
  });
}

function candidatDiagnosticDejaTermine(
  candidate: ActionCandidate,
  sessions: readonly LearningSession[],
  tentatives: readonly ExerciseAttempt[],
): boolean {
  if (candidate.intervention !== "diagnose") return false;
  const exerciceId = candidate.source === "legacy-exercise"
    ? candidate.candidateId.slice("legacy-exercise:".length)
    : null;
  return sessions.some((session) =>
    statutSeance(session) === "terminee"
    && (
      session.origineProposition?.candidateId === candidate.candidateId
      || (exerciceId !== null && exercicesDeLaSeance(session).includes(exerciceId))
    ),
  ) || (exerciceId !== null && tentatives.some((tentative) =>
    tentative.exerciseId === exerciceId && tentative.statut === "terminee",
  ));
}

function cleEquivalent(candidate: ActionCandidate): string {
  return JSON.stringify({
    codes: codesUniques(candidate).sort(),
    intervention: candidate.intervention,
    durationMinutes: candidate.durationMinutes,
  });
}

function priorite(candidate: ActionCandidate): number {
  return PRIORITE_SOURCE[candidate.source] ?? 0;
}

function fusionnerCandidates(
  candidates: readonly ActionCandidate[],
): ActionCandidate[] {
  const tries = [...candidates].sort((left, right) =>
    priorite(right) - priorite(left)
    || left.candidateId.localeCompare(right.candidateId),
  );
  const parCle = new Map<string, ActionCandidate>();
  for (const candidate of tries) {
    const cle = cleEquivalent(candidate);
    const existante = parCle.get(cle);
    if (!existante) {
      parCle.set(cle, {
        ...candidate,
        target: {
          ...candidate.target,
          skillCodes: codesUniques(candidate),
          engagementIds: [...new Set(candidate.target.engagementIds ?? [])].sort(),
        },
        reasons: [...new Set(candidate.reasons)],
        constraints: [...new Set(candidate.constraints)],
        reservations: [...new Set(candidate.reservations)],
      });
      continue;
    }
    existante.target.engagementIds = [...new Set([
      ...(existante.target.engagementIds ?? []),
      ...(candidate.target.engagementIds ?? []),
    ])].sort();
    existante.reasons = [...new Set([...existante.reasons, ...candidate.reasons])];
    existante.constraints = [...new Set([...existante.constraints, ...candidate.constraints])];
    existante.reservations = [...new Set([...existante.reservations, ...candidate.reservations])];
  }
  return [...parCle.values()];
}

function candidatsDepuisBesoins(
  sessions: readonly LearningSession[],
  engagements: readonly Engagement[],
  etats: readonly SkillState[],
  codesActifs: ReadonlySet<string>,
  reservations: string[],
): ActionCandidate[] {
  const parCode = new Map(etats.map((etat) => [etat.skill.code, etat]));
  return [...sessions]
    .filter((session) => !sessionActive(session) && session.besoinDeclare)
    .sort((left, right) => left.id.localeCompare(right.id))
    .flatMap((session) => {
      const besoin = session.besoinDeclare;
      if (!besoin) return [];
      const refus = motifRefusBesoin(besoin);
      if (refus) {
        reservations.push(`besoin déclaré ${session.id} réservé : ${refus}`);
        return [];
      }
      const codes = [...new Set(besoin.codesVises)];
      if (codes.length === 0) {
        reservations.push(`besoin déclaré ${session.id} réservé : aucune compétence visée`);
        return [];
      }
      const inactifs = codes.filter((code) => !codesActifs.has(code));
      if (inactifs.length > 0) {
        reservations.push(`besoin déclaré ${session.id} réservé : compétences hors référentiel actif`);
        return [];
      }
      const diagnostic = codes.some((code) => (parCode.get(code)?.observations.length ?? 0) === 0);
      const engagementIds = idsEngagementsPourCodes(codes, engagements);
      return [{
        candidateId: `declared-need:${session.id}`,
        source: "declared-need" as const,
        target: {
          skillCodes: codes,
          engagementIds,
          ...(besoin.intention?.trim() ? { label: besoin.intention.trim() } : {}),
        },
        intervention: diagnostic ? "diagnose" as const : "resolve" as const,
        expectedEffect: "measurement" as const,
        title: besoin.intention?.trim() || "Travailler les compétences déclarées",
        durationMinutes: besoin.tempsDisponibleMin,
        proofMode: "validated-submission" as const,
        reasons: ["Besoin déclaré par vous, conservé comme contexte de travail."],
        constraints: [],
        reservations: [],
      } satisfies ActionCandidate];
    });
}

function annoterEngagements(
  candidates: readonly ActionCandidate[],
  engagements: readonly Engagement[],
): ActionCandidate[] {
  return candidates.map((candidate) => ({
    ...candidate,
    target: {
      ...candidate.target,
      engagementIds: [...new Set([
        ...(candidate.target.engagementIds ?? []),
        ...idsEngagementsPourCodes(candidate.target.skillCodes, engagements),
      ])].sort(),
    },
  }));
}

/**
 * Réunit les producteurs connus du plan sans donner au moteur un accès au
 * référentiel ou à Supabase. Le filtrage des codes, les exclusions de séances
 * et la déduplication sont faits à cette frontière d'adaptation.
 */
export function composerCandidatsPlan(input: EntreesCandidatsPlan): ResultatCandidatsPlan {
  const reservations: string[] = [];
  const engagements = input.engagements ?? [];
  const tentatives = input.tentatives ?? [];
  const etats = input.etats ?? [];
  const historiques = input.recommandations
    .map((recommandation) => actionCandidateDepuisRecommandation(recommandation, {
      engagementIds: idsEngagementsPourCodes(
        recommandation.exercice?.competences ?? [],
        engagements,
      ),
    }))
    .filter((candidate): candidate is ActionCandidate => candidate !== null);
  const besoins = candidatsDepuisBesoins(
    input.sessions,
    engagements,
    etats,
    input.codesCompetenceActifs,
    reservations,
  );
  const candidatsBruts = annoterEngagements([
    ...historiques,
    ...besoins,
    ...(input.candidatsProtocole ?? []),
  ], engagements);

  const recevables = candidatsBruts.filter((candidate) => {
    const forme = motifRefusActionCandidate(candidate);
    if (forme) {
      reservations.push(`${candidate.candidateId} réservé : ${forme}`);
      return false;
    }
    const invalides = codesUniques(candidate).filter((code) => !input.codesCompetenceActifs.has(code));
    if (invalides.length > 0) {
      reservations.push(`${candidate.candidateId} réservé : compétence hors référentiel actif`);
      return false;
    }
    if ((candidate.source === "course-protocol" || candidate.source === "declared-need")
      && codesUniques(candidate).length === 0) {
      reservations.push(`${candidate.candidateId} réservé : aucune compétence visée`);
      return false;
    }
    if (candidateCouverteParSessionActive(candidate, input.sessions)) {
      reservations.push(`${candidate.candidateId} réservé : séance déjà planifiée ou en cours`);
      return false;
    }
    if (candidatDiagnosticDejaTermine(candidate, input.sessions, tentatives)) {
      reservations.push(`${candidate.candidateId} réservé : diagnostic déjà terminé dans ce parcours`);
      return false;
    }
    return true;
  });

  return {
    candidates: fusionnerCandidates(recevables),
    reservations: [...new Set(reservations)],
  };
}

/**
 * Compose la première proposition de tableau de bord à partir du classement
 * historique. Les séances acceptées restent la source d'occupation et une
 * candidate déjà matérialisée ne doit pas réapparaître à chaque relecture.
 *
 * Cette projection ne vaut pas encore replanification : un futur recalcul qui
 * touche des séances acceptées devra passer par `calculerDiffPlan`.
 */
export function actionCandidatesDepuisRecommandations(
  recommandations: readonly Recommandation[],
  sessions: readonly LearningSession[] = [],
  engagements: readonly Engagement[] = [],
): ActionCandidate[] {
  const candidatesDejaAcceptees = new Set(
    sessions
      .filter((session) => session.statut === "planifiee" || session.statut === "en-cours")
      .map((session) => session.origineProposition?.candidateId)
      .filter((candidateId): candidateId is string => Boolean(candidateId)),
  );

  return recommandations
    .map((recommandation) => actionCandidateDepuisRecommandation(recommandation, {
      engagementIds: idsEngagementsPourCodes(recommandation.exercice?.competences ?? [], engagements),
    }))
    .filter((candidate): candidate is ActionCandidate => candidate !== null)
    .filter((candidate) => !candidatesDejaAcceptees.has(candidate.candidateId));
}
