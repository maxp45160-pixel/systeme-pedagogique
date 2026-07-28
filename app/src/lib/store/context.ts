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
import { calculerNiveau, deriverBadges, deriverXP, totalXP, type BadgeObtenu, type EtatNiveau } from "@/lib/engine/xp";
import { recommander, type Recommandation } from "@/lib/engine/recommend";
import type { SkillState, XPEvent } from "@/lib/domain/types";

export interface Contexte {
  donnees: Collections;
  etats: SkillState[];
  etatsParCode: Map<string, SkillState>;
  global: EtatGlobal;
  xpEvents: XPEvent[];
  xp: EtatNiveau;
  badges: BadgeObtenu[];
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

  const erreursParSkill = new Map<string, string[]>();
  for (const err of donnees.errors) {
    if (err.archivee) continue;
    for (const code of err.skillCodes) {
      erreursParSkill.set(code, [...(erreursParSkill.get(code) ?? []), err.id]);
    }
  }

  const etats = computeAllSkillStates(SKILLS, donnees.evidence, erreursParSkill, now);
  const global = calculerEtatGlobal(etats, now);

  const xpEvents = deriverXP(donnees.evidence, donnees.exercises, donnees.projects);
  const xp = calculerNiveau(totalXP(xpEvents));

  const erreursCorrigees = donnees.errors
    .filter((e) => e.statut === "corrigee" || e.statut === "consolidee")
    .map((e) => ({
      id: e.id,
      concept: e.concept,
      date: e.occurrences.at(-1)?.date ?? now.toISOString(),
    }));
  const badges = deriverBadges(donnees.evidence, donnees.projects, erreursCorrigees);

  const recommandations = recommander(
    etats,
    donnees.exercises,
    donnees.attempts,
    donnees.errors,
    6,
  );

  return {
    donnees,
    etats,
    etatsParCode: new Map(etats.map((e) => [e.skill.code, e])),
    global,
    xpEvents,
    xp,
    badges,
    recommandations,
    now,
  };
}
