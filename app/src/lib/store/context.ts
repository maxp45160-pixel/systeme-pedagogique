/**
 * Assemble le contexte complet d'une page : données brutes + état dérivé.
 *
 * Point d'entrée unique côté serveur. Chaque page appelle `chargerContexte()`
 * et n'a jamais à savoir d'où viennent les données ni comment les indicateurs
 * sont calculés.
 *
 */

import { cache } from "react";
import { CODES_ACTIFS, SKILLS_ACTIFS } from "@/lib/domain/referentiel";
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

export const chargerContexte = cache(async (): Promise<Contexte> => {
  const now = new Date();
  const donneesBrutes = await lireTout();

  // Les exercices de diagnostic font partie du logiciel, pas du journal :
  // ils sont toujours disponibles, sans étape d'initialisation.
  //
  // Filtrés sur le périmètre actif (ADR-018) : proposer un exercice sur une
  // compétence qui n'est plus ni calculée ni affichée produirait une preuve
  // que rien ne lirait.
  const idsStockes = new Set(donneesBrutes.exercises.map((e) => e.id));
  const dansLePerimetre = (e: { competences: string[] }) =>
    e.competences.some((c) => CODES_ACTIFS.has(c));
  const donnees: Collections = {
    ...donneesBrutes,
    exercises: [
      ...EXERCICES_DIAGNOSTIC.filter((e) => !idsStockes.has(e.id) && dansLePerimetre(e)),
      ...donneesBrutes.exercises.filter(dansLePerimetre),
    ],
  };

  const etats = computeAllSkillStates(SKILLS_ACTIFS, donnees.evidence, now);
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
});
