/**
 * Les jeux de données livrés, au format d'échange.
 *
 * Ils sont écrits comme n'importe quel jeu maison : même structure, mêmes
 * champs, même validation. C'est délibéré — un jeu livré qui aurait des
 * privilèges de forme rendrait le format d'échange décoratif, et l'export
 * cesserait d'être un point de départ utilisable.
 *
 * Le référentiel est **propre à la simulation** : ni compte réel, ni
 * `referentiel.fixture.ts` (réservé aux tests).
 */

import type { Domaine, Exercise, Skill } from "@/lib/domain/types";
import type { EvenementScenario } from "./types";
import { FORMAT_JEU, VERSION_JEU, type JeuDonnees } from "./jeu-donnees";

const DEPART = "2026-03-02T09:00:00.000Z";
const JOUR_MS = 86_400_000;

function jour(n: number): string {
  return new Date(new Date(DEPART).getTime() + n * JOUR_MS).toISOString();
}

const domaine = (id: string, nom: string, prefixe: string, ordre: number): Domaine => ({
  id,
  nom,
  prefixe,
  description: "",
  ordre,
  version: 1,
  archive: false,
  origine: "manuel",
});

const competence = (
  code: string,
  intitule: string,
  palier: Skill["palier"],
  importance: number,
  ordre: number,
  prerequis: string[] = [],
): Skill => ({
  code,
  domaine: "logistique",
  intitule,
  palier,
  prerequis,
  importance,
  ordre,
  active: true,
  archive: false,
  origine: "manuel",
});

const exercice = (
  id: string,
  titre: string,
  difficulte: Exercise["difficulte"],
  competences: string[],
  dureeEstimeeMin: number,
  indices: number,
): Exercise => ({
  id,
  titre,
  domaine: "logistique",
  type: "probleme",
  difficulte,
  competences,
  dureeEstimeeMin,
  enonce: `Énoncé de simulation — ${titre}.`,
  indices: Array.from({ length: indices }, (_, i) => `Indice ${i + 1}`),
  correction: "Correction de simulation.",
  criteres: [
    { dimension: "comprehension", libelle: "Comprend l'énoncé" },
    { dimension: "application", libelle: "Applique la méthode" },
    { dimension: "justification", libelle: "Justifie le résultat" },
  ],
  origine: "manuel",
});

const DOMAINES: Domaine[] = [domaine("logistique", "Logistique", "LOG", 0)];

const COMPETENCES: Skill[] = [
  competence("LOG-01", "Lire un plan de transport", "fondamentaux", 1, 0),
  competence("LOG-02", "Calculer un besoin net", "fondamentaux", 1, 1),
  competence("LOG-03", "Dimensionner un stock de sécurité", "fondamentaux", 0.9, 2, ["LOG-02"]),
  competence("LOG-04", "Arbitrer coût de stockage et rupture", "intermediaire", 0.9, 3, [
    "LOG-03",
  ]),
  competence("LOG-05", "Construire un plan directeur de production", "intermediaire", 0.8, 4, [
    "LOG-02",
    "LOG-04",
  ]),
];

/** Catalogue court — suffisant pour les scénarios écrits à la main. */
const EXERCICES: Exercise[] = [
  exercice("EX-01", "Lecture d'un plan de transport", 1, ["LOG-01"], 20, 2),
  exercice("EX-02", "Besoin net sur trois périodes", 2, ["LOG-02"], 30, 3),
  exercice("EX-03", "Besoin net avec aléas", 3, ["LOG-02", "LOG-03"], 45, 3),
  exercice("EX-04", "Stock de sécurité sous contrainte", 3, ["LOG-03"], 40, 2),
  exercice("EX-05", "Arbitrage coût de rupture", 4, ["LOG-04", "LOG-03"], 60, 2),
  exercice("EX-06", "Plan directeur complet", 5, ["LOG-05", "LOG-04", "LOG-02"], 90, 1),
];

/**
 * Catalogue large — indispensable aux parcours longs : un exercice réussi sort
 * définitivement de la file (`recommandable`, recommend.ts). Avec six
 * exercices, un parcours de quatre mois s'assèche en une semaine et ne mesure
 * plus rien.
 */
const EXERCICES_VOLUME: Exercise[] = COMPETENCES.flatMap((c, rang) =>
  [1, 2, 3, 4, 5].flatMap((difficulte) =>
    [0, 1].map((variante) =>
      exercice(
        `EXV-${c.code}-${difficulte}-${variante}`,
        `${c.intitule} — niveau ${difficulte}, variante ${variante + 1}`,
        difficulte as Exercise["difficulte"],
        [c.code],
        20 + difficulte * 10 + rang * 2,
        difficulte <= 2 ? 2 : 3,
      ),
    ),
  ),
);

const COMPLETE = {
  comprehension: 1,
  application: 1,
  transfert: 0.8,
  justification: 0.8,
} as const;
const PARTIELLE = { comprehension: 0.8, application: 0.5, justification: 0.3 } as const;
const FAIBLE = { comprehension: 0.4, application: 0.2 } as const;

const REGULIER: EvenementScenario[] = [
  { type: "tentative", date: jour(0), exercice: "EX-01", resultat: "reussi", indicesUtilises: 0, dureeMin: 18, evaluation: COMPLETE },
  { type: "tentative", date: jour(2), exercice: "EX-02", resultat: "reussi", indicesUtilises: 1, dureeMin: 32, evaluation: COMPLETE },
  { type: "attente", date: jour(2), jours: 3 },
  { type: "tentative", date: jour(7), exercice: "EX-04", resultat: "partiel", indicesUtilises: 1, dureeMin: 44, evaluation: PARTIELLE },
  { type: "tentative", date: jour(10), exercice: "EX-03", resultat: "reussi", indicesUtilises: 0, dureeMin: 41, evaluation: COMPLETE },
  { type: "tentative", date: jour(14), exercice: "EX-05", resultat: "partiel", indicesUtilises: 2, dureeMin: 65, evaluation: PARTIELLE },
  { type: "attente", date: jour(14), jours: 7 },
];

const BLOQUE: EvenementScenario[] = [
  { type: "tentative", date: jour(0), exercice: "EX-01", resultat: "reussi", indicesUtilises: 0, dureeMin: 17, evaluation: COMPLETE },
  { type: "tentative", date: jour(1), exercice: "EX-02", resultat: "echec", indicesUtilises: 3, dureeMin: 35, evaluation: FAIBLE },
  { type: "tentative", date: jour(3), exercice: "EX-02", resultat: "echec", indicesUtilises: 3, dureeMin: 38, aideExterne: "assistant-ia", evaluation: FAIBLE },
  // Abandon : aucune preuve ne doit en sortir (ADR-030).
  { type: "tentative-abandonnee", date: jour(5), exercice: "EX-03", dureeMin: 3 },
  { type: "tentative", date: jour(8), exercice: "EX-02", resultat: "partiel", indicesUtilises: 2, dureeMin: 40, evaluation: PARTIELLE },
  { type: "attente", date: jour(8), jours: 5 },
  { type: "attente", date: jour(13), jours: 5 },
];

const PAUSE: EvenementScenario[] = [
  { type: "tentative", date: jour(0), exercice: "EX-02", resultat: "reussi", indicesUtilises: 0, dureeMin: 28, evaluation: COMPLETE },
  { type: "tentative", date: jour(1), exercice: "EX-03", resultat: "reussi", indicesUtilises: 0, dureeMin: 43, evaluation: COMPLETE },
  { type: "tentative", date: jour(2), exercice: "EX-04", resultat: "reussi", indicesUtilises: 0, dureeMin: 39, evaluation: COMPLETE },
  { type: "attente", date: jour(2), jours: 30 },
  { type: "attente", date: jour(32), jours: 30 },
  { type: "tentative", date: jour(65), exercice: "EX-05", resultat: "echec", indicesUtilises: 2, dureeMin: 70, evaluation: FAIBLE },
];

const APTITUDES_MOYENNES: Record<string, number> = {
  "LOG-01": 3.4,
  "LOG-02": 2.8,
  "LOG-03": 2.4,
  "LOG-04": 2,
  "LOG-05": 1.8,
};

function jeuEvenements(
  id: string,
  nom: string,
  intention: string,
  evenements: EvenementScenario[],
): JeuDonnees {
  return {
    format: FORMAT_JEU,
    version: VERSION_JEU,
    id,
    nom,
    intention,
    domaines: DOMAINES,
    competences: COMPETENCES,
    exercices: EXERCICES,
    deroule: { mode: "evenements", evenements },
  };
}

function jeuPilote(
  id: string,
  nom: string,
  intention: string,
  profil: Extract<JeuDonnees["deroule"], { mode: "pilote" }>["profil"],
  graine: number,
  pas = 120,
): JeuDonnees {
  return {
    format: FORMAT_JEU,
    version: VERSION_JEU,
    id,
    nom,
    intention,
    domaines: DOMAINES,
    competences: COMPETENCES,
    exercices: EXERCICES_VOLUME,
    deroule: { mode: "pilote", depart: DEPART, pas, graine, profil },
  };
}

export const JEUX_LIVRES: JeuDonnees[] = [
  jeuEvenements(
    "regulier",
    "Régulier — 3 semaines",
    "Parcours court sans accroc : sert de référence pour repérer ce qui cloche ailleurs.",
    REGULIER,
  ),
  jeuEvenements(
    "prerequis-bloque",
    "Prérequis bloqué",
    "Échecs répétés sur LOG-02, plus un abandon : le moteur continue-t-il à proposer la suite ?",
    BLOQUE,
  ),
  jeuEvenements(
    "pause-longue",
    "Reprise après deux mois",
    "Trois compétences acquises puis 60 jours sans rien : la révision arrive-t-elle au bon moment ?",
    PAUSE,
  ),
  jeuPilote(
    "assidu",
    "Assidu — 120 jours",
    "Fait presque tout ce qui est proposé. Le seul régime qui remplit les quatre métriques du moteur.",
    { aptitude: APTITUDES_MOYENNES, apprentissage: 0.12, tauxIgnore: 0.1, lenteur: 1 },
    20260821,
  ),
  jeuPilote(
    "irregulier",
    "Irrégulier — 120 jours",
    "Ignore deux propositions sur trois : les prédictions restent en attente, jamais comptées comme fausses.",
    { aptitude: APTITUDES_MOYENNES, apprentissage: 0.1, tauxIgnore: 0.65, lenteur: 1.2 },
    4242,
  ),
  jeuPilote(
    "en-difficulte",
    "En difficulté — 120 jours",
    "Aptitude basse et progression lente : la calibration descend-elle la difficulté au lieu de s'entêter ?",
    {
      aptitude: {
        "LOG-01": 2.2,
        "LOG-02": 1.6,
        "LOG-03": 1.4,
        "LOG-04": 1.2,
        "LOG-05": 1,
      },
      apprentissage: 0.05,
      tauxIgnore: 0.2,
      lenteur: 1.5,
    },
    777,
  ),
];

export function jeuLivreParId(id: string): JeuDonnees | undefined {
  return JEUX_LIVRES.find((j) => j.id === id);
}

/** Les jeux longs — les seuls qui remplissent les métriques d'auto-évaluation. */
export const JEUX_VOLUME = JEUX_LIVRES.filter((j) => j.deroule.mode === "pilote");
