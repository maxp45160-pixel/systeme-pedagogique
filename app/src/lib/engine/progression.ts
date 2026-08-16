/**
 * Agrégation globale et par domaine.
 *
 * Trois nombres distincts sont exposés, parce qu'ils répondent à trois
 * questions différentes et que les confondre serait trompeur :
 *
 * - `scoreGlobal`  — « à quel niveau suis-je là où j'ai été mesuré ? »
 *                    Pondéré par l'importance de chaque compétence.
 * - `niveauMoyen`  — la même chose, sans pondération.
 * - la couverture (`competencesEvaluees` / `competencesTotal`) — « quelle part
 *                    du référentiel a été mesurée ? »
 *
 * ADR-006, tranchée le 31/07/2026 — les compétences non évaluées ne sont plus
 * comptées pour zéro. La formule précédente les portait au dénominateur pour
 * leur importance pleine et au numérateur pour rien : non mesuré y valait
 * exactement zéro, ce que le protocole anti-hallucination §7 interdit (P2).
 *
 * Deux conséquences motivaient la correction. Le score était **anti-corrélé à
 * l'ambition** : élargir le référentiel le faisait chuter sans qu'aucune
 * compétence n'ait été perdue. Et depuis ADR-026 le référentiel est extensible
 * par l'utilisateur — le défaut serait passé de verrue documentée à incitation
 * structurelle à ne pas étendre son référentiel.
 *
 * Ce qui disparaît du score revient donc **entièrement** à la couverture, qui
 * est l'indicateur honnête de ce qui n'a pas encore été mesuré.
 */

import type { Confiance, Domaine, DomaineId, SkillState } from "@/lib/domain/types";
import { JOUR_MS } from "./dates";

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

export function agregerDomaine(
  domaine: DomaineId,
  etats: SkillState[],
  domaines: Domaine[] = [],
): AgregatDomaine {
  /*
   * Porteur **et** rattachées (ADR-081). Une compétence partagée informe
   * réellement les deux domaines qu'elle sert : l'écarter du second sous-
   * estimerait sa couverture. Ce n'est pas un double comptage — `calculerEtatGlobal`
   * somme sur les compétences, jamais sur les domaines, donc le score global
   * ne voit qu'une fois chaque compétence.
   */
  const duDomaine = etats.filter(
    (e) => e.skill.domaine === domaine || (e.skill.domainesSecondaires ?? []).includes(domaine),
  );
  const evalues = duDomaine.filter((e) => e.statut === "evalue" && e.score !== null);
  const preuves = duDomaine.reduce((s, e) => s + e.preuves.length, 0);
  // Le référentiel est propre au compte (ADR-026) : à défaut de libellé, on
  // affiche l'identifiant plutôt que d'inventer un nom.
  const nom = domaines.find((d) => d.id === domaine)?.nom ?? domaine;

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

  // ADR-006 : les deux sommes portent sur les seules compétences mesurées.
  // `competencesTotal` conserve l'effectif complet — c'est lui, et non le
  // score, qui dit ce qui reste à mesurer.
  const poidsMesure = evalues.reduce((s, e) => s + e.skill.importance, 0);
  const acquis = evalues.reduce(
    (s, e) => s + e.skill.importance * ((e.score ?? 0) / 5),
    0,
  );

  return {
    domaine,
    nom,
    score: poidsMesure === 0 ? null : Math.round((acquis / poidsMesure) * 100),
    niveauMoyen:
      Math.round((evalues.reduce((s, e) => s + (e.niveau ?? 0), 0) / evalues.length) * 10) / 10,
    competencesTotal: duDomaine.length,
    competencesEvaluees: evalues.length,
    preuves,
    confiance: moyenneConfiance(duDomaine),
  };
}

export function calculerEtatGlobal(
  etats: SkillState[],
  now: Date = new Date(),
  domaines: Domaine[] = [],
): EtatGlobal {
  const total = etats.length;
  const evalues = etats.filter((e) => e.statut === "evalue" && e.score !== null);
  const nombrePreuves = etats.reduce((s, e) => s + e.preuves.length, 0);

  // Seuls les domaines réellement représentés dans `etats` : le périmètre de
  // travail peut n'en couvrir qu'un, et afficher des domaines vides ferait
  // exactement ce que le protocole interdit — présenter une absence de mesure
  // comme une mesure à zéro.
  //
  // La liste se dérive des états eux-mêmes, et non plus d'un tableau global :
  // depuis ADR-026 le référentiel est propre au compte. `domaines` ne sert plus
  // qu'à ordonner et à nommer.
  const rang = new Map(domaines.map((d, i) => [d.id, i]));
  const presents = [...new Set(etats.flatMap((e) => [e.skill.domaine, ...(e.skill.domainesSecondaires ?? [])]))].sort(
    (a, b) => (rang.get(a) ?? Number.MAX_SAFE_INTEGER) - (rang.get(b) ?? Number.MAX_SAFE_INTEGER),
  );
  const parDomaine = presents.map((id) => agregerDomaine(id, etats, domaines));

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

  // ADR-006 — le score porte sur les seules compétences mesurées.
  //
  // Des preuves peuvent exister sans qu'aucune compétence n'atteigne le statut
  // « evalue » (hypothèses, preuves irrecevables) : le score est alors `null`,
  // pas 0. Une somme de poids nulle n'est pas un score nul.
  const poidsMesure = evalues.reduce((s, e) => s + e.skill.importance, 0);
  const acquis = evalues.reduce((s, e) => s + e.skill.importance * ((e.score ?? 0) / 5), 0);
  const scoreGlobal = poidsMesure === 0 ? null : Math.round((acquis / poidsMesure) * 100);

  // Même précaution : sans compétence évaluée, il n'y a pas de niveau moyen.
  // Une moyenne sur zéro terme valait `NaN` et s'affichait comme une mesure.
  const niveauMoyen =
    evalues.length === 0
      ? null
      : Math.round((evalues.reduce((s, e) => s + (e.niveau ?? 0), 0) / evalues.length) * 10) / 10;

  const competencesActives = etats.filter(
    (e) => e.joursDepuisDernierePreuve !== null && e.joursDepuisDernierePreuve <= 30,
  ).length;

  // « Améliorée » = au moins une preuve récente qui soutient le niveau courant.
  const competencesAmeliorees = etats.filter((e) => {
    if (e.niveau === null || e.niveau === 0) return false;
    return e.preuves.some(
      (p) =>
        p.resultat === "reussi" &&
        (now.getTime() - new Date(p.date).getTime()) / JOUR_MS <= 30,
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
  // Sans cette phrase le score se lirait comme une progression sur l'ensemble
  // du référentiel, ce qu'il n'est plus depuis ADR-006. Le nombre affiché et sa
  // portée doivent tenir ensemble (P3 : aucune valeur sans sa source).
  reserves.push(
    `Score calculé sur les ${evalues.length} compétence(s) mesurée(s), pas sur les ${total} du référentiel : la couverture est un indicateur distinct.`,
  );
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
      {
        libelle: "Niveau moyen là où mesuré",
        valeur: niveauMoyen === null ? "—" : `${niveauMoyen} / 5`,
      },
      {
        libelle: "Méthode",
        valeur:
          "Somme des scores pondérés par l'importance, rapportée aux seules compétences mesurées.",
      },
      {
        libelle: "Compétences non évaluées",
        valeur: "exclues du score, comptées dans la couverture (ADR-006)",
      },
    ],
    reserves,
  };
}
