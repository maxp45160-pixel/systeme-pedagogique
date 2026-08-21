/**
 * Le parcours long — dix-huit mois de produit, un pas de moteur par jour.
 *
 * ## Ce qu'il ajoute au pilote court
 *
 * `deroulerParcoursPilote` (simulateur.ts) répond à « le moteur tient-il sur
 * 120 pas ? ». Quatre choses lui manquent pour répondre à « que fabrique ce
 * produit sur la durée ? » :
 *
 * - **un référentiel qui grandit** — un compte réel voit apparaître des
 *   chapitres en cours de route ;
 * - **des périodes sans rien** — sans pause, l'oubli ne se voit pas et la
 *   révision espacée n'a rien à rattraper ;
 * - **une trace des actions servies** — ce que le moteur a proposé, à quelle
 *   difficulté, face à l'aptitude réelle du moment ;
 * - **des bras de comparaison** — le moteur, mais aussi des politiques naïves
 *   et des ablations. Un chiffre sans témoin ne se compare à rien : « 38 % des
 *   exercices dans la zone » ne veut rien dire tant qu'on ignore ce que donne
 *   un tirage au hasard.
 *
 * ## Le catalogue ne s'assèche plus
 *
 * Un exercice réussi sort définitivement de la file (`recommandable`,
 * recommend.ts). Sur un catalogue figé, la compétence la mieux classée finit
 * par n'avoir plus rien à proposer, et tout le parcours mesure alors la pénurie
 * plutôt que la sélection. Le produit réel ne reste pas à sec : il propose
 * « Générer un exercice ». Le parcours fait pareil — il fabrique l'exercice
 * manquant à la difficulté visée et compte combien il en a fallu.
 *
 * ## Mémoire
 *
 * Un pas complet porte l'état entier du moteur, journal recopié compris. Chaque
 * pas est donc résumé au vol (`PasResume`) et seul le dernier est conservé
 * entier.
 *
 * Rien n'est lu, rien n'est écrit : le module est pur, et ses sorties sont des
 * inspections, jamais des preuves (invariant 2).
 */

import type { Difficulte, Exercise, SkillState } from "@/lib/domain/types";
import type { ReglagesRecommandation } from "@/lib/engine/recommend";
import type { Recommandation } from "@/lib/engine/recommend";
import type { Scenario, ResultatSimulation } from "./types";
import { avancer, clore, decaler, etendreReferentiel, ouvrir } from "./simulateur";
import { creerApprenant, tirage } from "./apprenant";
import {
  construireMondeFictif,
  enPause,
  fabriquerExercice,
  lotDuJour,
  type MondeFictif,
} from "./monde";

/* ------------------------------------------------------------------ */
/* Bras : le moteur, des témoins naïfs, des ablations                  */
/* ------------------------------------------------------------------ */

/**
 * Comment la compétence du jour est choisie.
 *
 * Les quatre politiques naïves existent pour une seule raison : donner un point
 * de comparaison. Si le moteur ne fait pas mieux que `tourniquet`, le classement
 * qu'il calcule ne sert à rien — et c'est une piste autrement plus concrète que
 * n'importe quel seuil absolu.
 */
export type Politique = "moteur" | "aleatoire" | "facile" | "tourniquet" | "ancien";

export interface Bras {
  id: string;
  libelle: string;
  description: string;
  politique: Politique;
  /** Faux : `recommander` retombe sur la table par niveau. */
  calibrationActive: boolean;
  reglages: ReglagesRecommandation;
  /** Vrai pour les politiques naïves — ce à quoi le moteur doit se comparer. */
  temoin: boolean;
}

/** Un modèle de révision qui ne déclare jamais rien de dû. */
const JAMAIS_DUE: ReglagesRecommandation["modeleRevision"] = {
  intervalle: () => 100_000,
  facteurs: () => [],
};

export const BRAS: Bras[] = [
  {
    id: "moteur",
    libelle: "Moteur",
    description: "Le produit tel qu'il est : recommandation, calibration, révision espacée.",
    politique: "moteur",
    calibrationActive: true,
    reglages: {},
    temoin: false,
  },
  {
    id: "aleatoire",
    libelle: "Témoin — au hasard",
    description: "Compétence et difficulté tirées au sort. Le plancher absolu.",
    politique: "aleatoire",
    calibrationActive: true,
    reglages: {},
    temoin: true,
  },
  {
    id: "facile",
    libelle: "Témoin — toujours facile",
    description: "Compétence au hasard, difficulté 1. Beaucoup de réussite, peu d'apprentissage.",
    politique: "facile",
    calibrationActive: true,
    reglages: {},
    temoin: true,
  },
  {
    id: "tourniquet",
    libelle: "Témoin — tourniquet",
    description: "Les compétences dans l'ordre, difficulté moyenne. Couverture parfaite, aucune adaptation.",
    politique: "tourniquet",
    calibrationActive: true,
    reglages: {},
    temoin: true,
  },
  {
    id: "ancien",
    libelle: "Témoin — la plus ancienne",
    description: "La compétence pratiquée il y a le plus longtemps. Une révision espacée du pauvre.",
    politique: "ancien",
    calibrationActive: true,
    reglages: {},
    temoin: true,
  },
  {
    id: "sans-calibration",
    libelle: "Ablation — sans calibration",
    description: "Le moteur, mais la difficulté vient de la table par niveau, jamais des tentatives.",
    politique: "moteur",
    calibrationActive: false,
    reglages: {},
    temoin: false,
  },
  {
    id: "sans-revision",
    libelle: "Ablation — sans révision",
    description: "Le moteur, mais aucune compétence n'est jamais déclarée due.",
    politique: "moteur",
    calibrationActive: true,
    reglages: { modeleRevision: JAMAIS_DUE },
    temoin: false,
  },
  {
    id: "sans-bonus-actionnable",
    libelle: "Ablation — sans bonus actionnable",
    description: "Le moteur, mais avoir un exercice disponible ne fait plus monter le score.",
    politique: "moteur",
    calibrationActive: true,
    reglages: { bonusActionnable: 0 },
    temoin: false,
  },
];

export const BRAS_MOTEUR = BRAS[0];

export function brasParId(id: string): Bras {
  return BRAS.find((b) => b.id === id) ?? BRAS_MOTEUR;
}

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
  /** Rang de la proposition retenue dans la liste servie ; −1 hors politique moteur. */
  rang: number;
  /** L'exercice a été fabriqué faute de disponible, comme le ferait le tuteur. */
  genere: boolean;
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
  bras: Bras;
  /**
   * Le résultat au format commun — `pas` n'y contient que le dernier jour,
   * assez pour le registre des prédictions et le bilan final.
   */
  resultat: ResultatSimulation;
  resumes: PasResume[];
  actions: ActionServie[];
  /** Aptitude réelle au dernier jour, oubli compris. */
  veriteTerrain: Record<string, number>;
  /** Aptitude réelle au premier jour — le point de départ du gain. */
  aptitudeInitiale: Record<string, number>;
  /** Exercices fabriqués en cours de route faute de disponible. */
  exercicesGeneres: number;
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
 * lui, le journal simulé serait plus propre que n'importe quel journal réel.
 */
const PART_ABANDONS = 0.06;

/** Difficulté servie par les témoins qui n'en choisissent pas. */
const DIFFICULTE_NEUTRE: Difficulte = 3;

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

/** La compétence retenue pour la journée, avant même de savoir quoi lui donner. */
interface Choix {
  etat: SkillState;
  difficulteCible: Difficulte;
  facteur: string;
  rang: number;
  /** L'exercice que le moteur avait choisi, s'il y en avait un. */
  exercice: Exercise | null;
}

function choisir(
  politique: Politique,
  recommandations: Recommandation[],
  etats: SkillState[],
  suivant: () => number,
  dernierePratique: Map<string, number>,
  tourniquet: { rang: number },
): Choix | null {
  if (politique === "moteur") {
    const retenue = recommandations[0];
    if (!retenue) return null;
    return {
      etat: retenue.etat,
      difficulteCible: retenue.difficulteCible,
      facteur: facteurDominant(retenue.facteurs),
      rang: 0,
      exercice: retenue.exercice,
    };
  }

  const candidats = etats.filter((e) => e.skill.active && !e.skill.archive);
  if (candidats.length === 0) return null;

  const commun = (etat: SkillState, difficulte: Difficulte): Choix => ({
    etat,
    difficulteCible: difficulte,
    facteur: `politique ${politique}`,
    rang: -1,
    // Le témoin n'utilise pas le choix d'exercice du moteur : il prend le sien,
    // sinon il hériterait de la moitié de la logique qu'il est censé mesurer.
    exercice: null,
  });

  if (politique === "aleatoire") {
    const etat = candidats[Math.floor(suivant() * candidats.length)];
    return commun(etat, (1 + Math.floor(suivant() * 5)) as Difficulte);
  }

  if (politique === "facile") {
    return commun(candidats[Math.floor(suivant() * candidats.length)], 1);
  }

  if (politique === "tourniquet") {
    tourniquet.rang = (tourniquet.rang + 1) % candidats.length;
    return commun(candidats[tourniquet.rang], DIFFICULTE_NEUTRE);
  }

  // « ancien » : jamais pratiquée d'abord, puis la plus lointaine.
  let choisi = candidats[0];
  let pire = Number.POSITIVE_INFINITY;
  for (const etat of candidats) {
    const jour = dernierePratique.get(etat.skill.code) ?? -1;
    if (jour < pire) {
      pire = jour;
      choisi = etat;
    }
  }
  return commun(choisi, DIFFICULTE_NEUTRE);
}

/**
 * L'exercice à servir : celui du moteur, un dormant du catalogue, ou un neuf.
 *
 * La fabrication n'est pas un artifice de simulation : c'est ce que le produit
 * offre quand une compétence n'a plus rien de proposable (« Générer un
 * exercice »). Sans elle, le parcours mesurerait l'épuisement d'un catalogue
 * fixe.
 */
function servirExercice(
  parcours: ReturnType<typeof ouvrir>,
  choix: Choix,
  tentes: Set<string>,
  compteur: { genere: number },
): { exercice: Exercise; genere: boolean } {
  if (choix.exercice) return { exercice: choix.exercice, genere: false };

  const code = choix.etat.skill.code;
  const dormant = parcours.scenario.exercices.find(
    (e) =>
      e.competences[0] === code &&
      e.difficulte === choix.difficulteCible &&
      !tentes.has(e.id),
  );
  if (dormant) return { exercice: dormant, genere: false };

  compteur.genere += 1;
  const exercice = fabriquerExercice(
    choix.etat.skill,
    choix.difficulteCible,
    `généré ${compteur.genere}`,
  );
  etendreReferentiel(parcours, { domaines: [], competences: [], exercices: [exercice] });
  return { exercice, genere: true };
}

export interface OptionsParcoursLong {
  bras?: Bras;
}

export function deroulerParcoursLong(
  monde: MondeFictif = construireMondeFictif(),
  options: OptionsParcoursLong = {},
): ResultatParcoursLong {
  const debutCalcul = Date.now();
  const bras = options.bras ?? BRAS_MOTEUR;
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

  const parcours = ouvrir(scenario, {
    conserverPas: false,
    calibrationActive: bras.calibrationActive,
    reglages: bras.reglages,
  });
  const apprenant = creerApprenant(monde.profil, monde.graine);
  // Trois flux de tirage distincts : décider d'un abandon ou d'une compétence
  // témoin ne doit pas décaler les tirages de réussite, sinon changer un bras
  // changerait le comportement de l'apprenant.
  const tirageAbandon = tirage((monde.graine ^ 0x9e3779b9) >>> 0);
  const tiragePolitique = tirage((monde.graine ^ 0x85ebca6b) >>> 0);

  const resumes: PasResume[] = [];
  const actions: ActionServie[] = [];
  const dernierePratique = new Map<string, number>();
  const tentes = new Set<string>();
  const tourniquet = { rang: -1 };
  const compteur = { genere: 0 };
  const aptitudeInitiale = apprenant.aptitudes(monde.depart);

  let dernier = avancer(
    parcours,
    { type: "attente", date: monde.depart, jours: 0 },
    0,
    "Ouverture du compte — journal vide, aucune mesure",
  );
  resumes.push(
    resumer(dernier, 0, "ouverture", parcours.scenario.exercices.length, aptitudeInitiale),
  );

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
      resumes.push(
        resumer(dernier, jour, "extension", parcours.scenario.exercices.length, apprenant.aptitudes(date)),
      );
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
      resumes.push(
        resumer(dernier, jour, "pause", parcours.scenario.exercices.length, apprenant.aptitudes(date)),
      );
      continue;
    }

    const choix = choisir(
      bras.politique,
      dernier.recommandations,
      dernier.etats,
      tiragePolitique,
      dernierePratique,
      tourniquet,
    );
    if (choix === null) {
      dernier = avancer(
        parcours,
        { type: "attente", date, jours: 0 },
        jour,
        "Aucune compétence à proposer — référentiel vide",
      );
      resumes.push(
        resumer(dernier, jour, "sans-exercice", parcours.scenario.exercices.length, apprenant.aptitudes(date)),
      );
      continue;
    }

    const { exercice, genere } = servirExercice(parcours, choix, tentes, compteur);
    const code = choix.etat.skill.code;
    const aptitude = apprenant.aptitudes(date)[code] ?? null;
    const commun = {
      jour,
      date,
      code,
      exerciceId: exercice.id,
      titre: exercice.titre,
      difficulte: exercice.difficulte,
      difficulteCible: choix.difficulteCible,
      facteur: choix.facteur,
      rang: choix.rang,
      genere,
      niveauEstime: choix.etat.niveau,
      aptitude,
      dureeEstimeeMin: exercice.dureeEstimeeMin,
    };

    if (tirageAbandon() < PART_ABANDONS) {
      const dureeMin = Math.max(2, Math.round(exercice.dureeEstimeeMin * 0.12));
      tentes.add(exercice.id);
      dernier = avancer(
        parcours,
        { type: "tentative-abandonnee", date, exercice: exercice.id, dureeMin },
        jour,
      );
      actions.push({ ...commun, suivie: true, resultat: null, menee: false, dureeMin, indicesUtilises: null });
      resumes.push(
        resumer(dernier, jour, "abandon", parcours.scenario.exercices.length, apprenant.aptitudes(date)),
      );
      continue;
    }

    const jeu = apprenant.jouer({ exercice, etat: choix.etat, date });
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
      resumes.push(
        resumer(dernier, jour, "ignoree", parcours.scenario.exercices.length, apprenant.aptitudes(date)),
      );
      continue;
    }

    tentes.add(exercice.id);
    dernier = avancer(parcours, { ...jeu, type: "tentative", date, exercice: exercice.id }, jour);
    const inscrite = parcours.tentatives.at(-1);
    const menee = inscrite?.statut === "terminee";
    if (menee) dernierePratique.set(code, jour);

    actions.push({
      ...commun,
      suivie: true,
      resultat: jeu.resultat,
      menee,
      dureeMin: jeu.dureeMin,
      indicesUtilises: jeu.indicesUtilises,
    });
    resumes.push(
      resumer(dernier, jour, "tentative", parcours.scenario.exercices.length, apprenant.aptitudes(date)),
    );
  }

  const resultat = clore(parcours);
  const veriteTerrain = apprenant.aptitudes(resumes.at(-1)?.date);

  return {
    monde,
    bras,
    resultat: { ...resultat, veriteTerrain },
    resumes,
    actions,
    veriteTerrain,
    aptitudeInitiale,
    exercicesGeneres: compteur.genere,
    dureeCalculMs: Date.now() - debutCalcul,
  };
}
