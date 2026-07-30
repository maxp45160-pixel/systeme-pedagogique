/**
 * Assemble le contexte complet d'une page : données brutes + état dérivé.
 *
 * Point d'entrée unique côté serveur. Chaque page appelle `chargerContexte()`
 * et n'a jamais à savoir d'où viennent les données ni comment les indicateurs
 * sont calculés.
 *
 * ── Cache mémoire ──────────────────────────────────────────────────────
 *
 * Les données changent rarement (une écriture pour ~50 navigations) mais
 * étaient rechargées intégralement + recalculées à chaque changement de
 * page (5 requêtes Supabase + calcul des 43 compétences).
 *
 * Un cache mémoire par userId élimine le coût de la lecture et du calcul
 * pour les navigations successives. Il est invalidé explicitement par
 * chaque Server Action qui écrit, et expire automatiquement après TTL
 * secondes pour ne jamais servir de données périmées.
 */

import { CODES_ACTIFS, SKILLS_ACTIFS } from "@/lib/domain/referentiel";
import type {
  Collections,
} from "./db";
import { dorsaleCompte, lire } from "./db";
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

/* ------------------------------------------------------------------ */
/* Cache mémoire                                                       */
/* ------------------------------------------------------------------ */

/**
 * Durée de vie du cache en millisecondes. Garde-fou : même sans invalidation
 * explicite, le cache expire pour ne jamais servir de données trop anciennes
 * (autre onglet, import externe, etc.).
 */
const TTL_MS = 30_000;

interface EntreeCache {
  contexte: Contexte;
  timestamp: number;
}

/**
 * Cache en mémoire du processus Node, indexé par userId.
 *
 * Un seul utilisateur en pratique, mais la clé par userId est correcte
 * si le système évolue vers du multi-utilisateur.
 */
const cache = new Map<string, EntreeCache>();

/**
 * Invalide le cache du contexte.
 *
 * À appeler depuis chaque Server Action qui écrit des données (preuves,
 * exercices, sessions, etc.). La prochaine navigation rechargera les
 * données fraîches depuis Supabase.
 */
export function invaliderCacheContexte(): void {
  cache.clear();
}

/* ------------------------------------------------------------------ */
/* Chargement (avec cache)                                             */
/* ------------------------------------------------------------------ */

export async function chargerContexte(): Promise<Contexte> {
  const dorsale = await dorsaleCompte();
  const userId = dorsale.userId;

  // Cache hit ?
  const entree = cache.get(userId);
  if (entree && Date.now() - entree.timestamp < TTL_MS) {
    entree.timestamp = Date.now();
    return entree.contexte;
  }

  // Cache miss : chargement complet depuis Supabase.
  const now = new Date();

  const [user, evidence, exercises, attempts, sessions] = await Promise.all([
    lire("user", dorsale),
    lire("evidence", dorsale),
    lire("exercises", dorsale),
    lire("attempts", dorsale),
    lire("sessions", dorsale),
  ]);
  const donneesBrutes: Collections = { user, evidence, exercises, attempts, sessions };

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

  const contexte: Contexte = {
    donnees,
    etats,
    etatsParCode: new Map(etats.map((e) => [e.skill.code, e])),
    global,
    recommandations,
    now,
  };

  // Stocker en cache.
  cache.set(userId, { contexte, timestamp: Date.now() });

  return contexte;
}
