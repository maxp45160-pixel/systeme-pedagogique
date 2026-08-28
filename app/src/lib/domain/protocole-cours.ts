/**
 * Le protocole de traitement d'un cours — module pur, testable sans base.
 *
 * ## Ce qu'est un protocole
 *
 * Quand un PDF de cours est déposé, la personne déclare une **intention**
 * (mémoriser, maîtriser, comprendre). Le tuteur lit le cours et propose un
 * **plan fixe de séances**, chacune typée par une **dimension** pédagogique
 * (compréhension, application, contextualisation, mémorisation) et liée aux
 * compétences du référentiel que le cours a fait naître.
 *
 * ## Ce que ce module refuse de créer
 *
 * Aucune entité. Le protocole n'est pas stocké : il *devient* des
 * `LearningSession` planifiées, dont le `blueprint.origine` porte la trace
 * (ADR-048 — pas de nouvelle entité séance ; TWINY §9 — un parcours est
 * dérivé, pas un objectif stocké). Une proposition de protocole qui n'a pas
 * été relue n'existe nulle part.
 *
 * ## Ce que le tuteur n'a pas le droit de faire
 *
 * Le protocole est du **contenu** (ADR-037, ADR-069) : il ne note rien, ne
 * déduit aucun niveau, ne pré-jauge aucune compréhension. Les codes qu'il
 * désigne viennent de l'enum fourni par le serveur — il n'en frappe aucun
 * (ADR-043). Les mesures naîtront des tentatives validées, comme partout.
 */

import { DUREE_ESTIMEE_MAX, DUREE_ESTIMEE_MIN, TEMPS_DECLARE_MAX } from "./exercice";
import type { Exercise, OrigineSeance } from "./types";

/* ------------------------------------------------------------------ */
/* Intention du cours                                                   */
/* ------------------------------------------------------------------ */

/**
 * Ce que la personne DÉCLARE vouloir faire du cours, au dépôt du PDF.
 *
 * Un fait déclaré, daté, stocké dans la fiche — jamais déduit du contenu du
 * PDF, jamais révisé par le tuteur. C'est elle qui oriente le protocole ; le
 * tuteur l'explique, il ne la choisit pas.
 */
export const INTENTIONS_COURS = ["memoriser", "maitriser", "comprendre"] as const;

export type IntentionCours = (typeof INTENTIONS_COURS)[number];

export const LIBELLES_INTENTION_COURS: Record<IntentionCours, string> = {
  memoriser: "Mémoriser (apprendre par cœur)",
  maitriser: "Maîtriser les notions (savoir les appliquer)",
  comprendre: "Comprendre le contenu (en voir le sens et les liens)",
};

export function estIntentionCours(valeur: unknown): valeur is IntentionCours {
  return (
    typeof valeur === "string" &&
    (INTENTIONS_COURS as readonly string[]).includes(valeur)
  );
}

/**
 * La phrase libre qui accompagne l'intention.
 *
 * Facultative, bornée comme toute déclaration : elle oriente le tuteur, elle
 * n'entre dans aucun calcul. Même esprit que `BesoinDeclare.intention`.
 */
export const INTENTION_LIBRE_MAX = 500;

export function motifRefusIntentionLibre(texte: string): string | null {
  if (texte.length > INTENTION_LIBRE_MAX) {
    return `L'intention libre est trop longue : ${texte.length} caractères pour ${INTENTION_LIBRE_MAX} au plus.`;
  }
  return null;
}

/** Le support d'un protocole doit encore appartenir à un domaine vivant. */
export function motifRefusDomaineCours(
  domainId: string,
  activeDomainIds: ReadonlySet<string>,
): string | null {
  if (!domainId.trim() || !activeDomainIds.has(domainId)) {
    return "Le domaine du cours est absent ou archivé.";
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Dimensions d'une séance du protocole                                 */
/* ------------------------------------------------------------------ */

/**
 * Ce qu'une séance du protocole cherche à faire produire une preuve de.
 *
 * Un enum serveur, pas un vocabulaire libre : l'écran, le prompt et le
 * blueprint doivent nommer les mêmes valeurs dans les mêmes termes. La
 * dimension est un **intentif** posé à la création — elle dit ce que la
 * séance est conçue pour observer, jamais ce qui a été observé. Rien ne
 * mesure « la compréhension » : les tentatives validées produisent des
 * observations, et elles seules.
 */
export const DIMENSIONS_SEANCE = [
  "comprehension",
  "application",
  "contextualisation",
  "memorisation",
] as const;

export type DimensionSeance = (typeof DIMENSIONS_SEANCE)[number];

export const LIBELLES_DIMENSION_SEANCE: Record<DimensionSeance, string> = {
  comprehension: "Compréhension",
  application: "Application",
  contextualisation: "Contextualisation",
  memorisation: "Mémorisation",
};

export const DESCRIPTIONS_DIMENSION_SEANCE: Record<DimensionSeance, string> = {
  comprehension: "Vérifier que les notions du cours sont comprises et reformulables.",
  application: "Appliquer les notions du cours à des exercices typiques.",
  contextualisation: "Transposer les notions à des cas nouveaux ou concrets.",
  memorisation: "Fixer les points clés du cours dans la durée.",
};

export function estDimensionSeance(valeur: unknown): valeur is DimensionSeance {
  return (
    typeof valeur === "string" &&
    (DIMENSIONS_SEANCE as readonly string[]).includes(valeur)
  );
}

/* ------------------------------------------------------------------ */
/* Proposition du tuteur                                                */
/* ------------------------------------------------------------------ */

/** Plafond de séances d'un protocole. Un plan qu'on ne relit pas n'est pas un plan. */
export const SEANCES_PROTOCOLE_MAX = 6;

/** Plafond de compétences désignées par une séance du protocole. */
export const CODES_SEANCE_PROTOCOLE_MAX = 6;

/** Une séance proposée par le tuteur, avant relecture. */
export interface SeanceProtocole {
  /** Titre éditorial, relu et modifiable par la personne. */
  titre: string;
  dimension: DimensionSeance;
  /** Codes du référentiel visés — nécessairement issus de l'enum serveur. */
  codes: string[];
  /** Ce que la séance fait faire, en une à trois phrases. */
  consigne: string;
  /** Minutes cibles, déclarées par le tuteur et relues par la personne. */
  dureeCibleMin: number;
}

/** Le protocole complet proposé, avant relecture. */
export interface ProtocoleCours {
  /** Une à trois phrases : comment le plan couvre le cours et sert l'intention. */
  resume: string;
  seances: SeanceProtocole[];
}

const TITRE_PROTOCOLE_MAX = 120;
const CONSIGNE_PROTOCOLE_MAX = 600;

/**
 * Les refus opposés à une proposition de protocole, avant relecture.
 *
 * `codesActifs` est l'ensemble fermé fourni par le serveur : un code que le
 * tuteur aurait inventé est refusé ici, quoi qu'en ait dit le schéma de
 * l'outil — la validation écrite reste la seule autorité (ADR-031).
 *
 * La borne basse de durée est **dérivée** : une séance de *n* compétences ne
 * peut pas viser moins de *n* fois la durée minimale d'un exercice, sans quoi
 * `motifRefusDemande` refuserait à l'écriture ce que le protocole aurait
 * accepté à la relecture.
 */
export function motifRefusProtocole(
  protocole: ProtocoleCours,
  codesActifs: ReadonlySet<string>,
): string | null {
  if (!protocole.resume.trim()) {
    return "Le protocole doit dire, en une à trois phrases, comment il couvre le cours.";
  }
  if (
    !Array.isArray(protocole.seances) ||
    protocole.seances.length === 0 ||
    protocole.seances.length > SEANCES_PROTOCOLE_MAX
  ) {
    return `Un protocole compte de 1 à ${SEANCES_PROTOCOLE_MAX} séances — pas ${Array.isArray(protocole.seances) ? protocole.seances.length : "aucune"}.`;
  }

  for (const [index, seance] of protocole.seances.entries()) {
    const ou = `séance ${index + 1}`;
    const titre = seance.titre?.trim() ?? "";
    if (!titre || titre.length > TITRE_PROTOCOLE_MAX) {
      return `${ou} : le titre est obligatoire (${TITRE_PROTOCOLE_MAX} caractères au plus).`;
    }
    if (!estDimensionSeance(seance.dimension)) {
      return `${ou} (« ${titre} ») : dimension inconnue.`;
    }
    const codes = seance.codes ?? [];
    if (
      codes.length === 0 ||
      codes.length > CODES_SEANCE_PROTOCOLE_MAX ||
      codes.some((code) => !codesActifs.has(code))
    ) {
      return `${ou} (« ${titre} ») : les compétences visées doivent appartenir au référentiel actif du compte (1 à ${CODES_SEANCE_PROTOCOLE_MAX} codes).`;
    }
    const consigne = seance.consigne?.trim() ?? "";
    if (!consigne || consigne.length > CONSIGNE_PROTOCOLE_MAX) {
      return `${ou} (« ${titre} ») : la consigne est obligatoire (${CONSIGNE_PROTOCOLE_MAX} caractères au plus).`;
    }
    const duree = seance.dureeCibleMin;
    if (
      !Number.isInteger(duree) ||
      duree < codes.length * DUREE_ESTIMEE_MIN ||
      duree > TEMPS_DECLARE_MAX
    ) {
      return `${ou} (« ${titre} ») : durée cible hors bornes. Pour ${codes.length} compétence(s), elle doit être un entier de ${codes.length * DUREE_ESTIMEE_MIN} à ${TEMPS_DECLARE_MAX} minutes.`;
    }
  }

  return null;
}

/**
 * Les séances retenues après relecture — la seule forme qui atteint l'écriture.
 *
 * La relecture case par case (patronne ADR-129) retire les séances non cochées
 * ; ce qui reste ici est définitif pour l'écriture.
 */
export type ProtocoleRetenu = SeanceProtocole[];

/* ------------------------------------------------------------------ */
/* Compréhension = reformulation (ADR-133)                              */
/* ------------------------------------------------------------------ */

export interface ParametresExerciceExplication {
  code: string;
  intitule: string;
  /** La consigne relue de la séance — elle cite les notions du cours. */
  consigne: string;
  dureeEstimeeMin: number;
}

/**
 * L'exercice-Feynman d'une séance « compréhension » (ADR-133).
 *
 * Une séance dont la dimension est `comprehension` ne demande pas au tuteur
 * des exercices à produire : elle demande à la PERSONNE de reformuler. Cet
 * exercice est écrit par le serveur, déterministe, sans aucun appel LLM — la
 * préparation d'une telle séance est instantanée. La mesure naît ensuite
 * comme partout : tentative menée, critères relus, correction du tuteur si
 * sollicitée.
 *
 * Le contenu passe `motifRefusExercice` comme n'importe quel exercice : la
 * correction est une guidance d'auto-relecture, pas un corrigé inventé.
 */
export function exerciceExplicationPour(
  parametres: ParametresExerciceExplication,
): Omit<Exercise, "id"> & { origine: "manuel" } {
  const consigne = parametres.consigne.trim();
  const enonce = [
    `Méthode Feynman : expliquez « ${parametres.intitule} » (${parametres.code}) avec vos propres mots.`,
    "- Reformulez la notion comme à quelqu'un qui ne la connaît pas.",
    consigne
      ? `- Appuyez-vous sur les notions visées par la séance : ${consigne}`
      : "- Appuyez-vous sur les notions visées par la séance.",
    "- Donnez au moins une intuition ou un exemple qui n'est pas recopié du cours.",
  ].join("\n");
  const correction = [
    "Pas de corrigé à recopier : c'est VOTRE reformulation qui compte.",
    "À la relecture, vérifiez chaque critère honnêtement ; sollicitez la correction du tuteur pour un retour sur ce qui manque.",
  ].join("\n");
  return {
    titre: `Expliquer « ${parametres.intitule} » avec ses propres mots`,
    domaine: "",
    type: "rappel",
    difficulte: 2,
    competences: [parametres.code],
    dureeEstimeeMin: Math.min(
      DUREE_ESTIMEE_MAX,
      Math.max(DUREE_ESTIMEE_MIN, Math.round(parametres.dureeEstimeeMin)),
    ),
    enonce,
    indices: [],
    correction,
    criteres: [
      {
        dimension: "comprehension",
        libelle: "La notion est reformulée avec justesse, sans erreur de fond.",
      },
      {
        dimension: "justification",
        libelle: "Une intuition ou un exemple étaye l'explication.",
      },
    ],
    diagnostic: false,
    origine: "manuel",
  };
}

/* ------------------------------------------------------------------ */
/* Mémorisation = rappel actif (ADR-134)                                */
/* ------------------------------------------------------------------ */

export interface ParametresExerciceRappel {
  code: string;
  intitule: string;
  /** La consigne relue de la séance — elle cite les notions à retenir. */
  consigne: string;
  /** Titre du cours porteur — la vérification se fait contre LUI, pas contre un corrigé inventé. */
  titreCours: string;
  dureeEstimeeMin: number;
}

/**
 * La carte de rappel d'une séance « mémorisation » (ADR-134).
 *
 * Rappel actif, dans l'ordre qui fait l'effet : restituer D'ABORD de mémoire,
 * vérifier ENSUITE contre la source — le cours réel attaché à la fiche, jamais
 * un corrigé fabriqué par le serveur. Comme l'exercice-Feynman (ADR-133), la
 * carte est écrite de façon déterministe, sans aucun appel LLM : la
 * préparation d'une telle séance est instantanée.
 *
 * Le contenu passe `motifRefusExercice` comme n'importe quel exercice.
 */
export function exerciceRappelPour(
  parametres: ParametresExerciceRappel,
): Omit<Exercise, "id"> & { origine: "manuel" } {
  const consigne = parametres.consigne.trim();
  const cours = parametres.titreCours.trim() || "le cours attaché à cette fiche";
  const enonce = [
    `Mémoire active : SANS relire le cours, restituez les points clés de « ${parametres.intitule} » (${parametres.code}).`,
    "- Listez définitions, formules, étapes, exemples — tout ce dont vous vous souvenez, même fragmentaire.",
    consigne
      ? `- Les notions visées : ${consigne}`
      : "- Visez les notions désignées par la séance.",
    "- N'ouvrez le cours qu'APRÈS avoir écrit votre restitution : c'est l'effort de rappel qui fixe la mémoire.",
  ].join("\n");
  const correction = [
    `Vérification : rouvrez « ${cours} » et confrontez votre restitution aux sections visées.`,
    "Ce qui manque ou diffère n'est pas une faute — c'est exactement ce que la prochaine répétition doit couvrir.",
    "La correction du tuteur peut vous aider à départager l'approximatif du faux.",
  ].join("\n");
  return {
    titre: `Rappel de mémoire — « ${parametres.intitule} »`,
    domaine: "",
    type: "rappel",
    difficulte: 2,
    competences: [parametres.code],
    dureeEstimeeMin: Math.min(
      DUREE_ESTIMEE_MAX,
      Math.max(DUREE_ESTIMEE_MIN, Math.round(parametres.dureeEstimeeMin)),
    ),
    enonce,
    indices: [],
    correction,
    criteres: [
      {
        dimension: "comprehension",
        libelle: "Les points clés sont restitués sans erreur de fond.",
      },
      {
        dimension: "integration",
        libelle: "La restitution couvre l'essentiel des notions visées.",
      },
    ],
    diagnostic: false,
    origine: "manuel",
  };
}

/* ------------------------------------------------------------------ */
/* Origine d'une séance                                                 */
/* ------------------------------------------------------------------ */

const TITRE_ORIGINE_MAX = TITRE_PROTOCOLE_MAX;

/**
 * Le refus opposé à une `OrigineSeance` mal formée, avant écriture.
 *
 * `origine` vit dans le blueprint persisté : une donnée relue de Supabase se
 * valide comme les autres, et un blueprint écrit par un chemin détourné ne
 * doit pas pouvoir se réclamer d'un protocole qui n'existe pas.
 */
export function motifRefusOrigineSeance(
  origine: {
    genre: string;
    ficheId: string;
    pieceId?: unknown;
    titre: string;
    dimension: unknown;
    /** Présents sur une écriture en préparation différée (ADR-131) — relu comme le reste. */
    codes?: unknown;
    consigne?: unknown;
  },
): string | null {
  if (origine.genre !== "protocole-cours") {
    return "Seule l'origine « protocole-cours » est définie.";
  }
  if (!origine.ficheId.trim()) {
    return "Une séance de protocole désigne la fiche cours qui l'a fait naître.";
  }
  if (origine.pieceId !== undefined
    && (typeof origine.pieceId !== "string" || !origine.pieceId.trim())) {
    return "Le PDF source d'une séance de protocole est invalide.";
  }
  const titre = origine.titre.trim();
  if (!titre || titre.length > TITRE_ORIGINE_MAX) {
    return `Le titre de la séance de protocole est obligatoire (${TITRE_ORIGINE_MAX} caractères au plus).`;
  }
  if (!estDimensionSeance(origine.dimension)) {
    return "La dimension de la séance de protocole est inconnue.";
  }
  /*
   * Les champs de la préparation différée (ADR-131) ne sont validés QUE s'ils
   * sont présents : les séances écrites avant ADR-131 n'en portent pas, et
   * une séance complète n'en a pas besoin. Mais une fois posés, ils engagent —
   * ce sont eux que le démarrage passera au tuteur.
   */
  if (origine.codes !== undefined) {
    const codes = origine.codes;
    if (
      !Array.isArray(codes) ||
      codes.length === 0 ||
      codes.length > CODES_SEANCE_PROTOCOLE_MAX ||
      codes.some((code) => typeof code !== "string" || !code.trim())
    ) {
      return `Les compétences visées d'une séance à préparer sont obligatoires (1 à ${CODES_SEANCE_PROTOCOLE_MAX} codes non vides).`;
    }
  }
  if (origine.consigne !== undefined) {
    const consigne = typeof origine.consigne === "string" ? origine.consigne.trim() : "";
    if (!consigne || consigne.length > CONSIGNE_PROTOCOLE_MAX) {
      return `La consigne d'une séance à préparer est obligatoire (${CONSIGNE_PROTOCOLE_MAX} caractères au plus).`;
    }
  }
  return null;
}

/**
 * Désigne le seul PDF qu'une séance de protocole est autorisée à relire.
 * L'absence d'attachement est conservée pour les séances historiques ; elle
 * n'est jamais remplacée ici par un autre document.
 */
export function sourcePdfOrigineSeance(
  origine: Pick<OrigineSeance, "ficheId" | "pieceId">,
): { courseDocumentId: string; sourceAttachmentId: string } | null {
  if (!origine.pieceId) return null;
  return {
    courseDocumentId: origine.ficheId,
    sourceAttachmentId: origine.pieceId,
  };
}
