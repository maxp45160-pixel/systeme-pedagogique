/**
 * Le monde fictif — quelqu'un qui apprend la physique, sur dix-huit mois.
 *
 * ## Pourquoi un monde entier, et pas un jeu de données de plus
 *
 * Les jeux livrés (`catalogue.ts`) répondent à « ce cas précis casse-t-il un
 * invariant ? ». Ils ne répondent pas à « qu'est-ce que ce produit fabrique
 * chez quelqu'un qui l'utilise dix-huit mois ? » — question qui demande du
 * volume, un référentiel qui grandit, des objectifs à atteindre, et des
 * périodes sans rien.
 *
 * Un seul apprenant, une seule matière, quatre chapitres qui s'ouvrent l'un
 * après l'autre : mécanique, énergie, ondes, thermodynamique. Le référentiel
 * est **volontairement étranger** à celui du compte — rien ici ne doit pouvoir
 * être confondu avec une donnée réelle, ni relu comme une mesure sur
 * quelqu'un. Un domaine que le compte connaît déjà ne dirait d'ailleurs rien du
 * démarrage à froid, qui est justement ce qu'on cherche à voir.
 *
 * ## Ce qui est inventé, et ce qui ne l'est pas
 *
 * Inventé : le référentiel, les exercices, les objectifs, et l'aptitude de
 * l'apprenant simulé. Ce sont les **entrées** du moteur.
 *
 * Pas inventé : tout ce qui en sort. Niveaux, calibration, recommandations,
 * prédictions et métriques passent par les fonctions du produit — sans quoi la
 * simulation ne simulerait plus le produit.
 *
 * ## Les objectifs
 *
 * `ObjectifFictif` n'est pas une entité du domaine : le produit ne stocke que
 * deux objectifs textuels (`User.objectifMoyenTerme` / `objectifLongTerme`), et
 * ce module n'en crée pas un troisième. C'est un **critère de lecture** de la
 * simulation : « ces compétences-là devaient atteindre ce niveau-là ; à quelle
 * date le moteur y a-t-il mené ? ». Il vit ici et nulle part ailleurs.
 */

import type {
  Difficulte,
  Domaine,
  Exercise,
  Palier,
  Skill,
  TypeExercice,
} from "@/lib/domain/types";
import { tirage, type ProfilApprenant } from "./apprenant";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

/**
 * Un but déclaré : ces compétences, à ce niveau, à partir de ce jour.
 *
 * C'est la seule façon de dire si le produit « résout » quoi que ce soit sur la
 * durée. Sans lui, un parcours long ne se lit que comme une accumulation de
 * chiffres qui montent.
 */
export interface ObjectifFictif {
  id: string;
  intitule: string;
  /** Jour du parcours où l'objectif est déclaré. */
  jourDeclare: number;
  /** Codes visés — tous doivent atteindre `niveauRequis`. */
  competences: string[];
  niveauRequis: number;
}

/** Ce qui apparaît au référentiel à un jour donné. */
export interface LotReferentiel {
  jour: number;
  /** Ce qui justifie l'extension, tel qu'affiché dans le déroulé. */
  motif: string;
  domaine: Domaine;
  competences: Skill[];
  exercices: Exercise[];
  objectifs: ObjectifFictif[];
}

/** Une période sans aucune pratique — le seul moyen d'éprouver l'oubli. */
export interface FenetrePause {
  debut: number;
  fin: number;
  motif: string;
}

export interface MondeFictif {
  graine: number;
  /** Identifiant de l'archétype d'apprenant joué. */
  archetype: string;
  depart: string;
  /** Durée simulée, en jours. Un pas de moteur par jour. */
  jours: number;
  /** Le premier lot est le référentiel de départ (jour 0). */
  lots: LotReferentiel[];
  pauses: FenetrePause[];
  profil: ProfilApprenant;
}

/* ------------------------------------------------------------------ */
/* Définition du monde                                                 */
/* ------------------------------------------------------------------ */

interface DefinitionCompetence {
  intitule: string;
  palier: Palier;
  importance: number;
  /** Prérequis, exprimés en rang dans le domaine (1 = première compétence). */
  prerequis: number[];
}

interface DefinitionObjectif {
  intitule: string;
  /** Rangs visés dans le domaine. */
  cibles: number[];
  niveauRequis: number;
  /** Jours après l'apparition du domaine. */
  apres: number;
}

interface DefinitionDomaine {
  id: string;
  nom: string;
  prefixe: string;
  jour: number;
  motif: string;
  types: TypeExercice[];
  competences: DefinitionCompetence[];
  objectifs: DefinitionObjectif[];
  /** Exercices qui mobilisent plusieurs compétences — mesure du transfert. */
  integrations: { titre: string; cibles: number[]; difficulte: Difficulte }[];
}

const DOMAINES: DefinitionDomaine[] = [
  {
    id: "mecanique",
    nom: "Mécanique",
    prefixe: "MEC",
    jour: 0,
    motif: "Premier chapitre ouvert",
    types: ["rappel", "calcul", "application", "probleme"],
    competences: [
      { intitule: "Lire un graphique position-temps", palier: "fondamentaux", importance: 1, prerequis: [] },
      { intitule: "Décomposer un vecteur force", palier: "fondamentaux", importance: 1, prerequis: [] },
      { intitule: "Appliquer les lois de Newton", palier: "fondamentaux", importance: 0.95, prerequis: [2] },
      { intitule: "Traiter un mouvement uniformément accéléré", palier: "intermediaire", importance: 0.9, prerequis: [1, 3] },
      { intitule: "Étudier une chute libre", palier: "intermediaire", importance: 0.9, prerequis: [4] },
      { intitule: "Analyser un mouvement circulaire", palier: "intermediaire", importance: 0.85, prerequis: [3] },
      { intitule: "Résoudre un plan incliné avec frottements", palier: "avance", importance: 0.85, prerequis: [3, 4] },
      { intitule: "Modéliser un système à deux corps", palier: "avance", importance: 0.8, prerequis: [3, 6] },
    ],
    objectifs: [
      { intitule: "Résoudre un exercice de chute libre", cibles: [1, 3, 4, 5], niveauRequis: 3, apres: 0 },
      { intitule: "Traiter un problème de mécanique complet", cibles: [3, 4, 7], niveauRequis: 4, apres: 60 },
    ],
    integrations: [
      { titre: "Problème complet : bille lâchée sur un plan incliné", cibles: [7, 3, 4], difficulte: 4 },
      { titre: "Étude de mouvement, du relevé au modèle", cibles: [4, 1, 5], difficulte: 5 },
    ],
  },
  {
    id: "energie",
    nom: "Énergie",
    prefixe: "ENE",
    jour: 84,
    motif: "Nouveau chapitre ouvert : l'énergie",
    types: ["calcul", "application", "probleme", "etude-de-cas"],
    competences: [
      { intitule: "Calculer le travail d'une force", palier: "fondamentaux", importance: 1, prerequis: [] },
      { intitule: "Distinguer énergie cinétique et potentielle", palier: "fondamentaux", importance: 1, prerequis: [] },
      { intitule: "Appliquer la conservation de l'énergie mécanique", palier: "intermediaire", importance: 1, prerequis: [1, 2] },
      { intitule: "Traiter un choc élastique ou mou", palier: "intermediaire", importance: 0.9, prerequis: [3] },
      { intitule: "Utiliser puissance et rendement", palier: "intermediaire", importance: 0.8, prerequis: [1] },
      { intitule: "Résoudre un problème énergétique complet", palier: "avance", importance: 0.9, prerequis: [3, 4] },
      { intitule: "Relier force et énergie potentielle", palier: "avance", importance: 0.75, prerequis: [2, 3] },
    ],
    objectifs: [
      { intitule: "Passer le contrôle sur l'énergie mécanique", cibles: [1, 2, 3], niveauRequis: 3, apres: 0 },
      { intitule: "Mener un bilan énergétique de bout en bout", cibles: [3, 4, 6], niveauRequis: 4, apres: 66 },
    ],
    integrations: [
      { titre: "Bilan énergétique d'un pendule amorti", cibles: [3, 1, 5], difficulte: 5 },
    ],
  },
  {
    id: "ondes",
    nom: "Ondes",
    prefixe: "OND",
    jour: 182,
    motif: "Nouveau chapitre ouvert : les ondes",
    types: ["rappel", "application", "simulation", "probleme"],
    competences: [
      { intitule: "Décrire une onde périodique", palier: "fondamentaux", importance: 1, prerequis: [] },
      { intitule: "Relier fréquence, longueur d'onde et célérité", palier: "fondamentaux", importance: 1, prerequis: [1] },
      { intitule: "Interpréter une figure d'interférences", palier: "intermediaire", importance: 0.85, prerequis: [2] },
      { intitule: "Traiter réflexion et réfraction", palier: "intermediaire", importance: 0.85, prerequis: [2] },
      { intitule: "Analyser un son et son spectre", palier: "intermediaire", importance: 0.8, prerequis: [2] },
      { intitule: "Exploiter l'effet Doppler", palier: "avance", importance: 0.8, prerequis: [2, 5] },
      { intitule: "Modéliser une onde stationnaire", palier: "avance", importance: 0.75, prerequis: [3] },
    ],
    objectifs: [
      { intitule: "Comprendre la nature ondulatoire de la lumière", cibles: [1, 2, 3], niveauRequis: 3, apres: 0 },
    ],
    integrations: [
      { titre: "Des fentes d'Young à la longueur d'onde mesurée", cibles: [3, 2, 4], difficulte: 5 },
    ],
  },
  {
    id: "thermodynamique",
    nom: "Thermodynamique",
    prefixe: "THE",
    jour: 300,
    motif: "Nouveau chapitre ouvert : la thermodynamique",
    types: ["calcul", "etude-de-cas", "probleme", "application"],
    competences: [
      { intitule: "Lire un diagramme de phases", palier: "fondamentaux", importance: 0.9, prerequis: [] },
      { intitule: "Appliquer le premier principe", palier: "fondamentaux", importance: 1, prerequis: [] },
      { intitule: "Calculer un transfert thermique", palier: "intermediaire", importance: 0.9, prerequis: [2] },
      { intitule: "Étudier un gaz parfait", palier: "intermediaire", importance: 0.9, prerequis: [2] },
      { intitule: "Analyser un cycle thermodynamique", palier: "avance", importance: 0.9, prerequis: [3, 4] },
      { intitule: "Estimer le rendement d'une machine thermique", palier: "avance", importance: 0.85, prerequis: [5] },
    ],
    objectifs: [
      { intitule: "Expliquer un moteur thermique de bout en bout", cibles: [2, 3, 5, 6], niveauRequis: 4, apres: 0 },
    ],
    integrations: [
      { titre: "Cycle de Carnot, du diagramme au rendement", cibles: [5, 4, 3], difficulte: 5 },
    ],
  },
];

const PAUSES: FenetrePause[] = [
  { debut: 118, fin: 139, motif: "Trois semaines sans pratique" },
  { debut: 268, fin: 296, motif: "Un mois d'interruption" },
  { debut: 430, fin: 447, motif: "Deux semaines et demie d'interruption" },
];

export const JOURS_SIMULES = 540;
export const GRAINE_PAR_DEFAUT = 20260821;
const DERIVATION_GRAINE_APTITUDES = 0x6d2b79f5;

/* ------------------------------------------------------------------ */
/* Construction                                                        */
/* ------------------------------------------------------------------ */

const RANG_PALIER: Record<Palier, number> = {
  fondamentaux: 0,
  intermediaire: 1,
  avance: 2,
};

const DIFFICULTES: Difficulte[] = [1, 2, 3, 4, 5];
const VARIANTES = [1, 2];

function code(prefixe: string, rang: number): string {
  return `${prefixe}-${String(rang).padStart(2, "0")}`;
}

/**
 * Un exercice fabriqué pour une compétence et une difficulté.
 *
 * Exporté parce que le parcours en fabrique aussi **en cours de route** : quand
 * la compétence retenue n'a plus rien de proposable, le produit réel n'attend
 * pas — il propose « Générer un exercice ». Un parcours qui resterait à sec
 * mesurerait la pénurie d'un catalogue fixe, pas le comportement du moteur.
 */
export function fabriquerExercice(
  competence: Pick<Skill, "code" | "intitule" | "domaine">,
  difficulte: Difficulte,
  reference: string,
  type: TypeExercice = "probleme",
  rang = 0,
): Exercise {
  return {
    id: `${competence.code}-D${difficulte}-${reference}`,
    titre: `${competence.intitule} — niveau ${difficulte}, ${reference}`,
    domaine: competence.domaine,
    type,
    difficulte,
    competences: [competence.code],
    dureeEstimeeMin: 15 + difficulte * 8 + (rang % 3) * 3,
    enonce: `Énoncé de simulation — ${competence.intitule}.`,
    indices: Array.from({ length: difficulte <= 2 ? 2 : 3 }, (_, i) => `Indice ${i + 1}`),
    correction: "Correction de simulation.",
    criteres: [
      { dimension: "comprehension", libelle: "Comprend la situation" },
      { dimension: "application", libelle: "Applique la méthode" },
      { dimension: "justification", libelle: "Justifie le résultat" },
    ],
    origine: "manuel",
  };
}

function construireExercices(definition: DefinitionDomaine, competences: Skill[]): Exercise[] {
  const parCompetence = competences.flatMap((competence, rang) =>
    DIFFICULTES.flatMap((difficulte) =>
      VARIANTES.map((variante) =>
        fabriquerExercice(
          competence,
          difficulte,
          `variante ${variante}`,
          definition.types[(rang + difficulte + variante) % definition.types.length],
          rang,
        ),
      ),
    ),
  );

  // Les exercices d'intégration portent plusieurs compétences : sans eux, aucun
  // contexte combiné n'existe et le transfert ne se mesure jamais.
  const integrations = definition.integrations.map((integration, rang) => ({
    id: `${definition.prefixe}-INT-${rang + 1}`,
    titre: integration.titre,
    domaine: definition.id,
    type: "projet" as TypeExercice,
    difficulte: integration.difficulte,
    competences: integration.cibles.map((c) => code(definition.prefixe, c)),
    dureeEstimeeMin: 70 + integration.difficulte * 6,
    enonce: `Énoncé de simulation — ${integration.titre}.`,
    indices: ["Indice 1"],
    correction: "Correction de simulation.",
    criteres: [
      { dimension: "comprehension" as const, libelle: "Comprend la situation" },
      { dimension: "application" as const, libelle: "Applique la méthode" },
      { dimension: "transfert" as const, libelle: "Transpose à un cas nouveau" },
      { dimension: "justification" as const, libelle: "Justifie le résultat" },
    ],
    origine: "manuel" as const,
  }));

  return [...parCompetence, ...integrations];
}

function construireLot(definition: DefinitionDomaine, ordre: number): LotReferentiel {
  const domaine: Domaine = {
    id: definition.id,
    nom: definition.nom,
    prefixe: definition.prefixe,
    description: "Domaine de simulation — aucun rapport avec un référentiel réel.",
    ordre,
    version: 1,
    archive: false,
    origine: "manuel",
  };

  const competences: Skill[] = definition.competences.map((c, index) => ({
    code: code(definition.prefixe, index + 1),
    domaine: definition.id,
    intitule: c.intitule,
    palier: c.palier,
    prerequis: c.prerequis.map((rang) => code(definition.prefixe, rang)),
    importance: c.importance,
    ordre: index,
    active: true,
    archive: false,
    origine: "manuel",
  }));

  const objectifs: ObjectifFictif[] = definition.objectifs.map((o, index) => ({
    id: `${definition.prefixe}-OBJ-${index + 1}`,
    intitule: o.intitule,
    jourDeclare: definition.jour + o.apres,
    competences: o.cibles.map((rang) => code(definition.prefixe, rang)),
    niveauRequis: o.niveauRequis,
  }));

  return {
    jour: definition.jour,
    motif: definition.motif,
    domaine,
    competences,
    exercices: construireExercices(definition, competences),
    objectifs,
  };
}

/**
 * L'aptitude réelle, tirée une fois pour toutes.
 *
 * Elle décroît avec le palier — personne n'arrive au même niveau sur les
 * fondamentaux et sur l'avancé — et porte une part de tirage, pour que le
 * moteur ne puisse pas « avoir raison » en devinant une règle simple. Le moteur
 * ne la voit jamais : c'est la vérité terrain de la simulation.
 */
function tirerAptitudes(lots: LotReferentiel[], graine: number): Record<string, number> {
  // Les aptitudes cachées et le comportement de l'apprenant doivent avoir
  // des flux indépendants : réutiliser la même séquence crée une corrélation
  // artificielle entre la vérité terrain et les résultats tirés ensuite.
  const suivant = tirage((graine ^ DERIVATION_GRAINE_APTITUDES) >>> 0);
  const aptitude: Record<string, number> = {};
  for (const lot of lots) {
    for (const competence of lot.competences) {
      const base = 3.5 - RANG_PALIER[competence.palier] * 0.55;
      const bruit = (suivant() - 0.5) * 1.5;
      aptitude[competence.code] =
        Math.round(Math.min(4.3, Math.max(1.1, base + bruit)) * 100) / 100;
    }
  }
  return aptitude;
}

/* ------------------------------------------------------------------ */
/* Archétypes                                                          */
/* ------------------------------------------------------------------ */

/**
 * Six façons d'être l'apprenant.
 *
 * Un seul profil rend toute conclusion conditionnelle à ce profil : « le moteur
 * sert trop dur » veut alors dire « trop dur pour celui-là ». Un constat qui
 * tient sur quatre archétypes sur six parle du moteur ; un constat isolé décrit
 * l'archétype.
 *
 * `aptitudeFacteur` et `aptitudeDecalage` déplacent la vérité terrain : un
 * apprenant en difficulté ne diffère pas seulement par son assiduité.
 */
export interface Archetype {
  id: string;
  libelle: string;
  description: string;
  apprentissage: number;
  tauxIgnore: number;
  lenteur: number;
  oubli: number;
  aptitudeFacteur: number;
  aptitudeDecalage: number;
}

export const ARCHETYPES: Archetype[] = [
  {
    id: "regulier",
    libelle: "Régulier",
    description: "Fait ce qui est proposé trois fois sur quatre, progresse à rythme moyen.",
    apprentissage: 0.13,
    tauxIgnore: 0.25,
    lenteur: 1.05,
    oubli: 0.16,
    aptitudeFacteur: 1,
    aptitudeDecalage: 0,
  },
  {
    id: "assidu",
    libelle: "Assidu",
    description: "Ignore une proposition sur dix, travaille vite et oublie peu.",
    apprentissage: 0.15,
    tauxIgnore: 0.1,
    lenteur: 0.95,
    oubli: 0.12,
    aptitudeFacteur: 1,
    aptitudeDecalage: 0,
  },
  {
    id: "irregulier",
    libelle: "Irrégulier",
    description: "Ignore deux propositions sur trois : le moteur parle dans le vide la plupart du temps.",
    apprentissage: 0.12,
    tauxIgnore: 0.6,
    lenteur: 1.2,
    oubli: 0.24,
    aptitudeFacteur: 1,
    aptitudeDecalage: 0,
  },
  {
    id: "rapide",
    libelle: "Rapide",
    description: "Apprend deux fois plus vite que la moyenne : le moteur suit-il la montée ?",
    apprentissage: 0.26,
    tauxIgnore: 0.2,
    lenteur: 0.8,
    oubli: 0.1,
    aptitudeFacteur: 1,
    aptitudeDecalage: 0.4,
  },
  {
    id: "plafonne",
    libelle: "Plafonné",
    description: "Travaille sans progresser : toute montée de niveau observée serait une erreur.",
    apprentissage: 0.03,
    tauxIgnore: 0.2,
    lenteur: 1.1,
    oubli: 0.18,
    aptitudeFacteur: 1,
    aptitudeDecalage: 0,
  },
  {
    id: "en-difficulte",
    libelle: "En difficulté",
    description: "Aptitude basse, progression lente, séances longues.",
    apprentissage: 0.08,
    tauxIgnore: 0.3,
    lenteur: 1.5,
    oubli: 0.26,
    aptitudeFacteur: 0.65,
    aptitudeDecalage: 0,
  },
];

export const ARCHETYPE_PAR_DEFAUT = ARCHETYPES[0];

export function archetypeParId(id: string): Archetype {
  return ARCHETYPES.find((a) => a.id === id) ?? ARCHETYPE_PAR_DEFAUT;
}

export function construireMondeFictif(
  graine = GRAINE_PAR_DEFAUT,
  archetype: Archetype = ARCHETYPE_PAR_DEFAUT,
): MondeFictif {
  const lots = DOMAINES.map(construireLot);
  const brutes = tirerAptitudes(lots, graine);
  const aptitude: Record<string, number> = {};
  for (const [code, valeur] of Object.entries(brutes)) {
    aptitude[code] =
      Math.round(
        Math.min(4.6, Math.max(1, valeur * archetype.aptitudeFacteur + archetype.aptitudeDecalage)) *
          100,
      ) / 100;
  }

  return {
    graine,
    archetype: archetype.id,
    depart: "2026-01-05T08:00:00.000Z",
    jours: JOURS_SIMULES,
    lots,
    pauses: PAUSES,
    profil: {
      aptitude,
      apprentissage: archetype.apprentissage,
      tauxIgnore: archetype.tauxIgnore,
      lenteur: archetype.lenteur,
      oubli: archetype.oubli,
    },
  };
}

/** Tous les objectifs du monde, dans l'ordre de déclaration. */
export function objectifsDuMonde(monde: MondeFictif): ObjectifFictif[] {
  return monde.lots
    .flatMap((lot) => lot.objectifs)
    .sort((a, b) => a.jourDeclare - b.jourDeclare);
}

/** Le lot qui apparaît ce jour-là, hors référentiel de départ. */
export function lotDuJour(monde: MondeFictif, jour: number): LotReferentiel | undefined {
  return monde.lots.find((lot) => lot.jour === jour && lot.jour > 0);
}

export function enPause(monde: MondeFictif, jour: number): FenetrePause | undefined {
  return monde.pauses.find((p) => jour >= p.debut && jour <= p.fin);
}
