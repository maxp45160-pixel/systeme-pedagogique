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
 * observations — quand le maillon « ajustement des exercices » sera traité.
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
import type { ContexteDocumentaire, ResumeObservationsDocumentaires } from "./document-context";
import {
  estOuvert,
  fenetreEcheance,
  FENETRE_ECHEANCE_JOURS,
  joursRestants,
  libelleCompte,
  type Engagement,
} from "@/lib/domain/engagement";
import { estDue, MODELE_ACTIF, prochaineRevision, type ModeleRevision } from "./spaced";

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
/**
 * La table par niveau vise un cran au-dessus du niveau démontré.
 *
 * Deux variantes ont été essayées le 21/08/2026 — viser le niveau lui-même, et
 * n'ajouter le cran qu'après une réussite — sur un modèle d'apprenant depuis
 * reconnu faux (l'oubli y écrasait les gains, aucun objectif n'y était jamais
 * réellement atteint). Leurs chiffres ne valent donc rien et ne sont pas
 * reproduits ici. Le cran reste, et la calibration le corrige quand les faits
 * le démentent ; la question est rouverte, pas tranchée.
 */
function difficulteDepuisNiveau(etat: SkillState): Difficulte {
  const n = etat.niveau;
  if (n === null) return 2; // diagnostic : difficulté standard, sans aide
  if (n <= 1) return 2;
  if (n === 2) return 3;
  if (n === 3) return 4;
  return 5;
}

/**
 * La difficulté à viser pour une compétence — calibration d'abord, niveau à
 * défaut.
 *
 * Exportée depuis le 10/08/2026 pour la composition de séance (`engine/caf.ts`),
 * qui doit annoncer une difficulté pour une compétence **sans exercice** : elle
 * n'a alors aucune `Recommandation` d'où la lire. La recopier là-bas aurait posé
 * une seconde table par niveau, et c'est précisément le genre de doublon qui
 * dérive sans bruit (ADR-044).
 */
export function difficulteVisee(etat: SkillState, calibration?: Calibration): Difficulte {
  const parNiveau = difficulteDepuisNiveau(etat);
  const conseillee = calibration?.difficulteConseillee;
  if (conseillee === null || conseillee === undefined) return parNiveau;

  // La calibration AJUSTE, elle ne dérive pas — ajouté le 21/08/2026.
  //
  // `difficulteConseillee` part de la difficulté de la dernière tentative
  // exploitable et lui applique ±1. Elle s'ancre donc sur ce qui a été servi,
  // jamais sur ce qui est su : une suite de « trop facile » la fait monter de
  // proche en proche, et plus rien ne la ramène vers le niveau démontré. En
  // simulation, c'est ainsi qu'on servait du 5 à une compétence de niveau 2.
  //
  // Un cran d'écart au plus, dans les deux sens : la calibration garde tout
  // pouvoir d'ajustement local, elle perd celui de s'éloigner indéfiniment.
  return Math.min(
    Math.max(conseillee, Math.max(1, parNiveau - 1)),
    Math.min(5, parNiveau + 1),
  ) as Difficulte;
}

/**
 * Bonus d'actionnabilité — lot 5, 10/08/2026.
 *
 * Départage à score proche vers ce qui se lance immédiatement, sans attendre
 * une génération. Mesuré le 10/08/2026 : 11 compétences actives sur 77 ont un
 * exercice, et le classement seul poussait systématiquement vers le
 * non-couvert (« Jamais évaluée » vaut jusqu'à +70), qui n'a pourtant rien à
 * servir — la carte « Prochaine action » retombait alors sur « Générer un
 * exercice » plutôt que « Commencer ».
 *
 * ⚠️ **Ce n'est PAS une pénalité sur le non-couvert.** L'absence d'exercice ne
 * retire rien nulle part ailleurs dans ce calcul — une pénalité serait
 * l'inverse du besoin (le plan de refonte l'exclut explicitement). C'est un
 * bonus modeste sur ce qui EST actionnable, du même ordre que « Confiance
 * faible » (12) ou « Robustesse insuffisante » (14) : assez pour départager un
 * quasi-ex-aequo, largement insuffisant pour renverser un écart réel comme
 * « Jamais évaluée » (30 à 70) ou « Due pour révision » (40).
 */
export const BONUS_ACTIONNABLE = 10;

/**
 * Bornes du facteur de révision — voir le commentaire à son point d'usage.
 *
 * Le minimum vaut « due depuis l'instant » ; le maximum, « due depuis au moins
 * un intervalle complet de retard ». Les deux restent sous « Jamais évaluée »,
 * qui vaut 60 à 70 sur un palier de fondamentaux.
 */
export const REVISION_MINIMUM = 12;
export const REVISION_MAXIMUM = 32;

/**
 * Bonus de proximité d'échéance — chantier « fait daté / engagements »
 * (22/08/2026).
 *
 * Une échéance déclarée par la personne (table `engagements`) est le seul fait
 * du système qui dise QUAND la compétence servira : un examen dans dix jours
 * donne à ses compétences une urgence qu'aucun niveau dérivé ne connaît. Le
 * bonus croît linéairement de ~1 (J-21) au maximum (veille), et vaut ZÉRO hors
 * fenêtre — jamais une pénalité, une échéance lointaine ou dépassée ne dit
 * rien du travail utile aujourd'hui.
 *
 * Calibrage : 25 place ce facteur dans la bande « Due pour révision » (12–32),
 * sous « Jamais évaluée » (60–70). Il peut départager un quasi-ex-aequo et
 * faire monter une compétence ciblée, sans pouvoir renverser l'ordre des
 * fondamentaux jamais évalués. Aucune autre constante n'a bougé.
 *
 * ⚠️ Test de réfutation à mener sur données réelles : le taux d'acceptation
 * des recommandations doit être plus élevé PENDANT la fenêtre que HORS
 * fenêtre pour les mêmes compétences. Un taux identique signifierait que le
 * facteur ne décide rien — il serait alors à retirer plutôt qu'à gonfler.
 */
export const BONUS_ECHEANCE_MAX = 25;

/**
 * Pondération provisoire de l'hypothèse documentaire (ADR-064).
 *
 * Elle ne s'active que si la dernière observation est elle-même documentaire,
 * récente selon le modèle de répétition espacée, et déjà contextualisée. Elle
 * ne peut donc pas masquer une révision due ni une compétence sans observation.
 */
export const PENALITE_OBSERVATION_DOCUMENTAIRE_SOLIDE = -10;

/**
 * Ce que `reglagesEffectifs()` peut superposer aux valeurs livrées — ADR-085.
 *
 * Un objet et non deux paramètres positionnels : `recommander` en porte déjà
 * huit, et un neuvième booléen anonyme aurait été illisible au point d'appel.
 */
export interface ReglagesRecommandation {
  bonusActionnable?: number;
  /** Modèle de révision réglé — `creerModeleHeuristique(amplitude)`. */
  modeleRevision?: ModeleRevision;
}

function evaluer(
  etat: SkillState,
  etatsParCode: Map<string, SkillState>,
  now: Date,
  actionnable: boolean,
  documentaire?: ResumeObservationsDocumentaires,
  reglages: ReglagesRecommandation = {},
  /** Engagements du compte ciblant cette compétence (pré-filtrés par l'appelant). */
  engagements?: Engagement[],
): { valeur: number; facteurs: Facteur[] } {
  const bonusActionnable = reglages.bonusActionnable ?? BONUS_ACTIONNABLE;
  const modeleRevision = reglages.modeleRevision ?? MODELE_ACTIF;
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

  // 2. Absence totale d'observation — le cas dominant au démarrage.
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
  if (etat.observations.length === 0) {
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

    // 4. Répétition espacée — « est-elle due pour révision ? » (spaced.ts).
    //
    // Remplace l'ancien facteur « Ancienneté » (j × 0,35, plafonné à 30), qui
    // montait linéairement avec le temps sans tenir compte de la maîtrise. La
    // répétition espacée dérive un intervalle de révision de l'état (niveau,
    // robustesse, confiance, dernier résultat) : une compétence robuste peut
    // attendre, une fragile se révise vite. Le signal devient binaire et fort :
    // « due » pousse fortement, « pas due » laisse respirer.
    const j = etat.joursDepuisDerniereObservation ?? 0;
    const due = estDue(etat, now, modeleRevision);
    if (due) {
      // Contribution proportionnelle au RETARD, plafonnée — corrigé le 21/08/2026.
      //
      // Le plateau à 40 faisait de la révision le facteur dominant dès qu'une
      // poignée de compétences avaient été observées : 88 % des actions servies
      // sur dix-huit mois portaient ce facteur, et les chapitres ouverts en
      // cours de route n'obtenaient plus leur tour. Une compétence due l'est
      // d'autant plus qu'elle l'est depuis longtemps ; l'être depuis une heure
      // ne vaut pas l'être depuis un mois.
      //
      // Rejoué le 21/08/2026 sur 45 parcours, après correction du modèle
      // d'apprenant — plateau à 40 contre plafond 12–32 :
      //   couverture du référentiel .......... 82 % → 96 %
      //   écart au réel ...................... 1,05 → 0,79
      //   corrélation de rangs estimé / réel . −0,21 → −0,02
      //   ablation « sans révision fait mieux » : présente → disparue
      // Le facteur garde donc sa raison d'être ; il perd sa domination. Le
      // plafond passe sous « Jamais évaluée » (60 à 70) : découvrir passe avant
      // réviser.
      const revision = prochaineRevision(etat, now, modeleRevision);
      const retard =
        revision.intervalleJours > 0
          ? Math.min(1, Math.max(0, j - revision.intervalleJours) / revision.intervalleJours)
          : 1;
      facteurs.push({
        libelle: "Due pour révision",
        contribution: Math.round(REVISION_MINIMUM + retard * (REVISION_MAXIMUM - REVISION_MINIMUM)),
        phrase: `elle est due pour révision (${j} jours écoulés, intervalle ${revision.intervalleJours} j)`,
      });
    } else {
      // Pénalité : travaillée récemment, laisser respirer.
      facteurs.push({
        libelle: "Pratiquée récemment",
        contribution: -15,
        phrase: `elle a été travaillée il y a ${j} jour(s)`,
      });
    }

    const derniereObservationEstDocumentaire =
      documentaire?.derniereDate && etat.derniereObservation
        ? new Date(documentaire.derniereDate).getTime() ===
          new Date(etat.derniereObservation).getTime()
        : false;
    if (
      !due &&
      derniereObservationEstDocumentaire &&
      documentaire !== undefined &&
      documentaire.nombre >= 2 &&
      documentaire.reussites >= 2 &&
      documentaire.dernierResultat === "reussi" &&
      documentaire.contextes.length >= 2
    ) {
      facteurs.push({
        libelle: "Observation documentaire contextualisée",
        contribution: PENALITE_OBSERVATION_DOCUMENTAIRE_SOLIDE,
        phrase:
          "elle dispose d'une production récente, conservée et déjà démontrée dans plusieurs contextes",
      });
    }

    // 5. Confiance faible malgré des observations : évaluation à consolider.
    if (etat.confiance === "faible") {
      facteurs.push({
        libelle: "Confiance faible",
        contribution: 12,
        phrase: "l'évaluation actuelle repose sur trop peu d'observations pour être fiable",
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

  /*
   * 9. Proximité d'échéance — voir `BONUS_ECHEANCE_MAX`.
   *
   * Le facteur s'applique AUSSI aux compétences jamais évaluées : un examen
   * dans dix jours sur une compétence sans observation est précisément le cas
   * où la découverte presse. Plusieurs engagements peuvent cibler la même
   * compétence — seul le plus proche compte, empiler les bonus reviendrait à
   * compter plusieurs fois le même fait.
   *
   * La phrase porte SA SOURCE : quel engagement, quelle échéance, à quelle
   * distance. Elle s'affiche telle quelle dans le dépliant « Pourquoi cette
   * action plutôt qu'une autre ? » — jamais un score muet (P3).
   */
  if (engagements && engagements.length > 0) {
    let meilleure: { libelle: string; echeanceLe: string; jours: number } | null = null;
    for (const engagement of engagements) {
      if (!estOuvert(engagement)) continue;
      if (!engagement.codes.includes(etat.skill.code)) continue;
      if (!fenetreEcheance(now, engagement.echeanceLe)) continue;
      const jours = joursRestants(engagement.echeanceLe, now);
      if (!Number.isFinite(jours) || jours < 0) continue;
      if (!meilleure || jours < meilleure.jours) {
        meilleure = { libelle: engagement.libelle, echeanceLe: engagement.echeanceLe, jours };
      }
    }
    if (meilleure) {
      facteurs.push({
        libelle: "Proximité d'échéance",
        contribution: Math.max(
          1,
          Math.round(
            BONUS_ECHEANCE_MAX * (1 - (meilleure.jours - 1) / FENETRE_ECHEANCE_JOURS),
          ),
        ),
        phrase: `engagement déclaré : « ${meilleure.libelle} » — ${libelleCompte(meilleure.jours)} (${meilleure.echeanceLe})`,
      });
    }
  }

  // 10. Actionnable — voir `BONUS_ACTIONNABLE`. Calculé par l'appelant (il faut
  // avoir choisi l'exercice pour le savoir) et simplement injecté ici : cette
  // fonction reste celle qui écrit tous les facteurs, `raison` incluse.
  if (actionnable) {
    facteurs.push({
      libelle: "Exercice disponible",
      contribution: bonusActionnable,
      phrase: "un exercice existe déjà pour la lancer tout de suite",
    });
  }

  const valeur = facteurs.reduce((s, f) => s + f.contribution, 0);
  return { valeur, facteurs: facteurs.sort((a, b) => b.contribution - a.contribution) };
}

/** Date d'une tentative : sa fin si elle en a une, son début sinon. */
const dateTentative = (t: ExerciseAttempt): string => t.fin ?? t.debut;

/**
 * Tentatives TERMINÉES par exercice, chacune de la plus récente à la plus
 * ancienne.
 *
 * Les abandons sont écartés ici comme ils le sont dans `calibration.ts` : une
 * tentative interrompue sous le quart de la durée estimée ne dit rien, ni sur
 * l'exercice ni sur la personne. Une tentative en cours n'a pas de résultat.
 *
 * L'index est construit UNE fois par appel de `recommander` : le filtrage et le
 * tri de toutes les tentatives par exercice consulté, refaits à chaque
 * compétence puis à chaque comparaison du tri, faisaient du classement un
 * O(compétences × exercices × tentatives).
 */
function indexerTerminees(
  tentatives: ExerciseAttempt[],
): Map<string, ExerciseAttempt[]> {
  const parExercice = new Map<string, ExerciseAttempt[]>();
  for (const t of tentatives) {
    if (t.statut !== "terminee") continue;
    const liste = parExercice.get(t.exerciseId);
    if (liste) liste.push(t);
    else parExercice.set(t.exerciseId, [t]);
  }
  for (const liste of parExercice.values()) {
    liste.sort((a, b) => dateTentative(b).localeCompare(dateTentative(a)));
  }
  return parExercice;
}

/**
 * Cet exercice peut-il être recommandé ?
 *
 * Trois cas, du plus fort au plus faible :
 *
 *  1. DÉJÀ RÉUSSI — il sort de la file, définitivement. Le refaire reste
 *     possible depuis sa fiche, et fait monter la robustesse ; ce n'est
 *     simplement plus une recommandation.
 *
 *  2. DERNIÈRE TENTATIVE ÉCHOUÉE OU PARTIELLE — il ne revient qu'après un
 *     **progrès démontré** sur la compétence visée : une observation en réussite
 *     postérieure. C'est P4 lu dans l'autre sens — une faiblesse ne disparaît
 *     pas sans démonstration, et elle ne se remesure pas non plus sans qu'il y
 *     ait quelque chose de nouveau à mesurer. Reproposer le même exercice qui
 *     produit le même résultat n'apprend rien de neuf, ni au moteur ni à la
 *     personne.
 *
 *     Le déclencheur est une CONDITION, pas un délai. Un minuteur reproposerait
 *     au bout de trois jours un exercice hors de portée, sans que rien n'ait
 *     changé entre-temps : c'est précisément ce que le produit faisait, et ce
 *     qui donnait le sentiment de tourner en rond. Trois jours ne rendent pas
 *     soluble ce qui ne l'était pas.
 *
 *     ⚠️ Jusqu'au 10/08/2026 (lot 5), seul l'échec était gouverné par cette
 *     règle — un partiel restait candidat indéfiniment, « parce que c'est un
 *     progrès, pas un mur ». Observé en production le même jour : deux
 *     exercices diagnostics (`diag-dev-02`, `diag-tech-01`) ont chacun produit
 *     deux « partiel » à plusieurs JOURS d'écart, sans qu'aucune condition ne
 *     les ait fait sortir de la file entre les deux — le même exercice
 *     reproposé, le même résultat obtenu. C'est la définition même de
 *     « tourner en rond », et P4 ne distingue pas l'échec du partiel : les
 *     deux sont un résultat non abouti, et les deux exigent la même
 *     démonstration avant de revenir. Une compétence qui n'a QUE cet exercice
 *     se retrouve alors sans candidat — et retombe sur le repli « Générer un
 *     exercice », qui est exactement la sortie voulue : proposer autre chose
 *     plutôt que la même impasse.
 *
 *  3. JAMAIS TENTÉ — candidat sans condition.
 *
 * Rien n'est stocké : tout se dérive des tentatives et des observations (P1).
 */
function recommandable(
  exercice: Exercise,
  etat: SkillState,
  termineesParExercice: Map<string, ExerciseAttempt[]>,
): boolean {
  const passees = termineesParExercice.get(exercice.id) ?? [];
  if (passees.length === 0) return true;
  if (passees.some((t) => t.resultat === "reussi")) return false;

  const depuis = dateTentative(passees[0]);
  return etat.observations.some((p) => p.resultat === "reussi" && p.date > depuis);
}

/**
 * Choisit l'exercice le mieux adapté au niveau visé, parmi les recommandables.
 *
 * `null` a deux sens que l'appelant doit distinguer, d'où le second membre du
 * couple renvoyé : « cette compétence n'avait rien à proposer » (repli
 * « Générer un exercice ») et « elle avait de quoi, mais tout a été refusé »
 * (la compétence sort de la file).
 */
function choisirExercice(
  etat: SkillState,
  exercices: Exercise[],
  termineesParExercice: Map<string, ExerciseAttempt[]>,
  cible: Difficulte,
  exercicesRefuses: Set<string>,
): { exercice: Exercise | null; toutRefuse: boolean } {
  const recommandables = exercices.filter(
    (ex) =>
      ex.competences.includes(etat.skill.code) &&
      recommandable(ex, etat, termineesParExercice),
  );
  const candidats = recommandables.filter((ex) => !exercicesRefuses.has(ex.id));
  if (candidats.length === 0) {
    return { exercice: null, toutRefuse: recommandables.length > 0 };
  }

  // Priorité aux diagnostics tant que la compétence n'a aucune observation.
  if (etat.observations.length === 0) {
    const diag = candidats.find((ex) => ex.diagnostic);
    if (diag) return { exercice: diag, toutRefuse: false };
  }

  // À difficulté également adaptée, ce qui n'a jamais été tenté passe devant.
  // Sans cette clé, la file reservait indéfiniment le même exercice partiel
  // alors qu'un exercice neuf attendait au même écart de la cible.
  //
  // Le drapeau est lu AVANT le tri : le recalculer dans le comparateur
  // refiltrait toutes les tentatives à chaque comparaison.
  const classe = candidats
    .map((ex) => ({
      ex,
      jamaisTente: (termineesParExercice.get(ex.id)?.length ?? 0) === 0 ? 0 : 1,
    }))
    .sort(
      (a, b) =>
        a.jamaisTente - b.jamaisTente ||
        Math.abs(a.ex.difficulte - cible) - Math.abs(b.ex.difficulte - cible) ||
        a.ex.dureeEstimeeMin - b.ex.dureeEstimeeMin,
    );
  return { exercice: classe[0].ex, toutRefuse: false };
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
  now: Date = new Date(),
  /**
   * Ce que l'utilisateur a écarté (R1). Un refus est un fait observé.
   *
   * - `exercices` : les exercices passés. C'est la portée normale — la
   *   compétence reste recommandable avec un autre exercice.
   * - `codes` : les compétences passées entières. Portée des refus antérieurs
   *   au 07/08/2026 et de ceux posés quand aucun exercice n'était proposé.
   *
   * L'expiration (7 jours) est gérée à la lecture, en amont. Le moteur reste
   * pur : il reçoit deux ensembles, il ne lit ni la base ni l'horloge pour ça.
   */
  refus: { codes: Set<string>; exercices: Set<string> } = {
    codes: new Set(),
    exercices: new Set(),
  },
  contexteDocumentaire?: ContexteDocumentaire,
  /** Réglages effectifs — ADR-085. Omis : les valeurs livrées. */
  reglages: ReglagesRecommandation = {},
  /**
   * Engagements déclarés du compte — chantier « fait daté » (22/08/2026).
   *
   * Le moteur ne les lit jamais lui-même (P1) : il reçoit les faits en
   * paramètre, comme les compétences et les tentatives. Les clôturés sont
   * ignorés ici même (`estOuvert`) ; hors fenêtre, ils ne pèsent rien.
   */
  engagements?: Engagement[],
): Recommandation[] {
  const parCode = new Map(etats.map((e) => [e.skill.code, e]));
  const termineesParExercice = indexerTerminees(tentatives);
  /*
   * Index des engagements par compétence ciblée, construit une fois par appel :
   * filtrer les ouverts par code à l'intérieur d'`evaluer` referait le travail
   * pour chaque compétence. Une compétence non ciblée reçoit une liste vide —
   * et le facteur ne pèse rien, exactement comme avant ce paramètre.
   */
  const engagementsParCode = new Map<string, Engagement[]>();
  for (const engagement of engagements ?? []) {
    if (!estOuvert(engagement)) continue;
    for (const code of engagement.codes) {
      if (!parCode.has(code)) continue;
      const liste = engagementsParCode.get(code);
      if (liste) liste.push(engagement);
      else engagementsParCode.set(code, [engagement]);
    }
  }

  return etats
    .filter((e) => !refus.codes.has(e.skill.code))
    .map((etat) => {
      // L'exercice se choisit AVANT le score : depuis le lot 5, le score lit
      // s'il y en a un (`BONUS_ACTIONNABLE`). L'inverser referait de
      // `difficulteVisee`/`choisirExercice` un calcul à part, potentiellement
      // désynchronisé du score qu'il vient de nourrir.
      const calibration = calibrations?.get(etat.skill.code) ?? null;
      const cible = difficulteVisee(etat, calibration ?? undefined);

      const { exercice, toutRefuse } = choisirExercice(
        etat,
        exercices,
        termineesParExercice,
        cible,
        refus.exercices,
      );

      // La calibration règle la DIFFICULTÉ ; elle ne re-classe pas les
      // compétences au-delà du bonus d'actionnabilité ci-dessus. `facteurs`
      // reste une liste de contributions chiffrées au score de priorité — y
      // glisser une entrée à 0 la rendrait illisible. Le « Pourquoi ? » de
      // l'interface lit `calibration` séparément.
      const { valeur, facteurs } = evaluer(
        etat,
        parCode,
        now,
        exercice !== null,
        contexteDocumentaire?.get(etat.skill.code),
        reglages,
        engagementsParCode.get(etat.skill.code),
      );

      const recommandation: Recommandation = {
        etat,
        valeur,
        facteurs,
        raison: construireRaison(facteurs),
        exercice,
        difficulteCible: cible,
        dureeEstimeeMin: exercice?.dureeEstimeeMin ?? 30,
        calibration,
      };
      return { recommandation, toutRefuse };
    })
    // Une compétence dont *tous* les exercices ont été passés sort de la file.
    // `toutRefuse` reste interne au moteur : il répond à « pourquoi ce null ? »,
    // pas à une question que l'interface se pose.
    //
    // Sans ce filtre, passer le dernier exercice d'une compétence la laisse en
    // tête avec le repli « Générer un exercice » : le clic paraîtrait sans
    // effet, ce qui est exactement le défaut que ce mécanisme répare.
    .filter((r) => !r.toutRefuse)
    .map((r) => r.recommandation)
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
