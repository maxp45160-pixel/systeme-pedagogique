/**
 * Assemble le contexte complet d'une page : données brutes + état dérivé.
 *
 * Point d'entrée unique côté serveur. Chaque page appelle `chargerContexte()`
 * et n'a jamais à savoir d'où viennent les données ni comment les indicateurs
 * sont calculés.
 *
 * Depuis ADR-026 le référentiel fait partie des données lues, et non plus d'un
 * module compilé : c'est ici qu'il entre dans le moteur, exactement comme les
 * preuves. Le moteur, lui, ne connaît toujours aucun référentiel — il reçoit
 * les compétences en paramètre.
 */

import { cache } from "react";
import type { Collections } from "./db";
import { lireTout, dorsaleCompte } from "./db";
import { lireReferentiel } from "./referentiel";
import { EXERCICES_DIAGNOSTIC } from "@/lib/seed/exercises";
import { computeAllSkillStates } from "@/lib/engine/skill-state";
import { calculerEtatGlobal, type EtatGlobal } from "@/lib/engine/progression";
import { recommander, type Recommandation } from "@/lib/engine/recommend";
import { calibrerToutes, type Calibration } from "@/lib/engine/calibration";
import type { Referentiel, SkillState } from "@/lib/domain/types";

export interface Contexte {
  donnees: Collections;
  referentiel: Referentiel;
  etats: SkillState[];
  etatsParCode: Map<string, SkillState>;
  global: EtatGlobal;
  recommandations: Recommandation[];
  /**
   * 3ᵉ maillon de la boucle (ADR-028) : ce que les tentatives passées disent du
   * calibrage du prochain exercice. Dérivé à chaque lecture, jamais stocké.
   */
  calibrations: Map<string, Calibration>;
  now: Date;
}

export const chargerContexte = cache(async (): Promise<Contexte> => {
  const now = new Date();
  const dorsale = await dorsaleCompte();
  const [donneesBrutes, referentiel] = await Promise.all([
    lireTout(),
    lireReferentiel(dorsale),
  ]);

  // Les exercices de diagnostic font partie du logiciel, pas du journal :
  // ils sont toujours disponibles, sans étape d'initialisation.
  //
  // Filtrés sur le périmètre du compte : proposer un exercice sur une
  // compétence qui n'est ni calculée ni affichée produirait une preuve que rien
  // ne lirait. Un compte dont le référentiel est étranger au lot livré — une
  // arborescence de philosophie, par exemple — n'en reçoit aucun, et son
  // amorçage passe entièrement par le tuteur (ADR-004). C'est ce qui rend le
  // dispositif transférable à n'importe quel sujet.
  const idsStockes = new Set(donneesBrutes.exercises.map((e) => e.id));
  const dansLePerimetre = (e: { competences: string[] }) =>
    e.competences.some((c) => referentiel.codesActifs.has(c));
  const donnees: Collections = {
    ...donneesBrutes,
    exercises: [
      ...EXERCICES_DIAGNOSTIC.filter((e) => !idsStockes.has(e.id) && dansLePerimetre(e)),
      ...donneesBrutes.exercises.filter(dansLePerimetre),
    ],
  };

  const etats = computeAllSkillStates(referentiel.actifs, donnees.evidence, now);
  const global = calculerEtatGlobal(etats, now, referentiel.domaines);

  // Calculées AVANT la recommandation : c'est la calibration qui fixe la
  // difficulté visée, donc l'exercice retenu (ADR-028).
  const calibrations = calibrerToutes(etats, donnees.exercises, donnees.attempts);
  const recommandations = recommander(etats, donnees.exercises, donnees.attempts, 6, calibrations);

  return {
    donnees,
    referentiel,
    etats,
    etatsParCode: new Map(etats.map((e) => [e.skill.code, e])),
    global,
    recommandations,
    calibrations,
    now,
  };
});
