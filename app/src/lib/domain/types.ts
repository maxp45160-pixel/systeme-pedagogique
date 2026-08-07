/**
 * Modèle de domaine du système pédagogique.
 *
 * Ces types transcrivent les fichiers `data/00_instructions/` :
 * - échelle de niveau 0-5 ....... protocole d'évaluation §4
 * - autonomie A0-A4 ............. protocole d'évaluation §5
 * - qualité de preuve ........... protocole d'évaluation §6
 * - confiance ................... protocole anti-hallucination §10
 * - hiérarchie des preuves A-D .. protocole anti-hallucination §2
 *
 * Règle structurante : rien de ce qui est *dérivable* n'est stocké.
 * Le disque ne contient que des faits observés (preuves, tentatives,
 * sessions). Niveaux et scores sont recalculés à la lecture
 * par `lib/engine/`.
 */

/* ------------------------------------------------------------------ */
/* Échelles et vocabulaire                                             */
/* ------------------------------------------------------------------ */

/** Protocole d'évaluation §4 — échelle de niveau de compétence. */
export type NiveauCompetence = 0 | 1 | 2 | 3 | 4 | 5;

export const NIVEAUX: Record<NiveauCompetence, { nom: string; description: string }> = {
  0: { nom: "Exposition", description: "La notion a été rencontrée. Preuve insuffisante pour conclure à une compréhension." },
  1: { nom: "Compréhension", description: "Peut expliquer, reconnaître ou distinguer le concept." },
  2: { nom: "Application guidée", description: "Peut appliquer la méthode avec aide, cadre connu ou exemple." },
  3: { nom: "Application autonome", description: "Résout un problème standard sans aide significative." },
  4: { nom: "Transfert", description: "Résout un problème nouveau ou modifié, dans un contexte différent." },
  5: { nom: "Intégration", description: "Combine plusieurs compétences, compare des approches et analyse les limites." },
};

/** Protocole d'évaluation §5 — niveau d'autonomie observé sur une preuve. */
export type Autonomie = "A0" | "A1" | "A2" | "A3" | "A4";

export const AUTONOMIE: Record<Autonomie, { libelle: string; poids: number }> = {
  A0: { libelle: "Solution fournie", poids: 0 },
  A1: { libelle: "Fortement guidé", poids: 0.25 },
  A2: { libelle: "Quelques indices nécessaires", poids: 0.55 },
  A3: { libelle: "Résolution autonome", poids: 0.85 },
  A4: { libelle: "Autonome avec initiative méthodologique", poids: 1 },
};

/** Protocole d'évaluation §6 — qualité intrinsèque de la preuve. */
export type QualitePreuve = "faible" | "moyenne" | "forte";

export const QUALITE_PREUVE: Record<QualitePreuve, { libelle: string; poids: number }> = {
  faible: { libelle: "Réponse isolée, exercice très guidé ou question de mémoire", poids: 0.35 },
  moyenne: { libelle: "Exercice autonome, problème standard ou explication correcte", poids: 0.7 },
  forte: { libelle: "Problème nouveau, transfert, projet ou intégration interdisciplinaire", poids: 1 },
};

/** Protocole anti-hallucination §10 — confiance dans une évaluation. */
export type Confiance = "nulle" | "faible" | "moyenne" | "forte";

/**
 * Protocole anti-hallucination §2 — hiérarchie des preuves.
 * A preuve directe · B preuve indirecte · C déduction · D hypothèse.
 * C et D ne doivent jamais être présentés comme des faits certains.
 */
export type NiveauPreuve = "A" | "B" | "C" | "D";

/** Dimensions d'évaluation — protocole d'évaluation §3 et §12. */
export type Dimension =
  | "comprehension"
  | "application"
  | "transfert"
  | "integration"
  | "justification";

/** Pondérations du score macro — protocole d'évaluation §12, à la lettre. */
export const POIDS_DIMENSIONS: Record<Dimension, number> = {
  comprehension: 0.3,
  application: 0.25,
  transfert: 0.2,
  integration: 0.15,
  justification: 0.1,
};

export const LIBELLES_DIMENSIONS: Record<Dimension, string> = {
  comprehension: "Compréhension",
  application: "Application",
  transfert: "Transfert",
  integration: "Intégration",
  justification: "Justification",
};

/* ------------------------------------------------------------------ */
/* Domaines                                                            */
/* ------------------------------------------------------------------ */

/**
 * Identifiant de domaine — un slug propre au compte, ex. « philosophie-morale ».
 *
 * C'était une union de huit littéraux jusqu'au 31/07/2026, quand le référentiel
 * était un fichier TypeScript compilé. Depuis ADR-026 il est construit par
 * l'utilisateur à l'exécution : aucune union ne peut le vérifier à la
 * compilation. Le garde-fou n'est pas retiré, il est **déplacé** vers la clé
 * étrangère `competences.domaine_id → domaines.id` (`supabase/schema.sql` § 2),
 * seul endroit capable de l'appliquer à des données produites par un compte.
 */
export type DomaineId = string;

/** D'où vient une entrée du référentiel. Fait observé, jamais dérivé. */
export type OrigineReferentiel = "utilisateur" | "tuteur" | "migration" | "manuel";

export interface Domaine {
  id: DomaineId;
  nom: string;
  /** Préfixe des codes compétence, ex. « LOG » pour LOG-01. Unique par compte. */
  prefixe: string;
  description: string;
  /** Rang d'affichage déclaré, à défaut d'ordre naturel. */
  ordre: number;
  archive: boolean;
  origine: OrigineReferentiel;
}

/* ------------------------------------------------------------------ */
/* Entités                                                             */
/* ------------------------------------------------------------------ */

export interface User {
  id: string;
  prenom: string;
  formation: string;
  objectifMoyenTerme: string;
  objectifLongTerme: string;
  /** Date d'initialisation du système (ISO). */
  debutSuivi: string;
  /**
   * Préférences pédagogiques déclarées par l'utilisateur (fait observé, pas
   * dérivé). Transmises au tuteur pour qu'il adapte sa manière de travailler —
   * il ne les infère jamais lui-même.
   */
  preferencesPedagogiques?: string[];
  /**
   * Plan de travail détaillé, écrit par l'utilisateur (Chantier 14).
   *
   * Ce que la personne veut accomplir, dans quel ordre, avec quel contexte.
   * Transmis au tuteur et au moteur de recommandation pour pondérer
   * l'importance des compétences selon le plan déclaré.
   */
  plan?: string;
}

/** Position dans l'arbre de progression du domaine. */
export type Palier = "fondamentaux" | "intermediaire" | "avance";

/** Ordre de progression des paliers — sert à ordonner les diagnostics. */
export const ORDRE_PALIERS: Palier[] = ["fondamentaux", "intermediaire", "avance"];

/**
 * Une compétence du référentiel du compte (tables `domaines` / `competences`).
 * Ne porte AUCUN état de progression : celui-ci est dérivé des preuves.
 */
export interface Skill {
  /**
   * Code du référentiel, ex. « LOG-02 ». **Immuable** : c'est la clé étrangère
   * des preuves. Attribué par l'application à partir du préfixe du domaine,
   * jamais proposé par le tuteur.
   */
  code: string;
  domaine: DomaineId;
  intitule: string;
  palier: Palier;
  /** Codes des compétences prérequises (indicatif, jamais bloquant). */
  prerequis: string[];
  /**
   * Importance pour l'objectif déclaré du compte (`objectifMoyenTerme`),
   * de 0 à 1. Utilisée par le moteur de recommandation (§16).
   */
  importance: number;
  /** Rang déclaré dans le domaine — départage les compétences d'un même palier. */
  ordre: number;
  /**
   * Périmètre de travail du compte (ADR-026, remplace le `DOMAINE_PILOTE`
   * global d'ADR-020). Hors périmètre : ni calculée, ni affichée, ni transmise
   * au tuteur. Ses preuves restent intactes.
   */
  active: boolean;
  /**
   * Retirée du référentiel de travail **sans perdre ses preuves** (ADR-027).
   * C'est le seul retrait possible dès qu'une preuve existe : une compétence
   * sans preuve se supprime franchement.
   */
  archive: boolean;
  origine: OrigineReferentiel;
  /**
   * Hypothèse de départ issue de la formation déclarée — preuve de niveau D.
   * N'autorise aucun niveau affiché : sert uniquement à ordonner les diagnostics.
   */
  hypotheseInitiale?: {
    niveauSuppose: string;
    justification: string;
  };
}

/**
 * Le référentiel d'un compte, tel que lu par `lib/store/referentiel.ts`.
 *
 * Les quatre dernières entrées sont **dérivées** de `domaines` et `skills` à
 * chaque lecture, jamais stockées (P1).
 */
export interface Referentiel {
  domaines: Domaine[];
  skills: Skill[];
  /** Le périmètre de travail : `active && !archive`. */
  actifs: Skill[];
  /** Toutes les compétences, archivées comprises — résout les preuves anciennes. */
  parCode: Map<string, Skill>;
  codesActifs: Set<string>;
  domainesParId: Map<DomaineId, Domaine>;
}

/**
 * Preuve directe observée pour une compétence — l'unité de base du système.
 * C'est la SEULE façon dont un niveau peut évoluer.
 */
export interface SkillEvidence {
  id: string;
  skillCode: string;
  /** Date d'observation (ISO). */
  date: string;
  type:
    | "exercice"
    | "explication"
    | "code"
    | "calcul"
    | "projet"
    | "correction-erreur"
    | "transfert"
    | "etude-de-cas";
  /** Protocole anti-hallucination §2. Le moteur n'accepte que A et B. */
  niveauPreuve: NiveauPreuve;
  autonomie: Autonomie;
  qualite: QualitePreuve;
  resultat: "reussi" | "partiel" | "echec";
  /**
   * Étiquette de contexte. Deux preuves de contextes différents attestent
   * d'un transfert (§11) ; deux preuves du même contexte, non.
   */
  contexte: string;
  /** Dimensions effectivement démontrées, chacune dans [0,1]. */
  dimensions: Partial<Record<Dimension, number>>;
  /** Compétences mobilisées conjointement — condition du niveau 5. */
  competencesCombinees?: string[];
  /** Origine vérifiable : id de tentative, de projet, de session. */
  source: { kind: "exercice" | "projet" | "session" | "tuteur" | "manuel"; ref: string };
  commentaire?: string;
}

export type TypeExercice =
  | "rappel"
  | "application"
  | "calcul"
  | "probleme"
  | "etude-de-cas"
  | "programmation"
  | "simulation"
  | "projet";

export type Difficulte = 1 | 2 | 3 | 4 | 5;

export const DIFFICULTES: Record<Difficulte, string> = {
  1: "Découverte",
  2: "Standard",
  3: "Consolidation",
  4: "Difficile",
  5: "Ouvert",
};

export interface Exercise {
  id: string;
  titre: string;
  domaine: DomaineId;
  type: TypeExercice;
  difficulte: Difficulte;
  /** Compétences visées, la première étant la cible principale. */
  competences: string[];
  dureeEstimeeMin: number;
  /** Énoncé en markdown léger. */
  enonce: string;
  /** Données du problème, présentées séparément de l'énoncé. */
  donnees?: { libelle: string; valeur: string }[];
  /** Indices débloqués un par un, du plus léger au plus explicite. */
  indices: string[];
  /** Correction complète, révélée seulement après tentative. */
  correction: string;
  /** Points de contrôle que l'utilisateur coche à l'auto-évaluation. */
  criteres: { dimension: Dimension; libelle: string }[];
  /** Vrai pour les exercices du plan d'évaluation initiale. */
  diagnostic?: boolean;
  origine: "seed" | "tuteur" | "manuel";
  /**
   * Retiré du flux sans perte de preuves (calque ADR-027).
   *
   * Un exercice archivé sort de la recommandation et de la calibration, mais
   * les preuves qu'il a produites restent au journal — sinon le retrait
   * réécrirait le passé. Absent sur les exercices de diagnostic, qui sont
   * livrés avec le logiciel et ne se retirent pas un par un.
   */
  archive?: boolean;
}

export interface ExerciseAttempt {
  id: string;
  exerciseId: string;
  debut: string;
  fin?: string;
  dureeMin?: number;
  /** Nombre d'indices consultés — détermine l'autonomie enregistrée. */
  indicesUtilises: number;
  reponse: string;
  /** Auto-évaluation par critère, après lecture de la correction. */
  autoEvaluation: Partial<Record<Dimension, number>>;
  resultat: "reussi" | "partiel" | "echec";
  statut: "en-cours" | "terminee" | "abandonnee";
  notes?: string;
}

/**
 * Refus d'une recommandation (R1).
 *
 * Fait observé : l'utilisateur a écarté une suggestion. Stocké en base pour
 * que le moteur de recommandation puisse l'exclure de la file pendant la
 * durée d'expiration (7 jours, gérée à la lecture).
 */
export interface RefusRecommandation {
  id: string;
  /** Code de la compétence refusée. */
  code: string;
  /** Date du refus (ISO). */
  date: string;
}

export interface LearningSession {
  id: string;
  date: string;
  /**
   * Durée en minutes. Optionnel : une séance récapitulative (importée d'une
   * synthèse, sans chronométrage) n'a pas de durée réelle — on ne fabrique pas
   * un 0 trompeur (protocole anti-hallucination §7).
   */
  dureeMin?: number;
  domaines: DomaineId[];
  skillCodes: string[];
  activites: { type: string; ref: string; libelle: string }[];
  resultat?: string;
  difficulte?: string;
  apprentissagePrincipal?: string;
  prochaineAction?: string;
  /** Note libre ajoutée par l'utilisateur. */
  notePersonnelle?: string;
  /** Vrai si l'entrée a été produite par le système à partir d'événements. */
  genereAutomatiquement: boolean;
}

/** Photographie périodique, pour tracer l'évolution sans recalculer le passé. */
export interface ProgressSnapshot {
  date: string;
  scoreGlobal: number | null;
  confianceGlobale: Confiance;
  nombrePreuves: number;
  competencesEvaluees: number;
  parDomaine: Record<DomaineId, { score: number | null; preuves: number }>;
}

/* ------------------------------------------------------------------ */
/* Résultats dérivés (jamais persistés)                                */
/* ------------------------------------------------------------------ */

/**
 * Trace de calcul. Protocole anti-hallucination §4 : tout indicateur affiché
 * doit pouvoir répondre à « d'où vient ce nombre ? ».
 */
export interface Explication {
  resume: string;
  facteurs: { libelle: string; valeur: string; poids?: number }[];
  nombrePreuves: number;
  /** Réserves à afficher : preuves anciennes, contradictions, contexte unique. */
  reserves: string[];
}

export interface SkillState {
  skill: Skill;
  /** `null` tant qu'aucune preuve directe n'existe — jamais 0 par défaut. */
  niveau: NiveauCompetence | null;
  score: number | null;
  confiance: Confiance;
  robustesse: number | null;
  dimensions: Record<Dimension, number>;
  preuves: SkillEvidence[];
  contextesTestes: string[];
  dernierePreuve: string | null;
  joursDepuisDernierePreuve: number | null;
  /** Preuves qui s'opposent à la tendance dominante (§5 gestion des contradictions). */
  contradictions: SkillEvidence[];
  prochaineEtape: string;
  explication: Explication;
  statut: "non-evalue" | "hypothese" | "evalue";
}
