/**
 * Le parcours long — dix-huit mois de produit, un pas de moteur par jour.
 *
 * ## Ce qu'il ajoute au pilote court
 *
 * `deroulerParcoursPilote` (simulateur.ts) répond à « le moteur tient-il sur
 * 120 pas ? ». Trois choses lui manquent pour répondre à « que fabrique ce
 * produit sur la durée ? » :
 *
 * - **un référentiel qui grandit** — un compte réel voit apparaître des
 *   domaines en cours de route ; un graphe figé ne dit rien de ce que le moteur
 *   fait quand il s'étend ;
 * - **des périodes sans rien** — sans pause, l'oubli ne se voit pas et la
 *   révision espacée n'a rien à rattraper ;
 * - **une trace des actions servies** — ce que le moteur a proposé, à quelle
 *   difficulté, face à l'aptitude réelle du moment. C'est la seule matière qui
 *   permette de juger la SÉLECTION, et pas seulement le résultat.
 *
 * ## Mémoire
 *
 * Un pas complet porte l'état entier du moteur, journal recopié compris. Sur
 * 540 pas, tout conserver représente des centaines de milliers d'objets pour
 * quelques chiffres affichés. Chaque pas est donc résumé au vol
 * (`PasResume`) et seul le dernier est conservé entier — celui dont l'écran a
 * besoin pour le bilan final.
 *
 * Rien n'est lu, rien n'est écrit : le module est pur, et ses sorties sont des
 * inspections, jamais des preuves (invariant 2).
 */

import type { Scenario, ResultatSimulation } from "./types";
import { avancer, clore, decaler, etendreReferentiel, ouvrir } from "./simulateur";
import { creerApprenant, tirage } from "./apprenant";
import {
  construireMondeFictif,
  enPause,
  lotDuJour,
  type MondeFictif,
} from "./monde";

/* ------------------------------------------------------------------ */
/* Ce qu'on garde de chaque jour                                       */
/* ------------------------------------------------------------------ */

export type GenreJour =
  | "tentative"
  | "abandon"
  | "ignoree"
  | "pause"
  | "extension"
  | "sans-exercice"
  | "ouverture";

export interface PasResume {
  jour: number;
  date: string;
  genre: GenreJour;
  evenement: string;
  scoreGlobal: number | null;
  niveauMoyen: number | null;
  competencesTotal: number;
  competencesEvaluees: number;
  /** Compétences dont le niveau dérivé atteint 3 — le seuil « maîtrise ». */
  competencesMaitrisees: number;
  competencesActives: number;
  observations: number;
  tentativesMenees: number;
  exercicesDisponibles: number;
  /** Niveau dérivé par compétence, `null` tant qu'aucune observation. */
  niveaux: Record<string, number | null>;
  /**
   * Aptitude réelle du jour, compétence par compétence.
   *
   * Le moteur ne la voit jamais. C'est ce qui permet de suivre l'écart au réel
   * DANS le temps, et pas seulement à la fin : un moteur qui finit juste après
   * avoir été faux un an n'est pas le même produit.
   */
  aptitudes: Record<string, number>;
  tete: {
    code: string;
    exercice: string | null;
    difficulteCible: number;
    /** Facteur qui pèse le plus dans le score de la recommandation. */
    facteur: string;
  } | null;
  anomalies: number;
}

/**
 * Une action servie, et ce qu'elle a donné.
 *
 * `aptitude` est l'aptitude réelle au moment où l'exercice a été proposé — ce
 * que le moteur ne voit pas. C'est elle qui permet de dire si la difficulté
 * servie visait juste, question à laquelle le taux de réussite seul ne répond
 * pas : réussir tout le temps est aussi mauvais signe qu'échouer tout le temps.
 */
export interface ActionServie {
  jour: number;
  date: string;
  code: string;
  exerciceId: string;
  titre: string;
  difficulte: number;
  difficulteCible: number;
  facteur: string;
  /** Rang de la proposition retenue dans la liste servie (0 = la tête). */
  rang: number;
  niveauEstime: number | null;
  aptitude: number | null;
  suivie: boolean;
  resultat: "reussi" | "partiel" | "echec" | null;
  menee: boolean;
  dureeMin: number | null;
  dureeEstimeeMin: number;
  indicesUtilises: number | null;
}

export interface ResultatParcoursLong {
  monde: MondeFictif;
  /**
   * Le résultat au format commun — `pas` n'y contient que le dernier jour,
   * assez pour le registre des prédictions et le bilan final.
   */
  resultat: ResultatSimulation;
  resumes: PasResume[];
  actions: ActionServie[];
  /** Aptitude réelle au dernier jour, oubli compris. */
  veriteTerrain: Record<string, number>;
  /** Millisecondes de calcul — le parcours est lourd, autant le dire. */
  dureeCalculMs: number;
}

/* ------------------------------------------------------------------ */
/* Déroulé                                                             */
/* ------------------------------------------------------------------ */

/**
 * Part des propositions interrompues au bout de quelques minutes.
 *
 * Un abandon n'est pas un échec : il ne produit aucune preuve (ADR-030). Sans
 * lui, le journal simulé serait plus propre que n'importe quel journal réel, et
 * le garde-fou qui l'écarte ne serait jamais éprouvé.
 */
const PART_ABANDONS = 0.06;

function facteurDominant(facteurs: { libelle: string; contribution: number }[]): string {
  let meilleur: { libelle: string; contribution: number } | null = null;
  for (const facteur of facteurs) {
    if (!meilleur || facteur.contribution > meilleur.contribution) meilleur = facteur;
  }
  return meilleur?.libelle ?? "aucun";
}

function resumer(
  pas: ReturnType<typeof avancer>,
  jour: number,
  genre: GenreJour,
  exercicesDisponibles: number,
  aptitudes: Record<string, number>,
): PasResume {
  const niveaux: Record<string, number | null> = {};
  let maitrisees = 0;
  for (const etat of pas.etats) {
    niveaux[etat.skill.code] = etat.niveau;
    if (etat.niveau !== null && etat.niveau >= 3) maitrisees += 1;
  }

  const tete = pas.recommandations[0] ?? null;

  return {
    jour,
    date: pas.date,
    genre,
    evenement: pas.evenement,
    scoreGlobal: pas.global.scoreGlobal,
    niveauMoyen: pas.global.niveauMoyen,
    competencesTotal: pas.global.competencesTotal,
    competencesEvaluees: pas.global.competencesEvaluees,
    competencesMaitrisees: maitrisees,
    competencesActives: pas.global.competencesActives,
    observations: pas.observations.length,
    tentativesMenees: pas.tentatives.filter((t) => t.statut === "terminee").length,
    exercicesDisponibles,
    niveaux,
    aptitudes,
    tete: tete
      ? {
          code: tete.etat.skill.code,
          exercice: tete.exercice?.titre ?? null,
          difficulteCible: tete.difficulteCible,
          facteur: facteurDominant(tete.facteurs),
        }
      : null,
    anomalies: pas.anomalies.length,
  };
}

export function deroulerParcoursLong(
  monde: MondeFictif = construireMondeFictif(),
): ResultatParcoursLong {
  const debutCalcul = Date.now();
  const initial = monde.lots[0];

  const scenario: Scenario = {
    id: "parcours-fictif",
    nom: "Parcours fictif",
    intention:
      "Un compte qui part de zéro, sur un référentiel étranger, pendant dix-huit mois.",
    domaines: [initial.domaine],
    competences: initial.competences,
    exercices: initial.exercices,
    evenements: [],
  };

  const parcours = ouvrir(scenario, { conserverPas: false });
  const apprenant = creerApprenant(monde.profil, monde.graine);
  // Flux de tirage distinct de celui de l'apprenant : décider d'un abandon ne
  // doit pas décaler les tirages de réussite, sinon changer la part d'abandons
  // changerait tout le parcours.
  const tirageAbandon = tirage((monde.graine ^ 0x9e3779b9) >>> 0);

  const resumes: PasResume[] = [];
  const actions: ActionServie[] = [];

  let dernier = avancer(
    parcours,
    { type: "attente", date: monde.depart, jours: 0 },
    0,
    "Ouverture du compte — journal vide, aucune mesure",
  );
  resumes.push(resumer(dernier, 0, "ouverture", parcours.scenario.exercices.length, apprenant.aptitudes(monde.depart)));

  for (let jour = 1; jour <= monde.jours; jour += 1) {
    const date = decaler(monde.depart, jour);

    const lot = lotDuJour(monde, jour);
    if (lot) {
      etendreReferentiel(parcours, {
        domaines: [lot.domaine],
        competences: lot.competences,
        exercices: lot.exercices,
      });
      dernier = avancer(
        parcours,
        { type: "attente", date, jours: 0 },
        jour,
        `Référentiel étendu — ${lot.domaine.nom} : +${lot.competences.length} compétences, +${lot.exercices.length} exercices (${lot.motif})`,
      );
      resumes.push(resumer(dernier, jour, "extension", parcours.scenario.exercices.length, apprenant.aptitudes(date)));
      continue;
    }

    const pause = enPause(monde, jour);
    if (pause) {
      dernier = avancer(
        parcours,
        { type: "attente", date, jours: 0 },
        jour,
        `Aucune pratique — ${pause.motif}`,
      );
      resumes.push(resumer(dernier, jour, "pause", parcours.scenario.exercices.length, apprenant.aptitudes(date)));
      continue;
    }

    // La liste servie compte trois propositions : quelqu'un qui ouvre son
    // tableau de bord prend la première qui porte un exercice, pas la première
    // tout court. Ne retenir que la tête ferait perdre un jour sur deux à
    // regarder une carte vide — ce qui dirait plus sur le simulateur que sur le
    // produit. Le rang retenu est tracé : « la tête était vide » reste une
    // information, et c'en est une importante.
    const rang = dernier.recommandations.findIndex((r) => r.exercice !== null);
    const retenue = rang < 0 ? undefined : dernier.recommandations[rang];
    if (!retenue?.exercice) {
      dernier = avancer(
        parcours,
        { type: "attente", date, jours: 0 },
        jour,
        dernier.recommandations.length > 0
          ? `Aucune des ${dernier.recommandations.length} propositions ne porte d'exercice`
          : "Aucune recommandation — rien à proposer",
      );
      resumes.push(resumer(dernier, jour, "sans-exercice", parcours.scenario.exercices.length, apprenant.aptitudes(date)));
      continue;
    }

    const exercice = retenue.exercice;
    const code = retenue.etat.skill.code;
    const facteur = facteurDominant(retenue.facteurs);
    const aptitude = apprenant.aptitudes(date)[code] ?? null;
    const commun = {
      jour,
      date,
      code,
      exerciceId: exercice.id,
      titre: exercice.titre,
      difficulte: exercice.difficulte,
      difficulteCible: retenue.difficulteCible,
      facteur,
      rang,
      niveauEstime: retenue.etat.niveau,
      aptitude,
      dureeEstimeeMin: exercice.dureeEstimeeMin,
    };

    if (tirageAbandon() < PART_ABANDONS) {
      const dureeMin = Math.max(2, Math.round(exercice.dureeEstimeeMin * 0.12));
      dernier = avancer(
        parcours,
        { type: "tentative-abandonnee", date, exercice: exercice.id, dureeMin },
        jour,
      );
      actions.push({
        ...commun,
        suivie: true,
        resultat: null,
        menee: false,
        dureeMin,
        indicesUtilises: null,
      });
      resumes.push(resumer(dernier, jour, "abandon", parcours.scenario.exercices.length, apprenant.aptitudes(date)));
      continue;
    }

    const jeu = apprenant.jouer({ exercice, etat: retenue.etat, date });
    if (jeu === null) {
      dernier = avancer(
        parcours,
        { type: "attente", date, jours: 0 },
        jour,
        `Proposition ignorée — ${exercice.titre}`,
      );
      actions.push({
        ...commun,
        suivie: false,
        resultat: null,
        menee: false,
        dureeMin: null,
        indicesUtilises: null,
      });
      resumes.push(resumer(dernier, jour, "ignoree", parcours.scenario.exercices.length, apprenant.aptitudes(date)));
      continue;
    }

    dernier = avancer(
      parcours,
      { ...jeu, type: "tentative", date, exercice: exercice.id },
      jour,
    );
    const inscrite = parcours.tentatives.at(-1);
    actions.push({
      ...commun,
      suivie: true,
      resultat: jeu.resultat,
      menee: inscrite?.statut === "terminee",
      dureeMin: jeu.dureeMin,
      indicesUtilises: jeu.indicesUtilises,
    });
    resumes.push(resumer(dernier, jour, "tentative", parcours.scenario.exercices.length, apprenant.aptitudes(date)));
  }

  const resultat = clore(parcours);
  const veriteTerrain = apprenant.aptitudes(resumes.at(-1)?.date);

  return {
    monde,
    resultat: { ...resultat, veriteTerrain },
    resumes,
    actions,
    veriteTerrain,
    dureeCalculMs: Date.now() - debutCalcul,
  };
}
