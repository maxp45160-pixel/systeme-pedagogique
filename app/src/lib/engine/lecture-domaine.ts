/**
 * La lecture d'un seul domaine — ce que filtre `?domaine=` sur la Progression.
 *
 * La page globale répond à « que toute ma pratique a-t-elle produit ? » ; le
 * filtre répond à « que dit la pratique DE CE domaine ? ». Les deux lectures
 * partagent les mêmes règles : un périmètre porteur **et** rattaché (ADR-081,
 * même prédicat qu'`agregerDomaine`), une fenêtre de veille alignée sur celle
 * des compétences actives (`calculerEtatGlobal`), et une dernière observation
 * toujours SOURCÉE — une date sans origine ne serait qu'une affirmation (P3).
 *
 * ## Ce que ce module refuse
 *
 * Il ne fabrique aucun chiffre : là où rien n'a été observé, il rend zéro
 * observation et `null` — l'écran traduit en « rien encore observé », jamais
 * en « niveau zéro » (P2). Le temps passé n'entre dans aucun champ : les
 * séances ne sont pas attribuables à un domaine, elles restent donc hors de
 * cette lecture au lieu d'y être réparties au doigt mouillé.
 */

import type {
  Domaine,
  DomaineId,
  Exercise,
  ExerciseAttempt,
  Skill,
  SkillObservation,
  SkillState,
} from "@/lib/domain/types";

/**
 * Une compétence mesurée dont la dernière observation sort de cette fenêtre
 * est dite « en veille ». Même seuil que les compétences actives de
 * `calculerEtatGlobal` : deux mots pour une même frontière temporelle.
 */
export const FENETRE_VEILLE_JOURS = 30;

export interface DerniereObservationSourcee {
  /** Date ISO de l'observation la plus récente du domaine. */
  date: string;
  /**
   * `SkillObservation.source.kind` — l'origine vérifiable du journal, pas un
   * libellé composé à l'affichage.
   */
  origine: SkillObservation["source"]["kind"];
}

/**
 * Valide le paramètre d'URL contre les domaines RÉELS du compte.
 *
 * Un identifiant inconnu, vide ou mal orthographié est ignoré proprement —
 * la page retombe sur sa lecture globale au lieu d'afficher un domaine qui
 * n'existe pas ou de lever sur un paramètre bricolé à la main.
 */
export function resoudreFiltreDomaine(
  valeur: string | undefined,
  domaines: readonly Domaine[],
): DomaineId | null {
  if (!valeur) return null;
  return domaines.some((domaine) => domaine.id === valeur) ? valeur : null;
}

/**
 * Les codes de compétence qui informent un domaine : son porteur ET les
 * rattachées (ADR-081) — archivées comprises, pour qu'une observation ancienne
 * reste attributable au domaine qui l'a vue naître.
 */
export function codesDuDomaine(skills: readonly Skill[], domaineId: DomaineId): Set<string> {
  const codes = new Set<string>();
  for (const skill of skills) {
    if (skill.domaine === domaineId || (skill.domainesSecondaires ?? []).includes(domaineId)) {
      codes.add(skill.code);
    }
  }
  return codes;
}

export interface EntreesLectureDomaine {
  domaineId: DomaineId;
  /** Tout le référentiel du compte, archivées comprises (P4). */
  skills: readonly Skill[];
  /** États dérivés du compte — le module ne recalcule rien. */
  etats: readonly SkillState[];
  /** Journal effectif des observations. */
  observations: readonly SkillObservation[];
  exercices: readonly Exercise[];
  tentatives: readonly ExerciseAttempt[];
  now?: Date;
}

export interface LectureDomaine {
  /** États du périmètre — alimente les sections filtrées de la page. */
  etats: SkillState[];
  /** Observations du périmètre — rejouées ensuite par `evolutionScore`. */
  observations: SkillObservation[];
  /**
   * Tentatives dont l'exercice touche le périmètre. Un exercice est gardé dès
   * qu'il mobilise UNE compétence du domaine ; c'est le seul regroupement que
   * les données permettent sans inventer de quote-part.
   */
  tentatives: ExerciseAttempt[];
  /** Compétences du périmètre portant au moins une observation. */
  competencesMesurees: number;
  /**
   * Compétences MESURÉES dont la dernière observation a quitté la fenêtre.
   * Jamais comptées parmi les non mesurées : « en veille » présuppose une
   * preuve passée, l'absence de preuve est une autre ligne d'écran.
   */
  competencesEnVeille: number;
  /** Dernière observation du journal, avec son origine. `null` si rien. */
  derniereObservation: DerniereObservationSourcee | null;
}

export function lectureDomaine(entrees: EntreesLectureDomaine): LectureDomaine {
  const codes = codesDuDomaine(entrees.skills, entrees.domaineId);

  const etats = entrees.etats.filter((etat) => codes.has(etat.skill.code));
  const observations = entrees.observations.filter((observation) =>
    codes.has(observation.skillCode),
  );

  const idsExercicesDuDomaine = new Set(
    entrees.exercices
      .filter((exercice) => exercice.competences.some((code) => codes.has(code)))
      .map((exercice) => exercice.id),
  );
  const tentatives = entrees.tentatives.filter((tentative) =>
    idsExercicesDuDomaine.has(tentative.exerciseId),
  );

  let derniereObservation: DerniereObservationSourcee | null = null;
  for (const observation of observations) {
    if (!derniereObservation || observation.date > derniereObservation.date) {
      derniereObservation = { date: observation.date, origine: observation.source.kind };
    }
  }

  const mesurees = etats.filter((etat) => etat.observations.length > 0);
  const competencesEnVeille = mesurees.filter(
    (etat) =>
      etat.joursDepuisDerniereObservation === null ||
      etat.joursDepuisDerniereObservation > FENETRE_VEILLE_JOURS,
  ).length;

  return {
    etats,
    observations,
    tentatives,
    competencesMesurees: mesurees.length,
    competencesEnVeille,
    derniereObservation,
  };
}
