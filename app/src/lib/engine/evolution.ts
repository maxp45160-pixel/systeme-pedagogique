/**
 * L'évolution du score global, rejouée depuis le journal.
 *
 * Aucune progression n'est stockée (ADR-001) : la courbe se recalcule en
 * rejouant les observations dans l'ordre chronologique et en recomposant le
 * score global — la même formule que `calculerEtatGlobal` — après chacune.
 * Une courbe affichée ne peut donc pas diverger du journal qui la produit.
 *
 * ## La même convention de rejeu qu'`evenementsRecents`
 *
 * Chaque état intermédiaire est calculé avec le `now` d'aujourd'hui : les
 * règles de récence et de confiance sont celles du présent, pas celles de la
 * date rejouée. C'est exactement ce que fait déjà `evenementsRecents` pour les
 * niveaux avant/après ; en dévier ici créerait deux lectures du passé dans un
 * même écran. La conséquence assumée : une observation ancienne pèse moins
 * aujourd'hui qu'elle ne l'a pesé le jour où la courbe l'a traversée, et le
 * dernier point peut donc différer légèrement du point courant recalculé à
 * la minute près par `calculerEtatGlobal`. Le héros affiche celui-là ;
 * la courbe dit la trajectoire.
 *
 * ## Ce que ce module ajoute au calcul existant — et ce qu'il n'invente pas
 *
 * Les « faits marquants » (paliers franchis, premières mesures) sont des
 ** comptages d'événements déjà écrits** dans le journal. La conversion
 * parlante (`qualificatifScore`) est une lecture du score, pas une seconde
 * mesure : elle ne crée ni XP, ni rang, ni palier nommé qui monterait avec le
 * temps passé (ADR-017). Sa seule matière est le score lui-même.
 */

import type { Skill, SkillObservation } from "@/lib/domain/types";
import { computeSkillState } from "./skill-state";
import { joursDepuis } from "./dates";

export interface PointEvolution {
  /** Date ISO de l'observation qui a déplacé le score. */
  date: string;
  /** Score global /100 après cette observation. Toujours non nul : la courbe commence à la première mesure. */
  score: number;
}

export interface EvolutionScore {
  /**
   * Points chronologiques où le score global a changé de valeur. Le premier
   * est la première évaluation ; le dernier doit coïncider avec le score
   * courant, à la règle de récence près (voir l'en-tête du module).
   */
  points: PointEvolution[];
  /**
   * Score actuel moins score il y a au moins 7 jours. `null` tant qu'on ne
   * peut pas comparer deux mesures distantes d'une semaine — pas zéro, qui
   * prétendrait une stabilité jamais observée.
   */
  variation7j: number | null;
  /** Montées strictes de niveau sur toute l'histoire. Une première mesure n'en est pas une. */
  franchissementsTotal: number;
  /** Compétences mesurées pour la première fois, sur toute l'histoire. */
  premieresMesuresTotal: number;
}

export interface EntreesEvolution {
  observations: readonly SkillObservation[];
  /** Tout le référentiel, archivées comprises — même contrat qu'`evenementsRecents` (P4). */
  skillsParCode: ReadonlyMap<string, Skill>;
  now?: Date;
}

/** Au-delà, on résample : un SVG de dix mille points ne dit rien de plus. */
const POINTS_MAX = 120;

export function evolutionScore(entrees: EntreesEvolution): EvolutionScore {
  const now = entrees.now ?? new Date();
  const triees = [...entrees.observations].sort((a, b) => a.date.localeCompare(b.date));

  // Même regroupement qu'`evenementsRecents` : le rang de chaque observation
  // dans l'historique de SA compétence, pour ne recalculer que ce qui change.
  const parCode = new Map<string, SkillObservation[]>();
  const rangDansSaCompetence = new Array<number>(triees.length);
  for (let i = 0; i < triees.length; i++) {
    const historique = parCode.get(triees[i].skillCode);
    if (historique) {
      rangDansSaCompetence[i] = historique.length;
      historique.push(triees[i]);
    } else {
      rangDansSaCompetence[i] = 0;
      parCode.set(triees[i].skillCode, [triees[i]]);
    }
  }

  /*
   * Somme courante du numérateur et du dénominateur du score global
   * (ADR-006 : compétences mesurées seulement). Chaque observation ne touche
   * que la contribution de SA compétence — on retire l'ancienne, on pose la
   * nouvelle — là où recalculer `calculerEtatGlobal` entier rejouerait tout
   * le référentiel à chaque ligne du journal.
   */
  const contributionParCode = new Map<string, { poids: number; acquis: number; compte: boolean }>();
  let poidsTotal = 0;
  let acquisTotal = 0;

  const points: PointEvolution[] = [];
  let franchissements = 0;
  let premieresMesures = 0;

  for (let i = 0; i < triees.length; i++) {
    const observation = triees[i];
    const skill = entrees.skillsParCode.get(observation.skillCode);
    // Observation hors référentiel : impossible en base depuis ADR-027,
    // gardée impossible ici pour les journaux importés et les tests.
    if (!skill) continue;

    const historique = parCode.get(observation.skillCode)!;
    const rang = rangDansSaCompetence[i];
    const avant = computeSkillState(skill, historique.slice(0, rang), now);
    const apres = computeSkillState(skill, historique.slice(0, rang + 1), now);

    if (avant.niveau !== null && apres.niveau !== null && apres.niveau > avant.niveau) {
      franchissements += 1;
    }
    if (avant.niveau === null && apres.niveau !== null) {
      premieresMesures += 1;
    }

    const contribution = contributionParCode.get(observation.skillCode) ?? {
      poids: 0,
      acquis: 0,
      compte: false,
    };
    if (contribution.compte) {
      poidsTotal -= contribution.poids;
      acquisTotal -= contribution.acquis;
      contribution.compte = false;
    }
    if (apres.statut === "evalue" && apres.score !== null) {
      contribution.poids = skill.importance;
      contribution.acquis = skill.importance * (apres.score / 5);
      poidsTotal += contribution.poids;
      acquisTotal += contribution.acquis;
      contribution.compte = true;
    }
    contributionParCode.set(observation.skillCode, contribution);

    const score = poidsTotal > 0 ? Math.round((acquisTotal / poidsTotal) * 100) : null;
    if (score !== null && (points.length === 0 || points[points.length - 1].score !== score)) {
      points.push({ date: observation.date, score });
    }
  }

  // Résample défensif : garder les extrémités et un pas régulier entre elles.
  let pointsAffiches = points;
  if (points.length > POINTS_MAX) {
    const pas = Math.ceil(points.length / POINTS_MAX);
    pointsAffiches = points.filter(
      (_, index) => index % pas === 0 || index === points.length - 1,
    );
  }

  const dernier = pointsAffiches[pointsAffiches.length - 1];
  let reference: PointEvolution | undefined;
  for (const point of pointsAffiches) {
    if (joursDepuis(point.date, now) >= 7) reference = point;
    else break;
  }
  const variation7j =
    dernier !== undefined && reference !== undefined ? dernier.score - reference.score : null;

  return {
    points: pointsAffiches,
    variation7j,
    franchissementsTotal: franchissements,
    premieresMesuresTotal: premieresMesures,
  };
}

/* ------------------------------------------------------------------ */
/* Conversion parlante du score                                        */
/* ------------------------------------------------------------------ */

/**
 * Le score dit « en lecture directe », sans créer une seconde mesure.
 *
 * Trois qualificatifs, deux seuils d'affichage — pas des paliers de
 * progression : rien ne s'accumule, rien ne se débloque, et relire la même
 * donnée donne toujours le même mot. Un score de 10 après trois jours de
 * travail sérieux se lit « En construction », qui est une information, pas un
 * verdict (ADR-006, P2).
 *
 * Les seuils vivent ici et nulle part ailleurs ; les changer est une décision
 * d'affichage, documentée comme telle — pas une calibration du moteur.
 */
export function qualificatifScore(score: number): string {
  if (score >= 70) return "Solide";
  if (score >= 40) return "En consolidation";
  return "En construction";
}
