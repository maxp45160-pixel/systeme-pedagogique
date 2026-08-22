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

import type { Dimension, Exercise, ResultatTentative } from "@/lib/domain/types";
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
  /**
   * Progrès d'aptitude par tentative menée **au bon niveau de difficulté**.
   *
   * Le gain réel est modulé par la pertinence de l'exercice (`gainDApprentissage`) :
   * jusqu'au 21/08/2026 il était constant, si bien qu'un exercice trivial
   * rapportait autant qu'un exercice ajusté. La politique « toujours facile »
   * devenait alors optimale par construction, et la mesure « exercices servis
   * dans la zone » ne pouvait avoir aucune conséquence — on comparait des
   * stratégies de difficulté dans un monde où la difficulté ne changeait rien.
   */
  apprentissage: number;
  /** Part des propositions ignorées — une recommandation n'est pas un ordre. */
  tauxIgnore: number;
  /** Facteur appliqué à la durée estimée de l'exercice. */
  lenteur: number;
  /**
   * PART de l'acquis perdue par mois sans pratique — corrigé le 21/08/2026.
   *
   * C'était auparavant une quantité absolue de niveaux par mois. Avec 0,4 et des
   * reprises espacées de deux mois, l'oubli dépassait systématiquement les gains :
   * mesuré sur 45 parcours, l'apprenant simulé gagnait 0,14 niveau en dix-huit
   * mois et AUCUN objectif n'était jamais réellement atteint. On ne mesurait plus
   * un moteur pédagogique, on mesurait un apprenant qui n'apprend pas — et tout
   * objectif que le moteur déclarait résolu était un faux positif.
   *
   * Une part, donc, appliquée à ce qui a été appris : on n'oublie jamais plus
   * que ce qu'on a acquis, et jamais l'aptitude de départ, qui n'a pas été
   * apprise ici.
   *
   * S'y ajoute la CONSOLIDATION : plus une compétence a été pratiquée, moins
   * elle se perd (`1 / (1 + pratiques / 4)`). C'est le fait le mieux établi de
   * la littérature sur l'espacement, et sans lui la répétition espacée n'aurait
   * rien à démontrer — réviser ne servirait qu'à repousser la même chute.
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
  justification: 0.8,
};
const DIMENSIONS_INTEGRATION_REUSSIE: Partial<Record<Dimension, number>> = {
  ...DIMENSIONS_REUSSITE,
  transfert: 0.8,
  integration: 0.8,
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

/**
 * Ce qu'une tentative fait apprendre, selon l'écart à l'aptitude et le résultat.
 *
 * Deux effets, tous deux nécessaires pour que la difficulté servie ait des
 * conséquences :
 *
 * - **la difficulté désirable** — le gain culmine un demi-niveau AU-DESSUS de
 *   l'aptitude et retombe des deux côtés. Réviser ce qu'on sait déjà n'apprend
 *   presque rien ; buter sur trois niveaux au-dessus non plus.
 * - **l'issue** — une réussite consolide plus qu'un échec, sans que l'échec ne
 *   rapporte rien : on apprend aussi de ce qui résiste, à condition d'avoir
 *   cherché.
 *
 * Ce n'est pas une loi de l'apprentissage : c'est une hypothèse explicite,
 * lisible, et qu'on peut remplacer. Elle vaut mieux que l'hypothèse implicite
 * qu'elle remplace — « la difficulté ne change rien » — qui, elle, était fausse
 * sans le dire.
 */
const ECART_OPTIMAL = 0.5;
const LARGEUR_ZONE = 1.2;

const RENDEMENT_RESULTAT: Record<ResultatTentative, number> = {
  reussi: 1,
  partiel: 0.8,
  echec: 0.5,
};

export function gainDApprentissage(
  apprentissage: number,
  ecartDifficulte: number,
  resultat: ResultatTentative,
): number {
  const pertinence = Math.exp(
    -((ecartDifficulte - ECART_OPTIMAL) ** 2) / (2 * LARGEUR_ZONE ** 2),
  );
  return apprentissage * pertinence * RENDEMENT_RESULTAT[resultat];
}

export function creerApprenant(profil: ProfilApprenant, graine: number): Apprenant {
  const suivant = tirage(graine);
  /** Acquis courant par compétence, déjà amputé des oublis passés. */
  const acquis = new Map<string, number>();
  const dernierePratique = new Map<string, string>();
  const pratiques = new Map<string, number>();
  const partOubliee = profil.oubli ?? 0;

  /** L'acquis restant à `date`, une fois l'oubli du temps écoulé appliqué. */
  const acquisA = (code: string, date?: string): number => {
    const courant = acquis.get(code) ?? 0;
    const depuis = dernierePratique.get(code);
    if (partOubliee <= 0 || courant <= 0 || !date || !depuis) return courant;
    const jours = (new Date(date).getTime() - new Date(depuis).getTime()) / JOUR_MS;
    if (jours <= 0) return courant;

    // Consolidation : chaque pratique rend l'oubli plus lent.
    const taux = partOubliee / (1 + (pratiques.get(code) ?? 0) / 4);
    return Math.max(0, courant * Math.pow(1 - Math.min(0.95, taux), jours / 30));
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
    pratiques.set(code, (pratiques.get(code) ?? 0) + 1);
    if (contexte.date) dernierePratique.set(code, contexte.date);

    // Logistique centrée sur l'aptitude : à difficulté égale à l'aptitude, une
    // chance sur deux. La pente est raide pour que le parcours bouge vite.
    const ecart = aptitude - contexte.exercice.difficulte;
    const chance = 1 / (1 + Math.exp(-1.1 * ecart));
    const tirageResultat = suivant();

    const resultat: Jeu["resultat"] =
      tirageResultat < chance ? "reussi" : tirageResultat < chance + 0.25 ? "partiel" : "echec";

    // Le gain dépend de ce qui vient de se passer : il se calcule donc APRÈS le
    // tirage du résultat, et sur l'écart réel entre l'exercice et l'aptitude.
    acquis.set(
      code,
      restant + gainDApprentissage(profil.apprentissage, -ecart, resultat),
    );

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
          ? contexte.exercice.competences.length > 1
            ? DIMENSIONS_INTEGRATION_REUSSIE
            : DIMENSIONS_REUSSITE
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
