/**
 * La lecture longitudinale d'un domaine, précalculée pour la vue domaine de
 * l'Atelier (mode « Progression »).
 *
 * Il y avait deux surfaces pour la même question — « où j'en suis dans ce
 * domaine » : `/progression?domaine=` et la vue domaine de l'Atelier. Le
 * doublon est retiré : ce module produit, en une passe serveur, exactement ce
 * que `VueParDomaine` calculait — mêmes fonctions pures (`lectureDomaine`,
 * `agregerDomaine`, `evolutionScore`, `resumeCarriere`, `resumeCroissance`),
 * même périmètre porteur **et** rattaché (ADR-081) — et l'Atelier le rend.
 * `/progression?domaine=` redirige désormais vers cette vue.
 *
 * ## Contrat de sérialisation
 *
 * Le résultat traverse la frontière RSC vers un composant client : tout champ
 * est un plat JSON-serializable — dates en ISO déjà portées par le journal,
 * aucune `Date`, aucun `Map`, aucune fonction. C'est ce qui permet à la vue
 * de recevoir les props précalculées sans recopier le calcul.
 *
 * ## Coût
 *
 * Une passe par domaine du référentiel, à chaque requête Atelier : quelques
 * domaines, fonctions linéaires sur le journal — négligeable devant le reste
 * de la page (arbres, graphe). À surveiller seulement si un compte cumule
 * beaucoup de domaines et un très long journal.
 */

import type {
  Domaine,
  Exercise,
  ExerciseAttempt,
  Referentiel,
  SkillObservation,
  SkillState,
} from "@/lib/domain/types";
import { agregerDomaine, calculerEtatGlobal, type EtatGlobal } from "@/lib/engine/progression";
import { lectureDomaine, type DerniereObservationSourcee } from "@/lib/engine/lecture-domaine";
import { evolutionScore, type EvolutionScore } from "@/lib/engine/evolution";
import { resumeCarriere, type Carriere } from "@/lib/engine/carriere";
import { resumeCroissance, type ResumeCroissance } from "@/lib/engine/croissance";

/** Tout ce que la vue « Progression » d'un domaine affiche, précalculé. */
export interface ProgressionDomaineVue {
  domaine: Domaine;
  /** Score pondéré du domaine — `null` tant qu'aucune compétence n'est mesurée. */
  score: number | null;
  competencesMesurees: number;
  /** Compétences mesurées dont la dernière observation a quitté la fenêtre. */
  competencesEnVeille: number;
  observationsTotal: number;
  derniereObservation: DerniereObservationSourcee | null;
  /** États du périmètre — alimente le trio des plus travaillées. */
  etats: SkillState[];
  /** Rejeu du journal restreint au domaine : courbe, variation 7 j, faits. */
  evolution: EvolutionScore;
  carriere: Carriere;
  global: EtatGlobal;
  croissance: ResumeCroissance;
  /** Intitulés par code — nomme les compétences citées par le bilan. */
  intitules: Record<string, string>;
}

export interface EntreesProgressionsDomaines {
  referentiel: Referentiel;
  etats: readonly SkillState[];
  observations: readonly SkillObservation[];
  exercices: readonly Exercise[];
  tentatives: readonly ExerciseAttempt[];
  dureesEstimees?: ReadonlyMap<string, number>;
  now?: Date;
}

/**
 * La lecture de CHAQUE domaine du référentiel, indexée par identifiant.
 *
 * Les domaines archivés sont inclus : leurs traces restent lisibles là où
 * elles ont été portées (P4), et leur fiche Atelier porte le même lien.
 */
export function construireProgressionsDomaines(
  entrees: EntreesProgressionsDomaines,
): Record<string, ProgressionDomaineVue> {
  const now = entrees.now ?? new Date();
  const { referentiel } = entrees;
  const intitules = Object.fromEntries(
    referentiel.skills.map((skill) => [skill.code, skill.intitule]),
  );

  const resultat: Record<string, ProgressionDomaineVue> = {};
  for (const domaine of referentiel.domaines) {
    // Même découpage que VueParDomaine : périmètre porteur ET rattaché,
    // tentatives attribuées dès qu'un exercice touche UNE compétence.
    const lecture = lectureDomaine({
      domaineId: domaine.id,
      skills: referentiel.skills,
      etats: entrees.etats,
      observations: entrees.observations,
      exercices: entrees.exercices,
      tentatives: entrees.tentatives,
      now,
    });

    const agregat = agregerDomaine(domaine.id, [...entrees.etats], referentiel.domaines);
    const evolution = evolutionScore({
      observations: lecture.observations,
      skillsParCode: referentiel.parCode,
      now,
    });
    const global = calculerEtatGlobal(lecture.etats, now, referentiel.domaines);
    /*
     * Les séances ne sont pas attribuables à un domaine : elles sortent de la
     * carrière et du bilan filtrés — comme sur `/progression?domaine=`.
     */
    const carriere = resumeCarriere({
      sessions: [],
      tentatives: lecture.tentatives,
      observations: lecture.observations,
      now,
    });
    const croissance = resumeCroissance({
      sessions: [],
      tentatives: lecture.tentatives,
      observations: lecture.observations,
      skillsParCode: referentiel.parCode,
      dureesEstimees: entrees.dureesEstimees,
      now,
      limiteEvenements: 8,
    });

    resultat[domaine.id] = {
      domaine,
      score: agregat.score,
      competencesMesurees: lecture.competencesMesurees,
      competencesEnVeille: lecture.competencesEnVeille,
      observationsTotal: lecture.observations.length,
      derniereObservation: lecture.derniereObservation,
      etats: lecture.etats,
      evolution,
      carriere,
      global,
      croissance,
      intitules,
    };
  }
  return resultat;
}
