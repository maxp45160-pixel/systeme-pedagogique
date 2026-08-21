/**
 * Déroulé d'un scénario contre le moteur réel.
 *
 * Aucun calcul n'est réimplémenté ici : le simulateur construit le journal
 * d'observations exactement comme `terminerExercice` le fait, inscrit les
 * prédictions comme `journaliserActionServie` les inscrit, puis appelle les
 * mêmes fonctions que l'interface (`computeAllSkillStates`, `calibrerToutes`,
 * `recommander`, `calculerEtatGlobal`, `evaluerMoteur`). Une divergence entre
 * les deux chemins rendrait la simulation inutile : on ne simulerait plus le
 * produit.
 *
 * Le module est pur — pas d'I/O, pas d'horloge implicite, pas d'aléa non
 * gouverné. Ses sorties sont des observations d'inspection et ne doivent jamais
 * être écrites dans le journal d'un compte (invariant 2 : une mesure a une
 * source réelle).
 */

import { dureeRetenue } from "@/lib/domain/tentative";
import type {
  Domaine,
  Exercise,
  ExerciseAttempt,
  Skill,
  SkillObservation,
} from "@/lib/domain/types";
import {
  evaluerMoteur,
  type DecisionInscrite,
  type PredictionInscrite,
} from "@/lib/engine/auto-evaluation";
import { calibrerToutes, tentativeMenee } from "@/lib/engine/calibration";
import {
  attacherFamilles,
  construireCatalogueSituation,
} from "@/lib/engine/contexte-situation";
import { autonomieObservee, qualiteDepuisDifficulte } from "@/lib/engine/observation";
import { emettre } from "@/lib/engine/prediction";
import { calculerEtatGlobal } from "@/lib/engine/progression";
import { recommander, type Recommandation } from "@/lib/engine/recommend";
import { computeAllSkillStates } from "@/lib/engine/skill-state";
import {
  competencesJamaisRecommandees,
  detecterAnomalies,
  etatPrecedentVide,
  type EtatPrecedent,
} from "./anomalies";
import type {
  Anomalie,
  EvenementScenario,
  PasSimulation,
  ResultatSimulation,
  Scenario,
} from "./types";

const JOUR_MS = 86_400_000;
const RECOMMANDATIONS_PAR_PAS = 3;

export function decaler(date: string, jours: number): string {
  return new Date(new Date(date).getTime() + jours * JOUR_MS).toISOString();
}

function libelle(evenement: EvenementScenario, exercices: Exercise[]): string {
  if (evenement.type === "attente") return `Attente de ${evenement.jours} jours`;
  const titre =
    exercices.find((e) => e.id === evenement.exercice)?.titre ?? evenement.exercice;
  if (evenement.type === "tentative-abandonnee") {
    return `Tentative abandonnée — ${titre} (${evenement.dureeMin} min)`;
  }
  return `Tentative ${evenement.resultat} — ${titre} (${evenement.dureeMin} min, ${evenement.indicesUtilises} indice(s))`;
}

/**
 * Observations produites par une tentative menée — décalque de
 * `terminerExercice` (lib/store/actions.ts) : une observation de niveau A pour
 * la compétence cible, une observation indirecte de niveau B pour les autres.
 */
function observationsDeTentative(
  exercice: Exercise,
  tentative: ExerciseAttempt,
  date: string,
  aideExterne: Parameters<typeof autonomieObservee>[2],
  index: number,
): SkillObservation[] {
  const autonomie = autonomieObservee(
    tentative.indicesUtilises,
    exercice.indices.length,
    aideExterne,
  );
  const qualite = qualiteDepuisDifficulte(exercice.difficulte, autonomie);
  const type =
    exercice.type === "programmation"
      ? ("code" as const)
      : exercice.type === "etude-de-cas"
        ? ("etude-de-cas" as const)
        : exercice.type === "calcul"
          ? ("calcul" as const)
          : ("exercice" as const);

  return exercice.competences.map((code, rang) => ({
    id: `sim-obs-${index}-${rang}`,
    skillCode: code,
    date,
    type,
    niveauObservation: (rang === 0 ? "A" : "B") as "A" | "B",
    autonomie,
    qualite,
    resultat: tentative.resultat,
    contexte: exercice.titre,
    dimensions: tentative.evaluation,
    competencesCombinees:
      exercice.competences.length > 1
        ? exercice.competences.filter((c) => c !== code)
        : undefined,
    source: {
      kind: "exercice" as const,
      ref: exercice.id,
      trace: { kind: "tentative" as const, ref: tentative.id },
    },
  }));
}

/**
 * L'état mutable d'un parcours en cours de déroulé.
 *
 * Exporté avec `ouvrir`, `avancer`, `etendreReferentiel` et `clore` pour que le
 * parcours long (`parcours-long.ts`) déroule exactement la même mécanique. Un
 * second déroulé qui recopierait `avancer` finirait par en diverger, et la
 * simulation cesserait de simuler le produit — c'est tout ce que ce module
 * cherche à empêcher.
 */
export interface EtatParcours {
  scenario: Scenario;
  catalogue: ReturnType<typeof construireCatalogueSituation>;
  parId: Map<string, Exercise>;
  observations: SkillObservation[];
  tentatives: ExerciseAttempt[];
  abandonnees: Set<string>;
  recommandees: Set<string>;
  decisions: Map<string, DecisionInscrite>;
  predictions: Map<string, PredictionInscrite>;
  precedent: EtatPrecedent;
  pas: PasSimulation[];
  anomalies: (Anomalie & { pas: number; date: string })[];
  /**
   * Conserver chaque pas entier, ou le dernier seulement.
   *
   * Un pas porte l'état complet du moteur, journal compris — et `attacherFamilles`
   * en recopie chaque observation à chaque pas. Sur 540 jours et un millier
   * d'observations, tout garder revient à conserver des centaines de milliers
   * d'objets dont l'écran n'affiche que quelques chiffres. Le parcours long
   * résume lui-même chaque pas au vol et n'a besoin que du dernier.
   */
  conserverPas: boolean;
}

export function ouvrir(scenario: Scenario, options?: { conserverPas?: boolean }): EtatParcours {
  return {
    conserverPas: options?.conserverPas ?? true,
    scenario,
    catalogue: construireCatalogueSituation(scenario.exercices),
    parId: new Map(scenario.exercices.map((e) => [e.id, e])),
    observations: [],
    tentatives: [],
    abandonnees: new Set(),
    recommandees: new Set(),
    decisions: new Map(),
    predictions: new Map(),
    precedent: etatPrecedentVide(),
    pas: [],
    anomalies: [],
  };
}

/**
 * Joue un événement et recalcule tout ce que l'interface aurait affiché.
 *
 * L'ordre reproduit celui du produit : la tentative s'écrit, puis les états se
 * dérivent, puis la recommandation est **servie** — et c'est à ce moment, et
 * pas au clic, que la prédiction s'inscrit (`journaliserActionServie`).
 */
export function avancer(
  parcours: EtatParcours,
  evenement: EvenementScenario,
  index: number,
  /** Remplace le résumé lisible — utilisé quand l'événement ne dit pas tout. */
  libelleForce?: string,
): PasSimulation {
  const { scenario } = parcours;
  const horloge =
    evenement.type === "attente"
      ? decaler(evenement.date, evenement.jours)
      : evenement.date;
  const maintenant = new Date(horloge);

  if (evenement.type !== "attente") {
    const exercice = parcours.parId.get(evenement.exercice);
    if (!exercice) {
      throw new Error(
        `Scénario ${scenario.id} : exercice inconnu « ${evenement.exercice} » au pas ${index}.`,
      );
    }

    const abandon = evenement.type === "tentative-abandonnee";
    const resultat = abandon ? "partiel" : evenement.resultat;
    // `tentativeMenee` décide sur la durée BRUTE ; ce qu'on écrit passe par
    // `dureeRetenue` (ADR-071). Même ordre que le chemin réel.
    const menee =
      !abandon && tentativeMenee({ resultat, dureeMin: evenement.dureeMin }, exercice);
    const duree =
      dureeRetenue(
        { statut: menee ? "terminee" : "abandonnee", dureeMin: evenement.dureeMin },
        exercice.dureeEstimeeMin,
      ) ?? evenement.dureeMin;

    const tentative: ExerciseAttempt = {
      id: `sim-tent-${index}`,
      exerciseId: exercice.id,
      debut: decaler(horloge, -duree / (24 * 60)),
      fin: horloge,
      dureeMin: duree,
      indicesUtilises: abandon ? 0 : evenement.indicesUtilises,
      reponse: abandon ? "" : "Réponse simulée",
      evaluation: abandon ? {} : (evenement.evaluation ?? {}),
      resultat,
      statut: menee ? "terminee" : "abandonnee",
    };
    parcours.tentatives.push(tentative);

    // Une tentative abandonnée est un fait, jamais une preuve : elle entre dans
    // les tentatives (la calibration l'explique) et pas dans le journal
    // d'observations. Le simulateur doit reproduire ce refus, sinon il
    // masquerait précisément le défaut corrigé par ADR-030.
    if (menee) {
      parcours.observations.push(
        ...observationsDeTentative(
          exercice,
          tentative,
          horloge,
          evenement.type === "tentative" ? (evenement.aideExterne ?? "aucune") : "aucune",
          index,
        ),
      );
    } else {
      parcours.abandonnees.add(tentative.id);
    }
  }

  // Le chemin de lecture réel attache les familles de situation avant le moteur
  // (ADR-083) : sans ça, le transfert se mesurerait sur des titres.
  const journal = attacherFamilles(parcours.observations, parcours.catalogue);
  const etats = computeAllSkillStates(scenario.competences, journal, maintenant);
  const calibrations = calibrerToutes(etats, scenario.exercices, parcours.tentatives);
  const recommandations = recommander(
    etats,
    scenario.exercices,
    parcours.tentatives,
    RECOMMANDATIONS_PAR_PAS,
    calibrations,
    maintenant,
  );
  const global = calculerEtatGlobal(etats, maintenant, scenario.domaines);

  for (const recommandation of recommandations) {
    parcours.recommandees.add(recommandation.etat.skill.code);
  }

  inscrireEmission(parcours, recommandations[0], horloge, maintenant);

  const { anomalies, etat } = detecterAnomalies(
    etats,
    calibrations,
    recommandations,
    journal,
    parcours.abandonnees,
    parcours.precedent,
  );
  parcours.precedent = etat;

  const pas: PasSimulation = {
    index,
    date: horloge,
    evenement: libelleForce ?? libelle(evenement, scenario.exercices),
    etats,
    calibrations,
    recommandations,
    global,
    observations: journal,
    tentatives: [...parcours.tentatives],
    anomalies,
  };
  if (parcours.conserverPas) parcours.pas.push(pas);
  else parcours.pas[0] = pas;
  for (const anomalie of anomalies) {
    parcours.anomalies.push({ ...anomalie, pas: index, date: horloge });
  }
  return pas;
}

/**
 * Inscrit ce que le moteur affirme au moment où l'action est servie.
 *
 * Décalque de `journaliserActionServie` : seule la première recommandation est
 * journalisée, et seulement si elle porte un exercice. La clé d'idempotence de
 * `cleDecision` est conservée telle quelle — deux pas le même jour sur la même
 * compétence ne produisent qu'une décision, comme en production.
 */
function inscrireEmission(
  parcours: EtatParcours,
  retenue: Recommandation | undefined,
  horloge: string,
  maintenant: Date,
): void {
  if (!retenue?.exercice) return;

  const { decision, predictions } = emettre({
    now: maintenant,
    etat: retenue.etat,
    difficulteVisee: retenue.difficulteCible,
    calibration: retenue.calibration,
    exercice: retenue.exercice,
    facteurs: retenue.facteurs,
    tentatives: parcours.tentatives,
  });

  if (!parcours.decisions.has(decision.requestId)) {
    parcours.decisions.set(decision.requestId, {
      id: decision.requestId,
      priseLe: horloge,
      type: decision.type,
      politiqueVersion: decision.politiqueVersion,
      cibleCode: decision.cibleCode,
      cibleRef: decision.cibleRef,
    });
  }
  for (const prediction of predictions) {
    if (parcours.predictions.has(prediction.requestId)) continue;
    parcours.predictions.set(prediction.requestId, {
      id: prediction.requestId,
      emiseLe: horloge,
      type: prediction.type,
      cibleCode: prediction.cibleCode,
      cibleRef: prediction.cibleRef,
      valeur: prediction.valeur,
      horizonLe: prediction.horizonLe,
      modeleVersion: prediction.modeleVersion,
      entrees: prediction.entrees,
    });
  }
}

/**
 * Ajoute des domaines, des compétences et des exercices au référentiel en cours.
 *
 * Le référentiel d'un compte n'est pas figé : le tuteur y ajoute une branche
 * quand un besoin nouveau apparaît. Un parcours long qui garderait le même
 * référentiel du premier au dernier jour ne dirait rien de ce que le moteur
 * fait d'un graphe qui grandit — notamment s'il continue à servir l'ancien
 * domaine une fois le nouveau ouvert.
 *
 * Rien n'est retiré : les observations déjà au journal restent valables, et les
 * compétences déjà présentes ne sont pas remplacées.
 */
export function etendreReferentiel(
  parcours: EtatParcours,
  lot: { domaines: Domaine[]; competences: Skill[]; exercices: Exercise[] },
): void {
  const scenario = parcours.scenario;
  const codesConnus = new Set(scenario.competences.map((c) => c.code));
  const domainesConnus = new Set(scenario.domaines.map((d) => d.id));

  parcours.scenario = {
    ...scenario,
    domaines: [...scenario.domaines, ...lot.domaines.filter((d) => !domainesConnus.has(d.id))],
    competences: [
      ...scenario.competences,
      ...lot.competences.filter((c) => !codesConnus.has(c.code)),
    ],
    exercices: [...scenario.exercices, ...lot.exercices.filter((e) => !parcours.parId.has(e.id))],
  };

  parcours.catalogue = construireCatalogueSituation(parcours.scenario.exercices);
  parcours.parId = new Map(parcours.scenario.exercices.map((e) => [e.id, e]));
}

export function clore(parcours: EtatParcours): ResultatSimulation {
  const dernier = parcours.pas.at(-1);
  if (dernier) {
    for (const anomalie of competencesJamaisRecommandees(
      parcours.scenario.competences.filter((s) => s.active && !s.archive).map((s) => s.code),
      parcours.recommandees,
    )) {
      dernier.anomalies.push(anomalie);
      parcours.anomalies.push({ ...anomalie, pas: dernier.index, date: dernier.date });
    }
  }

  const predictions = [...parcours.predictions.values()];
  const decisions = [...parcours.decisions.values()];

  return {
    scenario: parcours.scenario,
    pas: parcours.pas,
    anomalies: parcours.anomalies,
    predictions,
    decisions,
    metriques: evaluerMoteur({
      predictions,
      decisions,
      tentatives: parcours.tentatives,
      observations: parcours.observations,
      exercicesParId: new Map(
        parcours.scenario.exercices.map((e) => [e.id, { dureeEstimeeMin: e.dureeEstimeeMin }]),
      ),
    }),
  };
}

export function deroulerScenario(scenario: Scenario): ResultatSimulation {
  const parcours = ouvrir(scenario);
  scenario.evenements.forEach((evenement, index) => {
    avancer(parcours, evenement, index);
  });
  return clore(parcours);
}

/**
 * Déroule un parcours **piloté par le moteur** : à chaque pas, l'apprenant
 * simulé fait ce que le moteur vient de recommander.
 *
 * C'est le seul mode qui produit du volume — et donc les seules métriques
 * d'auto-évaluation lisibles. Une liste d'événements écrite à la main teste ce
 * qu'on avait déjà en tête ; ici, c'est la boucle complète qui tourne :
 * recommandation servie, prédiction inscrite, tentative jouée, prédiction
 * tranchée.
 */
export function deroulerParcoursPilote(
  scenario: Scenario,
  options: {
    pas: number;
    /** Décide ce que l'apprenant fait de l'exercice proposé. */
    jouer: (contexte: {
      exercice: Exercise;
      difficulteCible: number;
      index: number;
      date: string;
      etat: PasSimulation["etats"][number];
    }) => Omit<Extract<EvenementScenario, { type: "tentative" }>, "date" | "exercice" | "type"> | null;
    /** Jours écoulés entre deux pas — au moins 1, sinon les décisions fusionnent. */
    joursEntrePas?: number;
  },
): ResultatSimulation {
  const parcours = ouvrir({ ...scenario, evenements: [] });
  const joursEntrePas = Math.max(1, options.joursEntrePas ?? 1);
  const depart = scenario.evenements[0]?.date ?? new Date("2026-03-02T09:00:00.000Z").toISOString();

  // Pas 0 : rien n'est encore arrivé, mais la recommandation est servie — donc
  // inscrite. C'est exactement ce que fait la première ouverture du tableau de
  // bord d'un compte neuf.
  let dernier = avancer(parcours, { type: "attente", date: depart, jours: 0 }, 0);

  for (let index = 1; index <= options.pas; index += 1) {
    const date = decaler(depart, index * joursEntrePas);
    const retenue = dernier.recommandations[0];
    if (!retenue?.exercice) {
      dernier = avancer(parcours, { type: "attente", date, jours: 0 }, index);
      continue;
    }

    const jeu = options.jouer({
      exercice: retenue.exercice,
      difficulteCible: retenue.difficulteCible,
      index,
      date,
      etat: retenue.etat,
    });

    dernier = avancer(
      parcours,
      jeu === null
        ? { type: "attente", date, jours: 0 }
        : { ...jeu, type: "tentative", date, exercice: retenue.exercice.id },
      index,
    );
  }

  return clore(parcours);
}
