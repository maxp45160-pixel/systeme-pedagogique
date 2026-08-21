/**
 * Détection d'anomalies sur un pas de simulation.
 *
 * Chaque règle protège un invariant écrit dans `PRODUCT.md` ou un garde-fou de
 * `CLAUDE.md`. Aucune règle n'est esthétique : une anomalie signalée ici est
 * une chose que le système ne devrait pas pouvoir faire.
 *
 * Les règles comparent l'état courant au pas précédent — c'est la seule façon
 * de voir un niveau bouger sans preuve, ou une calibration se déplacer sans
 * tentative.
 */

import type { SkillObservation, SkillState } from "@/lib/domain/types";
import type { Calibration } from "@/lib/engine/calibration";
import type { Recommandation } from "@/lib/engine/recommend";
import type { Anomalie } from "./types";

/** Ce que le pas précédent a laissé, pour comparer sans relire tout l'historique. */
export interface EtatPrecedent {
  niveaux: Map<string, number | null>;
  nombreObservations: Map<string, number>;
  nombreVerdicts: Map<string, number>;
  difficulteConseillee: Map<string, number | null>;
  /** Compétence en tête de recommandation, et depuis combien de pas. */
  tete: { code: string; repetitions: number } | null;
}

export function etatPrecedentVide(): EtatPrecedent {
  return {
    niveaux: new Map(),
    nombreObservations: new Map(),
    nombreVerdicts: new Map(),
    difficulteConseillee: new Map(),
    tete: null,
  };
}

/**
 * Nombre de fois qu'une même compétence peut rester en tête sans qu'une
 * nouvelle observation la concerne avant que ce soit un défaut d'adaptation.
 * Seuil d'inspection, pas seuil de calibration : le changer ne modifie aucune
 * mesure du produit.
 */
const REPETITIONS_TOLEREES = 4;

/**
 * Une phrase est tenue pour générique si elle ne s'appuie sur aucun fait :
 * ni compétence nommée, ni chiffre. C'est le défaut relevé sur « Résoudre un
 * problème standard sans indice pour démontrer l'autonomie. » — vraie pour
 * n'importe qui, donc sans valeur pour personne.
 */
export function phraseGenerique(phrase: string, etat: SkillState): boolean {
  const texte = phrase.trim();
  if (texte.length === 0) return true;
  if (/\d/.test(texte)) return false;
  const normalise = texte.toLocaleLowerCase("fr-FR");
  if (normalise.includes(etat.skill.code.toLocaleLowerCase("fr-FR"))) return false;
  const intitule = etat.skill.intitule.trim().toLocaleLowerCase("fr-FR");
  if (intitule.length > 0 && normalise.includes(intitule)) return false;
  return true;
}

export function detecterAnomalies(
  etats: SkillState[],
  calibrations: Map<string, Calibration>,
  recommandations: Recommandation[],
  observations: SkillObservation[],
  tentativesAbandonnees: Set<string>,
  precedent: EtatPrecedent,
): { anomalies: Anomalie[]; etat: EtatPrecedent } {
  const anomalies: Anomalie[] = [];

  // Invariant 2 — toute mesure doit avoir une source explicite.
  for (const observation of observations) {
    if (!observation.source?.kind || !observation.source.ref) {
      anomalies.push({
        regle: "preuve-sans-source",
        gravite: "invariant",
        competence: observation.skillCode,
        message: `Observation ${observation.id} sans source explicite.`,
      });
    }
    // Garde-fou — une tentative abandonnée ne produit pas de preuve.
    const trace = observation.source?.trace?.ref;
    if (trace && tentativesAbandonnees.has(trace)) {
      anomalies.push({
        regle: "preuve-depuis-abandon",
        gravite: "invariant",
        competence: observation.skillCode,
        message: `Observation ${observation.id} tirée de la tentative abandonnée ${trace}.`,
      });
    }
  }

  const niveaux = new Map<string, number | null>();
  const nombreObservations = new Map<string, number>();
  const nombreVerdicts = new Map<string, number>();
  const difficulteConseillee = new Map<string, number | null>();

  for (const etat of etats) {
    const code = etat.skill.code;
    niveaux.set(code, etat.niveau);
    nombreObservations.set(code, etat.observations.length);

    // Invariant 3 — absence de preuve n'est pas un zéro.
    if (etat.statut === "non-evalue" && (etat.niveau !== null || etat.score !== null)) {
      anomalies.push({
        regle: "absence-traitee-comme-zero",
        gravite: "invariant",
        competence: code,
        message: "Compétence sans observation portant tout de même un niveau ou un score.",
      });
    }

    // Invariant 4 — une faiblesse ne disparaît pas sans nouvelle démonstration.
    const avant = precedent.niveaux.get(code);
    const observationsAvant = precedent.nombreObservations.get(code) ?? 0;
    if (
      avant !== undefined &&
      avant !== null &&
      etat.niveau !== null &&
      etat.niveau > avant &&
      etat.observations.length === observationsAvant
    ) {
      anomalies.push({
        regle: "faiblesse-effacee",
        gravite: "invariant",
        competence: code,
        message: `Niveau passé de ${avant} à ${etat.niveau} sans nouvelle observation.`,
      });
    }

    const calibration = calibrations.get(code);
    const verdicts = calibration?.verdicts.length ?? 0;
    const conseillee = calibration?.difficulteConseillee ?? null;
    nombreVerdicts.set(code, verdicts);
    difficulteConseillee.set(code, conseillee);

    // Garde-fou — la difficulté conseillée est dérivée des tentatives : elle ne
    // peut pas bouger si aucune tentative ne s'est ajoutée.
    const difficulteAvant = precedent.difficulteConseillee.get(code);
    const verdictsAvant = precedent.nombreVerdicts.get(code) ?? 0;
    if (
      difficulteAvant !== undefined &&
      difficulteAvant !== conseillee &&
      verdicts === verdictsAvant
    ) {
      anomalies.push({
        regle: "calibration-sans-tentative",
        gravite: "invariant",
        competence: code,
        message: `Difficulté conseillée passée de ${difficulteAvant ?? "aucune"} à ${conseillee ?? "aucune"} sans nouvelle tentative.`,
      });
    }
  }

  // Point 4 du relevé — les phrases passe-partout de l'interface.
  for (const recommandation of recommandations) {
    if (phraseGenerique(recommandation.etat.prochaineEtape, recommandation.etat)) {
      anomalies.push({
        regle: "phrase-generique",
        gravite: "avertissement",
        competence: recommandation.etat.skill.code,
        message: `Prochaine étape sans aucun fait : « ${recommandation.etat.prochaineEtape} »`,
      });
    }
    if (phraseGenerique(recommandation.raison, recommandation.etat)) {
      anomalies.push({
        regle: "phrase-generique",
        gravite: "avertissement",
        competence: recommandation.etat.skill.code,
        message: `Justification sans aucun fait : « ${recommandation.raison} »`,
      });
    }
  }

  // Adaptation — la même compétence en tête indéfiniment est une boucle.
  const tete = recommandations[0]?.etat.skill.code ?? null;
  let suivi: EtatPrecedent["tete"] = null;
  if (tete) {
    const observationsCourantes = nombreObservations.get(tete) ?? 0;
    const observationsPrecedentes = precedent.nombreObservations.get(tete) ?? 0;
    const repetitions =
      precedent.tete?.code === tete && observationsCourantes === observationsPrecedentes
        ? precedent.tete.repetitions + 1
        : 1;
    suivi = { code: tete, repetitions };
    if (repetitions > REPETITIONS_TOLEREES) {
      anomalies.push({
        regle: "recommandation-figee",
        gravite: "avertissement",
        competence: tete,
        message: `Recommandée en tête ${repetitions} pas de suite sans nouvelle observation.`,
      });
    }
  }

  // Sans exercice, la recommandation n'est pas actionnable : l'utilisateur
  // reste devant une phrase.
  if (recommandations[0] && recommandations[0].exercice === null) {
    anomalies.push({
      regle: "recommandation-sans-exercice",
      gravite: "info",
      competence: recommandations[0].etat.skill.code,
      message: "Compétence en tête sans exercice disponible à la difficulté visée.",
    });
  }

  return {
    anomalies,
    etat: { niveaux, nombreObservations, nombreVerdicts, difficulteConseillee, tete: suivi },
  };
}

/**
 * Compétences que le moteur n'a jamais proposées sur l'ensemble du parcours.
 *
 * Ce n'est pas forcément un défaut — une compétence peut rester derrière ses
 * prérequis — mais c'est exactement ce qu'on veut voir en fin de simulation.
 */
export function competencesJamaisRecommandees(
  codesConnus: string[],
  codesRecommandes: Set<string>,
): Anomalie[] {
  return codesConnus
    .filter((code) => !codesRecommandes.has(code))
    .map((code) => ({
      regle: "competence-jamais-recommandee",
      gravite: "info" as const,
      competence: code,
      message: "Jamais apparue dans les recommandations du parcours.",
    }));
}
