/**
 * JEU DE DONNÉES FICTIF — MODE DÉMONSTRATION UNIQUEMENT.
 *
 * Rien de ce fichier ne décrit l'utilisateur réel. Il existe pour permettre
 * d'évaluer l'interface avec des vues remplies, avant que le travail réel
 * ait produit des preuves.
 *
 * Deux garanties, exigées par le protocole anti-hallucination §7 :
 * 1. ces données ne sont JAMAIS écrites sur disque — elles vivent en mémoire ;
 * 2. l'interface affiche en permanence un bandeau « données fictives » tant
 *    que le mode est actif.
 */

import type {
  Collections,
} from "@/lib/store/db";
import { UTILISATEUR_PAR_DEFAUT } from "@/lib/store/db";
import type {
  Autonomie,
  Dimension,
  QualitePreuve,
  SkillEvidence,
} from "@/lib/domain/types";
import { EXERCICES_DIAGNOSTIC } from "@/lib/seed/exercises";
import { JOUR_MS } from "@/lib/engine/dates";

function ilYa(jours: number, reference: number): string {
  return new Date(reference - jours * JOUR_MS).toISOString();
}

interface Brouillon {
  skill: string;
  jours: number;
  type: SkillEvidence["type"];
  autonomie: Autonomie;
  qualite: QualitePreuve;
  resultat: SkillEvidence["resultat"];
  contexte: string;
  dims: Partial<Record<Dimension, number>>;
  combinees?: string[];
  commentaire?: string;
}

const BROUILLONS: Brouillon[] = [
  // ---- STAT-01 : progression jusqu'au transfert -------------------------
  {
    skill: "STAT-01",
    jours: 148,
    type: "exercice",
    autonomie: "A2",
    qualite: "faible",
    resultat: "partiel",
    contexte: "Contrôle qualité — dispersion de cotes",
    dims: { comprehension: 0.7, application: 0.5 },
    commentaire: "Diagnostic initial : médiane et écart-type corrects, interprétation hésitante.",
  },
  {
    skill: "STAT-01",
    jours: 121,
    type: "exercice",
    autonomie: "A3",
    qualite: "moyenne",
    resultat: "reussi",
    contexte: "Contrôle qualité — dispersion de cotes",
    dims: { comprehension: 0.85, application: 0.8, justification: 0.6 },
  },
  {
    skill: "STAT-01",
    jours: 63,
    type: "exercice",
    autonomie: "A3",
    qualite: "moyenne",
    resultat: "reussi",
    contexte: "Logistique — temps de cycle entrepôt",
    dims: { comprehension: 0.9, application: 0.85, transfert: 0.75, justification: 0.7 },
  },
  {
    skill: "STAT-01",
    jours: 22,
    type: "transfert",
    autonomie: "A4",
    qualite: "forte",
    resultat: "reussi",
    contexte: "Maintenance — durées d'intervention",
    dims: { comprehension: 0.9, application: 0.9, transfert: 0.85, justification: 0.75 },
  },

  // ---- STAT-02 : niveau 3, robustesse encore moyenne --------------------
  {
    skill: "STAT-02",
    jours: 110,
    type: "exercice",
    autonomie: "A2",
    qualite: "faible",
    resultat: "reussi",
    contexte: "Réception — pièces défectueuses",
    dims: { comprehension: 0.75, application: 0.65 },
  },
  {
    skill: "STAT-02",
    jours: 74,
    type: "exercice",
    autonomie: "A3",
    qualite: "moyenne",
    resultat: "reussi",
    contexte: "Réception — pièces défectueuses",
    dims: { comprehension: 0.85, application: 0.8, justification: 0.6 },
  },
  {
    skill: "STAT-02",
    jours: 35,
    type: "exercice",
    autonomie: "A3",
    qualite: "moyenne",
    resultat: "reussi",
    contexte: "Guichet — arrivées clients",
    dims: { comprehension: 0.85, application: 0.85, transfert: 0.6 },
  },

  // ---- LOG-01 : solide -------------------------------------------------
  {
    skill: "LOG-01",
    jours: 133,
    type: "exercice",
    autonomie: "A2",
    qualite: "moyenne",
    resultat: "reussi",
    contexte: "Distribution — quantité économique",
    dims: { comprehension: 0.8, application: 0.75 },
  },
  {
    skill: "LOG-01",
    jours: 89,
    type: "exercice",
    autonomie: "A3",
    qualite: "moyenne",
    resultat: "reussi",
    contexte: "Distribution — quantité économique",
    dims: { comprehension: 0.85, application: 0.85, justification: 0.65 },
  },
  {
    skill: "LOG-01",
    jours: 41,
    type: "etude-de-cas",
    autonomie: "A3",
    qualite: "forte",
    resultat: "reussi",
    contexte: "Pièces détachées — remise quantitative",
    dims: { comprehension: 0.9, application: 0.85, transfert: 0.7, justification: 0.7 },
  },

  // ---- LOG-02 : niveau 2, une contradiction conservée -------------------
  {
    skill: "LOG-02",
    jours: 96,
    type: "exercice",
    autonomie: "A1",
    qualite: "faible",
    resultat: "reussi",
    contexte: "Stock de sécurité — niveau de service 95 %",
    dims: { comprehension: 0.7, application: 0.6 },
  },
  {
    skill: "LOG-02",
    jours: 52,
    type: "exercice",
    autonomie: "A3",
    qualite: "moyenne",
    resultat: "echec",
    contexte: "Stock de sécurité — délai variable",
    dims: { comprehension: 0.6, application: 0.3 },
    commentaire:
      "Écart-type de la demande pendant le délai calculé sans tenir compte de la variabilité du délai.",
  },
  {
    skill: "LOG-02",
    jours: 18,
    type: "correction-erreur",
    autonomie: "A2",
    qualite: "moyenne",
    resultat: "reussi",
    contexte: "Stock de sécurité — délai variable",
    dims: { comprehension: 0.8, application: 0.75, justification: 0.6 },
    commentaire: "Reprise de l'erreur sur la composition des variances.",
  },

  // ---- ALGO-01 / ALGO-05 ------------------------------------------------
  {
    skill: "ALGO-01",
    jours: 104,
    type: "code",
    autonomie: "A2",
    qualite: "faible",
    resultat: "reussi",
    contexte: "Python — tri et agrégation",
    dims: { comprehension: 0.75, application: 0.7 },
  },
  {
    skill: "ALGO-01",
    jours: 58,
    type: "code",
    autonomie: "A3",
    qualite: "moyenne",
    resultat: "reussi",
    contexte: "Python — tri et agrégation",
    dims: { comprehension: 0.85, application: 0.8, justification: 0.6 },
  },
  {
    skill: "ALGO-01",
    jours: 12,
    type: "code",
    autonomie: "A3",
    qualite: "moyenne",
    resultat: "reussi",
    contexte: "Python — parcours de nomenclature",
    dims: { comprehension: 0.85, application: 0.85, transfert: 0.65 },
  },
  {
    skill: "ALGO-05",
    jours: 47,
    type: "code",
    autonomie: "A2",
    qualite: "moyenne",
    resultat: "reussi",
    contexte: "Python — analyse d'un historique de ventes",
    dims: { comprehension: 0.8, application: 0.7 },
  },
  {
    skill: "ALGO-05",
    jours: 9,
    type: "code",
    autonomie: "A3",
    qualite: "moyenne",
    resultat: "partiel",
    contexte: "Python — analyse d'un historique de ventes",
    dims: { comprehension: 0.8, application: 0.65 },
  },

  // ---- PROD-01 / PROD-03 ------------------------------------------------
  {
    skill: "PROD-01",
    jours: 81,
    type: "etude-de-cas",
    autonomie: "A2",
    qualite: "moyenne",
    resultat: "reussi",
    contexte: "PIC — atelier mécanique",
    dims: { comprehension: 0.8, application: 0.7, justification: 0.55 },
  },
  {
    skill: "PROD-03",
    jours: 67,
    type: "exercice",
    autonomie: "A2",
    qualite: "moyenne",
    resultat: "partiel",
    contexte: "MRP — nomenclature à deux niveaux",
    dims: { comprehension: 0.7, application: 0.55 },
    commentaire: "Décalage des besoins nets sur le délai d'obtention non appliqué au niveau 2.",
  },

  // ---- RO-01 : intégration via projet -----------------------------------
  {
    skill: "RO-01",
    jours: 44,
    type: "exercice",
    autonomie: "A2",
    qualite: "moyenne",
    resultat: "reussi",
    contexte: "Programmation linéaire — mix de production",
    dims: { comprehension: 0.8, application: 0.7 },
  },
  {
    skill: "RO-01",
    jours: 15,
    type: "projet",
    autonomie: "A3",
    qualite: "forte",
    resultat: "reussi",
    contexte: "Projet — arbitrage coût/service sur un réseau à 3 sites",
    dims: {
      comprehension: 0.85,
      application: 0.8,
      transfert: 0.7,
      integration: 0.75,
      justification: 0.7,
    },
    combinees: ["LOG-01", "STAT-02"],
  },

  // ---- SYSC-01 : exposition récente -------------------------------------
  {
    skill: "SYSC-01",
    jours: 27,
    type: "explication",
    autonomie: "A2",
    qualite: "faible",
    resultat: "reussi",
    contexte: "Chaîne logistique — effet coup de fouet",
    dims: { comprehension: 0.7 },
  },
];

/**
 * Construit le jeu fictif. Les dates sont relatives à l'instant d'appel,
 * pour que la page Progression montre toujours une trajectoire lisible.
 */
export function jeuDeDemonstration(now: Date = new Date()): Collections {
  const ref = now.getTime();

  const evidence: SkillEvidence[] = BROUILLONS.map((b, i) => ({
    id: `demo-ev-${String(i + 1).padStart(3, "0")}`,
    skillCode: b.skill,
    date: ilYa(b.jours, ref),
    type: b.type,
    niveauPreuve: "A" as const,
    autonomie: b.autonomie,
    qualite: b.qualite,
    resultat: b.resultat,
    contexte: b.contexte,
    dimensions: b.dims,
    competencesCombinees: b.combinees,
    source: { kind: "manuel" as const, ref: "jeu-de-demonstration" },
    commentaire: b.commentaire,
  })).sort((a, b) => a.date.localeCompare(b.date));

  const sessions = [
    { jours: 148, duree: 35, dom: ["statistiques"] },
    { jours: 133, duree: 50, dom: ["logistique"] },
    { jours: 121, duree: 45, dom: ["statistiques"] },
    { jours: 110, duree: 40, dom: ["statistiques"] },
    { jours: 104, duree: 60, dom: ["algorithmique"] },
    { jours: 96, duree: 40, dom: ["logistique"] },
    { jours: 89, duree: 55, dom: ["logistique"] },
    { jours: 81, duree: 70, dom: ["production"] },
    { jours: 74, duree: 45, dom: ["statistiques"] },
    { jours: 67, duree: 50, dom: ["production"] },
    { jours: 63, duree: 45, dom: ["statistiques"] },
    { jours: 58, duree: 65, dom: ["algorithmique"] },
    { jours: 52, duree: 40, dom: ["logistique"] },
    { jours: 47, duree: 60, dom: ["algorithmique"] },
    { jours: 44, duree: 55, dom: ["recherche-operationnelle"] },
    { jours: 41, duree: 65, dom: ["logistique"] },
    { jours: 35, duree: 45, dom: ["statistiques"] },
    { jours: 27, duree: 30, dom: ["systemes-complexes"] },
    { jours: 22, duree: 50, dom: ["statistiques"] },
    { jours: 18, duree: 45, dom: ["logistique"] },
    { jours: 15, duree: 90, dom: ["recherche-operationnelle", "logistique"] },
    { jours: 12, duree: 55, dom: ["algorithmique"] },
    { jours: 9, duree: 45, dom: ["algorithmique"] },
    { jours: 4, duree: 35, dom: ["statistiques"] },
    { jours: 1, duree: 40, dom: ["logistique"] },
  ].map((s, i) => ({
    id: `demo-ses-${i + 1}`,
    date: ilYa(s.jours, ref),
    dureeMin: s.duree,
    domaines: s.dom as Collections["sessions"][number]["domaines"],
    skillCodes: [],
    activites: [],
    genereAutomatiquement: true,
  }));

  return {
    user: { ...UTILISATEUR_PAR_DEFAUT, prenom: "Démo" },
    evidence,
    exercises: EXERCICES_DIAGNOSTIC,
    attempts: [],
    errors: [
      {
        id: "demo-err-1",
        concept: "Composition des variances sous délai variable",
        skillCodes: ["LOG-02", "STAT-02"],
        description:
          "L'écart-type de la demande pendant le délai est calculé comme σ·√L en ignorant la variabilité du délai lui-même.",
        causeProbable:
          "Formule mémorisée dans le cas du délai constant, appliquée hors de son domaine de validité.",
        correction:
          "Utiliser σ_DL = √(L·σ_D² + D̄²·σ_L²) dès que le délai est aléatoire. Vérifier systématiquement quelle grandeur est incertaine avant de choisir la formule.",
        exemple:
          "D̄ = 120/sem, σ_D = 20, L̄ = 2 sem, σ_L = 0,5 → σ_DL = √(2·400 + 14400·0,25) = √4400 ≈ 66, et non 20·√2 ≈ 28.",
        occurrences: [
          { date: ilYa(52, ref), contexte: "Stock de sécurité — délai variable", source: "demo-ev-013" },
          { date: ilYa(31, ref), contexte: "Réapprovisionnement multi-fournisseurs", source: "séance" },
        ],
        statut: "en-cours",
      },
      {
        id: "demo-err-2",
        concept: "Décalage des besoins nets en MRP",
        skillCodes: ["PROD-03"],
        description:
          "Les besoins nets sont calculés sans décaler du délai d'obtention aux niveaux inférieurs de la nomenclature.",
        causeProbable:
          "Le jalonnement est appliqué au niveau 1 puis oublié en descendant dans l'arborescence.",
        correction:
          "Traiter la nomenclature niveau par niveau, et décaler les besoins du délai propre à chaque composant avant de passer au niveau suivant.",
        occurrences: [
          { date: ilYa(67, ref), contexte: "MRP — nomenclature à deux niveaux", source: "demo-ev-021" },
        ],
        statut: "nouvelle",
      },
    ],
    projects: [
      {
        id: "demo-proj-1",
        titre: "Arbitrage coût/service sur un réseau à trois sites",
        objectif:
          "Déterminer les niveaux de stock et la politique d'approvisionnement minimisant le coût total sous contrainte de taux de service.",
        domaines: ["logistique", "recherche-operationnelle"],
        skillCodes: ["LOG-01", "LOG-02", "RO-01", "STAT-02"],
        etapes: [
          { id: "e1", ordre: 1, titre: "Définition du problème", statut: "terminee" },
          { id: "e2", ordre: 2, titre: "Analyse du système", statut: "terminee" },
          { id: "e3", ordre: 3, titre: "Modélisation", statut: "terminee" },
          { id: "e4", ordre: 4, titre: "Méthode", statut: "terminee" },
          { id: "e5", ordre: 5, titre: "Implémentation", statut: "en-cours" },
          { id: "e6", ordre: 6, titre: "Expérimentation", statut: "a-faire" },
          { id: "e7", ordre: 7, titre: "Analyse", statut: "a-faire" },
          { id: "e8", ordre: 8, titre: "Conclusion", statut: "a-faire" },
        ],
        livrables: [{ titre: "Modèle linéaire (formulation)", note: "Rédigé" }],
        difficultes: ["Estimation de la demande sur le site 3, historique court."],
        statut: "en-cours",
        dateDebut: ilYa(38, ref),
      },
    ],
    readings: [
      {
        id: "demo-lec-1",
        titre: "Factory Physics",
        auteur: "Hopp & Spearman",
        domaine: "production",
        statut: "en-cours",
        progression: 40,
        concepts: ["Loi de Little", "Variabilité", "Relation WIP-débit-délai"],
        skillCodes: ["PROD-04", "SYSC-01"],
        notes: "La variabilité est traitée comme grandeur mesurable, pas comme un aléa subi.",
        exercicesGeneres: [],
        comprehensionDeclaree: 3,
      },
      {
        id: "demo-lec-2",
        titre: "Thinking in Systems",
        auteur: "Donella Meadows",
        domaine: "systemes-complexes",
        statut: "lu",
        progression: 100,
        concepts: ["Boucles de rétroaction", "Stocks et flux", "Points de levier"],
        skillCodes: ["SYSC-01", "SYSC-02"],
        notes: "Lecture faite ; aucune application pratique encore réalisée.",
        exercicesGeneres: [],
        comprehensionDeclaree: 4,
      },
    ],
    knowledge: [],
    sessions,
    objectives: [
      {
        id: "demo-obj-1",
        horizon: "jour",
        libelle: "Résoudre un problème de probabilités",
        skillCodes: ["STAT-02"],
        cible: { kind: "exercices", nombre: 1 },
        dateCreation: ilYa(0, ref),
      },
      {
        id: "demo-obj-2",
        horizon: "semaine",
        libelle: "Consolider les lois usuelles et leur choix en contexte",
        skillCodes: ["STAT-02", "STAT-03"],
        cible: { kind: "preuves", nombre: 3 },
        dateCreation: ilYa(3, ref),
      },
      {
        id: "demo-obj-3",
        horizon: "long-terme",
        libelle: "Maîtriser la modélisation de systèmes logistiques incertains",
        skillCodes: ["LOG-02", "LOG-06", "SYSC-03", "ALGO-06"],
        dateCreation: ilYa(150, ref),
      },
    ],
  };
}
