"use server";

/**
 * Server Functions — les seules écritures du système.
 *
 * Chacune s'exécute au nom du compte connecté : `dorsaleCompte()` redirige vers
 * `/login` sans session, et les politiques RLS de PostgreSQL restent la barrière
 * d'autorisation (ADR-015). Le tuteur n'a aucun accès à ce module : il émet une
 * proposition, l'utilisateur la valide, et c'est cette validation qui écrit (P5).
 *
 * Toutes appellent `revalidatePath("/", "layout")` (ADR-024). Une écriture peut
 * déplacer un niveau, un score global et une recommandation à la fois : à 77
 * lignes en base, invalider tout coûte moins cher que de raisonner, à chaque
 * ajout, sur les écrans qu'une preuve touche. Cette uniformité est aussi ce qui
 * rend sûr le cache routeur client de `next.config.ts`.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ajouter, ajouterPlusieurs, dorsaleCompte, lire, modifier, nouvelId } from "./db";
import { lireReferentiel } from "./referentiel";
import {
  autonomieDepuisIndices,
  autonomieObservee,
  LIBELLE_AIDE,
  qualiteDepuisDifficulte,
  qualiteDepuisNature,
  type AideExterne,
} from "@/lib/engine/preuve";
import { tentativeMenee } from "@/lib/engine/calibration";
import type {
  Difficulte,
  Dimension,
  DomaineId,
  Exercise,
  ExerciseAttempt,
  LearningSession,
  SkillEvidence,
  TypeExercice,
} from "@/lib/domain/types";

/* ------------------------------------------------------------------ */
/* Exercices                                                           */
/* ------------------------------------------------------------------ */

export async function demarrerTentative(exerciseId: string): Promise<void> {
  const dorsale = await dorsaleCompte();
  const existantes = await lire("attempts", dorsale);
  const enCours = existantes.find(
    (t) => t.exerciseId === exerciseId && t.statut === "en-cours",
  );
  if (!enCours) {
    await ajouter("attempts", {
      id: nouvelId("att"),
      exerciseId,
      debut: new Date().toISOString(),
      indicesUtilises: 0,
      reponse: "",
      autoEvaluation: {},
      resultat: "partiel",
      statut: "en-cours",
    } satisfies ExerciseAttempt, dorsale);
  }
  revalidatePath("/", "layout");
}

/**
 * `indicesUtilises` est le compteur courant, lu par la page qui rend le bouton.
 * Le passer évite de relire la tentative pour l'incrémenter : une requête au
 * lieu de deux. Deux onglets cliquant à la même seconde perdraient un
 * incrément — un compte est une personne, et la garde optimiste alternative
 * transformerait la perte en indice affiché mais non compté, c'est-à-dire en
 * autonomie surestimée. C'est le défaut connu qu'on refuse d'aggraver (P8).
 */
export async function debloquerIndice(
  attemptId: string,
  indicesUtilises: number,
): Promise<void> {
  const dorsale = await dorsaleCompte();
  await modifier("attempts", attemptId, { indicesUtilises: indicesUtilises + 1 }, dorsale);
  revalidatePath("/", "layout");
}

export async function enregistrerReponse(attemptId: string, reponse: string): Promise<void> {
  const dorsale = await dorsaleCompte();
  await modifier("attempts", attemptId, { reponse }, dorsale);
  revalidatePath("/", "layout");
}

export interface SoumissionExercice {
  attemptId: string;
  exerciseId: string;
  resultat: "reussi" | "partiel" | "echec";
  autoEvaluation: Partial<Record<Dimension, number>>;
  dureeMin: number;
  notes?: string;
}

/**
 * Clôture une tentative et écrit la ou les preuves correspondantes.
 *
 * C'est le seul chemin par lequel une compétence peut évoluer depuis
 * l'interface. La preuve porte l'autonomie observée, la qualité déduite de
 * la difficulté, et pointe vers la tentative qui la justifie
 * (protocole anti-hallucination §4, traçabilité).
 */
export async function terminerExercice(soumission: SoumissionExercice): Promise<void> {
  const dorsale = await dorsaleCompte();
  const exercices = await lire("exercises", dorsale);
  const { EXERCICES_DIAGNOSTIC } = await import("@/lib/seed/exercises");
  const exercice =
    exercices.find((e) => e.id === soumission.exerciseId) ??
    EXERCICES_DIAGNOSTIC.find((e) => e.id === soumission.exerciseId);
  if (!exercice) throw new Error(`Exercice introuvable : ${soumission.exerciseId}`);

  const date = new Date().toISOString();

  /*
   * Une tentative qui n'a pas eu lieu ne produit aucune preuve.
   *
   * `tentativeMenee` (lib/engine/calibration.ts) porte la règle : sous 25 % de
   * la durée estimée, sans réussite, on ne peut rien conclure. Elle gouvernait
   * la calibration de la difficulté depuis ADR-028 et **pas** l'écriture de la
   * preuve — d'où, le 01/08/2026, une preuve à toutes dimensions nulles écrite
   * depuis un abandon d'1 minute sur 20 estimées, qui a fait tomber DEV-01 de
   * 2,7 à 2,3. « L'absence de mesure n'est pas un zéro » (P2) était tenu d'un
   * côté et rompu de l'autre.
   *
   * La tentative reste écrite en base : c'est un fait observé, et `verdictTentative`
   * la lit pour expliquer pourquoi aucune difficulté n'est conseillée. Seul le
   * journal de preuves — la chaîne qui fait bouger un niveau — la refuse.
   */
  const menee = tentativeMenee(
    { resultat: soumission.resultat, dureeMin: soumission.dureeMin },
    exercice,
  );

  // La tentative renvoyée est celle qui vient d'être écrite : `indicesUtilises`
  // s'y lit sans relecture, et c'est lui qui détermine l'autonomie observée.
  const tentative = await modifier("attempts", soumission.attemptId, {
    fin: date,
    dureeMin: soumission.dureeMin,
    autoEvaluation: soumission.autoEvaluation,
    resultat: soumission.resultat,
    statut: (menee ? "terminee" : "abandonnee") as "terminee" | "abandonnee",
    notes: soumission.notes,
  }, dorsale);
  if (!tentative) throw new Error("Tentative introuvable");

  if (!menee) {
    // Le journal d'activité, lui, enregistre ce qui s'est passé : la minute
    // passée est un fait, et la taire ferait disparaître l'abandon du suivi.
    await ajouter("sessions", {
      id: nouvelId("ses"),
      date,
      dureeMin: soumission.dureeMin,
      domaines: [exercice.domaine],
      skillCodes: exercice.competences,
      activites: [{ type: "exercice", ref: exercice.id, libelle: exercice.titre }],
      resultat: "Tentative abandonnée — trop courte pour conclure",
      difficulte: `Difficulté ${exercice.difficulte}/5 · ${soumission.dureeMin} min sur ${exercice.dureeEstimeeMin} estimées`,
      notePersonnelle: soumission.notes,
      genereAutomatiquement: true,
    } satisfies LearningSession, dorsale);

    revalidatePath("/", "layout");
    redirect(`/exercices/${exercice.id}?abandon=1`);
  }

  const autonomie = autonomieDepuisIndices(tentative.indicesUtilises, exercice.indices.length);
  const qualite = qualiteDepuisDifficulte(exercice.difficulte, autonomie);

  // Une preuve par compétence ciblée. Les compétences secondaires sont
  // enregistrées comme preuve indirecte (niveau B), pas directe.
  const preuves: SkillEvidence[] = exercice.competences.map((code, index) => ({
    id: nouvelId("ev"),
    skillCode: code,
    date,
    type:
      exercice.type === "programmation"
        ? "code" as const
        : exercice.type === "etude-de-cas"
          ? "etude-de-cas" as const
          : exercice.type === "calcul"
            ? "calcul" as const
            : "exercice" as const,
    niveauPreuve: (index === 0 ? "A" : "B") as "A" | "B",
    autonomie,
    qualite,
    resultat: soumission.resultat,
    contexte: exercice.titre,
    dimensions: soumission.autoEvaluation,
    competencesCombinees:
      exercice.competences.length > 1
        ? exercice.competences.filter((c) => c !== code)
        : undefined,
    source: { kind: "exercice" as const, ref: exercice.id },
    commentaire: soumission.notes,
  }));
  await ajouterPlusieurs("evidence", preuves, dorsale);

  // Une entrée de journal est produite automatiquement (instructions §15 :
  // la maintenance du système se fait en arrière-plan).
  const session: LearningSession = {
    id: nouvelId("ses"),
    date,
    dureeMin: soumission.dureeMin,
    domaines: [exercice.domaine],
    skillCodes: exercice.competences,
    activites: [
      { type: "exercice", ref: exercice.id, libelle: exercice.titre },
    ],
    resultat:
      soumission.resultat === "reussi"
        ? "Exercice réussi"
        : soumission.resultat === "partiel"
          ? "Exercice partiellement réussi"
          : "Exercice non abouti",
    difficulte: `Difficulté ${exercice.difficulte}/5 · ${tentative.indicesUtilises} indice(s) consulté(s)`,
    notePersonnelle: soumission.notes,
    genereAutomatiquement: true,
  };
  await ajouter("sessions", session, dorsale);

  revalidatePath("/", "layout");
  redirect(`/exercices/${exercice.id}?bilan=1`);
}

/* ------------------------------------------------------------------ */
/* Preuve manuelle (hors exercice du store)                            */
/* ------------------------------------------------------------------ */

export interface SoumissionPreuveManuelle {
  skillCode: string;
  date?: string; // ISO ; défaut : maintenant
  type: SkillEvidence["type"];
  niveauPreuve: "A" | "B";
  /**
   * L'aide extérieure remplace l'autonomie auto-déclarée (ADR-033).
   *
   * L'utilisateur ne choisit plus un palier de l'échelle A0–A4 : il répond à
   * une question de fait — de quelle aide a-t-il disposé — et le moteur en
   * dérive l'autonomie. Une échelle à cinq crans demandait de connaître le
   * protocole pour être remplie honnêtement.
   */
  aideExterne: AideExterne;
  resultat: "reussi" | "partiel" | "echec";
  contexte: string;
  dimensions: Partial<Record<Dimension, number>>;
  competencesCombinees?: string[];
  sourceRef: string; // description vérifiable : "Script Python exécuté le 26/07", etc.
  commentaire?: string;
}

/**
 * Deuxième chemin d'écriture d'une preuve, à côté de `terminerExercice`.
 * Couvre tout travail qui ne passe pas par un `Exercise` du store : script
 * exécuté seul, exercice papier, synthèse d'un échange avec le tuteur.
 *
 * Mêmes garde-fous : source toujours renseignée, dimensions non observées
 * simplement omises (jamais un 0 par défaut).
 *
 * L'autonomie n'est plus déclarée ici non plus (ADR-033). L'utilisateur
 * répond « de quelle aide as-tu disposé ? » ; le moteur en dérive le palier.
 * Ce chemin n'ayant aucun indice interne à compter, l'aide extérieure est le
 * seul signal — mais c'est un fait constatable, pas une auto-évaluation.
 * La qualité se dérive de même (§6).
 */
export async function enregistrerPreuveManuelle(
  soumission: SoumissionPreuveManuelle,
): Promise<void> {
  if (!soumission.contexte.trim()) throw new Error("Le contexte est obligatoire.");
  if (!soumission.sourceRef.trim()) throw new Error("La source est obligatoire.");

  const dorsale = await dorsaleCompte();

  // Le référentiel est propre au compte (ADR-026) : la vérification porte sur
  // celui de l'appelant, jamais sur une table globale. Elle double la clé
  // étrangère `evidence_competence_fk`, qui reste la barrière de confiance —
  // ici on veut surtout un message lisible plutôt qu'une erreur SQL.
  const referentiel = await lireReferentiel(dorsale);
  const skill = referentiel.parCode.get(soumission.skillCode);
  if (!skill) throw new Error(`Compétence inconnue : ${soumission.skillCode}`);

  const date = soumission.date ?? new Date().toISOString();

  // Aucun indice interne sur ce chemin : `0 / 0` donne A3, que le plafond de
  // l'aide extérieure rabaisse ensuite s'il y a lieu.
  const autonomie = autonomieObservee(0, 0, soumission.aideExterne);

  const preuve: SkillEvidence = {
    id: nouvelId("ev"),
    skillCode: soumission.skillCode,
    date,
    type: soumission.type,
    niveauPreuve: soumission.niveauPreuve,
    autonomie,
    qualite: qualiteDepuisNature(soumission.type, autonomie),
    resultat: soumission.resultat,
    contexte: soumission.contexte.trim(),
    dimensions: soumission.dimensions,
    competencesCombinees: soumission.competencesCombinees?.length
      ? soumission.competencesCombinees
      : undefined,
    source: { kind: "manuel", ref: soumission.sourceRef.trim() },
    // Ce qui est consigné est le FAIT déclaré, pas l'inférence : « aide
    // extérieure : assistant IA » se relit et se conteste, « autonomie A1 »
    // non — on ne saurait plus d'où le palier vient.
    commentaire: [
      `Aide extérieure déclarée : ${LIBELLE_AIDE[soumission.aideExterne]}.`,
      soumission.commentaire?.trim(),
    ]
      .filter(Boolean)
      .join(" — "),
  };
  await ajouter("evidence", preuve, dorsale);

  // Même logique que `terminerExercice` : une entrée de journal automatique
  // (instructions §15 — la maintenance se fait en arrière-plan).
  const session: LearningSession = {
    id: nouvelId("ses"),
    date,
    domaines: [skill.domaine],
    skillCodes: [soumission.skillCode],
    activites: [
      { type: "preuve-manuelle", ref: preuve.id, libelle: soumission.contexte.trim() },
    ],
    resultat:
      soumission.resultat === "reussi"
        ? "Preuve enregistrée manuellement — réussie"
        : soumission.resultat === "partiel"
          ? "Preuve enregistrée manuellement — partielle"
          : "Preuve enregistrée manuellement — non aboutie",
    notePersonnelle: soumission.commentaire,
    genereAutomatiquement: true,
  };
  await ajouter("sessions", session, dorsale);

  revalidatePath("/", "layout");
}

/* ------------------------------------------------------------------ */
/* Création manuelle d'un exercice                                     */
/* ------------------------------------------------------------------ */

export interface SoumissionExerciceManuel {
  titre: string;
  domaine: DomaineId;
  type: TypeExercice;
  difficulte: Difficulte;
  competences: string[];
  dureeEstimeeMin: number;
  enonce: string;
  indices: string[];
  correction: string;
  criteres: { dimension: Dimension; libelle: string }[];
  /**
   * D'où vient l'énoncé (ADR-004). « tuteur » quand le formulaire a été
   * pré-rempli par une proposition du tuteur, « manuel » quand l'utilisateur
   * l'a écrit lui-même. Défaut prudent : « manuel ».
   *
   * Ce champ n'est pas décoratif : il rend traçable un corpus que personne ne
   * relit (P3). Il est affiché dans la liste des exercices.
   */
  origine?: Extract<Exercise["origine"], "tuteur" | "manuel">;
}

/**
 * Crée un exercice depuis l'interface. Jamais `diagnostic: true` (§1.4) — ce
 * champ reste réservé aux 10 exercices du plan d'évaluation initiale.
 */
export async function creerExercice(soumission: SoumissionExerciceManuel): Promise<string> {
  if (!soumission.titre.trim()) throw new Error("Le titre est obligatoire.");
  if (!soumission.enonce.trim()) throw new Error("L'énoncé est obligatoire.");
  if (!soumission.correction.trim()) throw new Error("La correction est obligatoire.");
  if (soumission.competences.length === 0) throw new Error("Au moins une compétence est requise.");
  if (soumission.criteres.length === 0) throw new Error("Au moins un critère est requis.");

  const dorsale = await dorsaleCompte();
  const referentiel = await lireReferentiel(dorsale);

  // Un exercice attaché à une compétence inexistante produirait des preuves que
  // rien ne lirait — exactement ce que `dansLePerimetre` filtre déjà côté
  // lecture, mais refusé ici à l'écriture plutôt que masqué à l'affichage.
  const inconnues = soumission.competences.filter((c) => !referentiel.codesActifs.has(c));
  if (inconnues.length > 0) {
    throw new Error(`Compétence(s) hors de ton périmètre : ${inconnues.join(", ")}`);
  }

  const exercice: Exercise = {
    id: nouvelId("ex"),
    titre: soumission.titre.trim(),
    domaine: soumission.domaine,
    type: soumission.type,
    difficulte: soumission.difficulte,
    competences: soumission.competences,
    dureeEstimeeMin: soumission.dureeEstimeeMin,
    enonce: soumission.enonce,
    indices: soumission.indices.filter((i) => i.trim().length > 0),
    correction: soumission.correction,
    criteres: soumission.criteres,
    diagnostic: false,
    // « seed » est réservé aux exercices livrés avec le logiciel : une écriture
    // depuis l'interface ne peut jamais s'en réclamer.
    origine: soumission.origine === "tuteur" ? "tuteur" : "manuel",
  };
  await ajouter("exercises", exercice, dorsale);
  revalidatePath("/", "layout");
  return exercice.id;
}

/* ------------------------------------------------------------------ */
/* Journal                                                             */
/* ------------------------------------------------------------------ */

/** Appelée par `<form action={ajouterNoteSession.bind(null, sessionId)}>`. */
export async function ajouterNoteSession(
  sessionId: string,
  formData: FormData,
): Promise<void> {
  const note = String(formData.get("note") ?? "").trim();
  // `null` et non `undefined` : vider le champ doit effacer la note en base,
  // là où `undefined` signifierait « ne pas y toucher ».
  await modifier("sessions", sessionId, { notePersonnelle: note || null });
  revalidatePath("/", "layout");
}

