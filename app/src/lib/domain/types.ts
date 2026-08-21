/**
 * Modèle de domaine du système pédagogique.
 *
 * Ces types transcrivent les fichiers `data/00_instructions/` :
 * - échelle de niveau 0-5 ....... protocole d'évaluation §4
 * - autonomie A0-A4 ............. protocole d'évaluation §5
 * - qualité d'observation ............ protocole d'évaluation §6
 * - confiance ................... protocole anti-hallucination §10
 * - hiérarchie des observations A-D .. protocole anti-hallucination §2
 *
 * Règle structurante : rien de ce qui est *dérivable* n'est stocké.
 * Le disque ne contient que des faits observés (observations, tentatives,
 * sessions). Niveaux et scores sont recalculés à la lecture
 * par `lib/engine/`.
 */

/* ------------------------------------------------------------------ */
/* Échelles et vocabulaire                                             */
/* ------------------------------------------------------------------ */

/** Protocole d'évaluation §4 — échelle de niveau de compétence. */
export type NiveauCompetence = 0 | 1 | 2 | 3 | 4 | 5;

export const NIVEAUX: Record<NiveauCompetence, { nom: string; description: string }> = {
  0: { nom: "Exposition", description: "La notion a été rencontrée. Observation insuffisante pour conclure à une compréhension." },
  1: { nom: "Compréhension", description: "Peut expliquer, reconnaître ou distinguer le concept." },
  2: { nom: "Application guidée", description: "Peut appliquer la méthode avec aide, cadre connu ou exemple." },
  3: { nom: "Application autonome", description: "Résout un problème standard sans aide significative." },
  4: { nom: "Transfert", description: "Résout un problème nouveau ou modifié, dans un contexte différent." },
  5: { nom: "Intégration", description: "Combine plusieurs compétences, compare des approches et analyse les limites." },
};

/** Protocole d'évaluation §5 — niveau d'autonomie observé sur une observation. */
export type Autonomie = "A0" | "A1" | "A2" | "A3" | "A4";

export const AUTONOMIE: Record<Autonomie, { libelle: string; poids: number }> = {
  A0: { libelle: "Solution fournie", poids: 0 },
  A1: { libelle: "Fortement guidé", poids: 0.25 },
  A2: { libelle: "Quelques indices nécessaires", poids: 0.55 },
  A3: { libelle: "Résolution autonome", poids: 0.85 },
  A4: { libelle: "Autonome avec initiative méthodologique", poids: 1 },
};

/** Protocole d'évaluation §6 — qualité intrinsèque de l'observation. */
export type QualiteObservation = "faible" | "moyenne" | "forte";

export const QUALITE_OBSERVATION: Record<QualiteObservation, { libelle: string; poids: number }> = {
  faible: { libelle: "Réponse isolée, exercice très guidé ou question de mémoire", poids: 0.35 },
  moyenne: { libelle: "Exercice autonome, problème standard ou explication correcte", poids: 0.7 },
  forte: { libelle: "Problème nouveau, transfert, projet ou intégration interdisciplinaire", poids: 1 },
};

/** Protocole anti-hallucination §10 — confiance dans une évaluation. */
export type Confiance = "nulle" | "faible" | "moyenne" | "forte";

/**
 * Protocole anti-hallucination §2 — hiérarchie des observations.
 * A — observation directe · B — observation indirecte · C — déduction · D — hypothèse.
 * C et D ne doivent jamais être présentés comme des faits certains.
 */
export type NiveauObservation = "A" | "B" | "C" | "D";

/** Dimensions d'évaluation — protocole d'évaluation §3 et §12. */
export type Dimension =
  | "comprehension"
  | "application"
  | "transfert"
  | "integration"
  | "justification";

/** Pondérations du score macro — protocole d'évaluation §12, à la lettre. */
export const POIDS_DIMENSIONS: Record<Dimension, number> = {
  comprehension: 0.3,
  application: 0.25,
  transfert: 0.2,
  integration: 0.15,
  justification: 0.1,
};

export const LIBELLES_DIMENSIONS: Record<Dimension, string> = {
  comprehension: "Compréhension",
  application: "Application",
  transfert: "Transfert",
  integration: "Intégration",
  justification: "Justification",
};

/* ------------------------------------------------------------------ */
/* Domaines                                                            */
/* ------------------------------------------------------------------ */

/**
 * Identifiant de domaine — un slug propre au compte, ex. « philosophie-morale ».
 *
 * C'était une union de huit littéraux jusqu'au 31/07/2026, quand le référentiel
 * était un fichier TypeScript compilé. Depuis ADR-026 il est construit par
 * l'utilisateur à l'exécution : aucune union ne peut le vérifier à la
 * compilation. Le garde-fou n'est pas retiré, il est **déplacé** vers la clé
 * étrangère `competences.domaine_id → domaines.id` (`supabase/schema.sql` § 2),
 * seul endroit capable de l'appliquer à des données produites par un compte.
 */
export type DomaineId = string;

/** D'où vient une entrée du référentiel. Fait observé, jamais dérivé. */
export type OrigineReferentiel = "utilisateur" | "tuteur" | "migration" | "manuel";

export interface Domaine {
  id: DomaineId;
  nom: string;
  /** Préfixe des codes compétence, ex. « LOG » pour LOG-01. Unique par compte. */
  prefixe: string;
  description: string;
  /** Rang d'affichage déclaré, à défaut d'ordre naturel. */
  ordre: number;
  /** Version optimiste de l'agrégat, incrémentée à chaque commande validée. */
  version: number;
  archive: boolean;
  origine: OrigineReferentiel;
}

/* ------------------------------------------------------------------ */
/* Entités                                                             */
/* ------------------------------------------------------------------ */

export interface User {
  id: string;
  prenom: string;
  avatarUrl?: string;
  formation: string;
  /** Objectif textuel déclaré à moyen terme lors de l'amorçage. */
  objectifMoyenTerme: string;
  /** Objectif textuel déclaré à long terme lors de l'amorçage. */
  objectifLongTerme: string;
  /** Date d'initialisation du système (ISO). */
  debutSuivi: string;
  /**
   * Préférences pédagogiques déclarées par l'utilisateur (fait observé, pas
   * dérivé). Transmises au tuteur pour qu'il adapte sa manière de travailler —
   * il ne les infère jamais lui-même.
   */
  preferencesPedagogiques?: string[];
}

/** Position dans l'arbre de progression du domaine. */
export type Palier = "fondamentaux" | "intermediaire" | "avance";

/** Ordre de progression des paliers — sert à ordonner les diagnostics. */
export const ORDRE_PALIERS: Palier[] = ["fondamentaux", "intermediaire", "avance"];

/**
 * Une compétence du référentiel du compte (tables `domaines` / `competences`).
 * Ne porte AUCUN état de progression : celui-ci est dérivé des observations.
 */
export interface Skill {
  /**
   * Code du référentiel, ex. « LOG-02 ». **Immuable** : c'est la clé étrangère
   * des observations. Attribué par l'application à partir du préfixe du domaine,
   * jamais proposé par le tuteur.
   */
  code: string;
  /**
   * Le domaine **porteur** : il donne le code et porte la gouvernance
   * (retrait, archivage, succession). Une compétence n'en a jamais qu'un.
   */
  domaine: DomaineId;
  /**
   * Domaines supplémentaires que cette compétence sert (ADR-081).
   *
   * Un savoir-faire partagé — « Lire un tableau de données » en Statistiques
   * comme en Logistique — s'y rattache **sans être dupliqué** : un second code
   * dédoublerait ses observations. Les rattachements comptent dans la couverture
   * des domaines concernés, jamais dans le score global, qui somme sur les
   * compétences et non sur les domaines.
   */
  domainesSecondaires?: DomaineId[];
  intitule: string;
  palier: Palier;
  /** Codes des compétences prérequises (indicatif, jamais bloquant). */
  prerequis: string[];
  /**
   * Importance déclarée dans le référentiel du compte, de 0 à 1. Utilisée par
   * le moteur de recommandation (§16).
   */
  importance: number;
  /** Rang déclaré dans le domaine — départage les compétences d'un même palier. */
  ordre: number;
  /**
   * Périmètre de travail du compte (ADR-026, remplace le `DOMAINE_PILOTE`
   * global d'ADR-020). Hors périmètre : ni calculée, ni affichée, ni transmise
   * au tuteur. Ses observations restent intactes.
   */
  active: boolean;
  /**
   * Retirée du référentiel de travail **sans perdre ses observations** (ADR-027).
   * C'est le seul retrait possible dès qu'une observation existe : une compétence
   * sans observation se supprime franchement.
   */
  archive: boolean;
  /** Successeur explicite lorsque le savoir-faire change de sens. */
  remplacePar?: string;
  origine: OrigineReferentiel;
  /**
   * Hypothèse de départ issue de la formation déclarée — observation de niveau D.
   * N'autorise aucun niveau affiché : sert uniquement à ordonner les diagnostics.
   */
  hypotheseInitiale?: {
    niveauSuppose: string;
    justification: string;
  };
}

/**
 * Le référentiel d'un compte, tel que lu par `lib/store/referentiel.ts`.
 *
 * Les quatre dernières entrées sont **dérivées** de `domaines` et `skills` à
 * chaque lecture, jamais stockées (P1).
 */
export interface Referentiel {
  domaines: Domaine[];
  skills: Skill[];
  /** Le périmètre de travail : `active && !archive`. */
  actifs: Skill[];
  /** Toutes les compétences, archivées comprises — résout les observations anciennes. */
  parCode: Map<string, Skill>;
  codesActifs: Set<string>;
  domainesParId: Map<DomaineId, Domaine>;
}

/**
 * Famille de situation d'une observation — ADR-083.
 *
 * Ce que le moteur compte quand il compte des « contextes distincts ». Deux
 * observations de familles différentes attestent d'un transfert (§11) ; deux observations
 * de la même famille, non.
 *
 * Le type vit dans le domaine et non dans `lib/engine/contexte-situation.ts`
 * qui le produit : `SkillObservation` le porte, et le domaine n'importe jamais le
 * moteur.
 */
export interface FamilleSituation {
  /** Clé de comparaison. C'est elle, et elle seule, qui départage. */
  cle: string;
  /** Libellé lisible — affichage et explications, jamais une comparaison. */
  libelle: string;
  /**
   * `false` quand la famille est un repli sur `SkillObservation.contexte`, faute
   * d'exercice source résoluble. Le moteur le porte en réserve : une famille
   * repliée vaut ce que vaut un libellé libre, c'est-à-dire presque un
   * identifiant.
   */
  derivee: boolean;
}

/**
 * Le résultat d'une tentative — la seule échelle du système.
 *
 * Une seule autorité : le type et son énumération vivent ici, et tout le
 * dépôt (observations, tentatives, bilans, explications, simulations,
 * validation Supabase, outils tuteur) les relit. Une union réécrite à la
 * main ailleurs est une copie qui peut diverger en silence — précisément ce
 * que ce fichier existe pour empêcher.
 */
export const RESULTATS_TENTATIVE = ["reussi", "partiel", "echec"] as const;

export type ResultatTentative = (typeof RESULTATS_TENTATIVE)[number];

/**
 * Observation structurée pour une compétence — l'unité de base du système.
 * C'est la SEULE façon dont un niveau peut évoluer.
 */
export interface SkillObservation {
  id: string;
  skillCode: string;
  /** Date d'observation (ISO). */
  date: string;
  type:
    | "exercice"
    | "explication"
    | "code"
    | "calcul"
    | "projet"
    | "correction-erreur"
    | "transfert"
    | "etude-de-cas";
  /** Protocole anti-hallucination §2. Le moteur n'accepte que A et B. */
  niveauObservation: NiveauObservation;
  autonomie: Autonomie;
  qualite: QualiteObservation;
  resultat: ResultatTentative;
  /**
   * Étiquette de contexte, écrite au moment de l'observation — le titre de
   * l'exercice pour une observation d'exercice.
   *
   * ⚠️ Ce n'est PAS le discriminant du transfert depuis ADR-083. Mesuré le
   * 18/08/2026 : 42 valeurs distinctes pour 52 observations. Un titre est presque
   * unique, si bien que « deux contextes distincts » — la porte du niveau 4 et
   * de la confiance moyenne — était franchi dès la deuxième observation. Le
   * discriminant est `familleSituation` ; ce champ reste le libellé lisible.
   */
  contexte: string;
  /**
   * Famille de situation — le discriminant réel du transfert (ADR-083).
   *
   * **Dérivée, jamais persistée** (P1) : `lib/engine/contexte-situation.ts` la
   * calcule à la lecture depuis l'exercice source. Elle est attachée en un
   * seul point, `chargerContexte`, pour la même raison que `tableDureesEstimees`
   * lit les exercices bruts : une observation peut venir d'un exercice archivé,
   * sorti du périmètre, ou livré avec le logiciel (`lib/seed/exercises.ts`).
   *
   * Absente = non résolue en amont. Le moteur retombe alors sur `contexte` et
   * l'inscrit en réserve — il ne fabrique pas une famille qu'aucune donnée ne
   * dit (précédent ADR-033).
   */
  familleSituation?: FamilleSituation;
  /** Dimensions effectivement démontrées, chacune dans [0,1]. */
  dimensions: Partial<Record<Dimension, number>>;
  /** Compétences mobilisées conjointement — condition du niveau 5. */
  competencesCombinees?: string[];
  /**
   * Origine vérifiable.
   *
   * `ref` garde l'id de l'exercice pour les observations d'exercice :
   * ADR-083 en dérive la famille de situation et les observations historiques
   * ont été conservées sans provenance supposée au cutover du lot 1.
   *
   * Toute nouvelle observation d'exercice porte en plus `trace`, qui désigne
   * exactement la tentative réellement à son origine. Le champ reste
   * optionnel dans le type pour rendre les lignes historiques lisibles — son
   * absence n'est jamais comblée à la lecture.
   *
   * `document` est lui aussi optionnel pour préserver les observations créées
   * avant le corpus documentaire. Quand il existe, le snapshot identifie
   * exactement le contenu produit au moment de la mesure.
   */
  source: {
    kind: "exercice" | "projet" | "session" | "tuteur" | "manuel";
    ref: string;
    trace?: { kind: "tentative"; ref: string };
    document?: { documentId: string; snapshotId: string };
  };
  commentaire?: string;
}

export type TypeExercice =
  | "rappel"
  | "application"
  | "calcul"
  | "probleme"
  | "etude-de-cas"
  | "programmation"
  | "simulation"
  | "projet";

/**
 * Pourquoi cet exercice a été écrit, pas pourquoi il est servi aujourd'hui.
 *
 * C'est un fait sur la rédaction — au même titre que `origine` — pas une
 * mesure ni un signal exploité par le moteur : `recommend.ts` et
 * `calibration.ts` continuent d'ignorer ce champ. Il existe pour que, le jour
 * où on voudra comparer l'effet de différentes interventions pédagogiques, la
 * donnée ait déjà été enregistrée — la reconstituer après coup serait
 * impossible (les 23 exercices actuels n'en portent aucune, et resteront
 * `undefined`).
 *
 * Optionnel côté schéma du tuteur : une valeur illisible fait échouer la
 * conversion (`versIntention`), une valeur absente n'en fabrique aucune.
 */
export type IntentionExercice = "decouverte" | "consolidation" | "transfert" | "revision";

export type Difficulte = 1 | 2 | 3 | 4 | 5;

export const DIFFICULTES: Record<Difficulte, string> = {
  1: "Découverte",
  2: "Standard",
  3: "Consolidation",
  4: "Difficile",
  5: "Ouvert",
};

export interface Exercise {
  id: string;
  titre: string;
  domaine: DomaineId;
  type: TypeExercice;
  difficulte: Difficulte;
  /** Compétences visées, la première étant la cible principale. */
  competences: string[];
  dureeEstimeeMin: number;
  /** Énoncé en markdown léger. */
  enonce: string;
  /** Données du problème, présentées séparément de l'énoncé. */
  donnees?: { libelle: string; valeur: string }[];
  /** Indices débloqués un par un, du plus léger au plus explicite. */
  indices: string[];
  /** Correction de référence, réservée au tuteur côté serveur. */
  correction: string;
  /** Points de contrôle que l'utilisateur coche à l'évaluation. */
  criteres: { dimension: Dimension; libelle: string }[];
  /** Vrai pour les exercices du plan d'évaluation initiale. */
  diagnostic?: boolean;
  origine: "seed" | "tuteur" | "manuel";
  /**
   * Retiré du flux sans perte d'observations (calque ADR-027).
   *
   * Un exercice archivé sort de la recommandation et de la calibration, mais
   * les observations qu'il a produites restent au journal — sinon le retrait
   * réécrirait le passé. Absent sur les exercices de diagnostic, qui sont
   * livrés avec le logiciel et ne se retirent pas un par un.
   */
  archive?: boolean;
  /**
   * Date de la dernière correction du contenu (ADR-047).
   *
   * Absente tant que l'exercice n'a pas été retouché — et sur une base dont le
   * schéma de référence n'est pas à jour.
   *
   * Elle existe pour une raison précise : une observation mesure une tentative sur
   * l'énoncé **d'alors**. Corriger le texte ne rend pas cette mesure fausse,
   * mais il rend l'exercice affiché différent de celui qui a été fait. Qui
   * relit une observation ancienne doit pouvoir savoir que le support a changé
   * depuis — sinon le journal paraît cohérent alors qu'il ne l'est plus.
   */
  modifieLe?: string;
  /** Pourquoi il a été écrit — voir `IntentionExercice`. Absent = non renseignée. */
  intention?: IntentionExercice;
}

export interface ExerciseAttempt {
  id: string;
  exerciseId: string;
  debut: string;
  fin?: string;
  dureeMin?: number;
  /** Nombre d'indices consultés — détermine l'autonomie enregistrée. */
  indicesUtilises: number;
  reponse: string;
  /**
   * Évaluation par critère, après lecture de la correction.
   *
   * Nommée `autoEvaluation` jusqu'au 10/08/2026. Le préfixe promettait une
   * chose que le produit ne fait pas : depuis ADR-046 le tuteur propose un
   * verdict critère par critère, et ce que la personne valide est une
   * évaluation assistée, pas une auto-évaluation. Le mot est tombé de
   * l'interface, du champ et de la colonne dans le même geste — un vocabulaire
   * qui ne survit qu'à moitié à un renommage est pire que celui qu'il remplace.
   */
  evaluation: Partial<Record<Dimension, number>>;
  resultat: ResultatTentative;
  statut: "en-cours" | "terminee" | "abandonnee";
  notes?: string;
  /**
   * Ce que le tuteur avait proposé, conservé tel quel (ADR-046).
   *
   * Absent quand la personne a rempli son bilan sans assistance, ou quand la
   * colonne n'existe pas encore en base. Ce n'est **pas** une mesure : la
   * mesure est ce que la personne a validé, et elle vit dans `resultat` et
   * `evaluation`. Ceci est la trace de ce qui lui a été proposé.
   */
  verdictTuteur?: VerdictTuteur;
}

/**
 * Le verdict du tuteur sur une tentative, archivé.
 *
 * Il était **jeté** : le tuteur rendait un jugement critère par critère, le
 * formulaire l'affichait, et le texte mourait avec la page. Le tuteur ne
 * pouvait donc pas relire ce qu'il avait dit la fois d'avant, et « cette erreur
 * revient » n'avait aucune matière — c'était le maillon manquant de la
 * détection de motifs, pas un problème de prompt.
 *
 * On garde aussi ce qu'il **proposait** comme résultat et appréciations, à côté
 * de ce que la personne a finalement validé. L'écart entre les deux est une
 * observation qu'on ne pouvait pas faire : il dit si quelqu'un se surestime ou
 * se sous-estime, et c'est une information sur la personne, pas sur l'exercice.
 */
export interface VerdictTuteur {
  /** Le résultat que le tuteur proposait — comparable à `attempt.resultat`. */
  resultat: string;
  /** Index base 0, comme `exercice.criteres`. */
  appreciations: Record<number, number>;
  justifications: Record<number, string>;
  /**
   * Le retour rédigé.
   *
   * ⚠️ Seul `aRetravailler` a le droit de revenir dans le contexte du chat
   * (`contexte.ts`) : la prose est écrite en ayant la correction sous les yeux,
   * et la faire remonter au chat rouvrirait l'exception d'ADR-036.
   */
  bilan: {
    pointsForts: string;
    pointsBloquants: string;
    aRetravailler: string[];
  };
  /** Date d'émission, pour trier sans dépendre de la tentative. */
  date: string;
}

/**
 * Refus d'une recommandation (R1).
 *
 * Fait observé : l'utilisateur a écarté une suggestion. Stocké en base pour
 * que le moteur de recommandation puisse l'exclure de la file pendant la
 * durée d'expiration (7 jours, gérée à la lecture).
 */
export interface RefusRecommandation {
  id: string;
  /**
   * Code de la compétence sur laquelle portait la recommandation refusée.
   *
   * Absent quand le refus porte sur une activité qui ne mobilise aucune
   * compétence : la note, la ressource ou l'exercice est alors écartée par son
   * propre `exerciceId`, sans toucher à la file de la compétence.
   */
  code?: string;
  /**
   * Activité refusée (exercice, note ou ressource). Absente = c'est la
   * **compétence entière** qui est écartée.
   *
   * Renseignée, le refus ne retire que cette activité : la compétence reste
   * recommandable avec une autre. Écarter la compétence à chaque « Passer »
   * assèchait la file — 40 des 54 compétences actives n'ont aucun exercice.
   * Absente reste le cas légitime des refus antérieurs au 07/08/2026 et de
   * ceux posés quand aucune activité n'était proposée (repli « Générer »).
   */
  exerciceId?: string;
  /** Date du refus (ISO). */
  date: string;
}

/**
 * Où en est une séance. Absent en base = séance historique, donc terminée.
 *
 * `statutSeance` (lib/domain/seance.ts) est le seul endroit qui interprète
 * cette absence : les 45 séances auto-générées avant le 10/08/2026 n'ont pas de
 * statut, et leur en fabriquer un à la lecture serait moins clair que de dire
 * une fois, au bon endroit, ce que l'absence signifie.
 *
 * `abandonnee` (16/08/2026) est le pendant de ce que `ExerciseAttempt.statut`
 * porte depuis l'origine. Une séance en cours n'avait qu'une sortie — la
 * terminer — et une séance qu'on ne veut pas mener serait restée ouverte
 * indéfiniment. Elle n'est PAS un échec : `seanceALieu` refuse de la compter
 * comme de l'activité tant qu'aucune tentative n'y a été menée (P2).
 */
export type StatutSeance = "planifiee" | "en-cours" | "terminee" | "abandonnee";

/**
 * Ce que la personne DÉCLARE vouloir, avant de travailler.
 *
 * C'est un fait observé — « le 10/08 à 9 h, elle a écrit ceci » — au même titre
 * qu'une tentative ou une observation, et c'est la seule raison pour laquelle il a le
 * droit d'être stocké (P1). Ce n'est PAS une mesure sur la personne : rien ici
 * n'est noté, agrégé ou comparé à un barème.
 *
 * Ce qu'on en tire — l'écart entre le déclaré et le réalisé — est **dérivé** à
 * la lecture par `ecartBesoinRealise`, et affiché avec les deux valeurs qui le
 * composent. Il n'existe volontairement aucun « indice de biais » : ce serait un
 * nombre sur quelqu'un, sans observation, exactement ce que P3 interdit.
 */
export interface BesoinDeclare {
  /**
   * Écrit par la personne, mot pour mot. Jamais rédigé ni reformulé par le
   * tuteur.
   *
   * **Facultatif depuis le 10/08/2026.** Choisir un thème et un temps est déjà
   * une déclaration d'intention ; exiger en plus une phrase rédigée faisait de
   * la composition d'une séance un formulaire plus long que la séance
   * elle-même. Son absence ne retire rien à `ecartBesoinRealise`, qui compare
   * `codesVises` et `tempsDisponibleMin` — la phrase n'entre dans aucun calcul,
   * elle est là pour être relue.
   */
  intention?: string;
  /** Les codes qu'elle dit vouloir travailler. Peut diverger du blueprint, et c'est le point. */
  codesVises: string[];
  /** Minutes dont elle dit disposer. Déclaration, pas chronométrage. */
  tempsDisponibleMin: number;
  /** Date de la déclaration (ISO). C'est elle qui en fait un fait daté. */
  declareLe: string;
}

/** Une compétence retenue par l'assemblage, avec la difficulté visée et sa raison. */
export interface CibleSeance {
  code: string;
  difficulte: Difficulte;
  /** Phrase citant ce qui a fait retenir cette compétence — jamais un texte d'avance (P3). */
  raison: string;
}

/**
 * Sur quoi porte la séance.
 */
export type PorteeSeance =
  | { type: "mono"; domaine: DomaineId }
  | { type: "transverse"; domaines: DomaineId[] };

/**
 * Le cahier des charges qui a produit la composition d'une séance.
 *
 * Conservé avec la séance pour une raison de traçabilité, pas de calcul : sans
 * lui, on ne saurait plus, en relisant une séance passée, si elle contenait
 * trois exercices parce que c'était demandé ou parce que le stock s'est arrêté
 * là. Le moteur ne le relit jamais pour en dériver quoi que ce soit.
 */
export interface BlueprintSeance {
  dureeCibleMin: number;
  nombreExercices: number;
  portee: PorteeSeance;
  cibles: CibleSeance[];
}

/**
 * Ce qu'on DEMANDE à l'assemblage — le blueprint avant qu'il soit rempli.
 *
 * Jamais persisté : `composerSeance` (lib/engine/caf.ts) en dérive un
 * `BlueprintSeance` complet, cibles comprises, et c'est celui-là qui est écrit
 * avec la séance. Séparer les deux évite un état intermédiaire ambigu — un
 * blueprint dont les cibles seraient vides parce qu'on ne les a pas encore
 * calculées, ou parce que rien n'a été trouvé.
 */
export interface DemandeSeance {
  dureeCibleMin: number;
  nombreExercices: number;
  portee: PorteeSeance;
  /**
   * Codes que la personne a explicitement visés dans son besoin déclaré.
   *
   * Ils passent devant le classement du moteur : c'est ce qui fait du besoin
   * déclaré autre chose qu'un formulaire décoratif. Un code imposé qui n'a
   * aucun exercice devient un manquant, pas un silence.
   */
  codesImposes?: string[];
}

export interface LearningSession {
  id: string;
  date: string;
  /**
   * Durée en minutes. Optionnel : une séance récapitulative (importée d'une
   * synthèse, sans chronométrage) n'a pas de durée réelle — on ne fabrique pas
   * un 0 trompeur (protocole anti-hallucination §7).
   */
  dureeMin?: number;
  domaines: DomaineId[];
  skillCodes: string[];
  activites: { type: string; ref: string; libelle: string }[];
  resultat?: string;
  difficulte?: string;
  apprentissagePrincipal?: string;
  prochaineAction?: string;
  /** Note libre ajoutée par l'utilisateur. */
  notePersonnelle?: string;
  /** Vrai si l'entrée a été produite par le système à partir d'événements. */
  genereAutomatiquement: boolean;

  /* --- Séance composée (ADR-048, 10/08/2026) ------------------------- */

  /**
   * Absent sur les 45 séances écrites avant cette date : elles sont terminées,
   * et `statutSeance` le dit une fois pour toutes plutôt que chaque appelant.
   */
  statut?: StatutSeance;
  /** Date/heure prévue (ISO). Absente : la séance n'a pas été planifiée à l'avance. */
  planifieePour?: string;
  besoinDeclare?: BesoinDeclare;
  blueprint?: BlueprintSeance;
}

/* Résultats dérivés (jamais persistés)                                */
/* ------------------------------------------------------------------ */

/**
 * Trace de calcul. Protocole anti-hallucination §4 : tout indicateur affiché
 * doit pouvoir répondre à « d'où vient ce nombre ? ».
 */
export interface Explication {
  resume: string;
  facteurs: { libelle: string; valeur: string; poids?: number }[];
  nombreObservations: number;
  /** Réserves à afficher : observations anciennes, contradictions, contexte unique. */
  reserves: string[];
}

export interface SkillState {
  skill: Skill;
  /** `null` tant qu'aucune observation directe n'existe — jamais 0 par défaut. */
  niveau: NiveauCompetence | null;
  score: number | null;
  confiance: Confiance;
  robustesse: number | null;
  dimensions: Record<Dimension, number>;
  observations: SkillObservation[];
  contextesTestes: string[];
  derniereObservation: string | null;
  joursDepuisDerniereObservation: number | null;
  /** Observations qui s'opposent à la tendance dominante (§5 gestion des contradictions). */
  contradictions: SkillObservation[];
  prochaineEtape: string;
  explication: Explication;
  statut: "non-evalue" | "hypothese" | "evalue";
}
