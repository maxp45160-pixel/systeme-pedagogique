import { describe, expect, it } from "vitest";
import type { Engagement } from "@/lib/domain/engagement";
import type { ProtocoleCours } from "@/lib/domain/protocole-cours";
import type { SkillState } from "@/lib/domain/types";
import { motifRefusActionCandidate } from "./action-candidate";
import { planifierTemps } from "./planification-temporelle";
import { actionsCandidatesDepuisProtocole } from "./protocole-candidats";

const ACTIVE_DOMAINS = new Set(["maths", "physique"]);
const ACTIVE_CODES = new Set(["MATH-01", "PHY-01"]);

function protocol(code: string, title = "Appliquer le cours"): ProtocoleCours {
  return {
    resume: "Protocole relu.",
    seances: [{
      titre: title,
      dimension: "application",
      codes: [code],
      consigne: `Appliquer ${code} au cas désigné.`,
      dureeCibleMin: 20,
    }],
  };
}

function engagement(
  id: string,
  moduleDomaineId: string,
  code: string,
  dueAt: string,
): Engagement {
  return {
    id,
    type: "examen",
    libelle: id,
    echeanceLe: dueAt,
    codes: [code],
    moduleDomaineId,
  };
}

function state(code: string, domain: string): SkillState {
  return {
    skill: {
      code,
      intitule: code,
      domaine: domain,
      palier: "fondamentaux",
      prerequis: [],
      importance: 1,
      ordre: 0,
      active: true,
      archive: false,
      origine: "utilisateur",
    },
    niveau: null,
    score: null,
    confiance: "nulle",
    robustesse: null,
    dimensions: {} as SkillState["dimensions"],
    observations: [],
    contextesTestes: [],
    derniereObservation: null,
    joursDepuisDerniereObservation: null,
    contradictions: [],
    prochaineEtape: "diagnostiquer",
    explication: { resume: "", facteurs: [], nombreObservations: 0, reserves: [] },
    statut: "non-evalue",
  };
}

function adapt(options: Partial<Parameters<typeof actionsCandidatesDepuisProtocole>[0]> = {}) {
  return actionsCandidatesDepuisProtocole({
    courseDocumentId: "cours-maths",
    sourceAttachmentId: "pdf-maths-v1",
    domainId: "maths",
    activeDomainIds: ACTIVE_DOMAINS,
    activeSkillCodes: ACTIVE_CODES,
    engagements: [engagement("exam-maths", "maths", "MATH-01", "2026-09-02")],
    protocol: protocol("MATH-01"),
    ...options,
  });
}

describe("actionsCandidatesDepuisProtocole", () => {
  it("arbitre deux cours concurrents dans le planificateur global", () => {
    const maths = adapt().candidates;
    const physics = adapt({
      courseDocumentId: "cours-physique",
      sourceAttachmentId: "pdf-physique-v1",
      domainId: "physique",
      protocol: protocol("PHY-01", "Préparer la physique"),
      engagements: [engagement("exam-physique", "physique", "PHY-01", "2026-09-01")],
    }).candidates;
    const plan = planifierTemps({
      now: "2026-08-28T08:00:00.000Z",
      engagements: [
        engagement("exam-maths", "maths", "MATH-01", "2026-09-02"),
        engagement("exam-physique", "physique", "PHY-01", "2026-09-01"),
      ],
      availability: [{
        startsAt: "2026-08-28T08:00:00.000Z",
        endsAt: "2026-08-28T09:00:00.000Z",
        sourceRef: "disponibilite:test",
      }],
      skillStates: [state("MATH-01", "maths"), state("PHY-01", "physique")],
      candidates: [...maths, ...physics],
      refusObserved: [],
      acceptedSessions: [],
    });

    expect(plan.slots.map((slot) => slot.candidate.candidateId)).toEqual([
      "course-protocol:cours-physique:pdf-physique-v1:1",
      "course-protocol:cours-maths:pdf-maths-v1:1",
    ]);
  });

  it("distingue deux PDF du même cours et conserve exactement leur origine", () => {
    const first = adapt({ sourceAttachmentId: "pdf-v1" }).candidates[0];
    const second = adapt({ sourceAttachmentId: "pdf-v2" }).candidates[0];

    expect(first.candidateId).not.toBe(second.candidateId);
    expect(first.courseProtocolOrigin?.sourceAttachmentId).toBe("pdf-v1");
    expect(second.courseProtocolOrigin?.sourceAttachmentId).toBe("pdf-v2");
    expect(motifRefusActionCandidate(first)).toBeNull();
  });

  it("met en réserve un document archivé", () => {
    expect(adapt({ documentArchived: true })).toEqual({
      candidates: [],
      reservations: ["document source archivé"],
    });
  });

  it("met en réserve un domaine orphelin", () => {
    expect(adapt({ domainId: "orphelin" })).toEqual({
      candidates: [],
      reservations: ["Le domaine du cours est absent ou archivé."],
    });
  });

  it("réutilise le refus canonique pour un code invalide", () => {
    const result = adapt({ protocol: protocol("INVENTE-99") });
    expect(result.candidates).toEqual([]);
    expect(result.reservations[0]).toContain("référentiel actif");
  });

  it("préserve les gestes déterministes Feynman et rappel", () => {
    const result = adapt({
      protocol: {
        resume: "Deux gestes relus.",
        seances: [
          { ...protocol("MATH-01").seances[0], dimension: "comprehension", titre: "Expliquer" },
          { ...protocol("MATH-01").seances[0], dimension: "memorisation", titre: "Rappeler" },
        ],
      },
    });
    expect(result.candidates.map((candidate) => candidate.intervention)).toEqual([
      "explain",
      "recall",
    ]);
  });
});
