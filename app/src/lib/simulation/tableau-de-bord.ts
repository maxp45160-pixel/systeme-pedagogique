/**
 * Ce qu'on lit d'un parcours de dix-huit mois.
 *
 * ## La question posée
 *
 * Pas « le moteur a-t-il produit des chiffres ? » — il en produit toujours —
 * mais : **au bout d'un an et demi, ce produit a-t-il mené quelque part ?**
 * Les objectifs déclarés sont-ils atteints, le graphe s'est-il étendu et
 * couvert, le niveau estimé ressemble-t-il à l'aptitude réelle, et les actions
 * servies étaient-elles les bonnes ?
 *
 * ## Trois familles de mesures, et pourquoi elles ne se remplacent pas
 *
 * - **le RÉSULTAT** — objectifs résolus, compétences maîtrisées, graphe
 *   couvert. C'est ce que l'utilisateur vient chercher.
 * - **la JUSTESSE** — écart entre le niveau estimé et l'aptitude réelle, que
 *   seule une simulation peut mesurer. Un produit peut faire progresser
 *   quelqu'un tout en se trompant sur son niveau : les deux se lisent à part.
 * - **la SÉLECTION** — ce qui a été servi, à quelle difficulté, à quelle
 *   fréquence, avec quelle diversité. Un bon résultat obtenu en servant
 *   toujours la même chose n'est pas reproductible.
 *
 * ## Ce que ces chiffres ne disent pas
 *
 * Rien sur le moteur en production. Ils disent ce que le moteur fait d'un
 * apprenant modèle — dont la règle de réussite est une logistique écrite à la
 * main. Un verdict au vert ne prouve pas que le produit marche ; un verdict au
 * rouge prouve en revanche qu'il y a quelque chose à corriger, puisque le
 * parcours est reproductible et ouvrable ligne à ligne.
 */

import type { MetriqueMoteur } from "@/lib/engine/auto-evaluation";
import { RESULTATS_TENTATIVE } from "@/lib/domain/types";
import { construireRegistre, type LigneRegistre } from "./analyse";
import { objectifsDuMonde, type ObjectifFictif } from "./monde";
import type { PasResume, ResultatParcoursLong } from "./parcours-long";
import type { Anomalie } from "./types";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface Entete {
  jours: number;
  mois: number;
  domaines: number;
  competences: number;
  exercices: number;
  propositions: number;
  suivies: number;
  tentativesMenees: number;
  abandons: number;
  ignorees: number;
  observations: number;
  decisions: number;
  predictions: number;
  minutes: number;
  joursActifs: number;
  anomalies: number;
  invariants: number;
  /** Exercices fabriqués en cours de route, faute de disponible. */
  exercicesGeneres: number;
  dureeCalculMs: number;
}

export type StatutVerdict = "ok" | "alerte" | "echec" | "inconnu";

export interface Verdict {
  cle: string;
  question: string;
  valeur: string;
  attendu: string;
  statut: StatutVerdict;
  /** Ce qu'on regarde si le verdict n'est pas au vert. */
  piste: string;
}

export interface BilanObjectif extends ObjectifFictif {
  /**
   * Premier jour où le MOTEUR voit toutes les compétences visées au niveau
   * requis. C'est une croyance, pas un fait : un moteur sévère l'annonce tard,
   * un moteur complaisant l'annonce tôt et à tort.
   */
  jourAtteint: number | null;
  /**
   * Premier jour où l'objectif est RÉELLEMENT atteint, lu sur l'aptitude de
   * l'apprenant simulé — que le moteur ne voit jamais.
   *
   * Ajouté le 21/08/2026 : sans lui, « objectifs résolus » et « jours jusqu'à
   * un objectif » se calculaient sur les niveaux du moteur, et durcir
   * l'estimation faisait mécaniquement chuter les deux. On mesurait la
   * complaisance du moteur en croyant mesurer le produit.
   */
  jourAtteintReel: number | null;
  /**
   * Jours entre la réalité et sa reconnaissance par le moteur.
   *
   * Positif : le moteur reconnaît en retard. Négatif : il l'annonce avant que
   * ce soit vrai — le défaut le plus grave, puisqu'il ferait passer à la suite
   * quelqu'un qui n'y est pas.
   */
  retardReconnaissance: number | null;
  joursPourResoudre: number | null;
  /** Jour où l'objectif, une fois atteint, a cessé de l'être. */
  jourPerdu: number | null;
  /** Part des compétences visées au niveau requis, au dernier jour. */
  partFinale: number;
  detail: {
    code: string;
    intitule: string;
    niveau: number | null;
    aptitude: number | null;
    atteint: boolean;
    tentatives: number;
  }[];
}

export interface PointCroissance {
  jour: number;
  date: string;
  competencesConnues: number;
  competencesObservees: number;
  competencesMaitrisees: number;
  exercices: number;
  observations: number;
  scoreGlobal: number | null;
  niveauMoyen: number | null;
  objectifsResolus: number;
  /** Écart moyen |niveau estimé − aptitude réelle| ce jour-là. */
  ecartMoyen: number | null;
}

export interface NoeudGraphe {
  code: string;
  intitule: string;
  domaine: string;
  domaineNom: string;
  palier: string;
  niveau: number | null;
  aptitude: number | null;
  observations: number;
  tentatives: number;
  servies: number;
  jourApparition: number;
}

export interface GrapheFinal {
  noeuds: NoeudGraphe[];
  liens: { de: string; vers: string }[];
  domaines: { id: string; nom: string; competences: number }[];
  /** Compétences sans prérequis ni successeur : vraies, pas à masquer. */
  isolees: number;
  /** Longueur de la plus longue chaîne de prérequis. */
  profondeurMax: number;
  /** Compétences jamais observées — le graphe s'étend-il plus vite qu'il ne se couvre ? */
  jamaisObservees: number;
}

export interface Justesse {
  comparables: number;
  /** Erreur absolue moyenne, en niveaux. */
  ecartMoyen: number | null;
  /** Écart signé moyen : positif, le moteur surestime. */
  biais: number | null;
  dansDemiNiveau: number | null;
  dansUnNiveau: number | null;
  /** Corrélation de rangs entre niveau estimé et aptitude réelle. */
  correlationRangs: number | null;
  pires: { code: string; intitule: string; niveau: number; aptitude: number; ecart: number }[];
}

export interface BucketFiabilite {
  borne: string;
  n: number;
  predit: number;
  observe: number;
  /**
   * Faux sous 30 cas : une tranche à n=8 est du bruit, et l'afficher en rouge
   * ferait passer un hasard pour un défaut.
   */
  conclusif: boolean;
}

/**
 * Le résultat mesuré HORS du moteur.
 *
 * Tout le reste du tableau de bord lit des chiffres que le moteur a lui-même
 * produits : score global, niveau, compétences maîtrisées. Il se note donc en
 * partie lui-même. Ce bloc-ci ne contient que des grandeurs qu'il ne calcule
 * pas — l'aptitude réelle de l'apprenant simulé et le temps passé. C'est la
 * seule base honnête pour comparer deux bras.
 */
export interface ResultatReel {
  heures: number;
  aptitudeMoyenneInitiale: number;
  aptitudeMoyenneFinale: number;
  gainAptitudeTotal: number;
  gainAptitudeMoyen: number;
  /** Points d'aptitude réelle gagnés par heure travaillée. */
  gainParHeure: number | null;
  objectifsResolus: number;
  partObjectifsResolus: number;
  /** Jours médians entre déclaration et résolution, sur les objectifs résolus. */
  joursMedianResolution: number | null;
  /** Objectifs réellement atteints — lus sur l'aptitude, pas sur le moteur. */
  objectifsAtteintsReellement: number;
  partObjectifsReels: number;
  joursMedianResolutionReelle: number | null;
  /**
   * Retard médian de reconnaissance, en jours. Négatif : le moteur annonce
   * l'objectif avant qu'il ne soit vrai.
   */
  retardMedianReconnaissance: number | null;
  couverture: number;
  exercicesGeneres: number;
}

export interface Selection {
  servies: { code: string; intitule: string; servies: number; part: number }[];
  jamaisServies: string[];
  partMax: number;
  distinctesServies: number;
  /** Répartition de (difficulté servie − aptitude réelle), arrondie au niveau. */
  ecartDifficulte: { ecart: number; n: number }[];
  partDansZone: number | null;
  tauxSuivi: number | null;
  tauxReussite: number | null;
  repartitionResultats: { resultat: string; n: number }[];
  facteurs: { libelle: string; n: number; part: number }[];
  repetitionMax: number;
  /** Compétences distinctes servies sur les 30 derniers jours glissants, en moyenne. */
  diversiteMensuelle: number | null;
  exercicesUtilises: number;
  partCatalogueUtilise: number;
  joursSansExercice: number;
  /**
   * Jours où la proposition de TÊTE ne portait aucun exercice.
   *
   * Le parcours prend alors la suivante, comme le ferait quelqu'un devant sa
   * liste. Le chiffre reste ici parce qu'il dit quelque chose de précis : la
   * compétence la mieux classée n'avait plus rien à proposer.
   */
  joursTeteVide: number;
  /** Part des actions prises ailleurs qu'en tête de liste. */
  partHorsTete: number | null;
}

export interface Revisions {
  actionsRevision: number;
  partRevision: number | null;
  delaiMedianRetour: number | null;
  delaiMaxRetour: number | null;
  baissesDeNiveau: number;
  competencesRetombees: number;
  reprisesApresPause: { motif: string; jour: number; joursAvantReprise: number | null }[];
}

export interface Activite {
  minutes: number;
  minutesParSemaineActive: number | null;
  joursActifs: number;
  partJoursActifs: number;
  serieMax: number;
  dureeMoyenneTentative: number | null;
  /** Rapport durée observée / durée estimée — jamais une mesure de performance. */
  rapportDuree: number | null;
}

export interface LigneCompetence {
  code: string;
  intitule: string;
  domaine: string;
  palier: string;
  niveau: number | null;
  aptitude: number | null;
  ecart: number | null;
  confiance: string;
  statut: string;
  observations: number;
  contextes: number;
  servies: number;
  tentatives: number;
  reussites: number;
  jourPremiereObservation: number | null;
  jourMaitrise: number | null;
  /**
   * Niveau dérivé, un point par semaine, aligné sur `croissance`.
   *
   * `null` veut dire « le moteur ne se prononce pas » — jamais zéro : une
   * courbe qui partirait de zéro raconterait une progression qui n'a pas eu
   * lieu (invariant 3).
   */
  serie: (number | null)[];
}

export interface TableauDeBord {
  entete: Entete;
  resultatReel: ResultatReel;
  verdicts: Verdict[];
  objectifs: BilanObjectif[];
  croissance: PointCroissance[];
  graphe: GrapheFinal;
  justesse: Justesse;
  fiabilite: BucketFiabilite[];
  selection: Selection;
  revisions: Revisions;
  activite: Activite;
  competences: LigneCompetence[];
  metriques: MetriqueMoteur[];
  anomalies: (Anomalie & { pas: number; date: string })[];
  registre: LigneRegistre[];
  /** Le déroulé, échantillonné : un jour sur sept, plus tous les faits marquants. */
  deroule: PasResume[];
}

/* ------------------------------------------------------------------ */
/* Outils                                                              */
/* ------------------------------------------------------------------ */

function moyenne(valeurs: number[]): number | null {
  if (valeurs.length === 0) return null;
  return valeurs.reduce((s, v) => s + v, 0) / valeurs.length;
}

function mediane(valeurs: number[]): number | null {
  if (valeurs.length === 0) return null;
  const triees = [...valeurs].sort((a, b) => a - b);
  const milieu = Math.floor(triees.length / 2);
  return triees.length % 2 === 0 ? (triees[milieu - 1] + triees[milieu]) / 2 : triees[milieu];
}

function arrondir(valeur: number | null, decimales = 2): number | null {
  if (valeur === null) return null;
  const facteur = 10 ** decimales;
  return Math.round(valeur * facteur) / facteur;
}

function rangs(valeurs: number[]): number[] {
  const indexes = valeurs.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const sortie = new Array<number>(valeurs.length);
  let i = 0;
  while (i < indexes.length) {
    let j = i;
    while (j + 1 < indexes.length && indexes[j + 1].v === indexes[i].v) j += 1;
    const rangMoyen = (i + j) / 2 + 1;
    for (let k = i; k <= j; k += 1) sortie[indexes[k].i] = rangMoyen;
    i = j + 1;
  }
  return sortie;
}

/** Corrélation de Pearson sur les rangs — c'est-à-dire Spearman. */
function correlationRangs(a: number[], b: number[]): number | null {
  if (a.length < 3) return null;
  const ra = rangs(a);
  const rb = rangs(b);
  const ma = (ra.length + 1) / 2;
  const mb = (rb.length + 1) / 2;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < ra.length; i += 1) {
    num += (ra[i] - ma) * (rb[i] - mb);
    da += (ra[i] - ma) ** 2;
    db += (rb[i] - mb) ** 2;
  }
  if (da === 0 || db === 0) return null;
  return num / Math.sqrt(da * db);
}

const JOUR_MS = 86_400_000;

/* ------------------------------------------------------------------ */
/* Objectifs                                                           */
/* ------------------------------------------------------------------ */

function objectifAtteint(resume: PasResume, objectif: ObjectifFictif): boolean {
  return objectif.competences.every((code) => {
    const niveau = resume.niveaux[code];
    return niveau !== null && niveau !== undefined && niveau >= objectif.niveauRequis;
  });
}

/** Le même objectif, lu sur l'aptitude réelle plutôt que sur ce qu'en croit le moteur. */
function objectifAtteintReellement(resume: PasResume, objectif: ObjectifFictif): boolean {
  return objectif.competences.every((code) => {
    const aptitude = resume.aptitudes[code];
    return aptitude !== undefined && aptitude >= objectif.niveauRequis;
  });
}

function bilanObjectifs(
  parcours: ResultatParcoursLong,
  tentativesParCode: Map<string, number>,
): BilanObjectif[] {
  const dernier = parcours.resumes.at(-1);
  const intitules = new Map(
    parcours.monde.lots.flatMap((lot) => lot.competences.map((c) => [c.code, c.intitule])),
  );

  return objectifsDuMonde(parcours.monde).map((objectif) => {
    let jourAtteint: number | null = null;
    let jourAtteintReel: number | null = null;
    let jourPerdu: number | null = null;

    for (const resume of parcours.resumes) {
      if (resume.jour < objectif.jourDeclare) continue;
      const atteint = objectifAtteint(resume, objectif);
      if (jourAtteintReel === null && objectifAtteintReellement(resume, objectif)) {
        jourAtteintReel = resume.jour;
      }
      if (atteint && jourAtteint === null) jourAtteint = resume.jour;
      // Une perte n'est comptée qu'après une résolution : « pas encore atteint »
      // et « perdu » ne sont pas la même information.
      if (!atteint && jourAtteint !== null && jourPerdu === null) jourPerdu = resume.jour;
    }

    const detail = objectif.competences.map((code) => {
      const niveau = dernier?.niveaux[code] ?? null;
      return {
        code,
        intitule: intitules.get(code) ?? code,
        niveau,
        aptitude: parcours.veriteTerrain[code] ?? null,
        atteint: niveau !== null && niveau >= objectif.niveauRequis,
        tentatives: tentativesParCode.get(code) ?? 0,
      };
    });

    return {
      ...objectif,
      jourAtteint,
      jourAtteintReel,
      retardReconnaissance:
        jourAtteint === null || jourAtteintReel === null ? null : jourAtteint - jourAtteintReel,
      joursPourResoudre: jourAtteint === null ? null : jourAtteint - objectif.jourDeclare,
      jourPerdu,
      partFinale: detail.filter((d) => d.atteint).length / Math.max(1, detail.length),
      detail,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Croissance                                                          */
/* ------------------------------------------------------------------ */

function ecartDuJour(resume: PasResume): number | null {
  const ecarts: number[] = [];
  for (const [code, niveau] of Object.entries(resume.niveaux)) {
    const aptitude = resume.aptitudes[code];
    if (niveau === null || aptitude === undefined) continue;
    ecarts.push(Math.abs(niveau - aptitude));
  }
  return moyenne(ecarts);
}

/** Un jour sur sept, plus le dernier : les courbes n'ont pas besoin de 540 points. */
function echantillonner(resumes: PasResume[], jours: number): PasResume[] {
  return resumes.filter((r) => r.jour % 7 === 0 || r.jour === jours);
}

function croissance(
  echantillon: PasResume[],
  objectifs: BilanObjectif[],
): PointCroissance[] {
  const points: PointCroissance[] = [];
  for (const resume of echantillon) {
    points.push({
      jour: resume.jour,
      date: resume.date,
      competencesConnues: resume.competencesTotal,
      competencesObservees: resume.competencesEvaluees,
      competencesMaitrisees: resume.competencesMaitrisees,
      exercices: resume.exercicesDisponibles,
      observations: resume.observations,
      scoreGlobal: resume.scoreGlobal,
      niveauMoyen: resume.niveauMoyen,
      objectifsResolus: objectifs.filter(
        (o) => o.jourAtteint !== null && o.jourAtteint <= resume.jour,
      ).length,
      ecartMoyen: arrondir(ecartDuJour(resume)),
    });
  }
  return points;
}

/* ------------------------------------------------------------------ */
/* Graphe final                                                        */
/* ------------------------------------------------------------------ */

function profondeurPrerequis(
  code: string,
  parCode: Map<string, string[]>,
  vus = new Set<string>(),
): number {
  if (vus.has(code)) return 0;
  vus.add(code);
  const prerequis = parCode.get(code) ?? [];
  if (prerequis.length === 0) return 1;
  return 1 + Math.max(...prerequis.map((p) => profondeurPrerequis(p, parCode, vus)));
}

function grapheFinal(
  parcours: ResultatParcoursLong,
  servies: Map<string, number>,
  tentativesParCode: Map<string, number>,
): GrapheFinal {
  const dernier = parcours.resultat.pas.at(-1);
  const etats = dernier?.etats ?? [];
  const jourApparition = new Map<string, number>();
  const nomDomaine = new Map<string, string>();
  for (const lot of parcours.monde.lots) {
    nomDomaine.set(lot.domaine.id, lot.domaine.nom);
    for (const competence of lot.competences) jourApparition.set(competence.code, lot.jour);
  }

  const noeuds: NoeudGraphe[] = etats.map((etat) => ({
    code: etat.skill.code,
    intitule: etat.skill.intitule,
    domaine: etat.skill.domaine,
    domaineNom: nomDomaine.get(etat.skill.domaine) ?? etat.skill.domaine,
    palier: etat.skill.palier,
    niveau: etat.niveau,
    aptitude: parcours.veriteTerrain[etat.skill.code] ?? null,
    observations: etat.observations.length,
    tentatives: tentativesParCode.get(etat.skill.code) ?? 0,
    servies: servies.get(etat.skill.code) ?? 0,
    jourApparition: jourApparition.get(etat.skill.code) ?? 0,
  }));

  const codes = new Set(noeuds.map((n) => n.code));
  const liens = etats.flatMap((etat) =>
    etat.skill.prerequis
      .filter((p) => codes.has(p))
      .map((p) => ({ de: p, vers: etat.skill.code })),
  );

  const relies = new Set(liens.flatMap((l) => [l.de, l.vers]));
  const parCode = new Map(etats.map((e) => [e.skill.code, e.skill.prerequis]));

  return {
    noeuds,
    liens,
    domaines: parcours.monde.lots.map((lot) => ({
      id: lot.domaine.id,
      nom: lot.domaine.nom,
      competences: lot.competences.length,
    })),
    isolees: noeuds.filter((n) => !relies.has(n.code)).length,
    profondeurMax: noeuds.reduce(
      (max, n) => Math.max(max, profondeurPrerequis(n.code, parCode)),
      0,
    ),
    jamaisObservees: noeuds.filter((n) => n.observations === 0).length,
  };
}

/* ------------------------------------------------------------------ */
/* Justesse                                                            */
/* ------------------------------------------------------------------ */

function justesse(parcours: ResultatParcoursLong): Justesse {
  const dernier = parcours.resultat.pas.at(-1);
  // Une compétence sans niveau n'entre pas dans la comparaison : « le moteur ne
  // se prononce pas » n'est pas une erreur d'estimation (invariant 3).
  const paires: { code: string; intitule: string; niveau: number; aptitude: number }[] = [];
  for (const etat of dernier?.etats ?? []) {
    const aptitude = parcours.veriteTerrain[etat.skill.code];
    if (etat.niveau === null || aptitude === undefined) continue;
    paires.push({
      code: etat.skill.code,
      intitule: etat.skill.intitule,
      niveau: etat.niveau,
      aptitude,
    });
  }

  const ecarts = paires.map((p) => p.niveau - p.aptitude);
  const absolus = ecarts.map(Math.abs);

  return {
    comparables: paires.length,
    ecartMoyen: arrondir(moyenne(absolus)),
    biais: arrondir(moyenne(ecarts)),
    dansDemiNiveau:
      paires.length === 0 ? null : absolus.filter((e) => e <= 0.5).length / paires.length,
    dansUnNiveau:
      paires.length === 0 ? null : absolus.filter((e) => e <= 1).length / paires.length,
    correlationRangs: arrondir(
      correlationRangs(
        paires.map((p) => p.niveau),
        paires.map((p) => p.aptitude),
      ),
    ),
    pires: paires
      .map((p) => ({ ...p, ecart: arrondir(p.niveau - p.aptitude) as number }))
      .sort((a, b) => Math.abs(b.ecart) - Math.abs(a.ecart))
      .slice(0, 6),
  };
}

/* ------------------------------------------------------------------ */
/* Fiabilité des prédictions de réussite                               */
/* ------------------------------------------------------------------ */

const BORNES = [0, 0.2, 0.4, 0.6, 0.8, 1.0001];

function fiabilite(registre: LigneRegistre[]): BucketFiabilite[] {
  const tranchees = registre.filter((l) => l.type === "reussite" && l.observe !== null);
  const buckets: BucketFiabilite[] = [];

  for (let i = 0; i < BORNES.length - 1; i += 1) {
    const dans = tranchees.filter(
      (l) => l.prediction.valeur >= BORNES[i] && l.prediction.valeur < BORNES[i + 1],
    );
    if (dans.length === 0) continue;
    buckets.push({
      borne: `${Math.round(BORNES[i] * 100)}–${Math.round(Math.min(1, BORNES[i + 1]) * 100)} %`,
      n: dans.length,
      conclusif: dans.length >= 30,
      predit: arrondir(moyenne(dans.map((l) => l.prediction.valeur)), 3) as number,
      observe: arrondir(moyenne(dans.map((l) => l.observe as number)), 3) as number,
    });
  }
  return buckets;
}

/* ------------------------------------------------------------------ */
/* Sélection                                                           */
/* ------------------------------------------------------------------ */

function selection(parcours: ResultatParcoursLong): Selection {
  const actions = parcours.actions;
  const dernier = parcours.resultat.pas.at(-1);
  const intitules = new Map(
    (dernier?.etats ?? []).map((e) => [e.skill.code, e.skill.intitule]),
  );

  const parCode = new Map<string, number>();
  for (const action of actions) parCode.set(action.code, (parCode.get(action.code) ?? 0) + 1);

  const servies = [...parCode.entries()]
    .map(([code, n]) => ({
      code,
      intitule: intitules.get(code) ?? code,
      servies: n,
      part: n / Math.max(1, actions.length),
    }))
    .sort((a, b) => b.servies - a.servies);

  const menees = actions.filter((a) => a.menee);
  const avecAptitude = actions.filter((a) => a.aptitude !== null);
  const ecarts = new Map<number, number>();
  for (const action of avecAptitude) {
    const ecart = Math.round(action.difficulte - (action.aptitude as number));
    ecarts.set(ecart, (ecarts.get(ecart) ?? 0) + 1);
  }

  const facteurs = new Map<string, number>();
  for (const action of actions) facteurs.set(action.facteur, (facteurs.get(action.facteur) ?? 0) + 1);

  let repetitionMax = 0;
  let courante = 0;
  let precedent: string | null = null;
  for (const resume of parcours.resumes) {
    const code = resume.tete?.code ?? null;
    if (code !== null && code === precedent) courante += 1;
    else courante = 1;
    precedent = code;
    repetitionMax = Math.max(repetitionMax, courante);
  }

  // Diversité : compétences distinctes servies par fenêtre glissante de 30 jours.
  const diversites: number[] = [];
  for (let debut = 0; debut + 30 <= parcours.monde.jours; debut += 30) {
    const fenetre = actions.filter((a) => a.jour >= debut && a.jour < debut + 30);
    if (fenetre.length === 0) continue;
    diversites.push(new Set(fenetre.map((a) => a.code)).size);
  }

  const codesConnus = (dernier?.etats ?? []).map((e) => e.skill.code);

  return {
    servies,
    jamaisServies: codesConnus.filter((code) => !parCode.has(code)),
    partMax: servies[0]?.part ?? 0,
    distinctesServies: parCode.size,
    ecartDifficulte: [...ecarts.entries()]
      .map(([ecart, n]) => ({ ecart, n }))
      .sort((a, b) => a.ecart - b.ecart),
    partDansZone:
      avecAptitude.length === 0
        ? null
        : avecAptitude.filter((a) => Math.abs(a.difficulte - (a.aptitude as number)) <= 1).length /
          avecAptitude.length,
    tauxSuivi: actions.length === 0 ? null : actions.filter((a) => a.suivie).length / actions.length,
    tauxReussite:
      menees.length === 0 ? null : menees.filter((a) => a.resultat === "reussi").length / menees.length,
    repartitionResultats: RESULTATS_TENTATIVE.map((resultat) => ({
      resultat,
      n: menees.filter((a) => a.resultat === resultat).length,
    })),
    facteurs: [...facteurs.entries()]
      .map(([libelle, n]) => ({ libelle, n, part: n / Math.max(1, actions.length) }))
      .sort((a, b) => b.n - a.n),
    repetitionMax,
    diversiteMensuelle: arrondir(moyenne(diversites), 1),
    exercicesUtilises: new Set(actions.filter((a) => a.suivie).map((a) => a.exerciceId)).size,
    partCatalogueUtilise:
      new Set(actions.filter((a) => a.suivie).map((a) => a.exerciceId)).size /
      Math.max(1, parcours.resultat.scenario.exercices.length),
    joursSansExercice: parcours.resumes.filter((r) => r.genre === "sans-exercice").length,
    joursTeteVide: parcours.resumes.filter((r) => r.tete !== null && r.tete.exercice === null)
      .length,
    partHorsTete:
      actions.length === 0 ? null : actions.filter((a) => a.rang > 0).length / actions.length,
  };
}

/* ------------------------------------------------------------------ */
/* Révision et oubli                                                   */
/* ------------------------------------------------------------------ */

const LIBELLE_REVISION = "Due pour révision";

function revisions(parcours: ResultatParcoursLong): Revisions {
  const actions = parcours.actions;
  const derniereFois = new Map<string, number>();
  const delais: number[] = [];
  let actionsRevision = 0;

  for (const action of actions) {
    const precedente = derniereFois.get(action.code);
    if (action.facteur === LIBELLE_REVISION) {
      actionsRevision += 1;
      if (precedente !== undefined) delais.push(action.jour - precedente);
    }
    if (action.menee) derniereFois.set(action.code, action.jour);
  }

  // Une baisse de niveau sans nouvelle observation serait une anomalie ; une
  // baisse APRÈS une observation est le comportement attendu de l'oubli.
  let baisses = 0;
  const retombees = new Set<string>();
  for (let i = 1; i < parcours.resumes.length; i += 1) {
    const avant = parcours.resumes[i - 1].niveaux;
    const apres = parcours.resumes[i].niveaux;
    for (const [code, niveau] of Object.entries(apres)) {
      const precedent = avant[code];
      if (precedent === null || precedent === undefined || niveau === null) continue;
      if (niveau < precedent) {
        baisses += 1;
        if (precedent >= 3 && niveau < 3) retombees.add(code);
      }
    }
  }

  const reprises = parcours.monde.pauses.map((pause) => {
    const premiere = actions.find((a) => a.jour > pause.fin && a.menee);
    return {
      motif: pause.motif,
      jour: pause.fin,
      joursAvantReprise: premiere ? premiere.jour - pause.fin : null,
    };
  });

  return {
    actionsRevision,
    partRevision: actions.length === 0 ? null : actionsRevision / actions.length,
    delaiMedianRetour: arrondir(mediane(delais), 1),
    delaiMaxRetour: delais.length === 0 ? null : Math.max(...delais),
    baissesDeNiveau: baisses,
    competencesRetombees: retombees.size,
    reprisesApresPause: reprises,
  };
}

/* ------------------------------------------------------------------ */
/* Activité                                                            */
/* ------------------------------------------------------------------ */

function activite(parcours: ResultatParcoursLong): Activite {
  const tentatives = parcours.resultat.pas.at(-1)?.tentatives ?? [];
  const menees = tentatives.filter((t) => t.statut === "terminee");
  const minutes = tentatives.reduce((s, t) => s + (t.dureeMin ?? 0), 0);
  const joursActifs = new Set(menees.map((t) => (t.fin ?? t.debut).slice(0, 10))).size;

  const semainesActives = new Set(
    menees.map((t) => Math.floor(new Date(t.fin ?? t.debut).getTime() / (7 * JOUR_MS))),
  ).size;

  let serieMax = 0;
  let courante = 0;
  for (const resume of parcours.resumes) {
    if (resume.genre === "tentative") courante += 1;
    else courante = 0;
    serieMax = Math.max(serieMax, courante);
  }

  const estimees = parcours.actions.filter((a) => a.menee && a.dureeMin !== null);

  return {
    minutes: Math.round(minutes),
    minutesParSemaineActive: semainesActives === 0 ? null : Math.round(minutes / semainesActives),
    joursActifs,
    partJoursActifs: joursActifs / Math.max(1, parcours.monde.jours),
    serieMax,
    dureeMoyenneTentative: arrondir(moyenne(menees.map((t) => t.dureeMin ?? 0)), 1),
    rapportDuree: arrondir(
      moyenne(estimees.map((a) => (a.dureeMin as number) / Math.max(1, a.dureeEstimeeMin))),
    ),
  };
}

/* ------------------------------------------------------------------ */
/* Compétences                                                         */
/* ------------------------------------------------------------------ */

function lignesCompetences(
  parcours: ResultatParcoursLong,
  servies: Map<string, number>,
  tentativesParCode: Map<string, number>,
  reussitesParCode: Map<string, number>,
  echantillon: PasResume[],
): LigneCompetence[] {
  const dernier = parcours.resultat.pas.at(-1);

  return (dernier?.etats ?? []).map((etat) => {
    const code = etat.skill.code;
    const aptitude = parcours.veriteTerrain[code] ?? null;

    let jourPremiere: number | null = null;
    let jourMaitrise: number | null = null;
    for (const resume of parcours.resumes) {
      const niveau = resume.niveaux[code];
      if (niveau === null || niveau === undefined) continue;
      if (jourPremiere === null) jourPremiere = resume.jour;
      if (jourMaitrise === null && niveau >= 3) jourMaitrise = resume.jour;
    }

    return {
      code,
      intitule: etat.skill.intitule,
      domaine: etat.skill.domaine,
      palier: etat.skill.palier,
      niveau: etat.niveau,
      aptitude,
      ecart: etat.niveau === null || aptitude === null ? null : arrondir(etat.niveau - aptitude),
      confiance: etat.confiance,
      statut: etat.statut,
      observations: etat.observations.length,
      contextes: etat.contextesTestes.length,
      servies: servies.get(code) ?? 0,
      tentatives: tentativesParCode.get(code) ?? 0,
      reussites: reussitesParCode.get(code) ?? 0,
      jourPremiereObservation: jourPremiere,
      jourMaitrise,
      serie: echantillon.map((resume) => resume.niveaux[code] ?? null),
    };
  });
}

/* ------------------------------------------------------------------ */
/* Verdicts                                                            */
/* ------------------------------------------------------------------ */

function pourcent(valeur: number | null, decimales = 0): string {
  return valeur === null ? "non mesuré" : `${(valeur * 100).toFixed(decimales)} %`;
}

function verdict(
  cle: string,
  question: string,
  valeur: string,
  attendu: string,
  statut: StatutVerdict,
  piste: string,
): Verdict {
  return { cle, question, valeur, attendu, statut, piste };
}

function seuil(valeur: number | null, ok: number, alerte: number): StatutVerdict {
  if (valeur === null) return "inconnu";
  if (valeur >= ok) return "ok";
  if (valeur >= alerte) return "alerte";
  return "echec";
}

function seuilInverse(valeur: number | null, ok: number, alerte: number): StatutVerdict {
  if (valeur === null) return "inconnu";
  if (valeur <= ok) return "ok";
  if (valeur <= alerte) return "alerte";
  return "echec";
}

function construireVerdicts(
  entete: Entete,
  objectifs: BilanObjectif[],
  graphe: GrapheFinal,
  just: Justesse,
  sel: Selection,
  rev: Revisions,
  metriques: MetriqueMoteur[],
  croissancePoints: PointCroissance[],
): Verdict[] {
  const resolus = objectifs.filter((o) => o.jourAtteint !== null).length;
  const partResolus = objectifs.length === 0 ? null : resolus / objectifs.length;
  const couverture =
    graphe.noeuds.length === 0
      ? null
      : (graphe.noeuds.length - graphe.jamaisObservees) / graphe.noeuds.length;

  const milieu = croissancePoints[Math.floor(croissancePoints.length / 2)] ?? null;
  const fin = croissancePoints.at(-1) ?? null;
  const progression =
    milieu?.niveauMoyen === null ||
    milieu?.niveauMoyen === undefined ||
    fin?.niveauMoyen === null ||
    fin?.niveauMoyen === undefined
      ? null
      : fin.niveauMoyen - milieu.niveauMoyen;

  const reussite = sel.tauxReussite;
  const statutReussite: StatutVerdict =
    reussite === null
      ? "inconnu"
      : reussite >= 0.5 && reussite <= 0.85
        ? "ok"
        : reussite >= 0.35 && reussite <= 0.92
          ? "alerte"
          : "echec";

  const mesurees = metriques.filter((m) => m.valeur !== null).length;

  return [
    verdict(
      "objectifs",
      "Les objectifs déclarés finissent-ils par être atteints ?",
      `${resolus} sur ${objectifs.length}`,
      "au moins 4 sur 5",
      seuil(partResolus, 0.8, 0.5),
      "Regarder les objectifs non résolus : leurs compétences sont-elles seulement servies, et à quelle difficulté ?",
    ),
    verdict(
      "couverture",
      "Le graphe se couvre-t-il au rythme où il s'étend ?",
      `${pourcent(couverture)} des compétences observées (${graphe.jamaisObservees} jamais)`,
      "au moins 90 %",
      seuil(couverture, 0.9, 0.7),
      "Une compétence jamais observée n'a jamais été proposée en tête : vérifier le score de recommandation des nouvelles branches.",
    ),
    verdict(
      "justesse",
      "Le niveau estimé ressemble-t-il à l'aptitude réelle ?",
      just.ecartMoyen === null ? "non mesuré" : `${just.ecartMoyen.toFixed(2)} niveau d'écart moyen`,
      "moins de 0,70",
      seuilInverse(just.ecartMoyen, 0.7, 1.1),
      "Comparer les pires écarts : viennent-ils d'un manque d'observations, ou d'une conversion qualité → niveau trop généreuse ?",
    ),
    verdict(
      "biais",
      "Le moteur se trompe-t-il toujours dans le même sens ?",
      just.biais === null ? "non mesuré" : `${just.biais > 0 ? "+" : ""}${just.biais.toFixed(2)}`,
      "entre −0,35 et +0,35",
      seuilInverse(just.biais === null ? null : Math.abs(just.biais), 0.35, 0.7),
      "Un biais positif = surestimation systématique : regarder `qualiteDepuisDifficulte` et le poids de l'autonomie.",
    ),
    verdict(
      "zone",
      "Les exercices servis étaient-ils à la bonne difficulté ?",
      pourcent(sel.partDansZone),
      "au moins 60 % à ±1 niveau de l'aptitude réelle",
      seuil(sel.partDansZone, 0.6, 0.4),
      "Comparer difficulté visée et difficulté servie : le catalogue offre-t-il la difficulté demandée par la calibration ?",
    ),
    verdict(
      "reussite",
      "Le régime de réussite est-il tenable ?",
      pourcent(reussite),
      "entre 50 % et 85 %",
      statutReussite,
      "Trop de réussite = trop facile, trop d'échec = trop dur. Les deux se corrigent par la calibration, pas par le référentiel.",
    ),
    verdict(
      "concentration",
      "Le moteur tourne-t-il en rond sur les mêmes compétences ?",
      `${pourcent(sel.partMax)} pour la plus servie, ${sel.repetitionMax} jours d'affilée au maximum`,
      "moins de 15 % pour la plus servie",
      seuilInverse(sel.partMax, 0.15, 0.3),
      "Regarder le facteur dominant de ces jours-là : « Jamais évaluée » et « Due pour révision » ne devraient pas s'entretenir mutuellement.",
    ),
    verdict(
      "revision",
      "Les révisions arrivent-elles quand elles sont dues ?",
      rev.delaiMedianRetour === null
        ? "aucune révision servie"
        : `${rev.delaiMedianRetour} jours de délai médian, ${rev.competencesRetombees} compétence(s) retombée(s) sous le seuil`,
      "moins de 14 jours",
      seuilInverse(rev.delaiMedianRetour, 14, 30),
      "Croiser avec les pauses : une reprise trop tardive vient soit du modèle d'intervalle, soit du score qui privilégie le neuf.",
    ),
    verdict(
      "catalogue",
      "Le catalogue suit-il, ou faut-il fabriquer en urgence ?",
      `${entete.exercicesGeneres} exercice(s) fabriqué(s) faute de disponible, ${pourcent(sel.partCatalogueUtilise)} du catalogue initial consommé`,
      "moins d'une proposition sur dix fabriquée dans l'urgence",
      seuilInverse(entete.exercicesGeneres / Math.max(1, entete.propositions), 0.1, 0.3),
      "Un exercice réussi sort définitivement de la file : sur un parcours long, la compétence la mieux classée finit par n'avoir plus rien, et c'est le tuteur qui doit produire à la demande.",
    ),
    verdict(
      "invariants",
      "Un invariant a-t-il été rompu ?",
      `${entete.invariants} rupture(s), ${entete.anomalies} anomalie(s) au total`,
      "aucune rupture",
      entete.invariants === 0 ? "ok" : "echec",
      "Chaque anomalie nomme sa règle : elles sont dans `lib/simulation/anomalies.ts`, et chacune protège un invariant écrit.",
    ),
    verdict(
      "auto-evaluation",
      "Le moteur peut-il se juger lui-même sur ce volume ?",
      `${mesurees} métrique(s) sur ${metriques.length} au-dessus du seuil`,
      "les 4",
      seuil(metriques.length === 0 ? null : mesurees / metriques.length, 1, 0.5),
      "Une métrique sous son seuil après dix-huit mois signale un horizon de prédiction mal choisi, pas un manque d'usage.",
    ),
    verdict(
      "progression",
      "Le niveau progresse-t-il encore sur la seconde moitié ?",
      progression === null
        ? "non mesuré"
        : `${progression > 0 ? "+" : ""}${progression.toFixed(2)} niveau moyen`,
      "strictement positif",
      progression === null ? "inconnu" : progression > 0.1 ? "ok" : progression > 0 ? "alerte" : "echec",
      "Un plateau en seconde moitié peut être réel (l'apprenant plafonne) ou fabriqué (le moteur ne propose plus assez dur).",
    ),
  ];
}

/* ------------------------------------------------------------------ */
/* Assemblage                                                          */
/* ------------------------------------------------------------------ */

/** Le déroulé, allégé : un jour sur sept, plus tous les jours qui disent quelque chose. */
function derouleLisible(resumes: PasResume[]): PasResume[] {
  return resumes.filter(
    (r) =>
      r.jour % 7 === 0 ||
      r.genre === "extension" ||
      r.genre === "sans-exercice" ||
      r.anomalies > 0 ||
      r.jour === resumes.length - 1,
  );
}

function resultatReel(
  parcours: ResultatParcoursLong,
  objectifs: BilanObjectif[],
  graphe: GrapheFinal,
  act: Activite,
): ResultatReel {
  const codes = Object.keys(parcours.veriteTerrain);
  const initiales = codes.map((code) => parcours.aptitudeInitiale[code] ?? 0);
  const finales = codes.map((code) => parcours.veriteTerrain[code] ?? 0);
  const gains = codes.map(
    (code, i) => (finales[i] ?? 0) - (parcours.aptitudeInitiale[code] ?? finales[i] ?? 0),
  );
  const gainTotal = gains.reduce((s, g) => s + g, 0);
  const heures = act.minutes / 60;
  const resolus = objectifs.filter((o) => o.jourAtteint !== null);
  const reels = objectifs.filter((o) => o.jourAtteintReel !== null);
  const retards = objectifs
    .map((o) => o.retardReconnaissance)
    .filter((r): r is number => r !== null);

  return {
    heures: Math.round(heures * 10) / 10,
    aptitudeMoyenneInitiale: arrondir(moyenne(initiales)) ?? 0,
    aptitudeMoyenneFinale: arrondir(moyenne(finales)) ?? 0,
    gainAptitudeTotal: arrondir(gainTotal) ?? 0,
    gainAptitudeMoyen: arrondir(moyenne(gains)) ?? 0,
    gainParHeure: heures === 0 ? null : arrondir(gainTotal / heures, 3),
    objectifsResolus: resolus.length,
    partObjectifsResolus: objectifs.length === 0 ? 0 : resolus.length / objectifs.length,
    joursMedianResolution: arrondir(
      mediane(resolus.map((o) => o.joursPourResoudre ?? 0)),
      1,
    ),
    objectifsAtteintsReellement: reels.length,
    partObjectifsReels: objectifs.length === 0 ? 0 : reels.length / objectifs.length,
    joursMedianResolutionReelle: arrondir(
      mediane(reels.map((o) => (o.jourAtteintReel ?? 0) - o.jourDeclare)),
      1,
    ),
    retardMedianReconnaissance: arrondir(mediane(retards), 1),
    couverture:
      graphe.noeuds.length === 0
        ? 0
        : (graphe.noeuds.length - graphe.jamaisObservees) / graphe.noeuds.length,
    exercicesGeneres: parcours.exercicesGeneres,
  };
}

export function construireTableauDeBord(parcours: ResultatParcoursLong): TableauDeBord {
  const dernier = parcours.resultat.pas.at(-1);
  const tentatives = dernier?.tentatives ?? [];
  const menees = tentatives.filter((t) => t.statut === "terminee");

  const parExercice = new Map(
    parcours.resultat.scenario.exercices.map((e) => [e.id, e.competences]),
  );
  const tentativesParCode = new Map<string, number>();
  const reussitesParCode = new Map<string, number>();
  for (const tentative of menees) {
    for (const code of parExercice.get(tentative.exerciseId) ?? []) {
      tentativesParCode.set(code, (tentativesParCode.get(code) ?? 0) + 1);
      if (tentative.resultat === "reussi") {
        reussitesParCode.set(code, (reussitesParCode.get(code) ?? 0) + 1);
      }
    }
  }

  const servies = new Map<string, number>();
  for (const action of parcours.actions) {
    servies.set(action.code, (servies.get(action.code) ?? 0) + 1);
  }

  const registre = construireRegistre(parcours.resultat);
  const objectifs = bilanObjectifs(parcours, tentativesParCode);
  const echantillon = echantillonner(parcours.resumes, parcours.monde.jours);
  const points = croissance(echantillon, objectifs);
  const graphe = grapheFinal(parcours, servies, tentativesParCode);
  const just = justesse(parcours);
  const sel = selection(parcours);
  const rev = revisions(parcours);
  const act = activite(parcours);

  const entete: Entete = {
    jours: parcours.monde.jours,
    mois: Math.round(parcours.monde.jours / 30.4),
    domaines: parcours.resultat.scenario.domaines.length,
    competences: parcours.resultat.scenario.competences.length,
    exercices: parcours.resultat.scenario.exercices.length,
    propositions: parcours.actions.length,
    suivies: parcours.actions.filter((a) => a.suivie).length,
    tentativesMenees: menees.length,
    abandons: tentatives.length - menees.length,
    ignorees: parcours.actions.filter((a) => !a.suivie).length,
    observations: dernier?.observations.length ?? 0,
    decisions: parcours.resultat.decisions.length,
    predictions: parcours.resultat.predictions.length,
    minutes: act.minutes,
    joursActifs: act.joursActifs,
    anomalies: parcours.resultat.anomalies.length,
    invariants: parcours.resultat.anomalies.filter((a) => a.gravite === "invariant").length,
    exercicesGeneres: parcours.exercicesGeneres,
    dureeCalculMs: parcours.dureeCalculMs,
  };

  return {
    entete,
    resultatReel: resultatReel(parcours, objectifs, graphe, act),
    verdicts: construireVerdicts(
      entete,
      objectifs,
      graphe,
      just,
      sel,
      rev,
      parcours.resultat.metriques,
      points,
    ),
    objectifs,
    croissance: points,
    graphe,
    justesse: just,
    fiabilite: fiabilite(registre),
    selection: sel,
    revisions: rev,
    activite: act,
    competences: lignesCompetences(
      parcours,
      servies,
      tentativesParCode,
      reussitesParCode,
      echantillon,
    ),
    metriques: parcours.resultat.metriques,
    anomalies: parcours.resultat.anomalies,
    registre,
    deroule: derouleLisible(parcours.resumes),
  };
}
