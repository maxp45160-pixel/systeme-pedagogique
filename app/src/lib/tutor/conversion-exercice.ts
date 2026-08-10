/**
 * Proposition du tuteur → exercice enregistrable.
 *
 * `PropositionExercice` porte tout en **chaînes brutes** : c'est ce que le
 * modèle a écrit, pas ce que le domaine accepte. Ce module fait la traversée,
 * et il la fait selon une seule règle :
 *
 * > **Une valeur illisible fait échouer la conversion. Elle n'est jamais
 * > remplacée par un défaut.**
 *
 * C'est la règle d'ADR-034 et de P2, et elle a déjà coûté deux fois. Le
 * 02/08/2026, `exercises.difficulte` était une colonne TEXT et `"1" + 0` valait
 * `"10"` : deux compétences se voyaient conseiller la difficulté 5 sur la foi
 * d'un partiel obtenu à difficulté 1. La modale de génération a rejoué le motif
 * sous une autre forme — `Number(p.difficulte) || 2` et
 * `Number(p.dureeEstimeeMin) || 30` — qui écrit un nombre que personne n'a
 * mesuré, sans le dire.
 *
 * `dureeEstimeeMin` mérite une mention à part : c'est la valeur dont
 * `tentativeMenee` se sert pour décider si une tentative a **eu lieu** (seuil de
 * 25 %, `lib/engine/calibration.ts`). La fabriquer ne produit pas seulement un
 * exercice approximatif : elle corrompt la détection d'abandon, donc le journal
 * de preuves. C'est exactement le défaut qu'ADR-030 a corrigé.
 *
 * Module **pur** : aucune entrée/sortie, aucun accès base. Il ne valide pas le
 * périmètre des compétences — `creerExercice` s'en charge contre le référentiel
 * du compte, et lui seul peut le faire.
 */

import type { Difficulte, Dimension, IntentionExercice, TypeExercice } from "@/lib/domain/types";
import {
  DIFFICULTE_MAX,
  DIFFICULTE_MIN,
  DUREE_ESTIMEE_MAX,
  DUREE_ESTIMEE_MIN,
} from "@/lib/domain/exercice";
import type { PropositionExercice } from "./proposition";

const TYPES: TypeExercice[] = [
  "rappel",
  "application",
  "calcul",
  "probleme",
  "etude-de-cas",
  "programmation",
  "simulation",
  "projet",
];

const INTENTIONS: IntentionExercice[] = ["decouverte", "consolidation", "transfert", "revision"];

const DIMENSIONS: Dimension[] = [
  "comprehension",
  "application",
  "transfert",
  "integration",
  "justification",
];

/**
 * Durée estimée plafond. Au-delà, ce n'est plus un exercice mais un projet, et
 * le seuil de 25 % de `tentativeMenee` n'aurait plus de sens : 25 % de huit
 * heures laisserait passer deux heures d'abandon comme une tentative menée.
 *
 * ⚠️ Ce plafond valait 480 alors que le schéma de `proposer_exercice` en
 * imposait 240 : la conversion laissait donc passer, et `creerExercice` écrivait,
 * une durée que le tuteur n'avait pas le droit de proposer. Les deux bornes
 * vivent désormais dans `lib/domain/exercice.ts`, importées par les trois
 * couches — le schéma, la conversion, l'écriture. Ce nom reste pour les
 * appelants ; il ne porte plus de valeur propre.
 */
export const DUREE_MAX_MIN = DUREE_ESTIMEE_MAX;

export type Conversion<T> =
  | { ok: true; valeur: T }
  | { ok: false; erreurs: string[] };

export interface ExerciceEnregistrable {
  titre: string;
  type: TypeExercice;
  difficulte: Difficulte;
  competences: string[];
  dureeEstimeeMin: number;
  enonce: string;
  indices: string[];
  correction: string;
  criteres: { dimension: Dimension; libelle: string }[];
  /** Absente = non renseignée. Jamais déduite (P2). */
  intention?: IntentionExercice;
}

/** Normalise pour comparaison : sans accent, sans casse, tirets unifiés. */
function nu(brut: string): string {
  return brut
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-");
}

/** `"3"` → `3`. Toute valeur hors 1–5 rend `null` — on ne borne pas, on refuse. */
export function versDifficulte(brut: string): Difficulte | null {
  const n = Number.parseInt(brut.trim(), 10);
  if (!Number.isInteger(n) || n < DIFFICULTE_MIN || n > DIFFICULTE_MAX) return null;
  return n as Difficulte;
}

export function versType(brut: string): TypeExercice | null {
  const candidat = nu(brut);
  return TYPES.find((t) => t === candidat) ?? null;
}

export function versDimension(brut: string): Dimension | null {
  const candidat = nu(brut);
  return DIMENSIONS.find((d) => d === candidat) ?? null;
}

/**
 * Vide → absente, jamais une erreur : `intention` est optionnelle. Une valeur
 * non vide mais hors liste, en revanche, fait échouer la conversion — même
 * règle que `versType` et `versDimension`, aucune valeur illisible ne
 * disparaît en silence.
 */
export function versIntention(brut: string): IntentionExercice | null | undefined {
  const trimmed = brut.trim();
  if (!trimmed) return undefined;
  const candidat = nu(trimmed);
  return INTENTIONS.find((i) => i === candidat) ?? null;
}

/**
 * `"30"` → `30`. Refuse zéro, le négatif et l'aberrant.
 *
 * Une durée nulle ferait diviser par zéro la fraction de `tentativeMenee` —
 * qui s'en protège (`estimee > 0`), mais en concluant alors que **toute**
 * tentative a eu lieu. Un exercice sans durée exploitable désarme le garde-fou
 * au lieu de le déclencher.
 */
export function versDuree(brut: string): number | null {
  const n = Number.parseInt(brut.trim(), 10);
  if (!Number.isInteger(n) || n < DUREE_ESTIMEE_MIN || n > DUREE_ESTIMEE_MAX) return null;
  return n;
}

/**
 * Convertit une proposition en exercice enregistrable, ou dit pourquoi elle
 * n'est pas convertible.
 *
 * Toutes les erreurs sont collectées, pas seulement la première : l'utilisateur
 * doit voir d'un coup ce qui cloche, et non les découvrir une par une.
 */
export function convertirProposition(
  p: PropositionExercice,
): Conversion<ExerciceEnregistrable> {
  const erreurs: string[] = [];

  const titre = p.titre.trim();
  if (!titre) erreurs.push("Le titre est vide.");

  const enonce = p.enonce.trim();
  if (!enonce) erreurs.push("L'énoncé est vide.");

  const correction = p.correction.trim();
  if (!correction) erreurs.push("La correction est vide.");

  const competences = p.competences.map((c) => c.trim()).filter(Boolean);
  if (competences.length === 0) erreurs.push("Aucune compétence ciblée.");

  const type = versType(p.type);
  if (type === null) erreurs.push(`Type d'exercice illisible : « ${p.type} ».`);

  const difficulte = versDifficulte(p.difficulte);
  if (difficulte === null) {
    erreurs.push(
      `Difficulté illisible : « ${p.difficulte} ». Attendu un entier de 1 à 5 — aucune valeur n'est déduite à sa place.`,
    );
  }

  const dureeEstimeeMin = versDuree(p.dureeEstimeeMin);
  if (dureeEstimeeMin === null) {
    erreurs.push(
      `Durée estimée illisible : « ${p.dureeEstimeeMin} ». C'est elle qui permet de juger si une tentative a eu lieu, elle ne peut pas être supposée.`,
    );
  }

  // Un critère dont la dimension est inconnue est écarté et signalé — il ne
  // vaut pas de rejeter l'exercice entier, mais il ne passe pas en silence.
  const criteres: { dimension: Dimension; libelle: string }[] = [];
  for (const c of p.criteres) {
    const libelle = c.libelle.trim();
    if (!libelle) continue;
    const dimension = versDimension(c.dimension);
    if (dimension === null) {
      erreurs.push(`Critère « ${libelle} » : dimension inconnue « ${c.dimension} ».`);
      continue;
    }
    criteres.push({ dimension, libelle });
  }
  if (criteres.length === 0) erreurs.push("Aucun critère exploitable.");

  const intention = versIntention(p.intention ?? "");
  if (intention === null) {
    erreurs.push(`Intention illisible : « ${p.intention} ».`);
  }

  if (erreurs.length > 0) return { ok: false, erreurs };

  return {
    ok: true,
    valeur: {
      titre,
      type: type as TypeExercice,
      difficulte: difficulte as Difficulte,
      competences,
      dureeEstimeeMin: dureeEstimeeMin as number,
      enonce,
      indices: p.indices.map((i) => i.trim()).filter(Boolean),
      correction,
      criteres,
      ...(intention ? { intention } : {}),
    },
  };
}
