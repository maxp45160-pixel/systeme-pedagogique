/**
 * Moteur de recommandation — « prochaine meilleure action ».
 *
 * Applique la priorisation du protocole d'évaluation §16 :
 * importance pour l'objectif, niveau actuel, lacunes, prérequis,
 * ancienneté de la dernière pratique, potentiel de transfert.
 *
 * Le facteur « fréquence des erreurs » du §16 a été retiré le 28/07/2026 avec
 * l'entité `ErrorItem` (ADR-014) : il n'a jamais rien pondéré, la table étant
 * restée vide. Il sera reposé sous sa vraie forme — une difficulté dérivée des
 * preuves — quand le maillon « ajustement des exercices » sera traité.
 *
 * Deux garde-fous :
 * - §16 « ne travaille pas uniquement les compétences les plus faibles » :
 *   l'entretien d'une compétence acquise mais ancienne pèse dans le calcul ;
 * - la raison affichée est construite à partir des facteurs réellement
 *   dominants, jamais d'un texte rédigé d'avance.
 */

import {
  ORDRE_PALIERS,
  type Difficulte,
  type Exercise,
  type ExerciseAttempt,
  type SkillState,
} from "@/lib/domain/types";
import type { Calibration } from "./calibration";

export interface Facteur {
  libelle: string;
  contribution: number;
  /** Formulation destinée à la phrase de justification. */
  phrase: string;
}

export interface Recommandation {
  etat: SkillState;
  valeur: number;
  facteurs: Facteur[];
  /** Phrase construite à partir des deux facteurs dominants. */
  raison: string;
  exercice: Exercise | null;
  difficulteCible: Difficulte;
  dureeEstimeeMin: number;
  /**
   * Calibration dérivée des tentatives (ADR-028), ou `null` si aucune n'est
   * exploitable. Portée jusqu'à l'interface pour que le « Pourquoi ? » puisse
   * citer la tentative qui a produit la difficulté visée.
   */
  calibration: Calibration | null;
}

/**
 * Difficulté visée pour le prochain exercice.
 *
 * Deux sources, dans cet ordre :
 *
 *   1. la CALIBRATION dérivée des tentatives (ADR-028) — ce que l'exercice
 *      précédent a réellement produit : réussi sans aide en moitié moins de
 *      temps que prévu, ou échoué indices épuisés ;
 *   2. à défaut, la table par niveau ci-dessous.
 *
 * L'ordre est le 3ᵉ maillon de la boucle. La table seule ne regarde que le
 * niveau dérivé, jamais comment la dernière tentative s'est passée : elle
 * proposait la même difficulté à qui vient d'échouer et à qui vient de réussir
 * sans effort. C'était l'ajustement manquant.
 *
 * `null` en calibration n'est pas un défaut : c'est le cas normal d'une
 * compétence jamais travaillée en exercice. On retombe alors sur le niveau, et
 * la raison affichée le dit (P3 — aucune valeur sans sa source).
 */
function difficulteDepuisNiveau(etat: SkillState): Difficulte {
  const n = etat.niveau;
  if (n === null) return 2; // diagnostic : difficulté standard, sans aide
  if (n <= 1) return 2;
  if (n === 2) return 3;
  if (n === 3) return 4;
  return 5;
}

function difficulteCible(etat: SkillState, calibration?: Calibration): Difficulte {
  return calibration?.difficulteConseillee ?? difficulteDepuisNiveau(etat);
}

function evaluer(
  etat: SkillState,
  etatsParCode: Map<string, SkillState>,
): { valeur: number; facteurs: Facteur[] } {
  const facteurs: Facteur[] = [];

  // 1. Importance pour l'objectif déclaré — le sens de "l'objectif" dépend du
  // domaine actif (DOMAINE_PILOTE) ; la phrase reste donc générique plutôt que
  // de nommer un objectif d'un domaine précis (ex. Master ITI), qui deviendrait
  // faux dès que le périmètre change (voir ADR-020).
  const fImportance = etat.skill.importance * 25;
  facteurs.push({
    libelle: "Importance pour l'objectif",
    contribution: fImportance,
    phrase:
      etat.skill.importance >= 0.9
        ? "elle est centrale pour ton objectif actuel"
        : "elle sert ton objectif de parcours",
  });

  // 2. Absence totale de preuve — le cas dominant au démarrage.
  //
  // Au jour 0 tous les autres facteurs sont nuls : il faut bien un ordre pour
  // départager les compétences jamais testées. Jusqu'au 31/07/2026 c'était
  // `ORDRE_DIAGNOSTIC`, une liste de onze codes en dur, seule trace vivante
  // d'un plan d'évaluation supprimé le 27/07. Un référentiel construit par
  // l'utilisateur (ADR-026) ne peut pas porter de liste écrite d'avance :
  // l'ordre se **dérive** de ce que la compétence déclare — son palier d'abord,
  // son rang dans le domaine ensuite. Les fondamentaux passent avant l'avancé,
  // ce que le plan supprimé faisait déjà, mais sans avoir à le réécrire pour
  // chaque nouveau domaine.
  if (etat.preuves.length === 0) {
    const rangPalier = Math.max(0, ORDRE_PALIERS.indexOf(etat.skill.palier));
    const bonusPalier = 30 - rangPalier * 10;
    const bonusOrdre = Math.max(0, 10 - etat.skill.ordre);
    facteurs.push({
      libelle: "Jamais évaluée",
      contribution: 30 + bonusPalier + bonusOrdre,
      phrase: `elle n'a jamais été évaluée et relève des ${etat.skill.palier === "fondamentaux" ? "fondamentaux" : `acquis de palier « ${etat.skill.palier} »`}`,
    });
  } else {
    // 3. Écart au niveau suivant : plus le palier est proche, plus l'effort paye.
    const n = etat.niveau ?? 0;
    const fEcart = (5 - n) * 5;
    facteurs.push({
      libelle: "Marge de progression",
      contribution: fEcart,
      phrase: `elle est au niveau ${n} et le palier suivant est atteignable`,
    });

    // 4. Ancienneté de la dernière preuve — entretien (§16).
    const j = etat.joursDepuisDernierePreuve ?? 0;
    const fAnciennete = Math.min(30, j * 0.35);
    if (j >= 21) {
      facteurs.push({
        libelle: "Ancienneté de la dernière preuve",
        contribution: fAnciennete,
        phrase: `elle n'a pas été travaillée depuis ${j} jours`,
      });
    } else {
      // Pénalité : travaillée très récemment, laisser respirer.
      facteurs.push({
        libelle: "Pratiquée récemment",
        contribution: -15,
        phrase: `elle a été travaillée il y a ${j} jour(s)`,
      });
    }

    // 5. Confiance faible malgré des preuves : évaluation à consolider.
    if (etat.confiance === "faible") {
      facteurs.push({
        libelle: "Confiance faible",
        contribution: 12,
        phrase: "l'évaluation actuelle repose sur trop peu de preuves pour être fiable",
      });
    }

    // 6. Potentiel de transfert : bon niveau, mais un seul contexte testé.
    if ((etat.niveau ?? 0) >= 3 && etat.contextesTestes.length < 2) {
      facteurs.push({
        libelle: "Potentiel de transfert",
        contribution: 18,
        phrase: "elle est maîtrisée dans un seul contexte et gagnerait à être transférée",
      });
    }

    // 7. Robustesse faible malgré un niveau élevé.
    if ((etat.niveau ?? 0) >= 3 && (etat.robustesse ?? 0) < 0.5) {
      facteurs.push({
        libelle: "Robustesse insuffisante",
        contribution: 14,
        phrase: "son niveau est bon mais insuffisamment confirmé",
      });
    }
  }

  // 8. Prérequis : une compétence dont les bases ne sont pas posées attend.
  const prerequisManquants = etat.skill.prerequis.filter((code) => {
    const p = etatsParCode.get(code);
    return !p || p.niveau === null || p.niveau < 2;
  });
  if (prerequisManquants.length > 0) {
    facteurs.push({
      libelle: "Prérequis non consolidés",
      contribution: -12 * prerequisManquants.length,
      phrase: `ses prérequis (${prerequisManquants.join(", ")}) ne sont pas encore consolidés`,
    });
  }

  const valeur = facteurs.reduce((s, f) => s + f.contribution, 0);
  return { valeur, facteurs: facteurs.sort((a, b) => b.contribution - a.contribution) };
}

/** Choisit l'exercice le mieux adapté au niveau visé, non encore réussi. */
function choisirExercice(
  etat: SkillState,
  exercices: Exercise[],
  tentatives: ExerciseAttempt[],
  cible: Difficulte,
): Exercise | null {
  const reussis = new Set(
    tentatives.filter((t) => t.resultat === "reussi").map((t) => t.exerciseId),
  );
  const candidats = exercices.filter(
    (ex) => ex.competences.includes(etat.skill.code) && !reussis.has(ex.id),
  );
  if (candidats.length === 0) return null;

  // Priorité aux diagnostics tant que la compétence n'a aucune preuve.
  if (etat.preuves.length === 0) {
    const diag = candidats.find((ex) => ex.diagnostic);
    if (diag) return diag;
  }

  return candidats.sort(
    (a, b) =>
      Math.abs(a.difficulte - cible) - Math.abs(b.difficulte - cible) ||
      a.dureeEstimeeMin - b.dureeEstimeeMin,
  )[0];
}

function construireRaison(facteurs: Facteur[]): string {
  const positifs = facteurs.filter((f) => f.contribution > 0).slice(0, 2);
  if (positifs.length === 0) return "Aucun facteur dominant : toutes les compétences sont à jour.";
  const phrases = positifs.map((f) => f.phrase);
  const texte =
    phrases.length === 1 ? phrases[0] : `${phrases[0]}, et ${phrases[1]}`;
  return `Recommandé car ${texte}.`;
}

export function recommander(
  etats: SkillState[],
  exercices: Exercise[],
  tentatives: ExerciseAttempt[],
  limite = 5,
  calibrations?: Map<string, Calibration>,
): Recommandation[] {
  const parCode = new Map(etats.map((e) => [e.skill.code, e]));

  return etats
    .map((etat) => {
      const { valeur, facteurs } = evaluer(etat, parCode);
      // La calibration règle la DIFFICULTÉ ; elle ne re-classe pas les
      // compétences. `facteurs` reste une liste de contributions chiffrées au
      // score de priorité — y glisser une entrée à 0 la rendrait illisible.
      // Le « Pourquoi ? » de l'interface lit `calibration` séparément.
      const calibration = calibrations?.get(etat.skill.code) ?? null;
      const cible = difficulteCible(etat, calibration ?? undefined);

      const exercice = choisirExercice(etat, exercices, tentatives, cible);
      return {
        etat,
        valeur,
        facteurs,
        raison: construireRaison(facteurs),
        exercice,
        difficulteCible: cible,
        dureeEstimeeMin: exercice?.dureeEstimeeMin ?? 30,
        calibration,
      };
    })
    .sort((a, b) => {
      if (b.valeur !== a.valeur) return b.valeur - a.valeur;
      // Départage stable, dérivé du référentiel du compte : palier, puis rang
      // déclaré dans le domaine, puis code.
      const pa = ORDRE_PALIERS.indexOf(a.etat.skill.palier);
      const pb = ORDRE_PALIERS.indexOf(b.etat.skill.palier);
      return (
        pa - pb ||
        a.etat.skill.ordre - b.etat.skill.ordre ||
        a.etat.skill.code.localeCompare(b.etat.skill.code)
      );
    })
    .slice(0, limite);
}
