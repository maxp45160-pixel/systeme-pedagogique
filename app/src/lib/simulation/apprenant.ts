/**
 * L'apprenant simulé — un modèle, pas une personne.
 *
 * Il décide ce qui arrive quand un exercice est proposé : réussite ou échec,
 * durée, indices consultés. Aucune de ces valeurs n'est une mesure : ce sont
 * les **entrées** du moteur, fabriquées pour l'éprouver. Rien de ce que produit
 * ce module n'a de sens hors de la simulation.
 *
 * Deux exigences de forme :
 *
 * - **déterministe** — un tirage pseudo-aléatoire à graine, jamais `Math.random`.
 *   Deux exécutions du même scénario doivent donner exactement le même journal,
 *   sinon une anomalie observée ne se reproduit pas et ne se corrige pas.
 * - **honnête sur son ignorance** — le modèle ne cherche pas à imiter un
 *   apprentissage réel, dont on ne sait rien. Il applique une règle simple et
 *   lisible : plus l'exercice dépasse l'aptitude, moins ça passe.
 */

import type { Dimension, Exercise } from "@/lib/domain/types";
import type { EvenementScenario } from "./types";

/** Tirage pseudo-aléatoire à graine — LCG « Numerical Recipes ». */
export function tirage(graine: number): () => number {
  let etat = graine >>> 0;
  return () => {
    etat = (Math.imul(1_664_525, etat) + 1_013_904_223) >>> 0;
    return etat / 4_294_967_296;
  };
}

export interface ProfilApprenant {
  /**
   * Aptitude par compétence, dans [1,5] : la difficulté à laquelle la personne
   * réussit une fois sur deux. Non observable par le moteur — c'est justement
   * ce qu'il doit approcher.
   */
  aptitude: Record<string, number>;
  /** Progrès d'aptitude par tentative menée sur la compétence. */
  apprentissage: number;
  /** Part des propositions ignorées — une recommandation n'est pas un ordre. */
  tauxIgnore: number;
  /** Facteur appliqué à la durée estimée de l'exercice. */
  lenteur: number;
  /**
   * Aptitude acquise perdue par mois sans pratique sur la compétence.
   *
   * Absent ou nul, personne n'oublie jamais rien : un parcours long ne montre
   * alors qu'une montée monotone, et la révision espacée n'a rien à rattraper.
   * Seul l'ACQUIS s'oublie — jamais l'aptitude de départ, qui n'a pas été
   * apprise ici et n'a aucune raison de disparaître.
   */
  oubli?: number;
}

type Jeu = Omit<
  Extract<EvenementScenario, { type: "tentative" }>,
  "date" | "exercice" | "type"
>;

const DIMENSIONS_REUSSITE: Partial<Record<Dimension, number>> = {
  comprehension: 1,
  application: 1,
  transfert: 0.8,
  justification: 0.8,
};
const DIMENSIONS_PARTIEL: Partial<Record<Dimension, number>> = {
  comprehension: 0.8,
  application: 0.5,
  justification: 0.3,
};
const DIMENSIONS_ECHEC: Partial<Record<Dimension, number>> = {
  comprehension: 0.4,
  application: 0.2,
};

/**
 * Construit la fonction `jouer` attendue par `deroulerParcoursPilote`.
 *
 * L'aptitude monte avec les tentatives menées sur la compétence : sans ça, un
 * parcours long ne montrerait jamais qu'un plateau, et la calibration n'aurait
 * rien à suivre.
 */
export interface Apprenant {
  jouer: (contexte: {
    exercice: Exercise;
    etat: { skill: { code: string } };
    /** Date du pas — sert à l'oubli. Absente, rien ne s'oublie. */
    date?: string;
  }) => Jeu | null;
  /**
   * L'aptitude atteinte à cet instant, compétence par compétence.
   *
   * C'est la **vérité terrain** de la simulation : le moteur ne la voit jamais,
   * et c'est précisément à elle qu'on compare le niveau qu'il a estimé. Sans
   * ça, on ne peut dire que « le moteur a produit des chiffres », pas « le
   * moteur voit juste ».
   *
   * `date` fait courir l'oubli jusque-là : sans elle, l'acquis est lu tel qu'il
   * était à la dernière pratique, ce qui surestimerait un apprenant en pause.
   */
  aptitudes: (date?: string) => Record<string, number>;
}

const JOUR_MS = 86_400_000;

export function creerApprenant(profil: ProfilApprenant, graine: number): Apprenant {
  const suivant = tirage(graine);
  /** Acquis courant par compétence, déjà amputé des oublis passés. */
  const acquis = new Map<string, number>();
  const dernierePratique = new Map<string, string>();
  const oubliParMois = profil.oubli ?? 0;

  /** L'acquis restant à `date`, une fois l'oubli du temps écoulé appliqué. */
  const acquisA = (code: string, date?: string): number => {
    const courant = acquis.get(code) ?? 0;
    const depuis = dernierePratique.get(code);
    if (oubliParMois <= 0 || courant <= 0 || !date || !depuis) return courant;
    const jours = (new Date(date).getTime() - new Date(depuis).getTime()) / JOUR_MS;
    if (jours <= 0) return courant;
    return Math.max(0, courant - (oubliParMois * jours) / 30);
  };

  const jouer = (contexte: {
    exercice: Exercise;
    etat: { skill: { code: string } };
    date?: string;
  }): Jeu | null => {
    if (suivant() < profil.tauxIgnore) return null;

    const code = contexte.etat.skill.code;
    const base = profil.aptitude[code] ?? 2.5;
    const restant = acquisA(code, contexte.date);
    const aptitude = base + restant;
    acquis.set(code, restant + profil.apprentissage);
    if (contexte.date) dernierePratique.set(code, contexte.date);

    // Logistique centrée sur l'aptitude : à difficulté égale à l'aptitude, une
    // chance sur deux. La pente est raide pour que le parcours bouge vite.
    const ecart = aptitude - contexte.exercice.difficulte;
    const chance = 1 / (1 + Math.exp(-1.1 * ecart));
    const tirageResultat = suivant();

    const resultat: Jeu["resultat"] =
      tirageResultat < chance ? "reussi" : tirageResultat < chance + 0.25 ? "partiel" : "echec";

    // Plus c'est dur, plus on consulte : les indices sont le seul signal
    // d'autonomie non déclaratif du produit (protocole §5).
    const indicesPossibles = contexte.exercice.indices.length;
    const indicesUtilises =
      resultat === "reussi"
        ? Math.min(indicesPossibles, suivant() < 0.75 ? 0 : 1)
        : Math.min(indicesPossibles, 1 + Math.floor(suivant() * indicesPossibles));

    // Durée : autour de l'estimation, plus longue quand ça résiste. Jamais sous
    // le quart de l'estimation, sinon `tentativeMenee` la traite en abandon —
    // ce qui est le bon comportement, mais ce n'est pas ce qu'on simule ici.
    const facteur =
      profil.lenteur * (resultat === "reussi" ? 0.8 : 1.15) * (0.75 + suivant() * 0.5);
    const dureeMin = Math.max(
      Math.ceil(contexte.exercice.dureeEstimeeMin * 0.3),
      Math.round(contexte.exercice.dureeEstimeeMin * facteur),
    );

    return {
      resultat,
      indicesUtilises,
      dureeMin,
      evaluation:
        resultat === "reussi"
          ? DIMENSIONS_REUSSITE
          : resultat === "partiel"
            ? DIMENSIONS_PARTIEL
            : DIMENSIONS_ECHEC,
    };
  };

  const aptitudes = (date?: string): Record<string, number> => {
    const courantes: Record<string, number> = {};
    for (const [code, base] of Object.entries(profil.aptitude)) {
      courantes[code] = Math.round((base + acquisA(code, date)) * 100) / 100;
    }
    return courantes;
  };

  return { jouer, aptitudes };
}
