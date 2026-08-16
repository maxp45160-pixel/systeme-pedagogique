/**
 * Correction d'une réponse par le tuteur — sans conversation.
 *
 * ⚠️ **C'est le seul endroit du système où le tuteur voit la correction d'un
 * exercice.** ADR-036 pose l'inverse : le tuteur connaît le corpus par ses
 * titres, ses compétences, sa difficulté et son état d'usage, jamais par ses
 * énoncés, et jamais par ses corrections. La raison était nette — un tuteur qui
 * a lu la correction ne peut plus guider vers elle sans la donner.
 *
 * Corriger exige pourtant de la lire. Sans elle, le tuteur ne corrigerait pas :
 * il improviserait un barème, et un barème improvisé qui remplit un formulaire
 * qui écrit une preuve est très exactement ce que ce système existe pour
 * empêcher.
 *
 * L'exception est donc **scopée**, par six verrous qui sont tous du code :
 *
 * 1. ce prompt, qui n'appelle jamais `construireContexte` — le test
 *    `contexte.test.ts` « ne transmet JAMAIS la correction » reste vrai et
 *    reste la garantie du chat ;
 * 2. une route dédiée ; `/api/tutor` ne lit toujours pas `exercice.correction` ;
 * 3. `outilCorrection` n'entre pas dans `outilsTuteur`, donc l'outil ne voyage
 *    pas avec les messages ;
 * 4. aucun historique de conversation : un seul message construit ici ;
 * 5. la sortie ne peut pas contenir la correction — `JUSTIFICATION_MAX` la
 *    borne et le validateur rejette au-delà ;
 * 6. la route ne sert qu'une tentative ouverte, du compte connecté, portant une
 *    réponse écrite.
 *
 * Ce que le tuteur ne fait toujours pas : écrire. Il propose un verdict que
 * l'utilisateur relit, modifie ou rejette. P5 tient à la lettre — mais il faut
 * dire franchement que le tuteur recommence à *proposer* une mesure, ce qu'il
 * avait cessé de faire le 04/08 (ADR-038).
 */

import type { Exercise } from "@/lib/domain/types";
import { LIBELLES_DIMENSIONS } from "@/lib/domain/types";
import { APPRECIATIONS, RESULTATS } from "@/lib/domain/bilan";
import type { MoteurTuteur } from "./moteurs";
import { lireErreurMoteur, lireOutilsActifs, messageSansOutils } from "./moteurs";
import { outilCorrection, type PropositionCorrection } from "./outils";

/* ------------------------------------------------------------------ */
/* Bornes                                                              */
/* ------------------------------------------------------------------ */

/**
 * Longueur maximale d'une réponse envoyée à la correction.
 *
 * Au-delà, la route **refuse** au lieu de tronquer. Un verdict rendu sur une
 * réponse amputée est une mesure dérivée d'une entrée partielle : elle aurait
 * l'air d'une mesure complète, et c'est P2 dans son esprit. 12 000 caractères
 * valent environ 3 000 jetons — la plus longue réponse jamais enregistrée en
 * fait 1 183 (mesuré le 07/08/2026), donc la borne est large, et c'est voulu :
 * elle protège contre l'aberration, pas contre l'usage.
 */
export const REPONSE_MAX_CARACTERES = 12_000;

/**
 * Un verdict « réussi » ne peut pas être déduit d'un jeton isolé que le sujet
 * ne contient nulle part. Cette barrière reste volontairement étroite : elle
 * ne rejette pas une réponse et ne fabrique pas un échec, elle empêche
 * seulement le tuteur de transformer un texte manifestement sans rapport en
 * réussite automatique. La personne peut alors remplir le bilan elle-même.
 */
export function reponseTropPauvrePourUneReussiteAutomatique(
  reponse: string,
  exercice: Pick<Exercise, "titre" | "enonce" | "criteres">,
): boolean {
  const extraireMots = (texte: string) =>
    texte
      .toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .split(/\s+/)
      .filter((mot) => mot.length >= 3);

  const motsReponse = extraireMots(reponse.trim());
  if (motsReponse.length !== 1) return false;

  const motsExercice = new Set(
    extraireMots(
      [exercice.titre, exercice.enonce, ...exercice.criteres.map((critere) => critere.libelle)].join(
        " ",
      ),
    ),
  );

  return !motsExercice.has(motsReponse[0]);
}

export interface ResultatCorrection {
  /** Verdict validé, prêt à pré-remplir le bilan. `null` si rien d'exploitable. */
  correction: PropositionCorrection | null;
  /** Le fournisseur a-t-il servi les outils ? Voir `ResultatGeneration`. */
  outilsActifs: boolean;
  /** Message d'erreur, ou `null` si la correction a abouti. */
  erreur: string | null;
}

/* ------------------------------------------------------------------ */
/* Prompt                                                              */
/* ------------------------------------------------------------------ */

/**
 * Le prompt système de la correction.
 *
 * Volontairement court, comme celui de `generation.ts` : ni protocole
 * d'évaluation complet, ni profil, ni corpus, ni priorités. Ce qui est
 * nécessaire tient en quatre blocs — l'énoncé, la correction de référence, les
 * critères numérotés, et le barème.
 *
 * Le barème est **importé** de `lib/domain/bilan.ts`, jamais recopié : c'est ce
 * qui garantit que le tuteur juge sur la même échelle que celle affichée à
 * l'utilisateur. Une divergence entre les deux ne lèverait aucune erreur.
 *
 * La consigne centrale est la dernière : **juger ce que la réponse contient**.
 * Un correcteur qui complète mentalement ce qu'il devine de l'intention de
 * l'auteur note une compétence qu'il a lui-même fournie.
 */
export function construirePromptCorrection(
  exercice: Pick<Exercise, "titre" | "enonce" | "correction" | "criteres">,
): string {
  const criteres = exercice.criteres.map(
    (c, i) => `${i + 1}. ${c.libelle} — dimension : ${LIBELLES_DIMENSIONS[c.dimension]}`,
  );

  return [
    "Tu es le tuteur du système pédagogique. Tu relis la réponse d'une personne à un exercice et tu rends un verdict, critère par critère.",
    "",
    "TU N'ENREGISTRES RIEN.",
    "Ton verdict est une proposition. La personne le relit, le modifie ou le rejette avant qu'aucune mesure ne soit écrite.",
    "",
    `EXERCICE — ${exercice.titre}`,
    exercice.enonce,
    "",
    "CORRECTION DE RÉFÉRENCE (elle t'est donnée pour corriger ; ne la recopie pas dans tes justifications)",
    exercice.correction,
    "",
    "CRITÈRES, dans l'ordre où tu dois les numéroter",
    ...criteres,
    "",
    "BARÈME PAR CRITÈRE",
    ...APPRECIATIONS.map((a) => `- ${a.valeur} = ${a.libelle}`),
    "",
    "RÉSULTAT GLOBAL",
    ...RESULTATS.map((r) => `- ${r.valeur} = ${r.aide}`),
    "",
    "COMMENT JUGER",
    "- Une appréciation porte sur ce que la réponse CONTIENT. Ce qui n'y figure pas n'est pas démontré : ne complète pas ce que tu devines de l'intention.",
    "- Une méthode juste menant à un résultat faux n'est pas un échec : dis-le critère par critère.",
    "- Chaque justification cite ce que la réponse contient ou omet, en une à deux phrases.",
    "- Tu dois couvrir TOUS les critères. Un critère oublié fait rejeter ta correction entière.",
    "",
    /*
     * Le bilan rédigé (ADR-046). Le tuteur savait déjà juger ; il n'avait pas
     * de place pour dire pourquoi, ni pour orienter la suite. Ces consignes
     * sont ce qui sépare une grille de cases d'un retour de tuteur.
     */
    "COMMENT RÉDIGER LE BILAN",
    "- Il s'adresse à la personne, pas au système. Tutoie, et parle de sa réponse à elle.",
    "- points_forts : ce qui est réellement acquis, cité. Si rien ne l'est, dis-le — un encouragement à vide se repère et décrédibilise le reste.",
    "- points_bloquants : l'erreur, PUIS ce qu'elle empêche. Remonte à l'incompréhension quand tu la vois, plutôt que de décrire le symptôme.",
    "- a_retravailler : formule sur la PERSONNE, pas sur cet exercice. « Confond médiane et moyenne » se relit dans six semaines ; « question 3 fausse » ne se relit pas.",
    "- Ce sont les seuls éléments que tu reverras dans une conversation ultérieure : écris-les pour ton toi futur, qui n'aura ni l'énoncé ni la correction sous les yeux.",
    "- Le bilan ne porte aucune note. N'y remets pas de barème, et n'y recopie pas la correction de référence.",
    "",
    "Appelle l'outil proposer_correction UNE fois. Ne recopie pas le contenu de l'appel dans ta réponse.",
  ].join("\n");
}

/* ------------------------------------------------------------------ */
/* Correction                                                          */
/* ------------------------------------------------------------------ */

/**
 * Fait relire une réponse par le moteur et collecte le verdict.
 *
 * `envoyer` collecte au lieu de diffuser — même mécanique que `genererExercices`.
 *
 * ⚠️ `diffuser` ne relaie **pas** les événements `texte`, et c'est délibéré.
 * Seule la sortie structurée est exploitée ici ; laisser passer la prose
 * rejouerait la duplication observée sur Mistral (ADR-031), où le tuteur
 * écrivait l'exercice deux fois — une fois en texte, une fois dans l'appel
 * d'outil. Ici ce serait pire : le texte pourrait contenir la correction, que
 * l'utilisateur n'a pas encore demandé à voir.
 */
export async function corrigerReponse(
  moteur: MoteurTuteur,
  exercice: Exercise,
  reponse: string,
  signal?: AbortSignal,
  diffuser?: (evenement: string, donnees: unknown) => void,
): Promise<ResultatCorrection> {
  let correction: PropositionCorrection | null = null;
  let outilsActifs = true;
  /** La panne annoncée par le moteur — clé refusée, quota, modèle absent. */
  let panne: string | null = null;

  const envoyer = (evenement: string, donnees: unknown) => {
    if (evenement !== "texte") diffuser?.(evenement, donnees);

    const actifs = lireOutilsActifs(evenement, donnees);
    if (actifs !== null) outilsActifs = actifs;
    panne = panne ?? lireErreurMoteur(evenement, donnees);

    if (evenement === "proposition") {
      const proposition = donnees as { genre: string; correction?: PropositionCorrection };
      if (proposition.genre === "correction" && proposition.correction) {
        correction = proposition.correction;
      }
    }
  };

  const messages = [
    {
      role: "user" as const,
      content: `Voici ma réponse. Corrige-la.\n\n${reponse.trim()}`,
    },
  ];

  await moteur.repondre({
    systemeStable: construirePromptCorrection(exercice),
    systemeProfil: "",
    // Un seul outil, et pas ceux du chat : la correction ne peut pas déraper
    // en création d'exercice ou en proposition de branche.
    outils: [outilCorrection(exercice.criteres)],
    messages,
    signal,
    envoyer,
  });

  const correctionRecue = correction as PropositionCorrection | null;

  if (
    correctionRecue?.resultat.trim().toLowerCase() === "reussi" &&
    reponseTropPauvrePourUneReussiteAutomatique(reponse, exercice)
  ) {
    return {
      correction: null,
      outilsActifs,
      erreur:
        "La réponse est trop pauvre pour être validée automatiquement comme réussie. Relis et remplis le bilan toi-même.",
    };
  }

  const erreur =
    correctionRecue !== null
      ? null
      : (panne ??
        (outilsActifs
          ? "Le tuteur n'a produit aucune correction exploitable."
          : messageSansOutils("la correction assistée")));

  return { correction: correctionRecue, outilsActifs, erreur };
}
