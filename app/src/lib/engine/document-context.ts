import type { SkillObservation } from "@/lib/domain/types";

/** Résumé dérivé des observations qui possèdent une provenance documentaire gelée. */
export interface ResumeObservationsDocumentaires {
  nombre: number;
  reussites: number;
  derniereDate: string | null;
  dernierResultat: SkillObservation["resultat"] | null;
  contextes: string[];
  typesObservation: SkillObservation["type"][];
  typesSource: SkillObservation["source"]["kind"][];
}

/**
 * Contexte documentaire prêt à être consommé par le moteur.
 *
 * La Map est calculée à la lecture depuis `observations`. Elle ne constitue pas une
 * nouvelle mesure et n'est jamais persistée.
 */
export type ContexteDocumentaire = ReadonlyMap<string, ResumeObservationsDocumentaires>;

function provenanceValide(observation: SkillObservation): boolean {
  const document = observation.source?.document;
  return Boolean(
    document &&
      typeof document.documentId === "string" &&
      document.documentId.length > 0 &&
      typeof document.snapshotId === "string" &&
      document.snapshotId.length > 0,
  );
}

function dateValide(date: string): boolean {
  return Number.isFinite(new Date(date).getTime());
}

function ajouterUnique<T>(liste: T[], valeur: T): void {
  if (!liste.includes(valeur)) liste.push(valeur);
}

/**
 * Reconstruit la présence documentaire par compétence sans lire les documents.
 *
 * Le snapshot est déjà référencé par `SkillObservation.source.document`. Cela
 * permet au chemin chaud de rester sur la lecture groupée existante : le
 * contenu Markdown et l'index relationnel pourront enrichir un autre écran,
 * mais ne sont pas nécessaires pour cette première décision pédagogique.
 */
export function construireContexteDocumentaire(
  observations: SkillObservation[],
): ContexteDocumentaire {
  const parCode = new Map<string, ResumeObservationsDocumentaires>();

  for (const observation of observations) {
    if (!provenanceValide(observation) || !dateValide(observation.date)) continue;

    const resume =
      parCode.get(observation.skillCode) ?? {
        nombre: 0,
        reussites: 0,
        derniereDate: null,
        dernierResultat: null,
        contextes: [],
        typesObservation: [],
        typesSource: [],
      };

    resume.nombre += 1;
    if (!resume.derniereDate || new Date(observation.date).getTime() > new Date(resume.derniereDate).getTime()) {
      resume.derniereDate = observation.date;
      resume.dernierResultat = observation.resultat;
    }
    if (observation.resultat === "reussi") resume.reussites += 1;
    if (observation.contexte.trim()) ajouterUnique(resume.contextes, observation.contexte.trim());
    ajouterUnique(resume.typesObservation, observation.type);
    ajouterUnique(resume.typesSource, observation.source.kind);
    parCode.set(observation.skillCode, resume);
  }

  return parCode;
}
