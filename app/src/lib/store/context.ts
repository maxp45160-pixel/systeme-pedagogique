/**
 * Assemble le contexte complet d'une page : données brutes + état dérivé.
 *
 * Point d'entrée unique côté serveur. Chaque page appelle `chargerContexte()`
 * et n'a jamais à savoir d'où viennent les données ni comment les indicateurs
 * sont calculés.
 *
 */

import { SKILLS } from "@/lib/domain/referentiel";
import type {
  Collections,
} from "./db";
import { lireTout } from "./db";
import { EXERCICES_DIAGNOSTIC } from "@/lib/seed/exercises";
import { computeAllSkillStates } from "@/lib/engine/skill-state";
import { calculerEtatGlobal, type EtatGlobal } from "@/lib/engine/progression";
import { recommander, type Recommandation } from "@/lib/engine/recommend";
import type { SkillState } from "@/lib/domain/types";

export interface Contexte {
  donnees: Collections;
  etats: SkillState[];
  etatsParCode: Map<string, SkillState>;
  global: EtatGlobal;
  recommandations: Recommandation[];
  now: Date;
}

export async function chargerContexte(): Promise<Contexte> {
  const now = new Date();
  const donneesBrutes = await lireTout();

  // Les exercices de diagnostic font partie du logiciel, pas du journal :
  // ils sont toujours disponibles, sans étape d'initialisation.
  const idsStockes = new Set(donneesBrutes.exercises.map((e) => e.id));
  const donnees: Collections = {
    ...donneesBrutes,
    exercises: [
      ...EXERCICES_DIAGNOSTIC.filter((e) => !idsStockes.has(e.id)),
      ...donneesBrutes.exercises,
    ],
  };

  const etats = computeAllSkillStates(SKILLS, donnees.evidence, now);
  const global = calculerEtatGlobal(etats, now);

  const recommandations = recommander(etats, donnees.exercises, donnees.attempts, 6);

  return {
    donnees,
    etats,
    etatsParCode: new Map(etats.map((e) => [e.skill.code, e])),
    global,
    recommandations,
    now,
  };
}
