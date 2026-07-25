/**
 * Agrégation globale et par domaine.
 *
 * Deux nombres distincts sont exposés, parce qu'ils répondent à deux
 * questions différentes et que les confondre serait trompeur :
 *
 * - `scoreGlobal`  — « où en suis-je sur l'ensemble du référentiel ? »
 *                    Les compétences non évaluées comptent pour zéro.
 * - `niveauMoyen`  — « quel est mon niveau là où j'ai été évalué ? »
 *                    Calculé sur les seules compétences évaluées.
 *
 * Afficher le premier sans le second donnerait l'impression d'un niveau
 * faible ; afficher le second sans le premier surestimerait la couverture.
 */

import type { Confiance, DomaineId, SkillState } from "@/lib/domain/types";
import { DOMAINES } from "@/lib/domain/referentiel";

const RANG_CONFIANCE: Record<Confiance, number> = { nulle: 0, faible: 1, moyenne: 2, forte: 3 };
const CONFIANCE_PAR_RANG: Confiance[] = ["nulle", "faible", "moyenne", "forte"];

export interface AgregatDomaine {
  domaine: DomaineId;
  nom: string;
  /** `null` si aucune preuve dans ce domaine. */
  score: number | null;
  niveauMoyen: number | null;
  competencesTotal: number;
  competencesEvaluees: number;
  preuves: number;
  confiance: Confiance;
}

export interface EtatGlobal {
  /** Sur 100, ou `null` si aucune preuve n'existe. Jamais 0 par défaut. */
  scoreGlobal: number | null;
  /** Niveau moyen sur les compétences évaluées, sur 5. */
  niveauMoyen: number | null;
  confiance: Confiance;
  competencesTotal: number;
  competencesEvaluees: number;
  /** Compétences dont une preuve date de moins de 30 jours. */
  competencesActives: number;
  /** Compétences dont le niveau a progressé sur les 30 derniers jours. */
  competencesAmeliorees: number;
  nombrePreuves: number;
  robustesseMoyenne: number | null;
  parDomaine: AgregatDomaine[];
  /** Explication affichable derrière « Pourquoi ce score ? ». */
  facteurs: { libelle: string; valeur: string }[];
  reserves: string[];
}

function moyenneConfiance(etats: SkillState[]): Confiance {
  const evalues = etats.filter((e) => e.statut === "evalue");
  if (evalues.length === 0) return "nulle";
  const moy =
    evalues.reduce((s, e) => s + RANG_CONFIANCE[e.confiance], 0) / evalues.length;
  return CONFIANCE_PAR_RANG[Math.max(1, Math.round(moy))];
}

export function agregerDomaine(domaine: DomaineId, etats: SkillState[]): AgregatDomaine {
  const duDomaine = etats.filter((e) => e.skill.domaine === domaine);
  const evalues = duDomaine.filter((e) => e.statut === "evalue" && e.score !== null);
  const preuves = duDomaine.reduce((s, e) => s + e.preuves.length, 0);
  const nom = DOMAINES.find((d) => d.id === domaine)?.nom ?? domaine;

  if (evalues.length === 0) {
    return {
      domaine,
      nom,
      score: null,
      niveauMoyen: null,
      competencesTotal: duDomaine.length,
      competencesEvaluees: 0,
      preuves,
      confiance: "nulle",
    };
  }

  const poidsTotal = duDomaine.reduce((s, e) => s + e.skill.importance, 0);
  const acquis = duDomaine.reduce(
    (s, e) => s + e.skill.importance * ((e.score ?? 0) / 5),
    0,
  );

  return {
    domaine,
    nom,
    score: poidsTotal === 0 ? null : Math.round((acquis / poidsTotal) * 100),
    niveauMoyen:
      Math.round((evalues.reduce((s, e) => s + (e.niveau ?? 0), 0) / evalues.length) * 10) / 10,
    competencesTotal: duDomaine.length,
    competencesEvaluees: evalues.length,
    preuves,
    confiance: moyenneConfiance(duDomaine),
  };
}

export function calculerEtatGlobal(etats: SkillState[], now: Date = new Date()): EtatGlobal {
  const total = etats.length;
  const evalues = etats.filter((e) => e.statut === "evalue" && e.score !== null);
  const nombrePreuves = etats.reduce((s, e) => s + e.preuves.length, 0);
  const parDomaine = DOMAINES.map((d) => agregerDomaine(d.id, etats));

  // Aucune preuve nulle part : le score n'existe pas. On ne renvoie pas 0,
  // qui prétendrait avoir mesuré (protocole anti-hallucination §7 et §14).
  if (nombrePreuves === 0) {
    return {
      scoreGlobal: null,
      niveauMoyen: null,
      confiance: "nulle",
      competencesTotal: total,
      competencesEvaluees: 0,
      competencesActives: 0,
      competencesAmeliorees: 0,
      nombrePreuves: 0,
      robustesseMoyenne: null,
      parDomaine,
      facteurs: [],
      reserves: [
        "Aucune preuve directe n'a encore été enregistrée.",
        "Le score global sera calculable dès le premier diagnostic réalisé.",
      ],
    };
  }

  const poidsTotal = etats.reduce((s, e) => s + e.skill.importance, 0);
  const acquis = etats.reduce((s, e) => s + e.skill.importance * ((e.score ?? 0) / 5), 0);
  const scoreGlobal = Math.round((acquis / poidsTotal) * 100);

  const niveauMoyen =
    Math.round((evalues.reduce((s, e) => s + (e.niveau ?? 0), 0) / evalues.length) * 10) / 10;

  const competencesActives = etats.filter(
    (e) => e.joursDepuisDernierePreuve !== null && e.joursDepuisDernierePreuve <= 30,
  ).length;

  // « Améliorée » = au moins une preuve récente qui soutient le niveau courant.
  const competencesAmeliorees = etats.filter((e) => {
    if (e.niveau === null || e.niveau === 0) return false;
    return e.preuves.some(
      (p) =>
        p.resultat === "reussi" &&
        (now.getTime() - new Date(p.date).getTime()) / 86_400_000 <= 30,
    );
  }).length;

  const robustesses = etats.filter((e) => e.robustesse !== null).map((e) => e.robustesse!);
  const robustesseMoyenne =
    robustesses.length === 0
      ? null
      : Math.round((robustesses.reduce((s, r) => s + r, 0) / robustesses.length) * 100) / 100;

  const couverture = evalues.length / total;
  let confiance = moyenneConfiance(etats);
  const reserves: string[] = [];

  // Une couverture faible plafonne la confiance globale : mesurer 3 compétences
  // sur l'ensemble du référentiel ne permet pas d'être confiant globalement (anti-hallucination §9).
  if (couverture < 0.25 && RANG_CONFIANCE[confiance] > 1) {
    confiance = "faible";
    reserves.push(
      `Seules ${evalues.length} compétences sur ${total} ont été évaluées : la confiance globale est plafonnée à « faible ».`,
    );
  }

  const domainesVierges = parDomaine.filter((d) => d.competencesEvaluees === 0);
  if (domainesVierges.length > 0) {
    reserves.push(
      `${domainesVierges.length} domaine(s) sans aucune preuve : ${domainesVierges
        .map((d) => d.nom)
        .join(", ")}.`,
    );
  }
  reserves.push(
    "Le score global est un indicateur de suivi, pas une vérité absolue (protocole d'évaluation §12).",
  );

  return {
    scoreGlobal,
    niveauMoyen,
    confiance,
    competencesTotal: total,
    competencesEvaluees: evalues.length,
    competencesActives,
    competencesAmeliorees,
    nombrePreuves,
    robustesseMoyenne,
    parDomaine,
    facteurs: [
      { libelle: "Compétences évaluées", valeur: `${evalues.length} / ${total}` },
      { libelle: "Preuves directes enregistrées", valeur: `${nombrePreuves}` },
      { libelle: "Niveau moyen là où mesuré", valeur: `${niveauMoyen} / 5` },
      {
        libelle: "Méthode",
        valeur:
          "Somme des scores pondérés par l'importance de chaque compétence, rapportée au référentiel complet.",
      },
      {
        libelle: "Compétences non évaluées",
        valeur: "comptées comme non acquises, jamais comme échec",
      },
    ],
    reserves,
  };
}
