import type { Recommandation } from "./recommend";
import { recommendLearningAction } from "./action-recommendation";
import { idDocumentDepuisActivite } from "@/lib/domain/adaptive-learning";
import type { SkillState } from "@/lib/domain/types";
import type {
  ActivityEvent,
  ActivityGenerationRequest,
  ActivityRun,
  LearningActivity,
  LearningGoal,
  LearningPreference,
  MentalCapacity,
  RecommendationFactor,
  RecommendedLearningAction,
  WorkspaceTool,
} from "@/lib/domain/adaptive-learning";

/**
 * Le pont entre le moteur historique et le moteur d'action (ADR-066).
 *
 * Le classement des compétences reste produit par `recommander()` : ce fichier
 * ne le recalcule pas, il le **reçoit**. Ce que le moteur d'action ajoute, et
 * qui manquait, c'est l'arbitrage à l'instant T — le temps réellement
 * disponible et la capacité mentale déclarée — et la possibilité qu'une action
 * ne soit pas un exercice.
 *
 * La sortie est volontairement pauvre : soit une file de recommandations
 * réordonnée (l'interface existante sait déjà l'afficher), soit une action
 * d'une autre famille. Aucun nouvel écran n'en découle.
 */

/**
 * Ce que la personne déclare de son instant. Ces valeurs ne sont pas
 * persistées et ne deviennent jamais un trait de profil : elles décrivent
 * maintenant, pas quelqu'un.
 */
export interface ContexteInstant {
  tempsMin: number;
  capacite: MentalCapacity;
}

export const TEMPS_PAR_DEFAUT_MIN = 25;
export const CAPACITE_PAR_DEFAUT: MentalCapacity = "standard";

export const LIBELLES_FAMILLE = {
  explorer: "Explorer",
  entrainer: "S'entraîner",
  produire: "Produire",
} as const;

/**
 * Lit le contexte d'instant depuis l'URL. Une valeur absente ou aberrante
 * retombe sur le défaut : un paramètre bricolé à la main ne doit pas produire
 * une recommandation fabriquée à partir d'une donnée invalide.
 */
export function lireContexteInstant(valeurs: {
  temps?: string;
  capacite?: string;
}): ContexteInstant {
  const temps = Number(valeurs.temps);
  return {
    tempsMin: Number.isFinite(temps) && temps >= 5 && temps <= 480
      ? Math.round(temps)
      : TEMPS_PAR_DEFAUT_MIN,
    capacite: valeurs.capacite === "faible" || valeurs.capacite === "elevee"
      ? valeurs.capacite
      : CAPACITE_PAR_DEFAUT,
  };
}

export interface EntreesActionUnifiee {
  accountId: string;
  instant: ContexteInstant;
  declaredAt: string;
  /** File produite par `recommander()`, du premier au dernier. */
  recommandations: readonly Recommandation[];
  /** Classement de compétences déjà calculé, aligné sur la file ci-dessus. */
  rankedSkillStates: readonly SkillState[];
  activities: readonly LearningActivity[];
  openRuns: readonly ActivityRun[];
  historicalRuns?: readonly ActivityRun[];
  generationRequests?: readonly ActivityGenerationRequest[];
  goals?: readonly LearningGoal[];
  events?: readonly ActivityEvent[];
  preferences?: readonly LearningPreference[];
  availableTools?: readonly WorkspaceTool[];
}

export type ActionUnifiee =
  | {
    kind: "exercice";
    /** La file existante, l'action retenue en tête. */
    recommandations: Recommandation[];
    facteurs: RecommendationFactor[];
    reserves: string[];
  }
  | {
    kind: "note";
    /** Identifiant de la fiche, pour ouvrir son espace de travail. */
    noteId: string;
    action: RecommendedLearningAction;
    facteurs: RecommendationFactor[];
    reserves: string[];
  }
  | {
    kind: "activite";
    action: RecommendedLearningAction;
    facteurs: RecommendationFactor[];
    reserves: string[];
  };

const OUTILS_PAR_DEFAUT: readonly WorkspaceTool[] = [
  "annotations",
  "ressources",
  "indices",
  "tuteur",
  "editeur-markdown",
  "fichiers",
  "liens",
  "calculatrice",
];

const PREFIXE_EXERCICE = "legacy-exercise:";

function identifiantExercice(action: RecommendedLearningAction): string | null {
  return action.activityId?.startsWith(PREFIXE_EXERCICE)
    ? action.activityId.slice(PREFIXE_EXERCICE.length)
    : null;
}

/**
 * Remonte de l'action choisie vers la recommandation historique qui la porte.
 *
 * Deux passes, dans cet ordre : l'exercice exact, puis à défaut la compétence
 * visée. La seconde couvre le cas où l'exercice a disparu de la file entre le
 * classement et l'arbitrage — la compétence, elle, y est toujours.
 */
function remettreEnTete(
  action: RecommendedLearningAction,
  recommandations: readonly Recommandation[],
): Recommandation[] | null {
  const exerciceId = identifiantExercice(action);
  const index = exerciceId !== null
    ? recommandations.findIndex((r) => r.exercice?.id === exerciceId)
    : -1;
  const parCompetence = index !== -1
    ? index
    : recommandations.findIndex((r) => action.target.skillCodes.includes(r.etat.skill.code));
  if (parCompetence === -1) return null;
  const retenue = recommandations[parCompetence];
  return [retenue, ...recommandations.filter((_, i) => i !== parCompetence)];
}

/**
 * Arbitre l'action à proposer maintenant.
 *
 * Ne renvoie jamais `null` tant qu'il existe au moins une recommandation :
 * quand rien ne tient dans le temps déclaré, la file habituelle est rendue
 * telle quelle, accompagnée de la réserve qui le dit. Une carte vide serait un
 * mensonge par omission — il existe des actions, elles sont juste trop longues.
 */
export function choisirActionUnifiee(entrees: EntreesActionUnifiee): ActionUnifiee | null {
  const recommandations = [...entrees.recommandations];
  const proposition = recommendLearningAction({
    context: {
      accountId: entrees.accountId,
      availableTimeMinutes: entrees.instant.tempsMin,
      mentalCapacity: entrees.instant.capacite,
      intent: "systeme",
      declaredAt: entrees.declaredAt,
    },
    activities: entrees.activities,
    openRuns: entrees.openRuns,
    historicalRuns: entrees.historicalRuns ?? [],
    generationRequests: entrees.generationRequests ?? [],
    goals: entrees.goals ?? [],
    rankedSkillStates: entrees.rankedSkillStates,
    events: entrees.events ?? [],
    sequencingSignals: [],
    preferences: entrees.preferences ?? [],
    availableTools: entrees.availableTools ?? OUTILS_PAR_DEFAUT,
  });

  if (!proposition) {
    if (recommandations.length === 0) return null;
    return {
      kind: "exercice",
      recommandations,
      facteurs: [],
      reserves: [
        `Aucune action ne tient dans ${entrees.instant.tempsMin} min : voici la file habituelle, sans arbitrage sur le temps.`,
      ],
    };
  }

  const action = proposition.primary;

  /*
   * La note passe avant la branche exercice.
   *
   * Une note de séance appartient à la famille « entrainer » : sans ce test en
   * premier, elle serait remise en tête de la file d'exercices et l'écran
   * proposerait un exercice là où la personne a engagé une séance. Le préfixe
   * de l'identifiant est le seul discriminant fiable — la famille ne dit pas de
   * quelle nature est le candidat.
   */
  const noteId = action.activityId ? idDocumentDepuisActivite(action.activityId) : null;
  if (noteId) {
    return { kind: "note", noteId, action, facteurs: action.factors, reserves: action.reservations };
  }

  if (identifiantExercice(action) !== null || action.family === "entrainer") {
    const reordonnee = remettreEnTete(action, recommandations);
    if (reordonnee) {
      return {
        kind: "exercice",
        recommandations: reordonnee,
        facteurs: action.factors,
        reserves: action.reservations,
      };
    }
  }

  return {
    kind: "activite",
    action,
    facteurs: action.factors,
    reserves: action.reservations,
  };
}
