/**
 * L'histoire d'une compétence, et son voisinage.
 *
 * ## Ce qui manquait à la fiche
 *
 * La fiche compétence affichait un « Historique récent » plat : un contexte,
 * une date, un type. Elle disait *qu'il s'était passé quelque chose*, jamais
 * *ce que cela avait changé* — alors que le niveau d'avant chaque preuve est
 * calculable, et l'est déjà ailleurs (`evenementsRecents`, `impactTentative`).
 *
 * Elle listait aussi les prérequis et les compétences suivantes, deux relations
 * **déclarées** que 17 compétences sur 77 portent. Rien ne disait ce que
 * l'activité, elle, avait relié : les compétences réellement travaillées
 * ensemble. Cette donnée existe depuis toujours — un exercice porte plusieurs
 * codes, une preuve porte ses `competencesCombinees` — et n'avait aucun
 * consommateur.
 *
 * ## Ce que ce module refuse de faire
 *
 * Il ne **crée** aucune relation. Une co-mobilisation est un fait observé : ces
 * deux compétences ont été mises en jeu par le même travail, tant de fois. Ce
 * n'est ni une proximité sémantique, ni un prérequis deviné, ni une arête
 * inventée pour remplir un graphe (ADR-056 : « aucune arête fabriquée »).
 *
 * Rien n'est stocké : tout se rejoue depuis le journal (P1).
 */

import type {
  Autonomie,
  Exercise,
  NiveauCompetence,
  Skill,
  SkillEvidence,
} from "@/lib/domain/types";
import { computeSkillState } from "./skill-state";

export interface EtapeParcours {
  preuveId: string;
  date: string;
  contexte: string;
  type: SkillEvidence["type"];
  resultat: SkillEvidence["resultat"];
  autonomie: Autonomie;
  niveauAvant: NiveauCompetence | null;
  niveauApres: NiveauCompetence | null;
  /** Monte d'un palier. Ni une première mesure, ni un recul. */
  progression: boolean;
  /** La compétence n'avait aucun niveau avant cette preuve. */
  premiereMesure: boolean;
  /** Le niveau a reculé — un fait, pas une faute (P4 : une faiblesse ne disparaît pas seule). */
  recul: boolean;
  /** Cette preuve inaugure un contexte que la compétence n'avait pas encore. */
  nouveauContexte: boolean;
}

/**
 * Le parcours d'une compétence, du plus récent au plus ancien.
 *
 * Chaque étape porte le niveau **d'avant** et **d'après** sa preuve, obtenus en
 * rejouant l'historique tronqué. `computeSkillState` filtre déjà sur
 * `skillCode` : l'historique coupé au rang d'une preuve est exactement l'état
 * qui précédait — c'est ce qui rend le rejeu exact plutôt qu'approché.
 *
 * `limite` borne le coût : deux `computeSkillState` par étape rendue.
 */
export function parcoursCompetence(
  skill: Skill,
  preuves: readonly SkillEvidence[],
  now: Date = new Date(),
  limite = 12,
): EtapeParcours[] {
  const historique = preuves
    .filter((preuve) => preuve.skillCode === skill.code)
    .sort((a, b) => a.date.localeCompare(b.date));

  const etapes: EtapeParcours[] = [];
  const depart = Math.max(0, historique.length - limite);

  for (let rang = historique.length - 1; rang >= depart; rang--) {
    const preuve = historique[rang];
    const avant = computeSkillState(skill, historique.slice(0, rang), now);
    const apres = computeSkillState(skill, historique.slice(0, rang + 1), now);

    etapes.push({
      preuveId: preuve.id,
      date: preuve.date,
      contexte: preuve.contexte,
      type: preuve.type,
      resultat: preuve.resultat,
      autonomie: preuve.autonomie,
      niveauAvant: avant.niveau,
      niveauApres: apres.niveau,
      progression:
        avant.niveau !== null && apres.niveau !== null && apres.niveau > avant.niveau,
      premiereMesure: avant.niveau === null && apres.niveau !== null,
      recul: avant.niveau !== null && apres.niveau !== null && apres.niveau < avant.niveau,
      nouveauContexte: !avant.contextesTestes.includes(preuve.contexte),
    });
  }

  return etapes;
}

export type RelationCompetence = "prerequis" | "suivante" | "co-mobilisee";

export interface CompetenceConnexe {
  code: string;
  intitule: string;
  relation: RelationCompetence;
  /** Nombre de travaux qui ont mis les deux en jeu. Absent hors co-mobilisation. */
  occurrences?: number;
  /** Vrai si la compétence porte au moins une preuve — « déjà connue ». */
  dejaMesuree: boolean;
}

export interface EntreesConnexes {
  skill: Skill;
  /** Le référentiel de travail : on ne propose pas d'aller vers une archivée. */
  actifs: readonly Skill[];
  skillsParCode: ReadonlyMap<string, Skill>;
  exercices: readonly Exercise[];
  /** Le journal complet — sert à compter les co-mobilisations et à dire ce qui est mesuré. */
  preuves: readonly SkillEvidence[];
  /** Nombre maximum de co-mobilisées rendues. */
  limiteCoMobilisees?: number;
}

/**
 * Le voisinage d'une compétence : ce qui est déclaré, puis ce qui est observé.
 *
 * Les prérequis et les suivantes viennent du référentiel — des liens que
 * quelqu'un a posés. Les co-mobilisées viennent du travail : deux compétences
 * visées par le même exercice, ou nommées ensemble sur une même preuve.
 *
 * Une compétence déjà déclarée prérequis ou suivante n'est pas répétée en
 * co-mobilisée : la relation déclarée est plus précise, et deux entrées pour un
 * même voisin feraient croire à deux liens.
 */
export function competencesConnexes(entrees: EntreesConnexes): CompetenceConnexe[] {
  const { skill, actifs, skillsParCode, exercices, preuves } = entrees;
  const limite = entrees.limiteCoMobilisees ?? 6;

  const mesurees = new Set(preuves.map((preuve) => preuve.skillCode));
  const resoudre = (code: string, relation: RelationCompetence, occurrences?: number): CompetenceConnexe | null => {
    const cible = skillsParCode.get(code);
    if (!cible) return null;
    return {
      code,
      intitule: cible.intitule,
      relation,
      ...(occurrences === undefined ? {} : { occurrences }),
      dejaMesuree: mesurees.has(code),
    };
  };

  const declarees: CompetenceConnexe[] = [
    ...skill.prerequis.flatMap((code) => resoudre(code, "prerequis") ?? []),
    ...actifs
      .filter((candidat) => candidat.prerequis.includes(skill.code))
      .flatMap((candidat) => resoudre(candidat.code, "suivante") ?? []),
  ];
  const dejaCitees = new Set([skill.code, ...declarees.map((item) => item.code)]);

  /*
   * Deux sources d'observation, comptées ensemble.
   *
   * Un exercice qui vise trois compétences les met en jeu dans le même travail,
   * qu'une preuve l'ait ou non enregistré. `competencesCombinees` couvre le cas
   * inverse — une preuve qui nomme des compétences absentes de l'énoncé.
   */
  const occurrences = new Map<string, number>();
  const compter = (code: string) => {
    if (dejaCitees.has(code)) return;
    occurrences.set(code, (occurrences.get(code) ?? 0) + 1);
  };

  for (const exercice of exercices) {
    if (exercice.archive || !exercice.competences.includes(skill.code)) continue;
    for (const code of exercice.competences) compter(code);
  }
  for (const preuve of preuves) {
    if (preuve.skillCode !== skill.code) continue;
    for (const code of preuve.competencesCombinees ?? []) compter(code);
  }

  const coMobilisees = [...occurrences.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limite)
    .flatMap(([code, total]) => resoudre(code, "co-mobilisee", total) ?? []);

  return [...declarees, ...coMobilisees];
}
