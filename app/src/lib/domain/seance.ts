/**
 * La séance — module pur, testable sans base (ADR-048).
 *
 * ## Ce que ce module ne crée pas
 *
 * Il n'introduit **aucune entité**. `LearningSession` existe depuis l'origine et
 * est écrite automatiquement à chaque exercice terminé (`lib/store/actions.ts`) :
 * au 10/08/2026, 45 des 46 séances en base sont des séances auto-générées à une
 * seule activité. Une séance composée, c'est la même entité avec *N* activités
 * et un `statut`. C'est ce qui permet à l'historique d'exister dès le premier
 * jour, sans reprise de données.
 *
 * ## La règle qui gouverne le besoin déclaré
 *
 * `BesoinDeclare` est stocké, et c'est une exception apparente à P1 (« rien de
 * ce qui est dérivable n'est stocké »). Elle n'en est pas une : une intention
 * n'est dérivable de rien. C'est un **fait observé**, daté, au même titre qu'une
 * tentative — « le 10/08 à 9 h, la personne a écrit ceci ».
 *
 * Ce qui est dérivé, en revanche, c'est l'écart entre ce qui était déclaré et ce
 * qui a eu lieu (`ecartBesoinRealise`). Il se recalcule à chaque lecture et
 * n'est jamais écrit.
 *
 * ⚠️ **Aucune fonction de ce module ne produit d'indice sur la personne.**
 * L'écart est rendu sous la forme des deux valeurs qui le composent, jamais
 * d'un score agrégé. Un « indice de biais » serait un nombre porté sur
 * quelqu'un, sans observation, et fabriqué à partir d'une seule observation — la
 * forme exacte de ce que P2 et P3 interdisent.
 */

import {
  DUREE_ESTIMEE_MAX,
  DUREE_ESTIMEE_MIN,
  EXERCICES_PAR_LOT_MAX,
} from "./exercice";
import type {
  BesoinDeclare,
  BlueprintSeance,
  DemandeSeance,
  ExerciseAttempt,
  LearningSession,
  StatutSeance,
} from "./types";

/* ------------------------------------------------------------------ */
/* Bornes                                                              */
/* ------------------------------------------------------------------ */

/**
 * Longueur de l'intention déclarée.
 *
 * Ce n'est pas la même borne que `JUSTIFICATION_MAX` et il ne faut pas les
 * confondre : celle-là confine un texte **écrit par le tuteur** qui pourrait
 * devenir la correction recopiée. Ici, c'est la personne qui écrit, pour
 * elle-même, et le texte n'entre dans aucun calcul. La borne existe seulement
 * pour qu'un champ de saisie ne devienne pas un journal intime — 500
 * caractères tiennent « ce que je veux faire aujourd'hui et pourquoi ».
 */
export const INTENTION_MAX = 500;

/**
 * Plafond du temps déclaré disponible, en minutes.
 *
 * Une déclaration n'a pas besoin d'une borne serrée — elle n'est pas une
 * mesure. Elle a besoin de ne pas être absurde : au-delà d'une journée de
 * travail, la valeur est une faute de frappe, pas une intention.
 */
export const TEMPS_DECLARE_MAX = 480;

/**
 * Nombre d'exercices par séance.
 *
 * La borne haute est celle du lot de génération (`EXERCICES_PAR_LOT_MAX`), et
 * ce n'est pas une coïncidence : composer une séance de *N* exercices demande,
 * dans le cas normal d'aujourd'hui, d'en faire rédiger une partie dans le même
 * tour. Une séance qui dépasse ce que le tuteur sait produire d'un coup serait
 * une séance dont la fin arrive tronquée.
 */
export const EXERCICES_PAR_SEANCE_MIN = 1;
export const EXERCICES_PAR_SEANCE_MAX = EXERCICES_PAR_LOT_MAX;

/* ------------------------------------------------------------------ */
/* Mode épreuve                                                        */
/* ------------------------------------------------------------------ */

/**
 * La séance a-t-elle été posée en mode épreuve ?
 *
 * Lecture pure d'un champ déclaré AU DÉPART (`modeEpreuve`, posé par
 * `creerSeance`) : rien n'est déduit, rien n'est recalculé. Absent sur les
 * séances antérieures au 22/08/2026, l'absence vaut « non » — même discipline
 * que `statutSeance` pour le statut.
 *
 * ⚠️ Le moteur ne lit JAMAIS cette fonction : le mode épreuve est un habillage
 * de séance (chrono, aides masquées), pas une dimension, pas une mesure. Il
 * n'entre ni dans `recommend`, ni dans le calibrage, ni dans l'autonomie —
 * celle-ci reste déduite des indices réellement consultés (P2).
 */
export function estModeEpreuve(seance: LearningSession): boolean {
  return seance.modeEpreuve === true;
}

/**
 * Les aides de l'exercice doivent-elles être masquées ici ?
 *
 * Masquées pendant que la séance se DÉROULE (`en-cours`), rendues à sa
 * clôture : une séance terminée ou abandonnée se relit, et la relecture a
 * besoin des aides comme du reste. Une tentative abandonnée ne produit de
 * toute façon pas de preuve ; le masquage n'a donc rien à protéger après la
 * fermeture.
 *
 * C'est la seule autorité du masquage : l'écran de l'exercice et le journal
 * appellent cette fonction au lieu de relire `seance.modeEpreuve` à la main,
 * sinon deux copies finiraient par diverger (ADR-044, ADR-047).
 */
export function indicesMasquesEnEpreuve(seance: LearningSession): boolean {
  return estModeEpreuve(seance) && statutSeance(seance) === "en-cours";
}

/**
 * Le refus opposé à toute activation ou retrait du mode épreuve APRÈS création.
 *
 * Le mode épreuve se pose quand la séance est composée, avec elle. L'activer
 * en cours de route transformerait en « épreuve » une séance dont les
 * premiers exercices ont été menés avec aides — deux régimes dans une même
 * trace. Le retirer ferait l'inverse. Dans les deux cas, le champ cesserait
 * d'être un fait déclaré au départ pour devenir un état manipulable.
 *
 * `avant` et `apres` sont le même enregistrement avant puis après une écriture
 * : le garde ne s'applique que si la valeur change — réécrire la même valeur
 * n'est pas un changement de régime.
 */
export function motifRefusChangementModeEpreuve(
  avant: LearningSession,
  apres: LearningSession,
): string | null {
  if ((avant.modeEpreuve ?? false) !== (apres.modeEpreuve ?? false)) {
    return "Le mode épreuve se pose à la création de la séance : il ne s'active ni ne se retire ensuite.";
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Statut                                                              */
/* ------------------------------------------------------------------ */

/**
 * Où en est une séance, l'absence de statut comprise.
 *
 * Les 45 séances écrites avant le 10/08/2026 n'ont pas de `statut` : elles ont
 * été produites au moment où un exercice se terminait, donc elles sont
 * terminées. Interpréter cette absence une seule fois, ici, vaut mieux que de
 * laisser chaque appelant écrire `seance.statut ?? "terminee"` — la valeur de
 * repli finirait par diverger d'un écran à l'autre.
 */
export function statutSeance(seance: LearningSession): StatutSeance {
  return seance.statut ?? "terminee";
}

/**
 * La séance a-t-elle eu lieu ?
 *
 * ⚠️ Ce prédicat est le garde-fou d'un défaut que la planification introduit et
 * que rien n'aurait signalé : `calculerActivite` compte **une ligne de
 * `sessions` par jour actif**, et comptait donc, depuis ADR-048, les séances
 * simplement *prévues*. Une séance planifiée pour jeudi aurait rempli une case
 * du bandeau d'activité le jeudi, sans qu'une minute ait été travaillée — une
 * mesure fabriquée à partir d'une intention (P2), dans l'écran même qui existe
 * pour dire ce qui s'est réellement passé.
 *
 * Une séance `en-cours` a lieu : la personne y travaille en ce moment.
 *
 * Une séance **abandonnée** relève du même piège, sous une autre forme : elle a
 * été démarrée, donc elle porte une date réelle, mais rien n'y a peut-être eu
 * lieu. `abandonnerSeance` n'écrit `dureeMin` que si une tentative a été menée
 * — l'absence de durée est donc ici le fait « aucune minute observée », et non
 * une donnée manquante. C'est cette absence qui décide, pas le statut : compter
 * un abandon sec comme un jour actif fabriquerait de l'activité à partir d'un
 * renoncement (P2).
 */
export function seanceALieu(seance: LearningSession): boolean {
  const statut = statutSeance(seance);
  if (statut === "planifiee") return false;
  if (statut === "abandonnee") return typeof seance.dureeMin === "number";
  return true;
}

/** Les identifiants d'exercice que la séance prévoit ou a traversés. */
export function exercicesDeLaSeance(seance: LearningSession): string[] {
  return seance.activites.filter((a) => a.type === "exercice").map((a) => a.ref);
}

/**
 * Retrouve la tentative qui appartient à une séance sans inventer de lien.
 *
 * Les séances historiques ont été écrites au même geste que leur tentative :
 * on retient donc la clôture la plus proche. Une séance composée, elle, ne peut
 * revendiquer que les tentatives ouvertes après son démarrage.
 */
export function tentativeDeSeance(
  seance: LearningSession,
  exerciceId: string,
  tentatives: ExerciseAttempt[],
): ExerciseAttempt | undefined {
  const candidates = tentatives.filter((tentative) => tentative.exerciseId === exerciceId);
  if (candidates.length === 0) return undefined;

  if (seance.genereAutomatiquement) {
    const dateSeance = new Date(seance.date).getTime();
    return [...candidates]
      .filter((tentative) => tentative.statut !== "en-cours")
      .sort((a, b) => {
        const ecartA = Math.abs(new Date(a.fin ?? a.debut).getTime() - dateSeance);
        const ecartB = Math.abs(new Date(b.fin ?? b.debut).getTime() - dateSeance);
        return ecartA - ecartB;
      })[0];
  }

  const depuisDebut = candidates
    .filter((tentative) => tentative.debut >= seance.date && tentative.statut !== "en-cours")
    .sort((a, b) => a.debut.localeCompare(b.debut));
  return depuisDebut.find((tentative) => tentative.statut === "terminee") ?? depuisDebut[0];
}

/**
 * La séance en cours qui contient cet exercice, s'il y en a une.
 *
 * ⚠️ C'est la fonction qui empêche le double comptage, et le défaut qu'elle
 * évite serait invisible : `terminerExercice` écrit une séance mono-exercice à
 * chaque clôture, comportement correct depuis toujours. Sans cette vérification,
 * un exercice fait DANS une séance produirait deux lignes — la séance composée
 * et sa propre séance auto-générée — et le journal compterait deux fois le même
 * travail, y compris dans le bandeau d'activité.
 *
 * ⚠️ **Ce n'est plus l'autorité, c'est le repli** (16/08/2026). Depuis que
 * plusieurs séances peuvent être ouvertes en même temps, « la plus récemment
 * commencée » n'est plus une réponse : le même exercice peut appartenir à deux
 * séances ouvertes, et deviner laquelle rattacherait le travail à la mauvaise.
 * La question se pose désormais à `seanceHoteDeLExercice`, qui préfère le
 * contexte explicite. Cette fonction reste la réponse des chemins qui n'en ont
 * pas — un exercice ouvert depuis la bibliothèque, hors workspace.
 */
export function seanceEnCoursPour(
  exerciceId: string,
  seances: LearningSession[],
): LearningSession | null {
  const candidates = seances
    .filter(
      (s) =>
        statutSeance(s) === "en-cours" && exercicesDeLaSeance(s).includes(exerciceId),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  return candidates[0] ?? null;
}

/**
 * La séance qui tient le journal pour cet exercice — contexte d'abord.
 *
 * ## Pourquoi cette fonction existe
 *
 * L'invariant « une seule séance en cours » (ADR-048) n'était pas du confort :
 * il rendait `seanceEnCoursPour` non ambigu. En le levant, on rouvre exactement
 * le défaut qu'ADR-048 avait fermé — un exercice présent dans deux séances
 * ouvertes serait rattaché à l'une d'elles au hasard de la date, et les deux
 * lignes de journal resteraient exactes prises séparément. Invisible.
 *
 * La réponse n'est pas de mieux deviner, c'est de ne plus deviner : le
 * workspace SAIT dans quelle séance il déroule (`?session=<id>`), et il le
 * transmet. `seanceIdContexte` n'est cru que s'il désigne une séance réellement
 * en cours qui contient réellement cet exercice — un contexte périmé ou
 * fabriqué ne doit pas pouvoir rattacher du travail à n'importe quoi.
 *
 * Sans contexte utilisable, on retombe sur `seanceEnCoursPour` : c'est le cas
 * d'un exercice ouvert hors workspace, où aucune séance n'a été désignée.
 */
export function seanceHoteDeLExercice(
  exerciceId: string,
  seances: LearningSession[],
  seanceIdContexte?: string,
): LearningSession | null {
  if (seanceIdContexte) {
    const designee = seances.find(
      (s) =>
        s.id === seanceIdContexte &&
        statutSeance(s) === "en-cours" &&
        exercicesDeLaSeance(s).includes(exerciceId),
    );
    if (designee) return designee;
  }
  return seanceEnCoursPour(exerciceId, seances);
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

/**
 * Les refus d'un besoin déclaré, en un point d'autorité.
 *
 * Même discipline que `motifRefusExercice` (ADR-047) : l'écran et la Server
 * Function appellent la même fonction, parce que deux copies d'une validation
 * finissent par diverger et que la divergence est invisible — on ferait entrer
 * par un chemin ce que l'autre refuse.
 */
export function motifRefusBesoin(besoin: BesoinDeclare): string | null {
  /*
   * L'intention est FACULTATIVE depuis le 10/08/2026.
   *
   * Elle était exigée, et c'était une friction mal placée : choisir un thème
   * et un temps est déjà une déclaration d'intention datée. Demander en plus
   * une phrase rédigée avant de composer faisait du formulaire l'obstacle que
   * la séance devait lever.
   *
   * Ce que sa borne haute protège en revanche n'a pas changé — un champ de
   * saisie ne doit pas devenir un journal — donc la longueur reste vérifiée
   * quand une phrase est écrite.
   */
  if (besoin.intention !== undefined && besoin.intention.length > INTENTION_MAX) {
    return `Intention trop longue : ${besoin.intention.length} caractères pour ${INTENTION_MAX} au plus.`;
  }
  if (
    !Number.isInteger(besoin.tempsDisponibleMin) ||
    besoin.tempsDisponibleMin < DUREE_ESTIMEE_MIN ||
    besoin.tempsDisponibleMin > TEMPS_DECLARE_MAX
  ) {
    return `Temps disponible hors bornes : ${besoin.tempsDisponibleMin}. Il doit être un entier de ${DUREE_ESTIMEE_MIN} à ${TEMPS_DECLARE_MAX} minutes.`;
  }
  if (!besoin.declareLe.trim()) {
    return "Un besoin déclaré sans date n'est pas un fait observé.";
  }
  return null;
}

/**
 * Les refus d'une demande de séance — ce qui est vérifiable avant l'assemblage.
 *
 * La borne de durée n'est pas un nombre de plus : elle est **dérivée** des
 * bornes d'un exercice (`lib/domain/exercice.ts`, ADR-045). Une séance de trois
 * exercices ne peut pas viser 10 minutes, parce qu'aucun exercice ne descend
 * sous 5. Poser ici un plafond arbitraire aurait recréé la troisième autorité
 * qu'ADR-045 a supprimée.
 */
export function motifRefusDemande(demande: DemandeSeance): string | null {
  const n = demande.nombreExercices;
  if (
    !Number.isInteger(n) ||
    n < EXERCICES_PAR_SEANCE_MIN ||
    n > EXERCICES_PAR_SEANCE_MAX
  ) {
    return `Nombre d'exercices hors bornes : ${n}. Il doit être un entier de ${EXERCICES_PAR_SEANCE_MIN} à ${EXERCICES_PAR_SEANCE_MAX}.`;
  }

  const plancher = n * DUREE_ESTIMEE_MIN;
  const plafond = n * DUREE_ESTIMEE_MAX;
  if (
    !Number.isInteger(demande.dureeCibleMin) ||
    demande.dureeCibleMin < plancher ||
    demande.dureeCibleMin > plafond
  ) {
    return `Durée cible incohérente : ${demande.dureeCibleMin} min pour ${n} exercice(s). Elle doit tenir entre ${plancher} et ${plafond} minutes.`;
  }

  if (demande.portee.type === "transverse" && demande.portee.domaines.length < 2) {
    return "Une séance transverse porte sur au moins deux domaines — sinon elle est mono-domaine, et il faut le dire.";
  }

  return null;
}

/**
 * Les refus d'un blueprint complet, avant écriture.
 *
 * C'est `motifRefusDemande` plus la seule règle que les cibles ajoutent. Une
 * seconde implémentation aurait divergé : on aurait pu écrire par un chemin un
 * blueprint que l'autre refuse (ADR-044, ADR-047).
 */
export function motifRefusBlueprint(blueprint: BlueprintSeance): string | null {
  const refus = motifRefusDemande(blueprint);
  if (refus) return refus;

  // Les cibles peuvent être moins nombreuses que les exercices demandés : c'est
  // le cas normal quand le stock ne suit pas, et `composerSeance` l'annonce.
  // Elles ne peuvent pas être PLUS nombreuses — ce serait une composition qui
  // dépasse ce qui a été demandé.
  if (blueprint.cibles.length > blueprint.nombreExercices) {
    return `Le blueprint vise ${blueprint.cibles.length} compétences pour ${blueprint.nombreExercices} exercice(s) demandé(s).`;
  }

  return null;
}

/**
 * Les refus d'une liste d'activités retenues, avant écriture.
 *
 * Une séance a besoin d'au moins un exercice RÉELLEMENT disponible : les places
 * « à générer » (`manquants`) n'existent pas encore comme exercice, et une
 * séance qui n'en retiendrait que des manquants serait vide au premier
 * exercice, sans rien à ouvrir ni à mesurer. La génération doit avoir eu lieu,
 * s'être relue, et l'exercice avoir rejoint la composition, avant qu'une séance
 * puisse être écrite (P2 — « à générer » n'est pas une activité).
 */
export function motifRefusActivites(
  activites: readonly { type: string; ref: string; libelle: string }[],
): string | null {
  const exercices = activites.filter((a) => a.type === "exercice");
  if (exercices.length === 0) {
    return "Cette séance ne contient aucun exercice déjà disponible : génère et relis au moins un exercice avant de l'enregistrer.";
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Avancement — dérivé des tentatives, jamais stocké                   */
/* ------------------------------------------------------------------ */

export interface AvancementSeance {
  total: number;
  /** Exercices dont une tentative a été MENÉE pendant la séance (statut `terminee`). */
  menes: string[];
  enCours: string[];
  /** Tentés puis abandonnés : une trace, mais aucune mesure (ADR-040). */
  abandonnes: string[];
  /** Jamais ouverts depuis le début de la séance. */
  restants: string[];
}

/**
 * Où en sont les activités d'une séance, dérivé des tentatives.
 *
 * ⚠️ La borne temporelle est indispensable et facile à oublier : un exercice de
 * la séance peut porter des tentatives **antérieures** — c'est même le cas
 * souhaitable, puisqu'un exercice déjà travaillé peut revenir. Ne compter que
 * les tentatives ouvertes à partir du début de la séance est ce qui distingue
 * « fait aujourd'hui » de « fait un jour ». Sans cela, une séance composée
 * d'exercices connus s'afficherait terminée avant d'avoir commencé.
 *
 * Le classement prend le meilleur état atteint : une tentative abandonnée puis
 * reprise et menée compte comme menée.
 */
export function avancementSeance(
  seance: LearningSession,
  tentatives: ExerciseAttempt[],
): AvancementSeance {
  const debut = seance.date;
  const prevus = exercicesDeLaSeance(seance);

  const menes: string[] = [];
  const enCours: string[] = [];
  const abandonnes: string[] = [];
  const restants: string[] = [];

  for (const id of prevus) {
    const siennes = tentatives.filter((t) => t.exerciseId === id && t.debut >= debut);
    if (siennes.some((t) => t.statut === "terminee")) menes.push(id);
    else if (siennes.some((t) => t.statut === "en-cours")) enCours.push(id);
    else if (siennes.some((t) => t.statut === "abandonnee")) abandonnes.push(id);
    else restants.push(id);
  }

  return { total: prevus.length, menes, enCours, abandonnes, restants };
}

/**
 * La phrase de résultat écrite au journal à la clôture d'une séance.
 *
 * Elle compte, elle ne juge pas : « 3 exercices menés sur 4 » est un fait,
 * « séance réussie » serait une mesure que rien n'autorise à porter sur un
 * ensemble d'exercices dont chacun a déjà son propre résultat.
 */
export function resumeSeance(avancement: AvancementSeance): string {
  const { total, menes, abandonnes } = avancement;
  const base = `Séance — ${menes.length} exercice(s) mené(s) sur ${total}`;
  return abandonnes.length > 0
    ? `${base}, ${abandonnes.length} abandonné(s)`
    : base;
}

/**
 * La phrase écrite quand une séance est abandonnée.
 *
 * Même discipline que `resumeSeance` : elle compte, elle ne juge pas. « Séance
 * ratée » serait une mesure portée sur un renoncement, c'est-à-dire sur
 * l'absence de mesure — la faute exacte qu'ADR-030 a corrigée un cran plus bas,
 * sur la tentative.
 *
 * Le nombre d'exercices jamais ouverts est cité : c'est ce qui reste à faire, et
 * c'est ce que la reprise lira.
 */
export function resumeSeanceAbandonnee(avancement: AvancementSeance): string {
  const { total, menes, restants } = avancement;
  const base = `Séance abandonnée — ${menes.length} exercice(s) mené(s) sur ${total}`;
  return restants.length > 0
    ? `${base}, ${restants.length} jamais ouvert(s)`
    : base;
}

/**
 * La séance peut-elle être reprise là où elle s'est arrêtée ?
 *
 * « Reprendre » n'est pas « refaire » : refaire recompose une séance neuve à
 * partir du blueprint (`presetDepuisSeance`), reprendre rouvre CELLE-CI sur ce
 * qui n'a pas été traité. Il faut donc qu'il reste quelque chose à traiter —
 * une séance abandonnée dont tous les exercices ont été menés n'a rien à
 * reprendre, elle a seulement été close par la mauvaise porte.
 *
 * Une séance **renoncée** (`renonceeLe` posé, voir `renoncerSeance`) ne se
 * reprend plus : son auteur a déclaré qu'il n'en ferait rien. Le geste est
 * daté et définitif — il sort la séance de la file « en suspens » au lieu de
 * la laisser y attendre un geste qui ne viendra pas.
 */
export function peutReprendreSeance(
  seance: LearningSession,
  avancement: AvancementSeance,
): boolean {
  return (
    statutSeance(seance) === "abandonnee" &&
    !seance.renonceeLe &&
    avancement.restants.length + avancement.enCours.length > 0
  );
}

/* ------------------------------------------------------------------ */
/* Écart entre le déclaré et le réalisé                                */
/* ------------------------------------------------------------------ */

export interface EcartBesoinRealise {
  /** Codes déclarés qui ont effectivement été travaillés. */
  codesTenus: string[];
  /** Codes déclarés qu'aucune tentative menée n'a touchés. */
  codesDelaisses: string[];
  /** Codes travaillés sans avoir été déclarés. Ce n'est pas une faute : c'est un fait. */
  codesImprevus: string[];
  tempsDeclareMin: number;
  /** Somme des durées des tentatives menées pendant la séance. `null` si aucune. */
  tempsPasseMin: number | null;
  /** Phrases factuelles citant les deux valeurs. Aucune ne conclut sur la personne. */
  constats: string[];
  /** Ce que cet écart ne permet PAS de dire (P3). */
  reserves: string[];
}

/**
 * L'écart entre ce qui était déclaré et ce qui a eu lieu.
 *
 * Rend `null` sans besoin déclaré : une séance sans intention n'a pas d'écart,
 * et en fabriquer un contre une intention vide serait inventer.
 *
 * ## Ce que cette fonction refuse de faire
 *
 * Elle ne produit **aucun indice**, aucune moyenne d'écarts, aucun qualificatif
 * sur la personne. Les constats citent les deux valeurs côte à côte — « 60 min
 * déclarées, 34 min passées » — et s'arrêtent là. « Tu surestimes ton temps »
 * est une conclusion sur quelqu'un ; elle demanderait une série, pas une séance,
 * et la réserve le dit explicitement plutôt que de le laisser deviner.
 *
 * C'est la même discipline que `calibration.ts` : le nombre est rendu avec sa
 * source, et ce qu'il ne prouve pas est écrit à côté.
 */
export function ecartBesoinRealise(
  seance: LearningSession,
  tentatives: ExerciseAttempt[],
  /** Résout un exercice vers les compétences qu'il vise. Un exercice absent est ignoré. */
  competencesParExercice: Map<string, string[]>,
): EcartBesoinRealise | null {
  const besoin = seance.besoinDeclare;
  if (!besoin) return null;

  const debut = seance.date;
  const menees = tentatives.filter(
    (t) => t.debut >= debut && t.statut === "terminee",
  );
  const prevus = new Set(exercicesDeLaSeance(seance));
  const meneesDeLaSeance = menees.filter((t) => prevus.has(t.exerciseId));

  const travailles = new Set<string>();
  for (const t of meneesDeLaSeance) {
    for (const code of competencesParExercice.get(t.exerciseId) ?? []) {
      travailles.add(code);
    }
  }

  const declares = new Set(besoin.codesVises);
  const codesTenus = besoin.codesVises.filter((c) => travailles.has(c));
  const codesDelaisses = besoin.codesVises.filter((c) => !travailles.has(c));
  const codesImprevus = [...travailles].filter((c) => !declares.has(c)).sort();

  // `null` et non `0` : aucune tentative menée n'est une absence de mesure, pas
  // une durée nulle (P2, anti-hallucination §7).
  const durees = meneesDeLaSeance
    .map((t) => t.dureeMin)
    .filter((d): d is number => typeof d === "number");
  const tempsPasseMin = durees.length > 0 ? durees.reduce((s, d) => s + d, 0) : null;

  const constats: string[] = [];
  if (tempsPasseMin === null) {
    constats.push(
      `${besoin.tempsDisponibleMin} min déclarées disponibles — aucune tentative menée, donc aucun temps mesuré.`,
    );
  } else {
    constats.push(
      `${besoin.tempsDisponibleMin} min déclarées disponibles, ${tempsPasseMin} min effectivement passées.`,
    );
  }
  if (besoin.codesVises.length > 0) {
    constats.push(
      `${codesTenus.length} compétence(s) travaillée(s) sur ${besoin.codesVises.length} visée(s)` +
        (codesDelaisses.length > 0 ? ` — laissées de côté : ${codesDelaisses.join(", ")}.` : "."),
    );
  }
  if (codesImprevus.length > 0) {
    constats.push(
      `Travaillé sans l'avoir visé : ${codesImprevus.join(", ")}.`,
    );
  }

  const reserves: string[] = [
    "Un écart sur une seule séance ne dit rien d'une tendance : il faut plusieurs séances déclarées pour que la comparaison porte.",
  ];
  if (besoin.codesVises.length === 0) {
    reserves.push(
      "Aucune compétence n'avait été visée : seul l'écart de temps est comparable ici.",
    );
  }

  return {
    codesTenus,
    codesDelaisses,
    codesImprevus,
    tempsDeclareMin: besoin.tempsDisponibleMin,
    tempsPasseMin,
    constats,
    reserves,
  };
}
