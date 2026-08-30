import type { Engagement } from "@/lib/domain/engagement";
import {
  motifRefusDomaineCours,
  motifRefusProtocole,
  type DimensionSeance,
  type ProtocoleCours,
} from "@/lib/domain/protocole-cours";
import type {
  ActionCandidate,
  OrigineCandidateProtocole,
} from "./action-candidate";

export interface EntreeCandidatsProtocole {
  courseDocumentId: string;
  sourceAttachmentId: string;
  domainId: string;
  documentArchived?: boolean;
  activeDomainIds: ReadonlySet<string>;
  activeSkillCodes: ReadonlySet<string>;
  engagements: readonly Engagement[];
  protocol: ProtocoleCours;
}

export interface ResultatCandidatsProtocole {
  candidates: ActionCandidate[];
  reservations: string[];
}

function interventionDepuisDimension(
  dimension: DimensionSeance,
): ActionCandidate["intervention"] {
  if (dimension === "comprehension") return "explain";
  if (dimension === "memorisation") return "recall";
  return "resolve";
}

export function identifiantCandidateProtocole(
  courseDocumentId: string,
  sourceAttachmentId: string,
  index: number,
): string {
  return `course-protocol:${courseDocumentId}:${sourceAttachmentId}:${index + 1}`;
}

function textePresent(value: string): boolean {
  return value.trim().length > 0;
}

/**
 * Adapte une analyse de cours en candidates du plan global sans la persister.
 *
 * La validation pédagogique reste celle de `motifRefusProtocole`. Les gardes
 * ajoutées ici ne portent que sur les frontières que ce contrat est seul à
 * connaître : fiche, PDF source et domaine vivants. Une entrée invalide reste
 * en réserve ; elle n'est jamais convertie en exercice générique.
 */
export function actionsCandidatesDepuisProtocole(
  input: EntreeCandidatsProtocole,
): ResultatCandidatsProtocole {
  if (!textePresent(input.courseDocumentId)) {
    return { candidates: [], reservations: ["fiche de cours source absente"] };
  }
  if (!textePresent(input.sourceAttachmentId)) {
    return { candidates: [], reservations: ["PDF source absent"] };
  }
  if (input.documentArchived) {
    return { candidates: [], reservations: ["document source archivé"] };
  }
  const refusDomaine = motifRefusDomaineCours(input.domainId, input.activeDomainIds);
  if (refusDomaine) {
    return { candidates: [], reservations: [refusDomaine] };
  }

  const refusal = motifRefusProtocole(input.protocol, input.activeSkillCodes);
  if (refusal) return { candidates: [], reservations: [refusal] };

  const engagementIds = input.engagements
    .filter((engagement) =>
      !engagement.clotureLe
      && !engagement.clotureType
      && engagement.moduleDomaineId === input.domainId)
    .map((engagement) => engagement.id)
    .sort();

  const candidates = input.protocol.seances.map((session, index) => ({
    candidateId: identifiantCandidateProtocole(
      input.courseDocumentId,
      input.sourceAttachmentId,
      index,
    ),
    source: "course-protocol" as const,
    target: {
      skillCodes: [...session.codes],
      engagementIds: [...engagementIds],
      label: session.titre,
    },
    intervention: interventionDepuisDimension(session.dimension),
    expectedEffect: "measurement" as const,
    title: session.titre,
    durationMinutes: session.dureeCibleMin,
    proofMode: "validated-submission" as const,
    reasons: [
      `Intervention relue pour le cours source « ${input.courseDocumentId} ».`,
      ...(engagementIds.length > 0
        ? ["Elle contribue à une échéance déclarée de ce module."]
        : []),
    ],
    constraints: [
      `PDF source : ${input.sourceAttachmentId}`,
      `Domaine déclaré : ${input.domainId}`,
    ],
    reservations: engagementIds.length === 0
      ? ["Aucune échéance ouverte n'est rattachée à ce module."]
      : [],
    courseProtocolOrigin: {
      courseDocumentId: input.courseDocumentId,
      sourceAttachmentId: input.sourceAttachmentId,
      domainId: input.domainId,
      dimension: session.dimension,
      instruction: session.consigne,
    } satisfies OrigineCandidateProtocole,
  } satisfies ActionCandidate));

  return { candidates, reservations: [] };
}
