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
import { ajouter, dorsaleCompte, lire, modifier, nouvelId, type DorsaleCompte } from "./db";
import { verifier } from "./supabase-backend";
import {
  avancementSeance,
  exercicesDeLaSeance,
  motifRefusBesoin,
  motifRefusBlueprint,
  resumeSeance,
  statutSeance,
} from "@/lib/domain/seance";
import type {
  BesoinDeclare,
  BlueprintSeance,
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

/**
 * Écrit une séance planifiée.
 *
 * Les deux validations viennent du domaine (`lib/domain/seance.ts`) et sont les
 * mêmes que celles de l'écran : une seule autorité, sinon on ferait entrer par
 * le serveur ce que le formulaire refuse, ou l'inverse (ADR-044, ADR-047).
 *
 * ⚠️ Les références d'activité sont vérifiées contre les exercices du compte.
 * L'interface ne propose que des exercices existants, mais l'interface est
 * contournable : une séance citant un exercice inconnu produirait un déroulé
 * qui s'arrête sur une page introuvable, et un journal qui ne résout plus.
 */
export async function planifierSeance(entree: EntreePlanification): Promise<string> {
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

  const retenus = entree.activites.flatMap((a) => {
    const ex = parId.get(a.ref);
    return ex ? [ex] : [];
  });

  const date = entree.planifieePour ?? new Date().toISOString();
  const seance: LearningSession = {
    id: nouvelId("ses"),
    date,
    // Pas de `dureeMin` : rien n'a encore eu lieu. Y mettre la durée cible
    // ferait passer une intention pour une mesure (P2).
    domaines: [...new Set(retenus.map((e) => e.domaine))],
    skillCodes: [...new Set(entree.blueprint.cibles.map((c) => c.code))],
    activites: entree.activites,
    genereAutomatiquement: false,
    statut: "planifiee",
    ...(entree.planifieePour ? { planifieePour: entree.planifieePour } : {}),
    besoinDeclare: entree.besoin,
    blueprint: entree.blueprint,
  };

  await ajouter("sessions", seance, dorsale);
  revalidatePath("/", "layout");
  return seance.id;
}

/* ------------------------------------------------------------------ */
/* Cycle de vie                                                        */
/* ------------------------------------------------------------------ */

async function seanceDuCompte(
  seanceId: string,
  dorsale: DorsaleCompte,
): Promise<{ seance: LearningSession; toutes: LearningSession[] }> {
  const toutes = await lire("sessions", dorsale);
  const seance = toutes.find((s) => s.id === seanceId);
  if (!seance) throw new Error(`Séance introuvable : ${seanceId}`);
  return { seance, toutes };
}

/**
 * Démarre une séance planifiée.
 *
 * `date` est réécrite au moment du démarrage, et ce n'est pas cosmétique :
 * c'est elle qui borne `avancementSeance`. Une séance planifiée mardi et
 * démarrée jeudi compterait sinon comme siennes toutes les tentatives faites
 * entre-temps, et s'afficherait à moitié terminée avant d'avoir commencé.
 *
 * Une seule séance en cours à la fois. Ce n'est pas une contrainte de confort :
 * `seanceEnCoursPour` désigne la séance à laquelle rattacher un exercice
 * terminé, et deux séances ouvertes rendraient ce rattachement arbitraire.
 */
export async function demarrerSeance(seanceId: string): Promise<void> {
  const dorsale = await dorsaleCompte();
  const { seance, toutes } = await seanceDuCompte(seanceId, dorsale);

  const statut = statutSeance(seance);
  if (statut !== "planifiee") {
    throw new Error(
      statut === "en-cours"
        ? "Cette séance est déjà en cours."
        : "Cette séance est terminée : elle ne se redémarre pas. Compose-en une nouvelle.",
    );
  }

  const autre = toutes.find((s) => s.id !== seanceId && statutSeance(s) === "en-cours");
  if (autre) {
    throw new Error(
      "Une autre séance est déjà en cours. Termine-la avant d'en démarrer une seconde.",
    );
  }

  await modifier(
    "sessions",
    seanceId,
    { statut: "en-cours", date: new Date().toISOString() },
    dorsale,
  );
  revalidatePath("/", "layout");
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
  const { seance } = await seanceDuCompte(seanceId, dorsale);

  if (statutSeance(seance) === "terminee") {
    throw new Error("Cette séance est déjà terminée.");
  }

  const tentatives = await lire("attempts", dorsale);
  const avancement = avancementSeance(seance, tentatives);

  const prevus = new Set(exercicesDeLaSeance(seance));
  const durees = tentatives
    .filter(
      (t) =>
        prevus.has(t.exerciseId) && t.debut >= seance.date && typeof t.dureeMin === "number",
    )
    .map((t) => t.dureeMin as number);
  const dureeMin = durees.length > 0 ? durees.reduce((s, d) => s + d, 0) : null;

  await modifier(
    "sessions",
    seanceId,
    {
      statut: "terminee",
      resultat: resumeSeance(avancement),
      dureeMin,
    },
    dorsale,
  );
  revalidatePath("/", "layout");
}

/**
 * Annule une séance qui n'a pas commencé.
 *
 * Elle refuse plutôt que de se replier en silence, comme `supprimerExercice` et
 * `supprimerCompetence` (ADR-027) : une séance en cours porte des tentatives, et
 * les tentatives ne s'effacent pas. Le geste attendu là est de la terminer, pas
 * de la faire disparaître — une fonction qui fait autre chose que ce que son nom
 * annonce s'érode.
 */
export async function annulerSeance(seanceId: string): Promise<void> {
  const dorsale = await dorsaleCompte();
  const { seance } = await seanceDuCompte(seanceId, dorsale);

  if (statutSeance(seance) !== "planifiee") {
    throw new Error(
      "Seule une séance qui n'a pas commencé peut être annulée. Termine celle-ci : ce qui a été fait reste au journal.",
    );
  }

  const { error } = await dorsale.supabase
    .from("sessions")
    .delete()
    .eq("user_id", dorsale.userId)
    .eq("id", seanceId);
  verifier("annulation de la séance", error);
  revalidatePath("/", "layout");
}
