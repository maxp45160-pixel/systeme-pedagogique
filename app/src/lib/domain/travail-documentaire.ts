import {
  INTERVENTION_TYPES,
  parseInterventionsSeance,
  type InterventionType,
} from "./intervention-seance";
import type { LearningSession } from "./types";

export const MAX_RESSOURCES_TRAVAIL_DOCUMENTAIRE = 30;
export const MAX_NOTE_TRAVAIL_DOCUMENTAIRE = 4000;

/** Un geste est choisi par la personne, jamais déduit de sa note libre. */
export const LIBELLES_GESTES_TRAVAIL_DOCUMENTAIRE: Record<InterventionType, string> = {
  resolve: "Résoudre",
  explain: "Expliquer",
  recall: "Rappeler",
  read: "Lire",
  synthesize: "Synthétiser",
  produce: "Produire",
  diagnose: "Diagnostiquer",
  "ask-for-help": "Demander de l’aide",
};

export interface EntreeTravailDocumentaire {
  documentIds: string[];
  geste: InterventionType;
  note?: string;
  cle: string;
}

export interface RessourceTravailDocumentaire {
  id: string;
  titre: string;
}

export function validerEntreeTravailDocumentaire(valeur: unknown): EntreeTravailDocumentaire {
  if (!valeur || typeof valeur !== "object" || Array.isArray(valeur)) {
    throw new Error("Travail documentaire invalide.");
  }
  const entree = valeur as Record<string, unknown>;
  if (!Array.isArray(entree.documentIds) || entree.documentIds.length < 1 || entree.documentIds.length > MAX_RESSOURCES_TRAVAIL_DOCUMENTAIRE ||
    !entree.documentIds.every((id) => typeof id === "string" && /^[a-zA-Z0-9_-]{1,120}$/.test(id)) ||
    new Set(entree.documentIds).size !== entree.documentIds.length) {
    throw new Error(`Choisissez de 1 à ${MAX_RESSOURCES_TRAVAIL_DOCUMENTAIRE} ressources distinctes.`);
  }
  if (typeof entree.geste !== "string" || !INTERVENTION_TYPES.some((type) => type === entree.geste)) {
    throw new Error("Choisissez le geste réellement effectué.");
  }
  if (typeof entree.cle !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(entree.cle)) {
    throw new Error("Clé d’enregistrement invalide.");
  }
  if (entree.note !== undefined && (typeof entree.note !== "string" || entree.note.length > MAX_NOTE_TRAVAIL_DOCUMENTAIRE)) {
    throw new Error("La note personnelle est trop longue.");
  }
  return {
    documentIds: entree.documentIds as string[],
    geste: entree.geste as InterventionType,
    ...(typeof entree.note === "string" && entree.note.trim() ? { note: entree.note } : {}),
    cle: entree.cle,
  };
}

/** Construit un fait déclaré, sans objectif de compétence ni contrat de preuve. */
export function composerSeanceTravailDocumentaire(
  id: string,
  date: string,
  entree: EntreeTravailDocumentaire,
  ressources: RessourceTravailDocumentaire[],
): LearningSession {
  if (ressources.length !== entree.documentIds.length || ressources.some((ressource, index) =>
    ressource.id !== entree.documentIds[index] || !ressource.titre.trim())) {
    throw new Error("Les ressources du travail déclaré ne correspondent pas à la sélection.");
  }
  const interventions = parseInterventionsSeance(ressources.map((ressource, index) => ({
    id: `${id}-${index + 1}`,
    type: entree.geste,
    label: `${LIBELLES_GESTES_TRAVAIL_DOCUMENTAIRE[entree.geste]} « ${ressource.titre} »`,
    source: { kind: "document", ref: ressource.id },
    expectedEffect: "preparation",
    statut: "completed",
  })));
  return {
    id,
    date,
    domaines: [],
    skillCodes: [],
    activites: [],
    interventions,
    ...(entree.note ? { notePersonnelle: entree.note } : {}),
    genereAutomatiquement: false,
    statut: "terminee",
  };
}

/** Une même clé ne peut jamais servir à enregistrer un autre fait. */
export function correspondAuTravailDocumentaire(
  seance: LearningSession,
  entree: EntreeTravailDocumentaire,
): boolean {
  return seance.statut === "terminee" && seance.genereAutomatiquement === false &&
    seance.dureeMin === undefined && seance.dureePlanifieeMin === undefined &&
    seance.domaines.length === 0 && seance.skillCodes.length === 0 && seance.activites.length === 0 &&
    (seance.notePersonnelle ?? undefined) === entree.note &&
    seance.interventions?.length === entree.documentIds.length &&
    seance.interventions.every((intervention, index) =>
      intervention.type === entree.geste &&
      intervention.source.kind === "document" && intervention.source.ref === entree.documentIds[index] &&
      intervention.expectedEffect === "preparation" && intervention.statut === "completed" &&
      intervention.proofContract === undefined && intervention.targetSkillCodes === undefined &&
      intervention.estimatedDurationMinutes === undefined) === true;
}
