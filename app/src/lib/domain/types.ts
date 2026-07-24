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
 * sessions). Niveaux, scores, XP, badges sont recalculés à la lecture
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

export type DomaineId =
  | "logistique"
  | "production"
  | "statistiques"
  | "algorithmique"
  | "recherche-operationnelle"
  | "systemes-complexes"
  | "technologies-innovantes";

export interface Domaine {
  id: DomaineId;
  nom: string;
  /** Préfixe des codes compétence, ex. « LOG » pour LOG-01. */
  prefixe: string;
  description: string;
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
}

/**
 * Une compétence du référentiel (`01_MATRICE_COMPETENCES.txt`).
 * Ne porte AUCUN état de progression : celui-ci est dérivé des preuves.
 */
export interface Skill {
  /** Code du référentiel, ex. « LOG-02 ». */
  code: string;
  domaine: DomaineId;
  intitule: string;
  /** Position dans l'arbre de progression du domaine. */
  palier: "fondamentaux" | "intermediaire" | "avance";
  /** Codes des compétences prérequises (indicatif, jamais bloquant). */
  prerequis: string[];
  /**
   * Importance pour l'objectif déclaré (BUT QLIO → Master ITI → recherche),
   * de 0 à 1. Utilisée par le moteur de recommandation (§16).
   */
  importance: number;
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
 * Erreur récurrente (`01_ERREURS_RECURRENTES.txt`).
 * Une erreur isolée n'entre PAS ici (anti-hallucination §11).
 */
export interface ErrorItem {
  id: string;
  concept: string;
  skillCodes: string[];
  description: string;
  causeProbable: string;
  correction: string;
  exemple?: string;
  /** Contextes d'apparition — une erreur multi-contextes est une lacune probable. */
  occurrences: { date: string; contexte: string; source: string }[];
  statut: "nouvelle" | "en-cours" | "corrigee" | "consolidee";
  /** Règle de non-suppression (§6) : on archive, on ne supprime jamais. */
  archivee?: boolean;
}

export interface ProjectStep {
  id: string;
  /** Les 8 étapes de progression demandées. */
  ordre: number;
  titre: string;
  statut: "a-faire" | "en-cours" | "terminee";
  notes?: string;
  dateFin?: string;
}

export interface Project {
  id: string;
  titre: string;
  objectif: string;
  domaines: DomaineId[];
  skillCodes: string[];
  etapes: ProjectStep[];
  livrables: { titre: string; url?: string; note?: string }[];
  difficultes: string[];
  statut: "en-cours" | "termine" | "suspendu";
  dateDebut: string;
  dateFin?: string;
  /** Bilan produit à la clôture — jamais généré automatiquement sans preuve. */
  bilan?: {
    competencesMobilisees: string[];
    competencesDeveloppees: string[];
    erreursRencontrees: string[];
    autonomie: Autonomie;
    transferabilite: string;
  };
}

export interface KnowledgeItem {
  id: string;
  titre: string;
  domaine: DomaineId;
  skillCodes: string[];
  contenu: string;
  source: string;
  date: string;
  /** Une connaissance notée n'est pas une compétence démontrée. */
  validee: boolean;
}

export interface Reading {
  id: string;
  titre: string;
  auteur: string;
  domaine: DomaineId;
  statut: "a-lire" | "en-cours" | "lu" | "exploite" | "maitrise-par-la-pratique";
  progression: number;
  concepts: string[];
  skillCodes: string[];
  notes: string;
  exercicesGeneres: string[];
  /**
   * Instructions §12 : la lecture n'est jamais une preuve de maîtrise.
   * Ce champ reste une auto-déclaration, marquée comme telle dans l'UI.
   */
  comprehensionDeclaree?: 1 | 2 | 3 | 4 | 5;
}

export interface LearningSession {
  id: string;
  date: string;
  dureeMin: number;
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

export interface QuestStep {
  id: string;
  libelle: string;
  /** Condition vérifiable sur les preuves — jamais cochée à la main. */
  condition:
    | { kind: "niveau-min"; niveau: NiveauCompetence }
    | { kind: "preuve-type"; type: SkillEvidence["type"] }
    | { kind: "autonomie-min"; autonomie: Autonomie }
    | { kind: "contextes-distincts"; nombre: number };
}

export interface Quest {
  id: string;
  titre: string;
  skillCode: string;
  etapes: QuestStep[];
  recompenseXp: number;
}

export type BadgeId =
  | "premiere-modelisation"
  | "premiere-simulation"
  | "premier-transfert"
  | "premiere-resolution-autonome"
  | "erreur-corrigee"
  | "projet-termine";

export interface Badge {
  id: BadgeId;
  titre: string;
  description: string;
  /** Condition évaluée sur le journal de preuves. */
  critere: string;
}

/** Barème fourni par l'utilisateur. Émis uniquement en projection d'événements. */
export type MotifXp =
  | "exercice-termine"
  | "exercice-difficile"
  | "erreur-corrigee"
  | "probleme-nouveau"
  | "projet-termine"
  | "transfert"
  | "maintien";

export const BAREME_XP: Record<MotifXp, { valeur: number; libelle: string }> = {
  "exercice-termine": { valeur: 10, libelle: "Exercice terminé" },
  "exercice-difficile": { valeur: 25, libelle: "Exercice difficile réussi" },
  "erreur-corrigee": { valeur: 30, libelle: "Erreur récurrente corrigée" },
  "probleme-nouveau": { valeur: 40, libelle: "Problème nouveau résolu" },
  transfert: { valeur: 50, libelle: "Transfert de compétence démontré" },
  "projet-termine": { valeur: 100, libelle: "Projet terminé" },
  maintien: { valeur: 15, libelle: "Compétence maintenue dans le temps" },
};

/**
 * Événement d'expérience. Toujours dérivé d'une preuve : `sourceEvidenceId`
 * est obligatoire, ce qui rend le farming structurellement impossible.
 */
export interface XPEvent {
  id: string;
  date: string;
  motif: MotifXp;
  valeur: number;
  skillCode?: string;
  sourceEvidenceId: string;
}

/** Photographie périodique, pour tracer l'évolution sans recalculer le passé. */
export interface ProgressSnapshot {
  date: string;
  scoreGlobal: number | null;
  confianceGlobale: Confiance;
  nombrePreuves: number;
  competencesEvaluees: number;
  xpTotal: number;
  parDomaine: Record<DomaineId, { score: number | null; preuves: number }>;
}

/* ------------------------------------------------------------------ */
/* Objectifs                                                           */
/* ------------------------------------------------------------------ */

export interface Objectif {
  id: string;
  horizon: "jour" | "semaine" | "long-terme";
  libelle: string;
  skillCodes: string[];
  /** Cible mesurable sur le journal, ex. 1 exercice sur STAT-02. */
  cible?: { kind: "exercices" | "preuves" | "minutes"; nombre: number };
  dateCreation: string;
  dateEcheance?: string;
  atteint?: boolean;
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
  erreursLiees: string[];
  prochaineEtape: string;
  explication: Explication;
  statut: "non-evalue" | "hypothese" | "evalue";
}
