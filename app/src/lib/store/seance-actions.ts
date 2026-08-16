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
 * L'avancement d'une séance — qui est fait, qui reste — n'est écrit nulle part.
 * Il se dérive des tentatives à chaque lecture (`avancementSeance`), comme les
 * niveaux se dérivent des preuves (P1). Une colonne « exercices terminés »
 * aurait été une seconde vérité, libre de diverger de la première au premier
 * abandon non enregistré.
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
import { verifier } from "./supabase-backend";
import {
  avancementSeance,
  exercicesDeLaSeance,
  motifRefusActivites,
  motifRefusBesoin,
  motifRefusBlueprint,
  peutReprendreSeance,
  resumeSeance,
  resumeSeanceAbandonnee,
  statutSeance,
} from "@/lib/domain/seance";
import { dureeRetenue } from "@/lib/domain/tentative";
import type {
  BesoinDeclare,
  BlueprintSeance,
  ExerciseAttempt,
  LearningSession,
} from "@/lib/domain/types";

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

  const exercices = await lire("exercises", dorsale);
  const parId = new Map(exercices.map((e) => [e.id, e]));
  const inconnus = entree.activites
    .filter((a) => a.type === "exercice" && !parId.has(a.ref))
    .map((a) => a.ref);
  if (inconnus.length > 0) {
    throw new Error(`Exercice(s) introuvable(s) dans la séance : ${inconnus.join(", ")}.`);
  }

  const refusActivites = motifRefusActivites(entree.activites);
  if (refusActivites) throw new Error(refusActivites);

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
    skillCodes: [...new Set(entree.blueprint.cibles.map((c) => c.code))],
    activites: entree.activites,
    genereAutomatiquement: false,
    statut: mode,
    ...(mode === "planifiee" && entree.planifieePour
      ? { planifieePour: entree.planifieePour }
      : {}),
    besoinDeclare: entree.besoin,
    blueprint: entree.blueprint,
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
export async function creerSeanceFocusExercice(exerciceId: string): Promise<string> {
  const dorsale = await dorsaleCompte();
  const exercices = await lire("exercises", dorsale);
  const exercice = exercices.find((item) => item.id === exerciceId && !item.archive);
  if (!exercice) throw new Error("Cet exercice n'est plus disponible.");

  const maintenant = new Date().toISOString();
  const codePrincipal = exercice.competences[0];
  if (!codePrincipal) throw new Error("Cet exercice ne cible aucune compétence.");

  return creerSeance(
    {
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
      },
      activites: [{ type: "exercice", ref: exercice.id, libelle: exercice.titre }],
    },
    "en-cours",
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
  const prevus = new Set(exercicesDeLaSeance(seance));
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
 */
export async function demarrerSeance(seanceId: string): Promise<void> {
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

  await modifier(
    "sessions",
    seanceId,
    { statut: "en-cours", date: new Date().toISOString() },
    dorsale,
  );
  revalidatePath("/", "layout");
  redirect(`/seances?session=${encodeURIComponent(seanceId)}`);
}

/**
 * Clôt une séance et range au journal ce qui s'est passé.
 *
 * Le résultat compte, il ne juge pas (`resumeSeance`) : chaque exercice porte
 * déjà son propre résultat et sa propre preuve. Poser une appréciation sur
 * l'ensemble serait une mesure de plus, sans rien pour l'étayer.
 *
 * `dureeMin` reste absente si aucune tentative n'a été menée. Zéro serait faux :
 * l'absence de mesure n'est pas une durée nulle (P2).
 */
export async function terminerSeance(seanceId: string): Promise<void> {
  const dorsale = await dorsaleCompte();
  const seance = await seanceDuCompte(seanceId, dorsale);

  if (statutSeance(seance) === "terminee") {
    throw new Error("Cette séance est déjà terminée.");
  }

  const tentatives = await lire("attempts", dorsale);
  const avancement = avancementSeance(seance, tentatives);

  await modifier(
    "sessions",
    seanceId,
    {
      statut: "terminee",
      resultat: resumeSeance(avancement),
      dureeMin: dureeObservee(seance, tentatives),
    },
    dorsale,
  );
  revalidatePath("/", "layout");
  redirect(`/seances?session=${encodeURIComponent(seanceId)}`);
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
 * **Aucune preuve, ni aucune destruction de preuve.** Les exercices déjà menés
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
export async function abandonnerSeance(seanceId: string): Promise<void> {
  const dorsale = await dorsaleCompte();
  const seance = await seanceDuCompte(seanceId, dorsale);
  const statut = statutSeance(seance);

  if (statut === "abandonnee") {
    redirect(`/seances?session=${encodeURIComponent(seanceId)}`);
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
  const exercices = await lire("exercises", dorsale);
  const parId = new Map(exercices.map((e) => [e.id, e]));
  const prevus = new Set(exercicesDeLaSeance(seance));

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
    await modifier(
      "attempts",
      tentative.id,
      { fin: date, dureeMin: duree, statut: "abandonnee" as const },
      dorsale,
    );
  }

  // Relu après les clôtures : les durées qui viennent d'être écrites font
  // partie du temps observé de la séance.
  const apres = await lire("attempts", dorsale);
  const avancement = avancementSeance(seance, apres);

  await modifier(
    "sessions",
    seanceId,
    {
      statut: "abandonnee",
      resultat: resumeSeanceAbandonnee(avancement),
      dureeMin: dureeObservee(seance, apres),
    },
    dorsale,
  );
  revalidatePath("/", "layout");
  redirect("/seances");
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
export async function reprendreSeance(seanceId: string): Promise<void> {
  const dorsale = await dorsaleCompte();
  const seance = await seanceDuCompte(seanceId, dorsale);

  if (statutSeance(seance) === "en-cours") {
    redirect(`/seances?session=${encodeURIComponent(seanceId)}`);
  }

  const tentatives = await lire("attempts", dorsale);
  if (!peutReprendreSeance(seance, avancementSeance(seance, tentatives))) {
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
  redirect(`/seances?session=${encodeURIComponent(seanceId)}`);
}

/**
 * Annule une séance qui n'a pas commencé.
 *
 * Elle refuse plutôt que de se replier en silence (ADR-027) : une séance en
 * cours porte des tentatives, et
 * les tentatives ne s'effacent pas. Le geste attendu là est de la terminer, pas
 * de la faire disparaître — une fonction qui fait autre chose que ce que son nom
 * annonce s'érode.
 */
export async function annulerSeance(seanceId: string): Promise<void> {
  const dorsale = await dorsaleCompte();
  const seance = await seanceDuCompte(seanceId, dorsale);

  if (statutSeance(seance) !== "planifiee") {
    throw new Error(
      "Seule une séance qui n'a pas commencé peut être annulée. Termine ou abandonne celle-ci : ce qui a été fait reste au journal.",
    );
  }

  const { error } = await dorsale.supabase
    .from("sessions")
    .delete()
    .eq("user_id", dorsale.userId)
    .eq("id", seanceId);
  verifier("annulation de la séance", error);
  revalidatePath("/", "layout");
  redirect("/seances");
}
