/**
 * Contrat commun des interventions d'une `LearningSession`.
 *
 * Les valeurs de ce module sont le vocabulaire canonique du domaine. Les
 * libellés présentés par l'interface peuvent rester localisés, mais aucun
 * moteur ne doit réintroduire une seconde liste de types ou d'effets.
 */

export const INTERVENTION_TYPES = [
  "resolve",
  "explain",
  "recall",
  "read",
  "synthesize",
  "produce",
  "diagnose",
  "ask-for-help",
] as const;

export type InterventionType = typeof INTERVENTION_TYPES[number];

export const INTERVENTION_EFFECTS = [
  "measurement",
  "preparation",
  "support",
] as const;

export type InterventionEffect = typeof INTERVENTION_EFFECTS[number];

export const INTERVENTION_SOURCE_KINDS = [
  "exercise",
  "course",
  "document",
  "engagement",
  "declared-need",
  "session",
] as const;

export type InterventionSourceKind = typeof INTERVENTION_SOURCE_KINDS[number];

export interface InterventionSource {
  kind: InterventionSourceKind;
  ref: string;
}

/** Contrat annoncé avant le geste et vérifié par le chemin de preuve. */
export interface InterventionProofContract {
  skillCodes: string[];
  protocolRef: string;
  requiredArtifact: string;
}

export interface InterventionSeance {
  /** Identifiant stable et unique dans la séance. */
  id: string;
  type: InterventionType;
  label: string;
  estimatedDurationMinutes?: number;
  source: InterventionSource;
  targetSkillCodes?: string[];
  expectedEffect: InterventionEffect;
  proofContract?: InterventionProofContract;
  /**
   * Fait d'exécution facultatif. Absent sur les séances historiques et sur
   * une intervention qui n'a pas encore été menée ; il ne constitue jamais
   * une Observation ni une mesure dérivée.
   */
  statut?: InterventionStatus;
}

export type InterventionStatus = "completed" | "abandoned";

export class InterventionSeanceInvalide extends Error {
  constructor(readonly chemin: string, attendu: string) {
    super(`Intervention (${chemin}) invalide — ${attendu}.`);
    this.name = "InterventionSeanceInvalide";
  }
}

type Objet = Record<string, unknown>;

function invalide(chemin: string, attendu: string): never {
  throw new InterventionSeanceInvalide(chemin, attendu);
}

function objet(valeur: unknown, chemin: string): Objet {
  if (!valeur || typeof valeur !== "object" || Array.isArray(valeur)) {
    return invalide(chemin, "objet attendu");
  }
  return valeur as Objet;
}

function texte(valeur: unknown, chemin: string): string {
  if (typeof valeur !== "string" || valeur.trim().length === 0) {
    return invalide(chemin, "texte non vide attendu");
  }
  return valeur;
}

function enumeration<const T extends readonly string[]>(
  valeur: unknown,
  valeurs: T,
  chemin: string,
): T[number] {
  if (typeof valeur !== "string" || !valeurs.includes(valeur)) {
    return invalide(chemin, `une des valeurs ${valeurs.join(", ")} attendue`);
  }
  return valeur as T[number];
}

function textes(valeur: unknown, chemin: string): string[] {
  if (!Array.isArray(valeur)) return invalide(chemin, "tableau attendu");
  return valeur.map((item, index) => texte(item, `${chemin}[${index}]`));
}

function validerPreuve(valeur: unknown, chemin: string): InterventionProofContract {
  const preuve = objet(valeur, chemin);
  const skillCodes = textes(preuve.skillCodes, `${chemin}.skillCodes`);
  if (skillCodes.length === 0) invalide(`${chemin}.skillCodes`, "au moins un code attendu");
  return {
    skillCodes,
    protocolRef: texte(preuve.protocolRef, `${chemin}.protocolRef`),
    requiredArtifact: texte(preuve.requiredArtifact, `${chemin}.requiredArtifact`),
  };
}

/**
 * Valide une intervention sans la normaliser ni lui fabriquer de valeur.
 * Le même validateur est utilisé par le domaine et la frontière Supabase.
 */
export function parseInterventionSeance(
  valeur: unknown,
  chemin = "intervention",
): InterventionSeance {
  const intervention = objet(valeur, chemin);
  const resultat: InterventionSeance = {
    id: texte(intervention.id, `${chemin}.id`),
    type: enumeration(intervention.type, INTERVENTION_TYPES, `${chemin}.type`),
    label: texte(intervention.label, `${chemin}.label`),
    source: (() => {
      const source = objet(intervention.source, `${chemin}.source`);
      return {
        kind: enumeration(source.kind, INTERVENTION_SOURCE_KINDS, `${chemin}.source.kind`),
        ref: texte(source.ref, `${chemin}.source.ref`),
      };
    })(),
    expectedEffect: enumeration(
      intervention.expectedEffect,
      INTERVENTION_EFFECTS,
      `${chemin}.expectedEffect`,
    ),
  };

  if (intervention.estimatedDurationMinutes !== undefined) {
    const duree = intervention.estimatedDurationMinutes;
    if (typeof duree !== "number" || !Number.isFinite(duree) || !Number.isInteger(duree) || duree < 0) {
      invalide(`${chemin}.estimatedDurationMinutes`, "entier positif ou nul attendu");
    }
    resultat.estimatedDurationMinutes = duree;
  }

  if (intervention.targetSkillCodes !== undefined) {
    resultat.targetSkillCodes = textes(intervention.targetSkillCodes, `${chemin}.targetSkillCodes`);
  }

  if (intervention.proofContract !== undefined) {
    resultat.proofContract = validerPreuve(
      intervention.proofContract,
      `${chemin}.proofContract`,
    );
  }

  if (intervention.statut !== undefined) {
    resultat.statut = enumeration(
      intervention.statut,
      ["completed", "abandoned"] as const,
      `${chemin}.statut`,
    );
  }

  return resultat;
}

/** Valide la liste et refuse deux identités dans une même séance. */
export function parseInterventionsSeance(
  valeur: unknown,
  chemin = "interventions",
): InterventionSeance[] {
  if (!Array.isArray(valeur)) invalide(chemin, "tableau attendu");
  const ids = new Set<string>();
  return valeur.map((item, index) => {
    const intervention = parseInterventionSeance(item, `${chemin}[${index}]`);
    if (ids.has(intervention.id)) invalide(`${chemin}[${index}].id`, "identifiant unique attendu");
    ids.add(intervention.id);
    return intervention;
  });
}

/**
 * Le contrat de preuve ne crée jamais une observation lui-même. Cette garde
 * ne fait qu'indiquer si un résultat pourrait emprunter le chemin de preuve ;
 * l'écriture et la validation de l'Observation restent ailleurs.
 */
export function interventionPeutProduireObservation(
  intervention: InterventionSeance,
  statut: InterventionStatus,
): boolean {
  return statut === "completed" && intervention.proofContract !== undefined;
}
