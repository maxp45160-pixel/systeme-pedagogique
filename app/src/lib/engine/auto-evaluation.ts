/**
 * Le moteur se relit — ADR-085.
 *
 * ## Ce que ce module fait, et surtout ce qu'il ne fait pas
 *
 * Il rejoue les prédictions inscrites (ADR-084) contre les faits qui les
 * tranchent, et en dérive des métriques. **Aucune table** : ni score de Brier,
 * ni courbe de calibration, ni agrégat n'est stocké. Tout se recalcule à la
 * lecture, comme les niveaux (P1). Une métrique stockée serait une métrique
 * qu'on ne peut plus réfuter.
 *
 * ## La règle qui gouverne tout ce fichier
 *
 * **Sous le seuil, `valeur` vaut `null`.** Jamais un nombre approximatif, jamais
 * un « 0,5 provisoire ». Un score de Brier sur trois observations n'est pas un
 * score de Brier, c'est du bruit avec une décimale — et l'afficher ferait
 * exactement ce que ce produit combat : présenter une ignorance comme une
 * mesure (P2, P7, anti-hallucination §7).
 *
 * ## Une prédiction non résolue n'est PAS un échec
 *
 * Une recommandation ignorée, un exercice jamais tenté, une révision pas encore
 * arrivée à son horizon : ces prédictions restent **en attente**. Les compter
 * comme fausses ferait chuter toutes les métriques pour la seule raison que la
 * personne n'a pas travaillé — on mesurerait son assiduité, pas la justesse du
 * moteur.
 */

import type {
  Exercise,
  ExerciseAttempt,
  SkillObservation,
} from "@/lib/domain/types";
import type { TypePrediction } from "./prediction";
import { tentativeMenee } from "./calibration";

/* ------------------------------------------------------------------ */
/* Seuils — combien il en faut avant de dire quoi que ce soit          */
/* ------------------------------------------------------------------ */

/**
 * Le seuil des scores de Brier.
 *
 * 30 : en deçà, l'écart-type de l'estimateur dépasse l'écart qu'on cherche à
 * détecter entre un modèle utile et un modèle qui prédit toujours la moyenne.
 * Ce n'est pas un calcul de puissance statistique — c'en serait un si le
 * produit avait le volume pour ; c'est un plancher assumé, et il se relèvera
 * quand les données diront qu'il est trop bas.
 */
export const SEUIL_BRIER = 30;

/**
 * Le seuil de l'erreur de durée, plus bas parce que la mesure est continue.
 *
 * 20 : une médiane sur vingt écarts dit déjà quelque chose, là où une
 * proportion binaire sur vingt tirages ne dit presque rien. **42 tentatives
 * chronométrées existent déjà** — c'est la seule métrique qui aura une valeur
 * dès le premier calcul.
 */
export const SEUIL_DUREE = 20;

/** Seuil de l'utilité des recommandations. */
export const SEUIL_UTILITE = 20;

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

/**
 * Une prédiction telle qu'elle a été inscrite.
 *
 * Déclarée ici et non importée de `lib/store/journal-moteur.ts` : le moteur ne
 * dépend d'aucune couche de persistance — il reçoit ses données, comme il
 * reçoit les compétences en paramètre. Le type du store lui est structurellement
 * assignable.
 */
export interface PredictionInscrite {
  id: string;
  emiseLe: string;
  type: TypePrediction;
  cibleCode: string;
  cibleRef: string | null;
  valeur: number;
  horizonLe: string | null;
  modeleVersion: string;
  entrees: Record<string, unknown>;
}

/** Une décision telle qu'elle a été inscrite. */
export interface DecisionInscrite {
  id: string;
  priseLe: string;
  type: string;
  politiqueVersion: string;
  cibleCode: string | null;
  cibleRef: string | null;
}

/**
 * Une prédiction confrontée au fait qui la tranche.
 *
 * `observe` est dans la même unité que `prediction.valeur` : une probabilité
 * face à un 0/1 pour les deux scores de Brier, des minutes face à des minutes
 * pour la durée.
 */
export interface Resolution {
  prediction: PredictionInscrite;
  observe: number;
  /** Ce qui a tranché — P3, pour pouvoir remonter au fait. */
  source: { kind: "tentative" | "observation"; ref: string; date: string };
}

export type NomMetrique =
  | "brier-reussite"
  | "erreur-duree"
  | "brier-retention"
  | "utilite-recommandation";

export interface MetriqueMoteur {
  nom: NomMetrique;
  libelle: string;
  /** `null` tant que `n < seuil`. Jamais un nombre fabriqué. */
  valeur: number | null;
  /** Unité de `valeur`, pour l'affichage. */
  unite: "score" | "minutes" | "ratio" | "part";
  n: number;
  seuil: number;
  /** Prédictions émises mais pas encore tranchées. Ni bonnes ni mauvaises. */
  enAttente: number;
  /**
   * La ligne de base à battre. `null` quand elle n'a pas de sens.
   *
   * Sans elle un score de Brier ne veut rien dire : 0,25 est excellent sur un
   * phénomène équilibré et catastrophique sur un phénomène qui arrive 9 fois
   * sur 10. La référence est la « climatologie » — prédire toujours le taux de
   * base observé.
   */
  reference: number | null;
  /** Ce que la valeur signifie, ou pourquoi il n'y en a pas. */
  lecture: string;
  /** Détail des facteurs — P3, aucune valeur sans sa source. */
  detail: { libelle: string; valeur: string }[];
  /**
   * Moyennes brutes du prédit et de l'observé.
   *
   * Pour `lib/engine/reglages.ts`, qui doit savoir dans quel SENS le moteur se
   * trompe — une valeur de Brier seule ne le dit pas. Absent tant que la
   * métrique est sous son seuil : un ajustement ne doit jamais pouvoir lire un
   * agrégat que l'affichage refuse de montrer.
   */
  agregats?: { preditMoyen: number; observeMoyen: number };
}

/* ------------------------------------------------------------------ */
/* Résolution — dérivée, jamais stockée                                */
/* ------------------------------------------------------------------ */

/**
 * Un résultat de tentative, ramené au 0/1 que la prédiction affirmait.
 *
 * `partiel` compte comme un échec : ADR-054 l'a tranché pour la
 * recommandation, et deux règles différentes pour un même mot rendraient les
 * deux illisibles.
 */
function reussiteObservee(resultat: ExerciseAttempt["resultat"]): number {
  return resultat === "reussi" ? 1 : 0;
}

/** La première tentative terminée sur cet exercice après l'émission. */
function tentativeResolvante(
  prediction: PredictionInscrite,
  tentatives: ExerciseAttempt[],
): ExerciseAttempt | null {
  if (prediction.cibleRef === null) return null;
  const candidates = tentatives
    .filter(
      (t) =>
        t.exerciseId === prediction.cibleRef &&
        t.statut === "terminee" &&
        t.debut > prediction.emiseLe,
    )
    .sort((a, b) => a.debut.localeCompare(b.debut));
  return candidates[0] ?? null;
}

/**
 * Résout les prédictions de réussite.
 *
 * Une tentative **abandonnée** ne tranche rien : `tentativeMenee` porte déjà
 * cette règle pour l'écriture de l'observation (ADR-030) et pour la calibration.
 * Une troisième lecture du même fait n'aurait aucune raison de diverger.
 */
export function resoudreReussites(
  predictions: PredictionInscrite[],
  tentatives: ExerciseAttempt[],
  exercicesParId: Map<string, Pick<Exercise, "dureeEstimeeMin">>,
): Resolution[] {
  const resolutions: Resolution[] = [];
  for (const prediction of predictions) {
    if (prediction.type !== "reussite") continue;
    const tentative = tentativeResolvante(prediction, tentatives);
    if (!tentative) continue;
    const exercice = exercicesParId.get(tentative.exerciseId);
    if (exercice && !tentativeMenee(tentative, exercice)) continue;

    resolutions.push({
      prediction,
      observe: reussiteObservee(tentative.resultat),
      source: { kind: "tentative", ref: tentative.id, date: tentative.debut },
    });
  }
  return resolutions;
}

/** Résout les prédictions de durée. Même filtre d'abandon. */
export function resoudreDurees(
  predictions: PredictionInscrite[],
  tentatives: ExerciseAttempt[],
  exercicesParId: Map<string, Pick<Exercise, "dureeEstimeeMin">>,
): Resolution[] {
  const resolutions: Resolution[] = [];
  for (const prediction of predictions) {
    if (prediction.type !== "duree") continue;
    const tentative = tentativeResolvante(prediction, tentatives);
    if (!tentative || tentative.dureeMin === undefined) continue;
    const exercice = exercicesParId.get(tentative.exerciseId);
    if (exercice && !tentativeMenee(tentative, exercice)) continue;

    resolutions.push({
      prediction,
      observe: tentative.dureeMin,
      source: { kind: "tentative", ref: tentative.id, date: tentative.debut },
    });
  }
  return resolutions;
}

/**
 * Résout les prédictions de rétention.
 *
 * L'affirmation testée : **la première observation enregistrée après l'horizon n'est
 * pas un échec**. Tant que l'horizon n'est pas passé, ou qu'aucune observation n'est
 * venue, la prédiction reste en attente — c'est le cas dominant, et ce n'en est
 * pas moins la seule lecture honnête.
 */
export function resoudreRetentions(
  predictions: PredictionInscrite[],
  observations: SkillObservation[],
): Resolution[] {
  const resolutions: Resolution[] = [];
  for (const prediction of predictions) {
    if (prediction.type !== "retention" || prediction.horizonLe === null) continue;

    const apres = observations
      .filter((p) => p.skillCode === prediction.cibleCode && p.date > prediction.horizonLe!)
      .sort((a, b) => a.date.localeCompare(b.date));
    const observation = apres[0];
    if (!observation) continue;

    resolutions.push({
      prediction,
      observe: observation.resultat === "echec" ? 0 : 1,
      source: { kind: "observation", ref: observation.id, date: observation.date },
    });
  }
  return resolutions;
}

/* ------------------------------------------------------------------ */
/* Calculs                                                             */
/* ------------------------------------------------------------------ */

export function mediane(valeurs: number[]): number {
  if (valeurs.length === 0) return 0;
  const triees = [...valeurs].sort((a, b) => a - b);
  const milieu = Math.floor(triees.length / 2);
  return triees.length % 2 === 0
    ? (triees[milieu - 1] + triees[milieu]) / 2
    : triees[milieu];
}

/** Score de Brier : moyenne de `(p − y)²`. Plus bas vaut mieux, 0 est parfait. */
function brier(resolutions: Resolution[]): number {
  const somme = resolutions.reduce(
    (s, r) => s + (r.prediction.valeur - r.observe) ** 2,
    0,
  );
  return somme / resolutions.length;
}

/**
 * La ligne de base « climatologie » : prédire toujours le taux de base observé.
 *
 * C'est elle qui rend un score de Brier lisible. Un modèle qui ne la bat pas
 * n'apporte rien qu'une moyenne n'apporterait — et ce verdict-là est le seul
 * qui justifie de toucher aux constantes du modèle.
 */
function brierReference(resolutions: Resolution[]): number {
  const taux = resolutions.reduce((s, r) => s + r.observe, 0) / resolutions.length;
  return resolutions.reduce((s, r) => s + (taux - r.observe) ** 2, 0) / resolutions.length;
}

function metriqueBrier(
  nom: "brier-reussite" | "brier-retention",
  libelle: string,
  resolutions: Resolution[],
  enAttente: number,
): MetriqueMoteur {
  const n = resolutions.length;
  const base = {
    nom,
    libelle,
    unite: "score" as const,
    n,
    seuil: SEUIL_BRIER,
    enAttente,
  };

  if (n < SEUIL_BRIER) {
    return {
      ...base,
      valeur: null,
      reference: null,
      lecture: `Données insuffisantes : ${n} prédiction(s) tranchée(s) sur ${SEUIL_BRIER} nécessaires.`,
      detail: [{ libelle: "En attente de résolution", valeur: `${enAttente}` }],
    };
  }

  const valeur = brier(resolutions);
  const reference = brierReference(resolutions);
  const taux = resolutions.reduce((s, r) => s + r.observe, 0) / n;
  const preditMoyen = resolutions.reduce((s, r) => s + r.prediction.valeur, 0) / n;

  return {
    ...base,
    valeur,
    reference,
    agregats: { preditMoyen, observeMoyen: taux },
    lecture:
      valeur < reference
        ? `Le modèle bat la ligne de base (${valeur.toFixed(3)} contre ${reference.toFixed(3)}) : ses probabilités apportent plus qu'une moyenne.`
        : `Le modèle ne bat PAS la ligne de base (${valeur.toFixed(3)} contre ${reference.toFixed(3)}) : prédire toujours ${(taux * 100).toFixed(0)} % ferait aussi bien.`,
    detail: [
      { libelle: "Prédictions tranchées", valeur: `${n}` },
      { libelle: "En attente de résolution", valeur: `${enAttente}` },
      { libelle: "Taux de base observé", valeur: `${(taux * 100).toFixed(0)} %` },
      { libelle: "Ligne de base (climatologie)", valeur: reference.toFixed(3) },
    ],
  };
}

/**
 * L'erreur de durée, et surtout son **biais**.
 *
 * L'erreur absolue seule ne dirait pas dans quel sens le moteur se trompe. Or
 * c'est exactement ce qu'ADR-045 a relevé le 09/08/2026 : la durée réelle
 * valait en moyenne **0,48 fois** la durée annoncée. Un moteur qui surestime
 * systématiquement du double n'a pas un problème de précision, il a un
 * problème de réglage — et c'est ce que le lot 4 doit corriger.
 *
 * Le ratio médian est donc la valeur portée, pas l'erreur absolue : c'est lui
 * qui est actionnable, et il est sans unité, donc comparable d'un exercice à
 * l'autre.
 */
function metriqueDuree(resolutions: Resolution[], enAttente: number): MetriqueMoteur {
  const n = resolutions.length;
  const base = {
    nom: "erreur-duree" as const,
    libelle: "Justesse des durées annoncées",
    unite: "ratio" as const,
    n,
    seuil: SEUIL_DUREE,
    enAttente,
  };

  if (n < SEUIL_DUREE) {
    return {
      ...base,
      valeur: null,
      reference: null,
      lecture: `Données insuffisantes : ${n} durée(s) confrontée(s) sur ${SEUIL_DUREE} nécessaires.`,
      detail: [{ libelle: "En attente de résolution", valeur: `${enAttente}` }],
    };
  }

  const exploitables = resolutions.filter((r) => r.prediction.valeur > 0);
  const ratios = exploitables.map((r) => r.observe / r.prediction.valeur);
  const ratio = mediane(ratios);
  const erreurs = resolutions.map((r) => Math.abs(r.observe - r.prediction.valeur));

  const sens =
    ratio < 0.9
      ? `Le moteur SURESTIME les durées : le réel vaut ${ratio.toFixed(2)} fois l'annoncé.`
      : ratio > 1.1
        ? `Le moteur SOUS-ESTIME les durées : le réel vaut ${ratio.toFixed(2)} fois l'annoncé.`
        : `Les durées annoncées tiennent : le réel vaut ${ratio.toFixed(2)} fois l'annoncé.`;

  return {
    ...base,
    valeur: ratio,
    // 1 : annoncer juste. C'est la seule référence qui ait un sens ici.
    reference: 1,
    agregats: {
      preditMoyen: mediane(resolutions.map((r) => r.prediction.valeur)),
      observeMoyen: mediane(resolutions.map((r) => r.observe)),
    },
    lecture: sens,
    detail: [
      { libelle: "Durées confrontées", valeur: `${n}` },
      { libelle: "En attente de résolution", valeur: `${enAttente}` },
      { libelle: "Erreur absolue médiane", valeur: `${mediane(erreurs).toFixed(0)} min` },
      { libelle: "Ratio médian réel / annoncé", valeur: ratio.toFixed(2) },
    ],
  };
}

/**
 * L'utilité des recommandations : quelle part d'entre elles a été suivie.
 *
 * ⚠️ **Ce n'est pas une mesure de qualité pédagogique**, et il ne faut pas la
 * lire comme telle. Une recommandation juste peut être ignorée parce que la
 * journée a été mauvaise ; une recommandation médiocre peut être suivie par
 * docilité. Ce qu'elle mesure vraiment, c'est si le moteur propose des choses
 * qu'on a envie de faire — utile, et distinct.
 *
 * Une décision est dite **suivie** quand une tentative a démarré sur l'exercice
 * qu'elle visait après qu'elle a été servie.
 */
/**
 * La fenêtre pendant laquelle une tentative peut être attribuée à la
 * recommandation qui la précède — corrigé le 21/08/2026.
 *
 * Sans fenêtre, la métrique comptait comme « suivie » toute décision qu'une
 * tentative sur le même exercice finissait par suivre, à n'importe quelle
 * distance. Or le moteur re-propose le même exercice tant qu'il n'a pas été
 * réussi : une seule tentative validait ainsi les trente décisions des trente
 * jours précédents. Mesuré en simulation le 21/08/2026 : un apprenant qui
 * ignore deux propositions sur trois obtenait 99 % de recommandations suivies —
 * la métrique disait « l'exercice a fini par être fait », pas « la
 * recommandation a été suivie ».
 *
 * Sept jours, et pas vingt-quatre heures : c'est déjà la durée d'expiration
 * d'un refus (`recommend.ts`), et une recommandation reprise le week-end
 * suivant reste plausiblement causée par elle. Ce seuil se déplacera si les
 * données le demandent — pas avant.
 */
export const FENETRE_UTILITE_JOURS = 7;

const FENETRE_UTILITE_MS = FENETRE_UTILITE_JOURS * 86_400_000;

/**
 * La tentative attribuable à une décision : sur l'exercice proposé, après la
 * décision, et dans la fenêtre. La première suffit — les suivantes ne rendent
 * pas la recommandation « plus suivie ».
 */
function tentativeDansLaFenetre(
  decision: DecisionInscrite,
  tentatives: ExerciseAttempt[],
): boolean {
  const prise = new Date(decision.priseLe).getTime();
  return tentatives.some((t) => {
    if (t.exerciseId !== decision.cibleRef) return false;
    const debut = new Date(t.debut).getTime();
    return debut > prise && debut - prise <= FENETRE_UTILITE_MS;
  });
}

function metriqueUtilite(
  decisions: DecisionInscrite[],
  tentatives: ExerciseAttempt[],
): MetriqueMoteur {
  const avecCible = decisions.filter((d) => d.cibleRef !== null);
  const n = avecCible.length;
  const base = {
    nom: "utilite-recommandation" as const,
    libelle: "Recommandations suivies",
    unite: "part" as const,
    n,
    seuil: SEUIL_UTILITE,
    enAttente: decisions.length - n,
  };

  if (n < SEUIL_UTILITE) {
    return {
      ...base,
      valeur: null,
      reference: null,
      lecture: `Données insuffisantes : ${n} décision(s) avec un exercice à proposer sur ${SEUIL_UTILITE} nécessaires.`,
      detail: [
        { libelle: "Décisions journalisées", valeur: `${decisions.length}` },
        { libelle: "Dont sans exercice à proposer", valeur: `${decisions.length - n}` },
      ],
    };
  }

  const suivies = avecCible.filter((d) => tentativeDansLaFenetre(d, tentatives)).length;
  const part = suivies / n;

  return {
    ...base,
    valeur: part,
    reference: null,
    lecture: `${suivies} recommandation(s) sur ${n} ont été suivies d'une tentative sur l'exercice proposé, dans les ${FENETRE_UTILITE_JOURS} jours.`,
    detail: [
      { libelle: "Décisions avec exercice", valeur: `${n}` },
      { libelle: "Suivies dans la fenêtre", valeur: `${suivies}` },
      { libelle: "Fenêtre retenue", valeur: `${FENETRE_UTILITE_JOURS} jours` },
      { libelle: "Part suivie", valeur: `${(part * 100).toFixed(0)} %` },
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Point d'entrée                                                      */
/* ------------------------------------------------------------------ */

export interface EntreesAutoEvaluation {
  predictions: PredictionInscrite[];
  decisions: DecisionInscrite[];
  tentatives: ExerciseAttempt[];
  observations: SkillObservation[];
  /** Sert à écarter les tentatives abandonnées. Exercices bruts, seed compris. */
  exercicesParId: Map<string, Pick<Exercise, "dureeEstimeeMin">>;
}

/** Les quatre métriques, recalculées de bout en bout. Rien n'est stocké. */
export function evaluerMoteur(entrees: EntreesAutoEvaluation): MetriqueMoteur[] {
  const { predictions, decisions, tentatives, observations, exercicesParId } = entrees;

  const parType = (type: TypePrediction) => predictions.filter((p) => p.type === type);

  const reussites = resoudreReussites(predictions, tentatives, exercicesParId);
  const durees = resoudreDurees(predictions, tentatives, exercicesParId);
  const retentions = resoudreRetentions(predictions, observations);

  return [
    metriqueDuree(durees, parType("duree").length - durees.length),
    metriqueBrier(
      "brier-reussite",
      "Justesse des chances de réussite",
      reussites,
      parType("reussite").length - reussites.length,
    ),
    metriqueBrier(
      "brier-retention",
      "Justesse de la répétition espacée",
      retentions,
      parType("retention").length - retentions.length,
    ),
    metriqueUtilite(decisions, tentatives),
  ];
}
