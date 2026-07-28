/**
 * Référentiel de compétences.
 *
 * Transcription fidèle de `data/01_profil/01_MATRICE_COMPETENCES.txt`
 * (43 compétences, 7 domaines). Les intitulés ne sont pas reformulés :
 * ils sont repris tels quels.
 *
 * ⚠️ Ce fichier source a été supprimé le 27/07/2026 : legacy, lu par aucun
 * code et déjà en dérive (AUDIT_SYSTEME_2026-07-25.md §2.1). Son contenu
 * reste consultable dans l'historique git. **Ce module est désormais la
 * source de vérité du référentiel** — l'étendre est une modification de
 * code, testée, pas une édition de données.
 *
 * Élargi le 25/07/2026 (LOG-07/08/09, STAT-07) — ajout justifié par
 * l'observation réelle du travail de l'utilisateur (cf. section 7 des
 * instructions ; source : synthese_profil_competences_2026-07-25.md).
 *
 * Trois champs sont ajoutés par l'application, et seulement eux :
 * - `palier`     : place dans l'arbre de progression du domaine ;
 * - `prerequis`  : indicatif, jamais bloquant (l'exploration reste libre) ;
 * - `importance` : poids pour l'objectif déclaré BUT QLIO → Master ITI,
 *                  dérivé de l'ordre de priorité de
 *                  `01_PLAN_EVALUATION_INITIALE.txt` (supprimé le 27/07/2026,
 *                  cf. historique git), pas d'une supposition.
 */

import type { Domaine, DomaineId, Skill } from "./types";

export const DOMAINES: Domaine[] = [
  {
    id: "statistiques",
    nom: "Statistiques et probabilités",
    prefixe: "STAT",
    description: "Décrire, modéliser et décider sous incertitude.",
  },
  {
    id: "logistique",
    nom: "Logistique industrielle",
    prefixe: "LOG",
    description: "Stocks, prévision, approvisionnement, réseaux et résilience.",
  },
  {
    id: "production",
    nom: "Gestion de production",
    prefixe: "PROD",
    description: "Capacité, planification, ordonnancement et amélioration continue.",
  },
  {
    id: "algorithmique",
    nom: "Algorithmique et programmation",
    prefixe: "ALGO",
    description: "Structurer, implémenter et analyser une solution calculatoire.",
  },
  {
    id: "recherche-operationnelle",
    nom: "Recherche opérationnelle et optimisation",
    prefixe: "RO",
    description: "Formuler et résoudre des problèmes de décision optimale.",
  },
  {
    id: "systemes-complexes",
    nom: "Systèmes complexes",
    prefixe: "SYSC",
    description: "Interactions, rétroactions, simulation, robustesse.",
  },
  {
    id: "technologies-innovantes",
    nom: "Technologies innovantes",
    prefixe: "TECH",
    description: "IA, IoT, jumeaux numériques, automatisation industrielle.",
  },
];

export const DOMAINE_PAR_ID = new Map<DomaineId, Domaine>(DOMAINES.map((d) => [d.id, d]));

/**
 * Ordre des diagnostics fixé par `01_PLAN_EVALUATION_INITIALE.txt`
 * (supprimé le 27/07/2026 — cet ordre en est la seule trace vivante).
 * Sert à départager les compétences non évaluées dans la recommandation :
 * au jour 0 tous les autres facteurs sont nuls, c'est ce plan qui tranche.
 */
export const ORDRE_DIAGNOSTIC: string[] = [
  "STAT-01",
  "STAT-02",
  "LOG-01",
  "LOG-02",
  "PROD-01",
  "PROD-03",
  "ALGO-01",
  "ALGO-05",
  "RO-01",
  "SYSC-01",
  "TECH-01",
];

/**
 * Périmètre pilote — ADR-018 (28/07/2026).
 *
 * Le référentiel garde ses 43 compétences : elles ne sont pas supprimées, elles
 * sont **hors périmètre de travail**. Seules celles listées ici sont calculées,
 * affichées et transmises au tuteur.
 *
 * Le domaine Logistique a été retenu parce que c'est le plus travaillé — 7
 * preuves sur 6 des 9 compétences au 28/07. Étendre le périmètre est une
 * décision, pas un réglage : le faire sans contenu pour l'alimenter ramènerait
 * exactement le problème que ce chantier corrige (31 compétences sur 43 sans
 * aucun support de travail).
 */
export const DOMAINE_PILOTE: DomaineId = "logistique";

export const SKILLS: Skill[] = [
  /* ---------------------------- STATISTIQUES --------------------------- */
  {
    code: "STAT-01",
    domaine: "statistiques",
    intitule:
      "Décrire et interpréter un jeu de données industriel avec les statistiques descriptives adaptées",
    palier: "fondamentaux",
    prerequis: [],
    importance: 1,
    hypotheseInitiale: {
      niveauSuppose: "0-1",
      justification: "Domaine couvert par le BUT QLIO — hypothèse de niveau D, à confirmer.",
    },
  },
  {
    code: "STAT-02",
    domaine: "statistiques",
    intitule:
      "Modéliser une variable aléatoire par une loi adaptée à un contexte industriel (Binomiale, Poisson, Normale)",
    palier: "fondamentaux",
    prerequis: ["STAT-01"],
    importance: 1,
    hypotheseInitiale: {
      niveauSuppose: "0-1",
      justification: "Domaine couvert par le BUT QLIO — hypothèse de niveau D, à confirmer.",
    },
  },
  {
    code: "STAT-03",
    domaine: "statistiques",
    intitule: "Construire et interpréter un intervalle de confiance en contexte industriel",
    palier: "intermediaire",
    prerequis: ["STAT-02"],
    importance: 0.85,
  },
  {
    code: "STAT-04",
    domaine: "statistiques",
    intitule: "Réaliser un test d'hypothèse pour comparer deux processus ou échantillons",
    palier: "intermediaire",
    prerequis: ["STAT-03"],
    importance: 0.85,
  },
  {
    code: "STAT-05",
    domaine: "statistiques",
    intitule: "Construire une carte de contrôle (SPC) et interpréter sa stabilité",
    palier: "intermediaire",
    prerequis: ["STAT-02"],
    importance: 0.75,
    hypotheseInitiale: {
      niveauSuppose: "0-1",
      justification: "Domaine couvert par le BUT QLIO — hypothèse de niveau D, à confirmer.",
    },
  },
  {
    code: "STAT-06",
    domaine: "statistiques",
    intitule: "Réaliser et interpréter une régression linéaire appliquée à un cas industriel",
    palier: "avance",
    prerequis: ["STAT-03"],
    importance: 0.8,
  },
  {
    // Ajout 25/07/2026 — observé (synthese_profil_competences_2026-07-25.md, C6).
    // Lacune ouverte et reconnue par l'utilisateur : priorité #1 de la synthèse.
    code: "STAT-07",
    domaine: "statistiques",
    intitule:
      "Relier le z-score de la loi normale centrée réduite (z = (X−μ)/σ) à une application concrète de gestion industrielle (ex. stock de sécurité)",
    palier: "intermediaire",
    prerequis: ["STAT-02"],
    importance: 0.9,
  },

  /* ----------------------------- LOGISTIQUE ---------------------------- */
  {
    code: "LOG-01",
    domaine: "logistique",
    intitule:
      "Modéliser et résoudre un problème de gestion de stock à demande déterministe (quantité économique, point de commande)",
    palier: "fondamentaux",
    prerequis: [],
    importance: 0.95,
    hypotheseInitiale: {
      niveauSuppose: "0-1",
      justification: "Cœur du BUT QLIO — hypothèse de niveau D, à confirmer.",
    },
  },
  {
    code: "LOG-02",
    domaine: "logistique",
    intitule:
      "Calculer un stock de sécurité et un point de commande sous demande variable (niveau de service, loi normale)",
    palier: "intermediaire",
    prerequis: ["LOG-01", "STAT-02"],
    importance: 0.95,
    hypotheseInitiale: {
      niveauSuppose: "0-1",
      justification: "Cœur du BUT QLIO — hypothèse de niveau D, à confirmer.",
    },
  },
  {
    code: "LOG-03",
    domaine: "logistique",
    intitule:
      "Élaborer une prévision de demande (moyenne mobile, lissage exponentiel) et évaluer sa précision",
    palier: "intermediaire",
    prerequis: ["STAT-01"],
    importance: 0.85,
    hypotheseInitiale: {
      niveauSuppose: "0-1",
      justification: "Cœur du BUT QLIO — hypothèse de niveau D, à confirmer.",
    },
  },
  {
    code: "LOG-04",
    domaine: "logistique",
    intitule: "Élaborer un plan d'approvisionnement sous contraintes de délais et de fournisseurs",
    palier: "intermediaire",
    prerequis: ["LOG-01"],
    importance: 0.7,
  },
  {
    code: "LOG-05",
    domaine: "logistique",
    intitule: "Analyser et optimiser un réseau logistique (implantation, flux, coûts de transport)",
    palier: "avance",
    prerequis: ["RO-01"],
    importance: 0.8,
  },
  {
    code: "LOG-06",
    domaine: "logistique",
    intitule:
      "Évaluer la résilience d'une chaîne logistique face à une perturbation (rupture, aléas de demande)",
    palier: "avance",
    prerequis: ["LOG-02", "SYSC-05"],
    importance: 0.9,
  },
  // Ajouts 25/07/2026 — observés (synthese_profil_competences_2026-07-25.md,
  // C1, C4, C5). Importances estimées (à recalibrer), non dérivées d'un plan.
  {
    code: "LOG-07",
    domaine: "logistique",
    intitule:
      "Identifier et typer les sources d'incertitude d'un système de production (demande, capacité/process, approvisionnement), y compris les données de référence supposées fiables à tort",
    palier: "fondamentaux",
    prerequis: [],
    importance: 0.85,
  },
  {
    code: "LOG-08",
    domaine: "logistique",
    intitule:
      "Analyser l'arbitrage économique entre taux de service visé et stock de sécurité, et situer le modèle adapté (Wilson/EOQ en avenir certain vs newsvendor en avenir incertain)",
    palier: "avance",
    prerequis: ["LOG-02"],
    importance: 0.8,
  },
  {
    code: "LOG-09",
    domaine: "logistique",
    intitule:
      "Calculer un stock de sécurité sous incertitude combinée (variabilité de la demande ET du délai fournisseur)",
    palier: "avance",
    prerequis: ["LOG-02"],
    importance: 0.85,
  },

  /* ----------------------------- PRODUCTION ---------------------------- */
  {
    code: "PROD-01",
    domaine: "production",
    intitule:
      "Construire un Plan Industriel et Commercial (PIC) à partir de prévisions et de contraintes de capacité",
    palier: "fondamentaux",
    prerequis: ["LOG-03"],
    importance: 0.9,
    hypotheseInitiale: {
      niveauSuppose: "0-1",
      justification: "Cœur du BUT QLIO — hypothèse de niveau D, à confirmer.",
    },
  },
  {
    code: "PROD-02",
    domaine: "production",
    intitule: "Élaborer un Plan Directeur de Production (PDP) et vérifier sa faisabilité",
    palier: "intermediaire",
    prerequis: ["PROD-01"],
    importance: 0.8,
    hypotheseInitiale: {
      niveauSuppose: "0-1",
      justification: "Cœur du BUT QLIO — hypothèse de niveau D, à confirmer.",
    },
  },
  {
    code: "PROD-03",
    domaine: "production",
    intitule:
      "Calculer les besoins nets par la méthode MRP à partir d'une nomenclature et de stocks existants",
    palier: "intermediaire",
    prerequis: ["PROD-02"],
    importance: 0.9,
    hypotheseInitiale: {
      niveauSuppose: "0-1",
      justification: "Cœur du BUT QLIO — hypothèse de niveau D, à confirmer.",
    },
  },
  {
    code: "PROD-04",
    domaine: "production",
    intitule:
      "Ordonnancer un atelier selon une règle de priorité et évaluer la performance obtenue",
    palier: "intermediaire",
    prerequis: [],
    importance: 0.8,
    hypotheseInitiale: {
      niveauSuppose: "0-1",
      justification: "Cœur du BUT QLIO — hypothèse de niveau D, à confirmer.",
    },
  },
  {
    code: "PROD-05",
    domaine: "production",
    intitule:
      "Identifier une contrainte selon la Théorie des Contraintes (TOC) et proposer une action",
    palier: "avance",
    prerequis: ["PROD-04"],
    importance: 0.75,
  },
  {
    code: "PROD-06",
    domaine: "production",
    intitule: "Calculer et interpréter un TRS et en déduire un axe d'amélioration continue",
    palier: "fondamentaux",
    prerequis: [],
    importance: 0.7,
    hypotheseInitiale: {
      niveauSuppose: "0-1",
      justification: "Cœur du BUT QLIO — hypothèse de niveau D, à confirmer.",
    },
  },

  /* --------------------------- ALGORITHMIQUE --------------------------- */
  {
    code: "ALGO-01",
    domaine: "algorithmique",
    intitule:
      "Écrire un algorithme structuré (boucles, conditions, fonctions) pour un problème simple",
    palier: "fondamentaux",
    prerequis: [],
    importance: 1,
  },
  {
    code: "ALGO-02",
    domaine: "algorithmique",
    intitule: "Choisir une structure de données adaptée à un problème et justifier ce choix",
    palier: "intermediaire",
    prerequis: ["ALGO-01"],
    importance: 0.85,
  },
  {
    code: "ALGO-03",
    domaine: "algorithmique",
    intitule: "Analyser la complexité d'une solution algorithmique (notation grande-O)",
    palier: "intermediaire",
    prerequis: ["ALGO-02"],
    importance: 0.85,
  },
  {
    code: "ALGO-04",
    domaine: "algorithmique",
    intitule: "Manipuler des graphes (parcours, plus court chemin) pour un problème logistique",
    palier: "avance",
    prerequis: ["ALGO-02"],
    importance: 0.9,
  },
  {
    code: "ALGO-05",
    domaine: "algorithmique",
    intitule: "Écrire un programme Python pour traiter et analyser des données",
    palier: "fondamentaux",
    prerequis: ["ALGO-01"],
    importance: 1,
  },
  {
    code: "ALGO-06",
    domaine: "algorithmique",
    intitule: "Concevoir une simulation simple (file d'attente, stock) en Python",
    palier: "avance",
    prerequis: ["ALGO-05", "STAT-02"],
    importance: 0.95,
  },

  /* --------------------- RECHERCHE OPÉRATIONNELLE ---------------------- */
  {
    code: "RO-01",
    domaine: "recherche-operationnelle",
    intitule:
      "Formuler un problème industriel sous forme de programme linéaire (variables, contraintes, objectif)",
    palier: "fondamentaux",
    prerequis: [],
    importance: 0.95,
  },
  {
    code: "RO-02",
    domaine: "recherche-operationnelle",
    intitule:
      "Résoudre un programme linéaire et interpréter la solution (valeurs, coûts marginaux)",
    palier: "intermediaire",
    prerequis: ["RO-01"],
    importance: 0.9,
  },
  {
    code: "RO-03",
    domaine: "recherche-operationnelle",
    intitule: "Modéliser un problème d'affectation ou de transport et le résoudre",
    palier: "intermediaire",
    prerequis: ["RO-01"],
    importance: 0.85,
  },
  {
    code: "RO-04",
    domaine: "recherche-operationnelle",
    intitule:
      "Appliquer une métaheuristique simple (glouton, recuit simulé) à un problème combinatoire",
    palier: "avance",
    prerequis: ["ALGO-03", "RO-01"],
    importance: 0.85,
  },
  {
    code: "RO-05",
    domaine: "recherche-operationnelle",
    intitule: "Modéliser un système de files d'attente et interpréter ses indicateurs de performance",
    palier: "avance",
    prerequis: ["STAT-02"],
    importance: 0.8,
  },

  /* ------------------------- SYSTÈMES COMPLEXES ------------------------ */
  {
    code: "SYSC-01",
    domaine: "systemes-complexes",
    intitule:
      "Identifier composants, interactions et boucles de rétroaction d'un système industriel",
    palier: "fondamentaux",
    prerequis: [],
    importance: 0.9,
  },
  {
    code: "SYSC-02",
    domaine: "systemes-complexes",
    intitule: "Construire un modèle causal (diagramme d'influence) et discuter sa cohérence",
    palier: "intermediaire",
    prerequis: ["SYSC-01"],
    importance: 0.85,
  },
  {
    code: "SYSC-03",
    domaine: "systemes-complexes",
    intitule: "Réaliser une simulation à événements discrets ou à base d'agents",
    palier: "avance",
    prerequis: ["ALGO-06", "SYSC-02"],
    importance: 0.95,
  },
  {
    code: "SYSC-04",
    domaine: "systemes-complexes",
    intitule: "Analyser la sensibilité d'un système à la variation d'un paramètre clé",
    palier: "avance",
    prerequis: ["SYSC-03"],
    importance: 0.85,
  },
  {
    code: "SYSC-05",
    domaine: "systemes-complexes",
    intitule: "Discuter la robustesse et la résilience d'un système face à une perturbation",
    palier: "avance",
    prerequis: ["SYSC-04"],
    importance: 0.9,
  },

  /* ----------------------- TECHNOLOGIES INNOVANTES --------------------- */
  {
    code: "TECH-01",
    domaine: "technologies-innovantes",
    intitule: "Expliquer les principes et cas d'usage du Machine Learning en contexte industriel",
    palier: "fondamentaux",
    prerequis: [],
    importance: 0.9,
  },
  {
    code: "TECH-02",
    domaine: "technologies-innovantes",
    intitule: "Expliquer l'architecture et les cas d'usage d'un système IoT industriel",
    palier: "fondamentaux",
    prerequis: [],
    importance: 0.75,
  },
  {
    code: "TECH-03",
    domaine: "technologies-innovantes",
    intitule: "Expliquer le concept de jumeau numérique et ses conditions de mise en œuvre",
    palier: "intermediaire",
    prerequis: ["TECH-02", "SYSC-03"],
    importance: 0.85,
  },
  {
    code: "TECH-04",
    domaine: "technologies-innovantes",
    intitule: "Analyser un cas d'automatisation/robotique industrielle et ses impacts",
    palier: "intermediaire",
    prerequis: [],
    importance: 0.7,
  },
  {
    code: "TECH-05",
    domaine: "technologies-innovantes",
    intitule:
      "Discuter enjeux et limites de l'intégration de l'IA dans un système de production",
    palier: "avance",
    prerequis: ["TECH-01"],
    importance: 0.85,
  },
];

export const SKILL_PAR_CODE = new Map<string, Skill>(SKILLS.map((s) => [s.code, s]));

/**
 * Les compétences réellement travaillées (ADR-018). C'est cette liste, et non
 * `SKILLS`, que consomment le moteur, l'interface et le contexte du tuteur.
 *
 * `SKILLS` reste exporté : une preuve enregistrée hors périmètre garde son
 * intitulé lisible, elle n'est simplement plus agrégée. Rien n'est perdu, et
 * élargir le périmètre suffit à la faire réapparaître dans les calculs.
 */
export const SKILLS_ACTIFS: Skill[] = SKILLS.filter((s) => s.domaine === DOMAINE_PILOTE);

export const CODES_ACTIFS = new Set(SKILLS_ACTIFS.map((s) => s.code));

export function skillsParDomaine(domaine: DomaineId): Skill[] {
  return SKILLS.filter((s) => s.domaine === domaine);
}

export function libelleDomaine(id: DomaineId): string {
  return DOMAINE_PAR_ID.get(id)?.nom ?? id;
}
