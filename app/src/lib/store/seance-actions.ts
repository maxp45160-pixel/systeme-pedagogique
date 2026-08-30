"use server";

/**
 * Écritures de séance (ADR-048).
 *
 * Même discipline que `actions.ts` : `dorsaleCompte()` redirige sans session,
 * RLS reste la barrière d'autorisation (ADR-015), et chaque écriture appelle
 * `revalidatePath("/", "layout")` (ADR-024).
 *
 * ## Ce que ce module ne stocke pas
 *
 * L'avancement des exercices — qui est fait, qui reste — n'est écrit nulle
 * part. Il se dérive des tentatives à chaque lecture (`avancementSeance`),
 * comme les niveaux se dérivent des observations (P1). Les gestes
 * non-exercice peuvent toutefois porter le fait explicite de leur clôture dans
 * `sessions.interventions.statut` ; ce statut n'est ni une mesure ni un
 * remplacement de la projection des tentatives.
 *
 * Ce qui est écrit à la clôture — `dureeMin`, `resultat` — n'est pas une mesure
 * indépendante : c'est la somme observée à cet instant, rangée au journal parce
 * que la table le fait déjà pour les séances mono-exercice et que le bandeau
 * d'activité la lit. Le recalculer plus tard depuis les tentatives donnerait le
 * même nombre.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ajouter, dorsaleCompte, lire, modifier, nouvelId, type DorsaleCompte } from "./db";
import { cloreExerciceAtomiquement } from "./cloture-exercice";
import {
  avancementSeance,
  attendPreparationSeance,
  estPlanificationDifferee,
  exercicesDeLaSeance,
  motifRefusActivites,
  motifRefusBesoin,
  motifRefusBlueprint,
  motifRefusPlanificationDifferee,
  peutReprendreSeance,
  resumeSeance,
  resumeSeanceAbandonnee,
  seanceEnCoursPour,
  statutSeance,
} from "@/lib/domain/seance";
import { dureeRetenue } from "@/lib/domain/tentative";
import type {
  BesoinDeclare,
  BlueprintSeance,
  Exercise,
  ExerciseAttempt,
  LearningSession,
} from "@/lib/domain/types";
import { parseInterventionsSeance } from "@/lib/domain/intervention-seance";
import { lireInterventionsSeance } from "@/lib/domain/legacy-session-intervention-adapter";
import { renduPourIntervention } from "@/lib/domain/intervention-rendus";
import { jourDeLaSeance } from "@/lib/domain/pages-cahier";
import {
  interventionsTerminees,
  interventionsAReprendre,
  lireExecutionInterventions,
  resumeInterventions,
} from "@/lib/domain/intervention-execution";

/**
 * Les exercices que le compte peut réellement dérouler, par identifiant.
 *
 * ⚠️ Lire la seule table `exercises` ne suffit pas : les diagnostics vivent dans
 * `EXERCICES_DIAGNOSTIC` et non en base (ADR-004). `chargerContexte` les expose
 * au moteur, donc la prochaine action peut parfaitement en désigner un — et la
 * séance était alors refusée avec « Cet exercice n'est plus disponible », pour
 * un exercice qui n'a jamais cessé de l'être. `terminerExercice` fait déjà cette
 * jonction ; l'écriture de séance ne la faisait pas.
 *
 * Une ligne stockée l'emporte sur le diagnostic de même identifiant : c'est la
 * règle qu'applique déjà `chargerContexte` (`idsStockes`).
 */
async function catalogueExercices(dorsale: DorsaleCompte): Promise<Map<string, Exercise>> {
  const stockes = await lire("exercises", dorsale);
  const { EXERCICES_DIAGNOSTIC } = await import("@/lib/seed/exercises");
  const parId = new Map<string, Exercise>(EXERCICES_DIAGNOSTIC.map((e) => [e.id, e]));
  for (const exercice of stockes) parId.set(exercice.id, exercice);
  return parId;
}

/* ------------------------------------------------------------------ */
/* Planification                                                       */
/* ------------------------------------------------------------------ */

export interface EntreePlanification {
  besoin: BesoinDeclare;
  blueprint: BlueprintSeance;
  /** Les exercices retenus, dans l'ordre de déroulé. Forme de `LearningSession.activites`. */
  activites: { type: string; ref: string; libelle: string }[];
  /** Date/heure prévue (ISO). Absente : la séance est composée pour maintenant. */
  planifieePour?: string;
  /**
   * Mode épreuve (22/08/2026) : conditions réelles — chrono affiché, aides
   * masquées pendant le déroulé. Posé ICI et nulle part ailleurs : c'est le
   * seul chemin d'écriture du champ, aucune mise à jour ultérieure ne peut
   * l'activer ni le retirer (`motifRefusChangementModeEpreuve`).
   */
  modeEpreuve?: boolean;
}

/** La séance est-elle seulement planifiée ou directement lancée ? */
export type ModeCreationSeance = "planifiee" | "en-cours";

/**
 * Écrit une séance — planifiée ou directement en cours — en UNE écriture.
 *
 * C'est le remplacement de l'enchaînement « planifier puis démarrer » : celui-là
 * n'était pas atomique — si le démarrage échouait (une autre séance en cours),
 * on restait avec une séance planifiée orpheline que personne n'avait voulue.
 *
 * Les validations viennent du domaine (`lib/domain/seance.ts`) et sont les
 * mêmes que celles de l'écran : une seule autorité, sinon on ferait entrer par
 * le serveur ce que le formulaire refuse, ou l'inverse (ADR-044, ADR-047).
 *
 * ⚠️ Les références d'activité sont vérifiées contre les exercices du compte.
 * L'interface ne propose que des exercices existants, mais l'interface est
 * contournable : une séance citant un exercice inconnu produirait un déroulé
 * qui s'arrête sur une page introuvable, et un journal qui ne résout plus. Et
 * une séance sans aucun exercice déjà disponible (`motifRefusActivites`) est
 * refusée : les « à générer » ne comptent pas comme activité (P2).
 */
export async function creerSeance(
  entree: EntreePlanification,
  mode: ModeCreationSeance,
): Promise<string> {
  const dorsale = await dorsaleCompte();

  const refusBesoin = motifRefusBesoin(entree.besoin);
  if (refusBesoin) throw new Error(refusBesoin);
  const refusBlueprint = motifRefusBlueprint(entree.blueprint);
  if (refusBlueprint) throw new Error(refusBlueprint);

  const parId = await catalogueExercices(dorsale);
  const inconnus = entree.activites
    .filter((a) => a.type === "exercice" && !parId.has(a.ref))
    .map((a) => a.ref);
  if (inconnus.length > 0) {
    throw new Error(`Exercice(s) introuvable(s) dans la séance : ${inconnus.join(", ")}.`);
  }

  /*
   * Préparation différée (ADR-131) : une séance du protocole d'un cours se
   * PLANIFIE avec moins d'exercices que demandés — voire aucun, cas normal
   * d'un cours nouveau — parce qu'elle porte sa commande (`origine.codes` +
   * `consigne`) et que le démarrage la fera préparer. La contrepartie est
   * non négociable : sans commande stockée, pas de tolérance — la séance
   * serait vide pour toujours. Le démarrage direct reste soumis à la règle
   * stricte : on ne lance pas une séance vide.
   */
  const differee = estPlanificationDifferee(entree.blueprint, entree.activites, mode);
  if (differee) {
    const refusDifferee = motifRefusPlanificationDifferee(entree.blueprint);
    if (refusDifferee) throw new Error(refusDifferee);
  } else {
    const refusActivites = motifRefusActivites(entree.activites);
    if (refusActivites) throw new Error(refusActivites);
  }

  const retenus = entree.activites.flatMap((a) => {
    const ex = parId.get(a.ref);
    return ex ? [ex] : [];
  });

  /*
   * Plus de garde « une seule séance en cours » (16/08/2026).
   *
   * Elle existait pour que `seanceEnCoursPour` ne soit jamais ambigu. Sa
   * contrepartie est `seanceHoteDeLExercice` : le rattachement d'un exercice
   * terminé se fait maintenant sur le contexte explicite du workspace, pas sur
   * une déduction. Lever la garde SANS cette contrepartie rouvrirait le double
   * journal d'ADR-048 — les deux vont ensemble.
   */

  const maintenant = new Date().toISOString();
  // `date` borne `avancementSeance` : une séance planifiée garde la date prévue
  // tant qu'elle n'est pas démarrée, une séance lancée mord à l'instant réel.
  const date = mode === "en-cours" ? maintenant : (entree.planifieePour ?? maintenant);

  const seance: LearningSession = {
    id: nouvelId("ses"),
    date,
    // Pas de `dureeMin` : rien n'a encore eu lieu. Y mettre la durée cible
    // ferait passer une intention pour une mesure (P2).
    domaines: [...new Set(retenus.map((e) => e.domaine))],
    /*
     * Les compétences visées incluent la commande différée : une séance
     * planifiée sans exercices doit quand même dire ce qu'elle visera — ce
     * sont ces codes que le démarrage passera au tuteur (ADR-131).
     */
    skillCodes: [
      ...new Set([
        ...entree.blueprint.cibles.map((c) => c.code),
        ...(differee ? (entree.blueprint.origine?.codes ?? []) : []),
      ]),
    ],
    activites: entree.activites,
    genereAutomatiquement: false,
    statut: mode,
    ...(mode === "planifiee" && entree.planifieePour
      ? { planifieePour: entree.planifieePour }
      : {}),
    besoinDeclare: entree.besoin,
    blueprint: entree.blueprint,
    // Le mode épreuve s'écrit avec la séance, une seule fois, ou pas du tout :
    // `undefined` est omis par `entiteVersLigne`, donc les séances ordinaires
    // ne portent aucune trace du mode (même convention que `planifieePour`).
    ...(entree.modeEpreuve ? { modeEpreuve: true } : {}),
  };

  await ajouter("sessions", seance, dorsale);

  /*
   * La première tentative n'est PLUS ouverte ici (16/08/2026).
   *
   * Elle l'était pour qu'un exercice déjà travaillé s'ouvre vierge plutôt que
   * sur son historique — ce que `demarrerTentative` fait de toute façon quand
   * l'exercice s'affiche. Depuis que plusieurs séances peuvent être ouvertes,
   * la pré-ouverture lançait autant de chronomètres que de séances démarrées :
   * `dureeMin` est du temps d'horloge (ADR-071), et une tentative ouverte dans
   * une séance qu'on n'a pas encore regardée aurait mesuré du temps passé
   * ailleurs. Une mesure sans source (P2).
   *
   * La tentative s'ouvre donc là où le travail commence réellement : à
   * l'ouverture de l'exercice.
   */

  revalidatePath("/", "layout");
  return seance.id;
}

/**
 * Transforme une prochaine action unitaire en vraie séance puis laisse le
 * workspace focus la dérouler. On étend `LearningSession` : aucune entité
 * parallèle et aucune double entrée dans le journal.
 */
export async function creerSeanceFocusExercice(
  exerciceId: string,
  options: { premierParcours?: boolean } = {},
): Promise<string> {
  const dorsale = await dorsaleCompte();
  const exercice = (await catalogueExercices(dorsale)).get(exerciceId);
  if (!exercice || exercice.archive) throw new Error("Cet exercice n'est plus disponible.");

  // Le CTA peut être soumis une seconde fois avant que la redirection du
  // premier appel soit visible. Reprendre la séance déjà ouverte fait converger
  // les deux appels vers un seul journal, au lieu de laisser un doublon en cours.
  const existante = seanceEnCoursPour(exerciceId, await lire("sessions", dorsale));
  if (existante) return existante.id;

  return creerSeance(entreeFocusDepuisExercice(exercice, options), "en-cours");
}

function entreeFocusDepuisExercice(
  exercice: Exercise,
  options: { premierParcours?: boolean } = {},
  planifieePour?: string,
): EntreePlanification {
  const maintenant = new Date().toISOString();
  const codePrincipal = exercice.competences[0];
  if (!codePrincipal) throw new Error("Cet exercice ne cible aucune compétence.");

  return {
    besoin: {
      codesVises: exercice.competences,
      tempsDisponibleMin: exercice.dureeEstimeeMin,
      declareLe: maintenant,
    },
    blueprint: {
      dureeCibleMin: exercice.dureeEstimeeMin,
      nombreExercices: 1,
      portee: { type: "mono", domaine: exercice.domaine },
      cibles: [{
        code: codePrincipal,
        difficulte: exercice.difficulte,
        raison: "Exercice choisi depuis la prochaine action.",
      }],
      ...(options.premierParcours ? { premierParcours: true } : {}),
    },
    activites: [{ type: "exercice", ref: exercice.id, libelle: exercice.titre }],
    ...(planifieePour ? { planifieePour } : {}),
  };
}

/**
 * Accepte explicitement l'exercice recommandé à une date choisie par la
 * personne. La recommandation reste une projection : seule cette action crée
 * la séance persistée qui pourra rejoindre « Aujourd'hui ».
 */
export async function planifierExerciceRecommande(
  exerciceId: string,
  planifieePour: string,
): Promise<string> {
  if (typeof planifieePour !== "string" || !Number.isFinite(Date.parse(planifieePour))) {
    throw new Error("Choisissez une date et une heure valides.");
  }

  const dorsale = await dorsaleCompte();
  const exercice = (await catalogueExercices(dorsale)).get(exerciceId);
  if (!exercice || exercice.archive) throw new Error("Cet exercice n'est plus disponible.");

  return creerSeance(
    entreeFocusDepuisExercice(exercice, {}, new Date(planifieePour).toISOString()),
    "planifiee",
  );
}

/** Server Action utilisée par le CTA d'une prochaine action déjà disponible. */
export async function demarrerExerciceEnFocus(exerciceId: string): Promise<void> {
  const seanceId = await creerSeanceFocusExercice(exerciceId);
  redirect(`/seances?session=${encodeURIComponent(seanceId)}`);
}

/* ------------------------------------------------------------------ */
/* Cycle de vie                                                        */
/* ------------------------------------------------------------------ */

async function seanceDuCompte(
  seanceId: string,
  dorsale: DorsaleCompte,
): Promise<LearningSession> {
  const toutes = await lire("sessions", dorsale);
  const seance = toutes.find((s) => s.id === seanceId);
  if (!seance) throw new Error(`Séance introuvable : ${seanceId}`);
  return seance;
}

/**
 * Les minutes observées sur les activités de la séance, ou `null`.
 *
 * `null` et non `0` : aucune tentative ouverte n'est une absence de mesure, pas
 * une durée nulle (P2). C'est cette absence que `seanceALieu` lit pour refuser
 * de compter un abandon sec comme un jour de travail.
 *
 * Les tentatives abandonnées comptent : la minute passée est un fait, et c'est
 * déjà ce que fait le journal d'un abandon d'exercice hors séance.
 */
function dureeObservee(
  seance: LearningSession,
  tentatives: ExerciseAttempt[],
): number | null {
  const prevus = new Set([
    ...exercicesDeLaSeance(seance),
    ...lireInterventionsSeance(seance).interventions
      .filter((intervention) => intervention.source.kind === "exercise")
      .map((intervention) => intervention.source.ref),
  ]);
  const durees = tentatives
    .filter(
      (t) =>
        prevus.has(t.exerciseId) && t.debut >= seance.date && typeof t.dureeMin === "number",
    )
    .map((t) => t.dureeMin as number);
  return durees.length > 0 ? durees.reduce((s, d) => s + d, 0) : null;
}

/**
 * Démarre une séance planifiée.
 *
 * `date` est réécrite au moment du démarrage, et ce n'est pas cosmétique :
 * c'est elle qui borne `avancementSeance`. Une séance planifiée mardi et
 * démarrée jeudi compterait sinon comme siennes toutes les tentatives faites
 * entre-temps, et s'afficherait à moitié terminée avant d'avoir commencé.
 *
 * Plus aucune garde d'unicité : plusieurs séances peuvent être ouvertes en même
 * temps (16/08/2026). Ce que cette garde protégeait — le rattachement non
 * ambigu d'un exercice terminé — est désormais tenu par le contexte explicite
 * du workspace (`seanceHoteDeLExercice`).
 *
 * La destination est RETOURNÉE, pas jouée par `redirect` : appelée depuis une
 * transition client, une redirection traverse la promesse comme une erreur
 * NEXT_REDIRECT, affichée par le try/catch du composant après une écriture
 * réussie, sans navigation (défaut documenté du 23/08/2026). Même convention
 * que `abandonnerExercice`.
 */
export async function demarrerSeance(seanceId: string): Promise<string> {
  const dorsale = await dorsaleCompte();
  const seance = await seanceDuCompte(seanceId, dorsale);

  const statut = statutSeance(seance);
  if (statut !== "planifiee") {
    throw new Error(
      statut === "en-cours"
        ? "Cette séance est déjà en cours."
        : statut === "abandonnee"
          ? "Cette séance a été abandonnée : elle se reprend, elle ne se démarre pas."
          : "Cette séance est terminée : elle ne se redémarre pas. Compose-en une nouvelle.",
    );
  }

  /*
   * Préparation différée (ADR-131) : une séance protocole qui attend encore des
   * exercices ne démarre pas — le déroulé s'arrêterait sur du vide. L'écran la
   * fait préparer d'abord (« Préparer et démarrer ») ; ce garde protège les
   * chemins qui passeraient outre.
   */
  if (attendPreparationSeance(seance)) {
    throw new Error(
      "Cette séance attend ses exercices : passez par « Préparer et démarrer » pour que le tuteur écrive les manquants.",
    );
  }

  await modifier(
    "sessions",
    seanceId,
    { statut: "en-cours", date: new Date().toISOString() },
    dorsale,
  );
  revalidatePath("/", "layout");
  /*
   * `sas=1` : la coupure entre décider et travailler (ADR-103). Le paramètre
   * porte l'état — aucune clé navigateur — et `SasSeance` le retire de l'URL
   * dès l'affichage, pour qu'un rechargement ne le rejoue pas.
   */
  return `/seances?session=${encodeURIComponent(seanceId)}&focus=1&sas=1`;
}

/**
 * Clôt une séance et range au journal ce qui s'est passé.
 *
 * Le résultat compte, il ne juge pas (`resumeSeance`) : chaque exercice porte
 * déjà son propre résultat et sa propre observation. Poser une appréciation sur
 * l'ensemble serait une mesure de plus, sans rien pour l'étayer.
 *
 * `dureeMin` reste absente si aucune tentative n'a été menée. Zéro serait faux :
 * l'absence de mesure n'est pas une durée nulle (P2).
 *
 * La destination est retournée, pas jouée par `redirect` (même convention que
 * `demarrerSeance`).
 */
export async function terminerSeance(seanceId: string): Promise<string> {
  const dorsale = await dorsaleCompte();
  const seance = await seanceDuCompte(seanceId, dorsale);
  await ecrireClotureSeance(seanceId);
  return `/seances?jour=${encodeURIComponent(jourDeLaSeance(seance))}`;
}

/**
 * Clôt un geste non-exercice dans la séance courante.
 *
 * Le statut est un fait d'exécution rangé dans le JSONB déjà porté par la
 * séance ; il ne constitue ni une Observation ni une nouvelle entité de
 * travail. Les rendus exercice restent exclusivement clôturés par leur
 * parcours de preuve (`VueExercice`).
 */
export async function terminerIntervention(
  seanceId: string,
  interventionId: string,
): Promise<string> {
  const dorsale = await dorsaleCompte();
  const seance = await seanceDuCompte(seanceId, dorsale);
  if (statutSeance(seance) !== "en-cours") {
    throw new Error("Cette intervention ne peut être clôturée que dans une séance en cours.");
  }
  if (seance.interventions === undefined) {
    throw new Error("Cette séance historique ne porte pas d'intervention canonique à clôturer.");
  }

  const interventions = parseInterventionsSeance(seance.interventions);
  const index = interventions.findIndex((intervention) => intervention.id === interventionId);
  if (index < 0) throw new Error("Intervention introuvable dans cette séance.");
  const intervention = interventions[index];
  if (renduPourIntervention(intervention).kind === "exercise") {
    throw new Error("Une intervention d'exercice se clôture par son parcours de preuve.");
  }
  if (intervention.statut === "completed" || intervention.statut === "abandoned") {
    return `/seances?session=${encodeURIComponent(seanceId)}&intervention=${encodeURIComponent(interventionId)}`;
  }

  const misesAJour = interventions.map((candidate, candidateIndex) =>
    candidateIndex === index ? { ...candidate, statut: "completed" as const } : candidate,
  );
  const modifiee = await modifier("sessions", seanceId, { interventions: misesAJour }, dorsale);
  if (!modifiee) throw new Error("La séance n'est plus accessible dans ce compte.");
  revalidatePath("/", "layout");
  return `/seances?session=${encodeURIComponent(seanceId)}&intervention=${encodeURIComponent(interventionId)}`;
}

/** Variante liée pour les composants clients qui reçoivent une Server Action. */
export async function terminerInterventionPourSeance(
  interventionId: string,
  seanceId: string,
): Promise<string> {
  return terminerIntervention(seanceId, interventionId);
}

/**
 * Écrit la clôture d'une séance menée à son terme — sans aucune navigation.
 *
 * Corps commun de `terminerSeance` et de la clôture automatique du premier
 * parcours (`destinationApresExercice`) : une seule implémentation de ce que
 * « terminer une séance » écrit. Idempotent — rappeler sur une séance déjà
 * terminée ne réécrit rien (leçon d'ADR-072).
 */
export async function ecrireClotureSeance(seanceId: string): Promise<void> {
  const dorsale = await dorsaleCompte();
  const seance = await seanceDuCompte(seanceId, dorsale);

  if (statutSeance(seance) === "terminee") {
    return;
  }

  const tentatives = await lire("attempts", dorsale);
  const avancement = avancementSeance(seance, tentatives);
  const execution = seance.interventions !== undefined
    ? lireExecutionInterventions(seance, tentatives).executions
    : undefined;
  if (seance.interventions !== undefined) {
    if (!execution || !interventionsTerminees(execution)) {
      throw new Error("Toutes les interventions doivent être traitées avant de clôturer la séance.");
    }
  }

  await modifier(
    "sessions",
    seanceId,
    {
      statut: "terminee",
      resultat: execution ? resumeInterventions(execution) : resumeSeance(avancement),
      dureeMin: dureeObservee(seance, tentatives),
    },
    dorsale,
  );
  revalidatePath("/", "layout");
}

/**
 * Abandonne une séance : la refermer sans rien en conclure.
 *
 * ## Le manque qu'elle comble
 *
 * Une séance en cours n'avait qu'une sortie, `terminerSeance`, qui écrit un
 * résultat au journal. Une séance qu'on ne veut pas mener — mauvais moment,
 * mauvaise composition — n'avait donc aucune porte : elle restait ouverte
 * indéfiniment. C'est le même manque que celui qu'`abandonnerExercice` a comblé
 * un cran plus bas, et la réponse est la même.
 *
 * ## Ce qu'elle n'écrit pas
 *
 * **Aucune mesure sur la séance.** `resumeSeanceAbandonnee` compte ce qui a été
 * mené et ce qui ne l'a jamais été ; il ne qualifie pas. Un abandon dit qu'on
 * n'a pas continué, pas qu'on a échoué — les confondre poserait un jugement sur
 * un renoncement (P2, P3).
 *
 * **Aucune observation, ni aucune destruction d'observation.** Les exercices déjà menés
 * gardent les leurs : ce qui a été démontré reste démontré (P4).
 *
 * `dureeMin` reste `null` si rien n'a été ouvert, et c'est ce que `seanceALieu`
 * lit pour ne pas colorer une case du bandeau d'activité avec un abandon sec.
 *
 * ## Idempotence
 *
 * Rappeler la fonction sur une séance déjà abandonnée ne réécrit rien et ne
 * lève pas : c'est la leçon d'ADR-072, où douze clics sur « abandonner » ont
 * produit douze entrées de journal. Un geste répété par impatience ou par
 * double soumission doit converger, pas s'empiler.
 */
export async function abandonnerSeance(seanceId: string): Promise<string> {
  const dorsale = await dorsaleCompte();
  const seance = await seanceDuCompte(seanceId, dorsale);

  if (statutSeance(seance) === "abandonnee") {
    return `/seances?session=${encodeURIComponent(seanceId)}`;
  }

  await ecrireAbandon(seance, dorsale);
  revalidatePath("/", "layout");
  // Destination retournée, pas `redirect` : voir `demarrerSeance`.
  return "/seances";
}

/**
 * Abandon d'une séance depuis le tableau de bord.
 *
 * La même écriture que `abandonnerSeance` — le corps commun est
 * `ecrireAbandon` — mais sans redirection : on reste sur le tableau de bord,
 * dont la carte « séance en cours » laisse place à la prochaine suggestion
 * (le re-rendu est déclenché par `revalidatePath`, ADR-024).
 *
 * L'idempotence de `ecrireAbandon` s'applique ici aussi : un abandon déjà écrit
 * ne réécrit rien et ne lève pas (ADR-072).
 */
export async function abandonnerSeanceDepuisTableauDeBord(
  seanceId: string,
): Promise<void> {
  const dorsale = await dorsaleCompte();
  const seance = await seanceDuCompte(seanceId, dorsale);
  await ecrireAbandon(seance, dorsale);
  revalidatePath("/", "layout");
}

/**
 * Corps commun de l'abandon d'une séance : gardes de statut, clôture des
 * tentatives encore ouvertes, puis écriture de la séance. Aucune redirection :
 * c'est l'appelant qui décide où aller.
 */
async function ecrireAbandon(
  seance: LearningSession,
  dorsale: DorsaleCompte,
): Promise<void> {
  const statut = statutSeance(seance);

  if (statut === "abandonnee") {
    return;
  }
  if (statut === "terminee") {
    throw new Error(
      "Cette séance est terminée : ce qui a été fait est au journal, et ne s'abandonne pas après coup.",
    );
  }
  if (statut === "planifiee") {
    throw new Error(
      "Cette séance n'a pas commencé : elle s'annule, elle ne s'abandonne pas.",
    );
  }

  const date = new Date().toISOString();
  const tentatives = await lire("attempts", dorsale);
  const parId = await catalogueExercices(dorsale);
  const prevus = new Set([
    ...exercicesDeLaSeance(seance),
    ...lireInterventionsSeance(seance).interventions
      .filter((intervention) => intervention.source.kind === "exercise")
      .map((intervention) => intervention.source.ref),
  ]);

  /*
   * Les tentatives encore ouvertes de la séance sont refermées ici.
   *
   * Sans cela, l'exercice resterait « en cours » pour toujours dans une séance
   * qui, elle, ne l'est plus : `avancementSeance` compterait un travail en
   * cours que rien ne peut plus clore, et le chronomètre continuerait de courir
   * jusqu'à la prochaine ouverture de l'exercice. Le plafond d'ADR-071
   * s'applique — `dureeMin` est du temps d'horloge, pas du temps travaillé.
   */
  const ouvertes = tentatives.filter(
    (t) => prevus.has(t.exerciseId) && t.statut === "en-cours" && t.debut >= seance.date,
  );
  for (const tentative of ouvertes) {
    const exercice = parId.get(tentative.exerciseId);
    const ecouleMin = Math.round(
      (new Date(date).getTime() - new Date(tentative.debut).getTime()) / 60000,
    );
    const duree = exercice
      ? dureeRetenue({ statut: "abandonnee", dureeMin: ecouleMin }, exercice.dureeEstimeeMin) ?? 1
      : Math.max(1, ecouleMin);
    const activite = seance.activites.find(
      (item) => item.type === "exercice" && item.ref === tentative.exerciseId,
    ) ?? lireInterventionsSeance(seance).interventions
      .find(
        (intervention) =>
          intervention.source.kind === "exercise" &&
          intervention.source.ref === tentative.exerciseId,
      );
    if (!activite) {
      throw new Error(`Séance incohérente : activité absente pour ${tentative.exerciseId}.`);
    }
    const activiteJournal = "ref" in activite
      ? activite
      : { type: "exercice", ref: activite.source.ref, libelle: activite.label };

    await cloreExerciceAtomiquement({
      tentative: {
        id: tentative.id,
        exerciseId: tentative.exerciseId,
        fin: date,
        dureeMin: duree,
        statut: "abandonnee",
      },
      observations: [],
      // Cette charge n'est insérée que si la séance hôte disparaît entre les
      // lectures. Dans le cas normal, `seance.id` est verrouillée et tient déjà
      // l'unique entrée de journal.
      seance: {
        id: nouvelId("ses"),
        date,
        dureeMin: duree,
        domaines: exercice ? [exercice.domaine] : seance.domaines,
        skillCodes: exercice ? exercice.competences : seance.skillCodes,
        activites: [activiteJournal],
        resultat: "Tentative abandonnée — aucune observation enregistrée",
        genereAutomatiquement: true,
      },
      seanceIdContexte: seance.id,
      seanceHoteRequise: true,
    }, dorsale);
  }

  // Relu après les clôtures : les durées qui viennent d'être écrites font
  // partie du temps observé de la séance.
  const apres = await lire("attempts", dorsale);
  const avancement = avancementSeance(seance, apres);
  const execution = seance.interventions !== undefined
    ? lireExecutionInterventions(seance, apres).executions
    : undefined;

  await modifier(
    "sessions",
    seance.id,
    {
      statut: "abandonnee",
      resultat: execution
        ? resumeInterventions(execution, true)
        : resumeSeanceAbandonnee(avancement),
      dureeMin: dureeObservee(seance, apres),
    },
    dorsale,
  );
}

/**
 * Reprend une séance abandonnée là où elle s'est arrêtée.
 *
 * ⚠️ **`date` n'est pas réécrite**, à l'inverse de `demarrerSeance`, et
 * l'asymétrie est le cœur du geste. `date` borne `avancementSeance` : la
 * réécrire ferait perdre à la séance tout le travail déjà mené en son sein, qui
 * se retrouverait antérieur à son propre début. On rouvrirait une séance vide
 * en croyant reprendre — et « reprendre » redeviendrait « refaire ».
 *
 * `resultat` et `dureeMin` sont effacés : ils décrivaient un état clos qui ne
 * l'est plus. Les laisser afficherait au journal le bilan d'un abandon dans une
 * séance rouverte, et ils seront réécrits à la vraie clôture.
 */
export async function reprendreSeance(seanceId: string): Promise<string> {
  const dorsale = await dorsaleCompte();
  const seance = await seanceDuCompte(seanceId, dorsale);

  if (statutSeance(seance) === "en-cours") {
    return `/seances?session=${encodeURIComponent(seanceId)}`;
  }

  const tentatives = await lire("attempts", dorsale);
  const peutReprendre = seance.interventions !== undefined
    ? statutSeance(seance) === "abandonnee" &&
      !seance.renonceeLe &&
      interventionsAReprendre(lireExecutionInterventions(seance, tentatives).executions)
    : peutReprendreSeance(seance, avancementSeance(seance, tentatives));
  if (!peutReprendre) {
    throw new Error(
      "Cette séance n'a rien à reprendre : toutes ses activités ont été traitées. Compose-en une nouvelle.",
    );
  }

  await modifier(
    "sessions",
    seanceId,
    { statut: "en-cours", resultat: null, dureeMin: null },
    dorsale,
  );
  revalidatePath("/", "layout");
  // Reprendre est une entrée en travail comme une autre : même sas.
  // Destination retournée, pas `redirect` : voir `demarrerSeance`.
  return `/seances?session=${encodeURIComponent(seanceId)}&focus=1&sas=1`;
}

/**
 * Renonce définitivement à une séance abandonnée.
 *
 * Une séance `abandonnee` qui garde des exercices jamais ouverts reste « en
 * suspens » : le cahier la montre tant qu'elle demande un geste. Mais quand ce
 * geste ne viendra jamais — la séance a été oubliée, remplacée, abandonnée de
 * bon cœur — aucune porte de sortie n'existait : seule « Reprendre » était
 * proposée, et l'onglet restait ouvert indéfiniment.
 *
 * Le geste écrit `renonceeLe` : un fait daté, posé une fois. Il ne supprime
 * rien — la séance reste au cahier avec ses tentatives et son résultat — il
 * retire seulement l'attente d'une reprise qui n'aura pas lieu
 * (`peutReprendreSeance` devient faux).
 *
 * ## Gardes
 *
 * - déjà renoncée : idempotent, rien ne se réécrit (leçon d'ADR-072) ;
 * - en cours ou planifiée : erreur explicite — ces états ont leurs propres
 *   sorties (« Abandonner », « Annuler ») ;
 * - terminée, ou abandonnée sans rien à reprendre : erreur explicite — il
 *   n'y a précisément rien à renoncer.
 */
export async function renoncerSeance(seanceId: string): Promise<void> {
  const dorsale = await dorsaleCompte();
  const seance = await seanceDuCompte(seanceId, dorsale);
  const statut = statutSeance(seance);

  if (seance.renonceeLe) {
    return;
  }
  if (statut === "planifiee") {
    throw new Error(
      "Cette séance n'a pas commencé : elle s'annule plutôt qu'elle ne se renonce.",
    );
  }
  if (statut === "en-cours") {
    throw new Error(
      "Cette séance est en cours : abandonnez-la d'abord si vous ne voulez pas la mener.",
    );
  }

  const tentatives = await lire("attempts", dorsale);
  if (!peutReprendreSeance(seance, avancementSeance(seance, tentatives))) {
    throw new Error(
      "Cette séance n'attend plus rien : elle est déjà refermée dans le cahier.",
    );
  }

  await modifier(
    "sessions",
    seanceId,
    { renonceeLe: new Date().toISOString() },
    dorsale,
  );
  revalidatePath("/", "layout");
}

/**
 * Annule une séance qui n'a pas commencé.
 *
 * Elle refuse plutôt que de se replier en silence (ADR-027) : une séance en
 * cours porte des tentatives, et les tentatives ne s'effacent pas. Une séance
 * planifiée est conservée comme fait abandonné et renoncé ; aucune observation
 * n'est produite par l'annulation.
 */
export async function annulerSeance(seanceId: string): Promise<string> {
  const dorsale = await dorsaleCompte();
  const seance = await seanceDuCompte(seanceId, dorsale);

  if (statutSeance(seance) !== "planifiee") {
    throw new Error(
      "Seule une séance qui n'a pas commencé peut être annulée. Termine ou abandonne celle-ci : ce qui a été fait reste au journal.",
    );
  }

  await modifier(
    "sessions",
    seanceId,
    { statut: "abandonnee", renonceeLe: new Date().toISOString() },
    dorsale,
  );
  revalidatePath("/", "layout");
  // Destination retournée, pas `redirect` : voir `demarrerSeance`.
  return "/seances";
}
