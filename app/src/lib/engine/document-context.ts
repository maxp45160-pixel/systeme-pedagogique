import type { SkillEvidence } from "@/lib/domain/types";

/** Résumé dérivé des preuves qui possèdent une provenance documentaire gelée. */
export interface ResumePreuvesDocumentaires {
  nombre: number;
  reussites: number;
  derniereDate: string | null;
  dernierResultat: SkillEvidence["resultat"] | null;
  contextes: string[];
  typesPreuve: SkillEvidence["type"][];
  typesSource: SkillEvidence["source"]["kind"][];
}

/**
 * Contexte documentaire prêt à être consommé par le moteur.
 *
 * La Map est calculée à la lecture depuis `evidence`. Elle ne constitue pas une
 * nouvelle mesure et n'est jamais persistée.
 */
export type ContexteDocumentaire = ReadonlyMap<string, ResumePreuvesDocumentaires>;

function provenanceValide(preuve: SkillEvidence): boolean {
  const document = preuve.source?.document;
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
 * Le snapshot est déjà référencé par `SkillEvidence.source.document`. Cela
 * permet au chemin chaud de rester sur la lecture groupée existante : le
 * contenu Markdown et l'index relationnel pourront enrichir un autre écran,
 * mais ne sont pas nécessaires pour cette première décision pédagogique.
 */
export function construireContexteDocumentaire(
  preuves: SkillEvidence[],
): ContexteDocumentaire {
  const parCode = new Map<string, ResumePreuvesDocumentaires>();

  for (const preuve of preuves) {
    if (!provenanceValide(preuve) || !dateValide(preuve.date)) continue;

    const resume =
      parCode.get(preuve.skillCode) ?? {
        nombre: 0,
        reussites: 0,
        derniereDate: null,
        dernierResultat: null,
        contextes: [],
        typesPreuve: [],
        typesSource: [],
      };

    resume.nombre += 1;
    if (!resume.derniereDate || new Date(preuve.date).getTime() > new Date(resume.derniereDate).getTime()) {
      resume.derniereDate = preuve.date;
      resume.dernierResultat = preuve.resultat;
    }
    if (preuve.resultat === "reussi") resume.reussites += 1;
    if (preuve.contexte.trim()) ajouterUnique(resume.contextes, preuve.contexte.trim());
    ajouterUnique(resume.typesPreuve, preuve.type);
    ajouterUnique(resume.typesSource, preuve.source.kind);
    parCode.set(preuve.skillCode, resume);
  }

  return parCode;
}
