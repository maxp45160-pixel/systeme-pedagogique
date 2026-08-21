/**
 * La conclusion, et l'export qui va avec.
 *
 * ## Pourquoi une conclusion écrite, et pas seulement des chiffres
 *
 * Un tableau de bord de quarante mesures ne dit pas quoi faire. La conclusion
 * range ce qui vient d'être mesuré en trois piles : ce qui tient, ce qui ne
 * tient pas, et ce que la simulation ne prouve pas. Elle est **dérivée**, jamais
 * rédigée à la main : chaque phrase cite le chiffre dont elle sort, et un
 * chantier qui déplacerait le chiffre déplacerait la phrase.
 *
 * Aucune conclusion n'est une décision. « Le moteur surestime de 0,89 niveau »
 * est un fait sur ce parcours simulé ; « il faut changer la conversion
 * qualité → niveau » est une décision, et elle ne se prend pas ici (CLAUDE.md :
 * ne jamais transformer une analyse en décision validée).
 *
 * ## L'export
 *
 * Un seul objet JSON, autodescriptif, destiné à être relu par un modèle : il
 * porte ses propres unités, ses seuils, la façon dont il a été produit et ce
 * qu'il ne prouve pas. Sans ces champs, un lecteur — humain ou non — prendrait
 * des mesures faites sur un apprenant modèle pour des mesures de production.
 */

import type { ActionServie } from "./parcours-long";
import type { StatutVerdict, TableauDeBord, Verdict } from "./tableau-de-bord";

export const FORMAT_EXPORT = "simulation-parcours-analyse";
export const VERSION_EXPORT = 1;

/* ------------------------------------------------------------------ */
/* Conclusion                                                          */
/* ------------------------------------------------------------------ */

export type GraviteConstat = "bloquant" | "important" | "a-surveiller";

export interface Constat {
  cle: string;
  gravite: GraviteConstat;
  /** Le fait mesuré, avec son chiffre. */
  fait: string;
  /** Ce que ce fait veut dire pour le produit. */
  lecture: string;
  /** Où regarder — jamais quoi décider. */
  piste: string;
  /** Fichiers concernés, pour ouvrir directement. */
  ou: string[];
}

export interface Conclusion {
  resume: string;
  tenu: string[];
  constats: Constat[];
  reserve: string;
}

/** Où se règle chaque question, quand elle se règle mal. */
const FICHIERS: Record<string, string[]> = {
  objectifs: ["src/lib/engine/recommend.ts", "src/lib/engine/parcours.ts"],
  couverture: ["src/lib/engine/recommend.ts"],
  justesse: ["src/lib/engine/skill-state.ts", "src/lib/engine/observation.ts"],
  biais: ["src/lib/engine/observation.ts", "src/lib/engine/skill-state.ts"],
  zone: ["src/lib/engine/calibration.ts", "src/lib/engine/recommend.ts"],
  reussite: ["src/lib/engine/calibration.ts"],
  concentration: ["src/lib/engine/recommend.ts", "src/lib/engine/spaced.ts"],
  revision: ["src/lib/engine/spaced.ts", "src/lib/engine/recommend.ts"],
  catalogue: ["src/lib/engine/recommend.ts"],
  invariants: ["src/lib/simulation/anomalies.ts"],
  "auto-evaluation": ["src/lib/engine/auto-evaluation.ts", "src/lib/engine/prediction.ts"],
  progression: ["src/lib/engine/calibration.ts", "src/lib/engine/recommend.ts"],
};

const GRAVITE: Record<StatutVerdict, GraviteConstat | null> = {
  echec: "bloquant",
  alerte: "important",
  inconnu: "a-surveiller",
  ok: null,
};

function constatDuVerdict(verdict: Verdict): Constat | null {
  const gravite = GRAVITE[verdict.statut];
  if (gravite === null) return null;
  return {
    cle: verdict.cle,
    gravite,
    fait: `${verdict.question} → ${verdict.valeur} (attendu : ${verdict.attendu}).`,
    lecture: MOT_LECTURE[verdict.cle] ?? "Le seuil écrit d'avance n'est pas tenu sur ce parcours.",
    piste: verdict.piste,
    ou: FICHIERS[verdict.cle] ?? [],
  };
}

const MOT_LECTURE: Record<string, string> = {
  objectifs:
    "Un objectif déclaré et jamais atteint est le seul échec que l'utilisateur voit vraiment : tout le reste lui est invisible.",
  couverture:
    "Le référentiel grandit plus vite qu'il ne se couvre : des compétences existent sans qu'aucune mesure ne s'y attache.",
  justesse:
    "Le niveau affiché ne décrit pas la personne. Toutes les décisions du moteur en découlent, y compris la difficulté servie.",
  biais:
    "L'erreur n'est pas du bruit mais une direction constante : c'est une règle de conversion à revoir, pas un manque de données.",
  zone:
    "Les exercices servis tombent à côté de l'aptitude réelle : trop bas, ils n'apprennent rien ; trop haut, ils ne mesurent rien.",
  reussite:
    "Le régime de réussite sort de la plage où l'on apprend encore quelque chose de chaque tentative.",
  concentration:
    "Le moteur revient sur les mêmes compétences : le parcours dépend alors du classement, pas du besoin.",
  revision:
    "Ce qui a été appris est revu trop tard : l'oubli a le temps de faire son travail avant la relance.",
  catalogue:
    "La file d'exercices s'assèche : un exercice réussi en sort définitivement, et la compétence la mieux classée n'a plus rien à proposer.",
  invariants:
    "Une règle que le système ne devrait pas pouvoir enfreindre l'a été. C'est le seul type de constat qui ne se discute pas.",
  "auto-evaluation":
    "Le moteur ne peut pas se juger lui-même faute de prédictions tranchées : l'horizon choisi est probablement trop long.",
  progression:
    "Le niveau ne monte plus sur la seconde moitié : soit l'apprenant plafonne, soit le moteur cesse de proposer assez dur.",
};

function phrasesTenues(tableau: TableauDeBord): string[] {
  return tableau.verdicts
    .filter((v) => v.statut === "ok")
    .map((v) => `${v.question} ${v.valeur}.`);
}

/**
 * Les constats qui ne viennent pas d'un verdict.
 *
 * Un verdict répond à une question posée d'avance. Ces trois-là sortent de la
 * matière elle-même — un objectif perdu, une tête de liste vide, une compétence
 * jamais servie — et n'auraient aucune raison d'avoir leur propre seuil.
 */
function constatsDeMatiere(tableau: TableauDeBord): Constat[] {
  const constats: Constat[] = [];

  const perdus = tableau.objectifs.filter((o) => o.jourPerdu !== null);
  if (perdus.length > 0) {
    constats.push({
      cle: "objectif-perdu",
      gravite: "important",
      fait: `${perdus.length} objectif(s) atteint(s) puis reperdu(s) : ${perdus
        .map((o) => `« ${o.intitule} » (atteint j${o.jourAtteint}, perdu j${o.jourPerdu})`)
        .join(", ")}.`,
      lecture:
        "Un objectif qui se défait est un fait pédagogique réel (l'oubli), mais le produit ne le signale nulle part.",
      piste:
        "Croiser avec la révision : la compétence retombée était-elle due, et le moteur l'a-t-il reproposée avant la chute ?",
      ou: ["src/lib/engine/spaced.ts", "src/lib/engine/progression.ts"],
    });
  }

  if (tableau.selection.joursTeteVide > 0) {
    constats.push({
      cle: "tete-vide",
      gravite: tableau.selection.joursTeteVide > tableau.entete.jours / 4 ? "important" : "a-surveiller",
      fait: `${tableau.selection.joursTeteVide} jour(s) sur ${tableau.entete.jours} où la proposition la mieux classée ne portait aucun exercice ; ${(
        (tableau.selection.partHorsTete ?? 0) * 100
      ).toFixed(0)} % des actions ont été prises plus bas dans la liste.`,
      lecture:
        "Le classement et la disponibilité sont décidés séparément : la compétence gagne le classement, puis on découvre qu'il n'y a rien à lui donner.",
      piste:
        "Regarder si la disponibilité d'un exercice doit entrer dans le score plutôt que d'être vérifiée après coup.",
      ou: ["src/lib/engine/recommend.ts"],
    });
  }

  if (tableau.selection.jamaisServies.length > 0) {
    constats.push({
      cle: "jamais-servies",
      gravite: "a-surveiller",
      fait: `${tableau.selection.jamaisServies.length} compétence(s) jamais proposée(s) en dix-huit mois : ${tableau.selection.jamaisServies.join(", ")}.`,
      lecture:
        "Ces compétences existent au référentiel, comptent dans le score global, et n'ont jamais eu la moindre chance d'être mesurées.",
      piste:
        "Vérifier leur score de recommandation : importance faible, prérequis non consolidés, ou simple manque d'exercices ?",
      ou: ["src/lib/engine/recommend.ts"],
    });
  }

  const pireBucket = [...tableau.fiabilite].sort(
    (a, b) => Math.abs(b.predit - b.observe) - Math.abs(a.predit - a.observe),
  )[0];
  if (pireBucket && Math.abs(pireBucket.predit - pireBucket.observe) > 0.15) {
    constats.push({
      cle: "fiabilite",
      gravite: "important",
      fait: `Quand le moteur annonce ${(pireBucket.predit * 100).toFixed(0)} % de chances de réussite, il en survient ${(pireBucket.observe * 100).toFixed(0)} % (${pireBucket.n} cas).`,
      lecture:
        "La prédiction de réussite est décalée dans une direction constante : ce n'est pas une question de volume.",
      piste:
        "Le modèle de prédiction n'a jamais été confronté au réel : ce parcours est la première confrontation disponible.",
      ou: ["src/lib/engine/prediction.ts", "src/lib/engine/auto-evaluation.ts"],
    });
  }

  return constats;
}

const ORDRE_GRAVITE: GraviteConstat[] = ["bloquant", "important", "a-surveiller"];

export function redigerConclusion(tableau: TableauDeBord): Conclusion {
  const constats = [
    ...tableau.verdicts.map(constatDuVerdict).filter((c): c is Constat => c !== null),
    ...constatsDeMatiere(tableau),
  ].sort((a, b) => ORDRE_GRAVITE.indexOf(a.gravite) - ORDRE_GRAVITE.indexOf(b.gravite));

  const resolus = tableau.objectifs.filter((o) => o.jourAtteint !== null).length;
  const bloquants = constats.filter((c) => c.gravite === "bloquant").length;

  const resume = [
    `Sur ${tableau.entete.mois} mois simulés, ${tableau.entete.tentativesMenees} exercices menés et ${tableau.entete.observations} observations, ${resolus} objectif(s) sur ${tableau.objectifs.length} ont été atteints et ${tableau.graphe.noeuds.length - tableau.graphe.jamaisObservees} compétence(s) sur ${tableau.graphe.noeuds.length} ont reçu au moins une mesure.`,
    tableau.justesse.ecartMoyen === null
      ? "L'écart au réel n'a pas pu être calculé."
      : `Le niveau estimé s'écarte en moyenne de ${tableau.justesse.ecartMoyen.toFixed(2)} de l'aptitude réelle, avec un biais de ${(tableau.justesse.biais ?? 0) > 0 ? "+" : ""}${(tableau.justesse.biais ?? 0).toFixed(2)}.`,
    bloquants === 0
      ? "Aucun seuil n'est franchement rompu."
      : `${bloquants} question(s) sortent du seuil écrit d'avance et demandent un chantier.`,
  ].join(" ");

  return {
    resume,
    tenu: phrasesTenues(tableau),
    constats,
    reserve:
      "Ces chiffres disent ce que le moteur fait d'un apprenant modèle, dont la règle de réussite est une logistique écrite à la main. Un verdict au vert ne prouve pas que le produit marche en production ; un verdict au rouge prouve seulement qu'il y a quelque chose à regarder, le parcours étant reproductible à la graine près.",
  };
}

/* ------------------------------------------------------------------ */
/* Export                                                              */
/* ------------------------------------------------------------------ */

export interface ExportAnalyse {
  format: typeof FORMAT_EXPORT;
  version: typeof VERSION_EXPORT;
  /** Comment lire ce fichier — destiné à un lecteur qui n'a pas le code sous les yeux. */
  notice: {
    nature: string;
    production: string;
    reproductible: string;
    unites: Record<string, string>;
    conventions: string[];
  };
  monde: {
    matiere: string;
    jours: number;
    graine: number;
    domaines: { id: string; nom: string; jourOuverture: number; competences: number }[];
    pauses: { debut: number; fin: number; motif: string }[];
    profil: { apprentissage: number; tauxIgnore: number; lenteur: number; oubli: number };
  };
  conclusion: Conclusion;
  verdicts: Verdict[];
  entete: TableauDeBord["entete"];
  objectifs: TableauDeBord["objectifs"];
  croissance: TableauDeBord["croissance"];
  graphe: TableauDeBord["graphe"];
  justesse: TableauDeBord["justesse"];
  fiabilite: TableauDeBord["fiabilite"];
  selection: TableauDeBord["selection"];
  revisions: TableauDeBord["revisions"];
  activite: TableauDeBord["activite"];
  competences: TableauDeBord["competences"];
  metriques: TableauDeBord["metriques"];
  anomalies: { regle: string; gravite: string; occurrences: number; exemple: string }[];
  actions: ActionServie[];
  registre: {
    type: string;
    emiseLe: string;
    cible: string;
    predit: number;
    observe: number | null;
    ecart: number | null;
  }[];
}

const UNITES: Record<string, string> = {
  niveau: "entier 0 à 5, dérivé des observations ; null = le moteur ne se prononce pas",
  aptitude:
    "réel 1 à 5, aptitude de l'apprenant simulé — invisible du moteur, c'est la vérité terrain",
  ecart: "niveau estimé moins aptitude réelle ; positif = surestimation",
  difficulte: "entier 1 à 5, propriété de l'exercice",
  jour: "jours écoulés depuis l'ouverture du compte simulé",
  part: "fraction 0 à 1",
  "brier-reussite": "score de Brier, plus bas est meilleur, 0 = parfait",
  "erreur-duree": "minutes d'écart absolu médian",
};

const CONVENTIONS = [
  "Absence de mesure ≠ zéro : null veut dire « aucune preuve », jamais « niveau nul ».",
  "Une tentative abandonnée ne produit aucune observation.",
  "Une prédiction que rien n'a tranchée reste en attente, jamais comptée comme fausse.",
  "Aucune arête du graphe n'est fabriquée : seuls les prérequis déclarés sont des liens.",
  "Le référentiel s'étend en cours de parcours : une compétence absente d'un jour donné n'existait pas encore.",
];

export function construireExportAnalyse(
  tableau: TableauDeBord,
  monde: {
    graine: number;
    jours: number;
    lots: { jour: number; domaine: { id: string; nom: string }; competences: unknown[] }[];
    pauses: { debut: number; fin: number; motif: string }[];
    profil: { apprentissage: number; tauxIgnore: number; lenteur: number; oubli?: number };
  },
  actions: ActionServie[],
): ExportAnalyse {
  const groupes = new Map<string, { regle: string; gravite: string; occurrences: number; exemple: string }>();
  for (const anomalie of tableau.anomalies) {
    const entree = groupes.get(anomalie.regle);
    if (entree) entree.occurrences += 1;
    else
      groupes.set(anomalie.regle, {
        regle: anomalie.regle,
        gravite: anomalie.gravite,
        occurrences: 1,
        exemple: anomalie.message,
      });
  }

  return {
    format: FORMAT_EXPORT,
    version: VERSION_EXPORT,
    notice: {
      nature:
        "Parcours SIMULÉ : un apprenant fictif, un référentiel de physique inventé pour l'occasion, aucune donnée réelle et aucune personne réelle.",
      production:
        "Les entrées (référentiel, exercices, objectifs, aptitude) sont fabriquées ; tout ce qui en sort (niveaux, calibration, recommandations, prédictions, métriques) est calculé par les fonctions de production du moteur.",
      reproductible:
        "Déterministe à la graine près : deux exécutions du même monde donnent le même journal, au chiffre près.",
      unites: UNITES,
      conventions: CONVENTIONS,
    },
    monde: {
      matiere: "Physique — mécanique, énergie, ondes, thermodynamique",
      jours: monde.jours,
      graine: monde.graine,
      domaines: monde.lots.map((lot) => ({
        id: lot.domaine.id,
        nom: lot.domaine.nom,
        jourOuverture: lot.jour,
        competences: lot.competences.length,
      })),
      pauses: monde.pauses,
      profil: {
        apprentissage: monde.profil.apprentissage,
        tauxIgnore: monde.profil.tauxIgnore,
        lenteur: monde.profil.lenteur,
        oubli: monde.profil.oubli ?? 0,
      },
    },
    conclusion: redigerConclusion(tableau),
    verdicts: tableau.verdicts,
    entete: tableau.entete,
    objectifs: tableau.objectifs,
    croissance: tableau.croissance,
    graphe: tableau.graphe,
    justesse: tableau.justesse,
    fiabilite: tableau.fiabilite,
    selection: tableau.selection,
    revisions: tableau.revisions,
    activite: tableau.activite,
    competences: tableau.competences,
    metriques: tableau.metriques,
    anomalies: [...groupes.values()].sort((a, b) => b.occurrences - a.occurrences),
    actions,
    registre: tableau.registre.map((ligne) => ({
      type: ligne.type,
      emiseLe: ligne.prediction.emiseLe,
      cible: ligne.prediction.cibleRef
        ? `${ligne.prediction.cibleCode} · ${ligne.prediction.cibleRef}`
        : ligne.prediction.cibleCode,
      predit: ligne.prediction.valeur,
      observe: ligne.observe,
      ecart: ligne.ecart,
    })),
  };
}

export function ecrireExportAnalyse(analyse: ExportAnalyse): string {
  return JSON.stringify(analyse, null, 2);
}
