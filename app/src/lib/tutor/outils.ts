/**
 * Outils du tuteur — les propositions passent en sortie structurée (lot 3.2).
 *
 * Jusqu'ici le tuteur écrivait ses propositions en blocs markdown, que
 * `proposition.ts` reprenait avec une machine à états. Trois conséquences que
 * ce module supprime à la racine :
 *
 * 1. **Une réponse tronquée produisait un demi-exercice en silence.** Les champs
 *    arrivent dans l'ordre du gabarit ; un flux coupé après l'énoncé donnait un
 *    bloc qui « ressemblait » à une proposition. Ici, un JSON incomplet ne parse
 *    pas, ou échoue à la validation : il est **rejeté et annoncé**, jamais
 *    accepté à moitié.
 * 2. **La forme du gabarit était une classe de bugs.** Étiquette en gras,
 *    étiquette seule sur sa ligne, tiret cadratin dans un intitulé : autant de
 *    correctifs successifs sur le parseur. Un schéma n'a pas de mise en forme.
 * 3. **Les interdits du prompt n'étaient que des phrases.** « N'écris aucun code
 *    de compétence » se lit ou ne se lit pas ; ici le schéma de la branche ne
 *    comporte simplement PAS de champ `code` (CLAUDE.md §8). L'interdit devient
 *    impossible à enfreindre au lieu d'être seulement demandé.
 *
 * Ce que ce module **ne change pas** : le tuteur n'a toujours aucun accès en
 * écriture (P5). Un appel d'outil est une *proposition* — elle remplit un
 * formulaire que l'utilisateur valide, exactement comme le bloc markdown avant
 * elle. C'est pourquoi la validation rend les mêmes types que les parseurs.
 *
 * Aucune dépendance : ni node, ni validateur tiers (CLAUDE.md §8). Le schéma
 * JSON part au fournisseur, la validation ci-dessous est écrite à la main et
 * reste la seule à faire autorité — un fournisseur qui suivrait mal le schéma
 * ne doit pas pouvoir faire entrer une proposition mal formée.
 */

import {
  RESULTATS_TENTATIVE,
  type Referentiel,
  type ResultatTentative,
} from "@/lib/domain/types";
// Le barème vient du domaine, pas d'une constante locale : le prompt et l'écran
// doivent nommer les mêmes valeurs dans les mêmes termes (`lib/domain/bilan.ts`).
import { APPRECIATIONS, RESULTATS } from "@/lib/domain/bilan";
import {
  DIFFICULTE_MAX,
  DIFFICULTE_MIN,
  DUREE_ESTIMEE_MAX,
  DUREE_ESTIMEE_MIN,
} from "@/lib/domain/exercice";
// La validation d'une intention vit au domaine, pas ici : c'est elle qui décide
// ce qu'est une action exécutable, et elle est tenue par ses propres tests.
import {
  analyserDemandeReferentiel,
  GENRES_INTENTION,
  validerTraductionIntention,
  type TraductionIntention,
} from "@/lib/domain/intention";
import {
  exerciceComplet,
  type PropositionExercice,
  type PropositionReferentiel,
} from "./proposition";
// L'atomicité vient du domaine, pas d'une liste locale : le schéma d'outil et
// le validateur d'écriture doivent nommer les mêmes verbes et les mêmes bornes,
// sinon le tuteur remplit des champs valides et se fait rejeter (ADR-086).
import {
  composerIntitule,
  motifsNonAtomique,
  motifsRefusStructure,
  OBJET_MAX,
  PHRASE_MESURABILITE,
  PRECISION_MAX,
  VERBES_ACTION,
} from "@/lib/domain/atomicite";
import { objet } from "./conversion";
import {
  CODES_SEANCE_PROTOCOLE_MAX,
  DIMENSIONS_SEANCE,
  SEANCES_PROTOCOLE_MAX,
  motifRefusProtocole,
  type ProtocoleCours,
} from "@/lib/domain/protocole-cours";

/* ------------------------------------------------------------------ */
/* Noms d'outils et description neutre d'un schéma                     */
/* ------------------------------------------------------------------ */

export const OUTIL_EXERCICE = "proposer_exercice";
export const OUTIL_REFERENTIEL = "proposer_referentiel";

/**
 * Outil confiné au contrôle qualité d'un exercice déjà proposé.
 *
 * Il n'entre jamais dans `outilsTuteur` : le tuteur conversationnel ne doit
 * pas recevoir un exercice du corpus pour le relire. Le serveur l'arme
 * uniquement après une proposition, avec l'énoncé et la correction du tour.
 */
export const OUTIL_COHERENCE_EXERCICE = "verifier_coherence_exercice";

/**
 * Outil interne de réparation, armé uniquement après un premier contrôle
 * négatif. Il ne modifie pas l'énoncé : il réécrit la correction à partir de
 * celui-ci, puis la correction réparée repasse par le contrôle de cohérence.
 */
export const OUTIL_REPARATION_CORRECTION_EXERCICE = "reparer_correction_exercice";

/**
 * ⚠️ `proposer_correction` n'entre PAS dans `outilsTuteur`, et c'est le premier
 * des six verrous qui bornent l'exception à ADR-036.
 *
 * ADR-036 dit que le tuteur voit le corpus — titres, compétences, difficulté,
 * état d'usage — mais jamais les énoncés, et jamais la correction. Corriger une
 * réponse exige pourtant de lire la correction : sans elle, le tuteur ne
 * corrigerait pas, il improviserait un barème.
 *
 * L'exception est donc scopée à un seul chemin : un outil qui ne voyage pas
 * avec le chat, un prompt dédié qui n'appelle jamais `construireContexte`, et
 * une route qui n'accepte aucun historique de conversation. Le test
 * `contexte.test.ts` « ne transmet JAMAIS la correction » reste vrai et reste
 * la garantie du chat.
 */
export const OUTIL_CORRECTION = "proposer_correction";

/**
 * Plafond de longueur d'une justification de critère.
 *
 * Ce n'est pas une règle pédagogique, c'est une **borne de confinement**. La
 * justification est la seule sortie du chemin de correction : si elle peut
 * faire 2 000 caractères, elle peut contenir la correction réécrite, et
 * l'exception à ADR-036 devient un tunnel plutôt qu'une fenêtre.
 *
 * 400 est un chiffre rond, choisi pour tenir « une à deux phrases » et rien de
 * plus. Il se déplacera sur observation, comme tout seuil de ce dépôt.
 */
export const JUSTIFICATION_MAX = 400;

/**
 * Plafonds du bilan rédigé — le feedback global du tuteur (ADR-046).
 *
 * ## Pourquoi ils sont plus larges que `JUSTIFICATION_MAX`, et pourquoi c'est
 * défendable
 *
 * La borne ci-dessus protège un chemin précis : la justification est **attachée
 * à une case que l'utilisateur doit cocher**. Longue, elle devient la correction
 * réécrite, l'utilisateur la lit, se dit « oui c'est ça », et tamponne — la
 * mesure est corrompue à l'entrée de la chaîne. Elle ne bouge pas.
 *
 * Le bilan rédigé, lui, **ne porte aucune mesure**. Il n'est attaché à aucun
 * critère, il n'entre dans aucune observation, il ne pré-remplit rien. C'est du
 * conseil, et un conseil de 400 caractères ne dit pas « ce qui pose problème,
 * pourquoi, et quoi faire ». Le borner court reviendrait à refuser la demande
 * plutôt qu'à la sécuriser.
 *
 * ## ⚠️ La frontière qui reste, et où elle est tenue
 *
 * Le vrai risque n'est pas la longueur : c'est que ce texte **revienne dans le
 * chat**, où la correction n'a jamais le droit d'entrer (ADR-036, et le test
 * « ne transmet JAMAIS la correction »). Un bilan persisté puis resérialisé
 * dans `construireContexte` serait précisément ce tunnel.
 *
 * D'où la règle, tenue dans `contexte.ts` et non ici : **seul
 * `aRetravailler` franchit la frontière**. Ce sont des points courts qui
 * parlent de la personne — « confond médiane et moyenne » — et non de la
 * solution. `pointsForts` et `pointsBloquants` sont persistés, relisibles par
 * l'utilisateur sur sa tentative, et ne sortent jamais de là.
 */
export const FEEDBACK_MAX = 900;
export const RETRAVAILLER_MAX = 180;
export const RETRAVAILLER_ITEMS_MAX = 4;

/**
 * ⚠️ `proposer_revision` — le point d'architecture du lot C.
 *
 * CLAUDE.md §8 interdit de laisser le tuteur écrire un code de compétence.
 * Réviser un référentiel existant exige pourtant de **désigner** les
 * compétences à reformuler ou à retirer. Il faut donc nommer une distinction
 * que l'interdit d'origine ne faisait pas :
 *
 * > **Frapper un code** = produire un identifiant que l'application n'a pas
 * > attribué. Interdit : collision, observations qui suivent la mauvaise
 * > compétence, sans erreur visible (ADR-026).
 * >
 * > **Désigner un code** = pointer l'un des identifiants que l'application a
 * > **déjà attribués** et qu'elle vient de remettre au modèle dans cette
 * > requête même. Ce n'est pas le même acte.
 *
 * Le design est sûr par trois couches indépendantes :
 *
 * 1. **l'`enum` est fermé et construit par le serveur**, à la requête, sur les
 *    codes vivants du seul domaine révisé. Une valeur hors de cet ensemble
 *    n'est pas découragée — elle n'est pas dans le schéma. Deux bornes
 *    gratuites au passage : une révision du domaine X ne peut pas renommer une
 *    compétence du domaine Y, et une compétence archivée ne peut être ni
 *    renommée ni re-retirée ;
 * 2. **`validerRevision` revérifie l'appartenance**, parce qu'un fournisseur
 *    qui ignore le schéma ne doit pas passer pour autant (ADR-031) ;
 * 3. **`appliquerRevision` revérifie à l'écriture**, côté serveur.
 *
 * Et surtout : **`ajouts` n'a aucun champ `code`.** L'interdit reste intact là
 * où il compte — la frappe. L'`enum` ne fait que pointer.
 *
 * ⚠️ Ne pas « simplifier » cet `enum` en `type: "string"` par commodité : ce
 * serait rendre la frappe exprimable à nouveau.
 */
export const OUTIL_REVISION = "proposer_revision";

/**
 * Les arêtes de progression d'une compétence — prérequis et suites.
 *
 * `competences.prerequis` était la seule donnée du référentiel que **aucun
 * écran** ne savait remplir : les deux cadres de la fiche restaient vides, et le
 * graphe avec eux. Un champ de saisie libre aurait laissé écrire un code
 * inexistant ; une liste déroulante aurait interdit ce que la personne demande
 * — qu'un prérequis n'existe pas encore.
 *
 * D'où la forme de cet outil : chaque proposition porte **un intitulé, un
 * palier et un domaine**, et rien d'autre. Le tuteur ne frappe aucun code — s'il
 * reconnaît une compétence de la liste, il le dit dans `codeExistant`, dont
 * l'`enum` est fermé sur les codes du compte ; sinon l'application décide, à
 * l'écriture, entre rattacher un homonyme et créer.
 *
 * `domaineId` est un `enum` des domaines existants, et il compte autant que les
 * codes : sans lui, tout prérequis venu d'ailleurs — les maths d'un problème de
 * logistique — atterrirait dans le domaine de la fiche ouverte, et les domaines
 * grossiraient sans que rien ne l'arbitre. Une proposition sans domaine
 * plaçable n'est pas créée : elle s'affiche comme demandant un domaine neuf.
 */
export const OUTIL_RELATIONS = "proposer_relations";
export const OUTIL_CARTE = "proposer_rattachement_carte";

/**
 * Où une compétence sert (ADR-107) — proposé, jamais posé.
 *
 * Une compétence peut porter plusieurs tags de domaine, et c'est exactement ce
 * qu'une machine range mal : « Lire un tableau de données » sert les
 * statistiques et la logistique, et aucun classement lexical ne le devine sans
 * se tromper une fois sur deux. Le tuteur lit l'intitulé et les domaines du
 * compte, et propose.
 *
 * Deux interdits, du même ordre que ceux de la carte :
 *
 * - **nommer un domaine neuf.** L'`enum` est fermé sur les domaines vivants du
 *   compte, relu côté serveur. Créer un domaine est une commande gouvernée
 *   (ADR-065), pas un effet de bord d'une suggestion ;
 * - **taguer.** L'appel produit une proposition. L'écriture reste le geste
 *   d'une personne (`taguerCompetences`), et rien ne part sans son clic.
 */
export const OUTIL_TAGS = "proposer_tags_competence";

/**
 * La relecture du référentiel entier — ADR-108.
 *
 * `proposer_tags_competence` et `proposer_relations` travaillent **par fiche**,
 * sur clic. À soixante-quinze compétences, personne n'ouvre les soixante-quinze
 * fiches : c'est le constat qui ouvre ADR-108. Cet outil lit le référentiel
 * d'un tenant — les intitulés, l'arbre des domaines, les relations déjà
 * déclarées, le travail récent et les intentions déclarées — et rend un lot.
 *
 * Trois genres, et rien d'autre. Les quatre détecteurs déterministes gardent
 * leur place : ce qu'un calcul explique en une phrase n'a pas à être demandé à
 * un modèle. Le tuteur ne couvre que ce qu'aucun calcul ne voit — la
 * paraphrase, le sujet implicite, le prérequis qu'aucune co-mobilisation n'a
 * encore révélé.
 *
 * Quatre interdits, tous portés par l'`enum` fermé et TOUS revérifiés par
 * `validerRelecture` côté serveur (ADR-031 : le schéma n'est pas la barrière,
 * c'est la première des deux) :
 *
 * - **frapper un code de compétence.** Les codes sont attribués par
 *   l'application (ADR-026). Le tuteur désigne un code existant par `enum`, ou
 *   décrit un savoir-faire en clair sans code ;
 * - **frapper un identifiant de domaine.** `parentId` et `domaineId` sont des
 *   `enum` sur les domaines vivants. Un sous-domaine proposé reçoit son
 *   identifiant et son préfixe de l'application, à l'écriture ;
 * - **toucher la carte des savoirs.** Elle reste fermée (ADR-105) et n'apparaît
 *   pas dans ce schéma ;
 * - **écrire.** L'appel produit un lot de propositions. Chacune s'arbitre
 *   séparément, et l'écriture passe par les commandes gouvernées d'ADR-065.
 */
export const OUTIL_RELECTURE = "proposer_relecture_referentiel";

/**
 * Un référentiel entier — plusieurs branches d'un seul geste.
 *
 * `proposer_referentiel` rend **une** branche. Un sujet un peu large n'en tient
 * pas une seule : « le stoïcisme » se découpe en domaines, et forcer le tuteur à
 * tout mettre dans un domaine produit une branche de vingt compétences que
 * personne ne relit.
 *
 * Aucun champ `code` ici non plus : chaque branche réutilise exactement le
 * schéma de `proposer_referentiel`.
 */
export const OUTIL_REFERENTIEL_COMPLET = "proposer_referentiel_complet";


/**
 * ⚠️ `traduire_intention` — le point d'entrée unique de création.
 *
 * N'entre PAS dans `outilsTuteur` : il n'est armé que sur `POST /api/intention`,
 * où le serveur a déjà fixé les codes actifs et le contexte du compte. Le
 * confiner à sa route est la même règle que pour `outilCorrection` — un outil
 * de création n'est jamais monté sur le chemin de résolution.
 *
 * Même distinction frapper / désigner : `codes` est un `enum` fermé sur les
 * codes actifs du compte entier — un besoin exprimé traverse les domaines par
 * construction. Aucun champ de code en écriture libre. Le genre `referentiel`
 * ne porte qu'un `sujet` en clair, jamais un code : quand le sujet n'existe pas
 * encore, il n'y a rien à désigner, et c'est la proposition de branche
 * (`proposer_referentiel`) qui prendra le relais après validation humaine.
 *
 * ⚠️ Ne pas « simplifier » cet `enum` en `type: "string"` : ce serait rendre la
 * frappe de code exprimable sur le chemin le plus emprunté de l'application.
 */
export const OUTIL_INTENTION = "traduire_intention";

/**
 * Outil confiné de la boucle adaptative.
 *
 * Il n'est jamais ajouté à `outilsTuteur` : le serveur l'arme pour une requête
 * one-shot après avoir fixé les cibles, les contraintes, les ressources et le
 * contrat d'évaluation. Le tuteur ne peut donc produire que le contenu du
 * workspace. Il n'écrit ni activité, ni évaluation finale, ni observation.
 */
export const OUTIL_MINI_PROJET_ADAPTATIF = "proposer_mini_projet_adaptatif";
export const OUTIL_EVALUATION_EXPLICATION = "proposer_evaluation_explication";

/**
 * Outil confiné du protocole de traitement d'un cours (ADR-130).
 *
 * Il n'entre PAS dans `outilsTuteur` : le serveur l'arme sur sa seule route
 * (`/api/protocole/generer`), après avoir fixé l'intention déclarée et les
 * codes actifs du compte. Le tuteur propose un plan de séances — du contenu,
 * jamais une mesure (ADR-037) — et n'en frappe aucun code : `codes` est un
 * `enum` fermé sur le référentiel actif, même distinction frapper / désigner
 * que `traduire_intention`.
 */
export const OUTIL_PROTOCOLE_COURS = "proposer_protocole_cours";

export type FamilleContenuAdaptatif = "produire";

/**
 * Sous-ensemble de JSON Schema effectivement employé ici.
 *
 * Volontairement pauvre : ce qui n'est pas exprimable dans ce type n'est pas
 * exprimé dans un schéma non plus, et se valide donc en TypeScript ci-dessous,
 * là où la garantie est réelle.
 */
export interface SchemaJson {
  type: "object" | "string" | "integer" | "number" | "array" | "boolean";
  description?: string;
  enum?: string[];
  minimum?: number;
  maximum?: number;
  minItems?: number;
  /**
   * Plafond du nombre d'entrées. Le schéma l'annonce ; `validerCorrection` le
   * revérifie — un fournisseur qui ignore la contrainte ne doit pas passer.
   */
  maxItems?: number;
  /**
   * Longueur maximale d'une chaîne. Le schéma l'annonce ; la conversion la
   * revérifie (`motifsRefusStructure`) — un fournisseur qui l'ignore ne doit
   * pas passer. Même contrat que `maxItems` ci-dessus.
   */
  maxLength?: number;
  items?: SchemaJson;
  properties?: Record<string, SchemaJson>;
  required?: string[];
  additionalProperties?: boolean;
}

/** Définition d'outil indépendante du fournisseur. Chaque moteur la traduit. */
export interface OutilTuteur {
  nom: string;
  description: string;
  schema: SchemaJson;
}

const DIMENSIONS = [
  "comprehension",
  "application",
  "transfert",
  "integration",
  "justification",
] as const;

const TYPES_EXERCICE = [
  "rappel",
  "application",
  "calcul",
  "probleme",
  "etude-de-cas",
  "programmation",
  "simulation",
  "projet",
] as const;

const PALIERS = ["fondamentaux", "intermediaire", "avance"] as const;

const INTENTIONS = ["decouverte", "consolidation", "transfert", "revision"] as const;

/* ------------------------------------------------------------------ */
/* Les trois schémas                                                   */
/* ------------------------------------------------------------------ */

/**
 * Le schéma d'exercice dépend du référentiel du compte : la liste des domaines
 * y entre en `enum`. Un domaine inventé cesse d'être une consigne de prompt
 * pour devenir une valeur que le schéma n'admet pas.
 *
 * Les codes de compétence, eux, ne sont PAS énumérés : un référentiel peut en
 * porter des centaines, et les répéter dans le schéma à chaque message coûterait
 * plus que le gabarit qu'on retire. Ils restent validés en aval, contre le
 * référentiel, comme avant (`chat.tsx`, puis le formulaire).
 */
function schemaExercice(domaines: string[]): SchemaJson {
  return {
    type: "object",
    properties: {
      titre: { type: "string" },
      domaine:
        domaines.length > 0
          ? { type: "string", enum: domaines }
          : { type: "string", description: "Identifiant du domaine." },
      type: { type: "string", enum: [...TYPES_EXERCICE] },
      // Pas de description : la règle 2 du cadre d'intervention dit déjà que la
      // difficulté vient du bloc CALIBRAGE. La répéter ici la ferait payer deux
      // fois, et diverger au premier changement.
      difficulte: { type: "integer", minimum: DIFFICULTE_MIN, maximum: DIFFICULTE_MAX },
      competences: {
        type: "array",
        minItems: 1,
        items: { type: "string" },
        description: "Codes du profil ; la première est la cible.",
      },
      duree_estimee_min: {
        type: "integer",
        minimum: DUREE_ESTIMEE_MIN,
        maximum: DUREE_ESTIMEE_MAX,
      },
      enonce: {
        type: "string",
        // Les énoncés produits renvoyaient à des formules qu'ils ne donnaient
        // pas : la personne devait aller les chercher ailleurs, et l'exercice
        // mesurait alors sa capacité à retrouver une référence plutôt que la
        // compétence visée. La consigne voyage avec l'outil, donc à chaque
        // message — contrairement à une phrase de protocole chargée sur
        // mots-clés.
        description:
          "Auto-suffisant : toutes les formules, constantes, données chiffrées et unités nécessaires à la résolution figurent dans l'énoncé. La personne ne doit avoir à chercher aucune information ailleurs. Exception : quand retrouver soi-même la formule EST la compétence évaluée — dis-le alors explicitement dans l'énoncé.",
      },
      indices: {
        type: "array",
        items: { type: "string" },
        description: "Du plus léger au plus explicite.",
      },
      correction: { type: "string" },
      criteres: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          properties: {
            dimension: { type: "string", enum: [...DIMENSIONS] },
            libelle: { type: "string", description: "Ce que l'utilisateur doit pouvoir cocher." },
          },
          required: ["dimension", "libelle"],
          additionalProperties: false,
        },
      },
      // Optionnel, volontairement absent du bloc CALIBRAGE : c'est un fait sur
      // la rédaction, pas une mesure — le moteur ne le lit pas.
      intention: {
        type: "string",
        enum: [...INTENTIONS],
        description:
          "Pourquoi cet exercice : decouverte (première exposition), consolidation (refaire à niveau égal), transfert (contexte inédit), revision (reprise après un délai). Omets le champ si aucun n'est net.",
      },
    },
    required: [
      "titre",
      "domaine",
      "type",
      "difficulte",
      "competences",
      "duree_estimee_min",
      "enonce",
      "correction",
      "criteres",
    ],
    additionalProperties: false,
  };
}

const MOTIFS_COHERENCE_MAX = 6;
const MOTIF_COHERENCE_MAX = 500;
const CORRECTION_REPAREE_MAX = 12_000;

function schemaCoherenceExercice(): SchemaJson {
  return {
    type: "object",
    properties: {
      coherent: {
        type: "boolean",
        description:
          "Vrai uniquement si la correction est démontrable à partir de l'énoncé ; au moindre doute, faux.",
      },
      motifs: {
        type: "array",
        maxItems: MOTIFS_COHERENCE_MAX,
        description:
          "Motifs courts et précis. Obligatoires si coherent est faux ; tableau vide si tout est étayé.",
        items: { type: "string", maxLength: MOTIF_COHERENCE_MAX },
      },
    },
    required: ["coherent", "motifs"],
    additionalProperties: false,
  };
}

function schemaReparationCorrectionExercice(): SchemaJson {
  return {
    type: "object",
    properties: {
      correction: {
        type: "string",
        maxLength: CORRECTION_REPAREE_MAX,
        description:
          "Correction complète réécrite uniquement à partir de l'énoncé. Ne modifie pas l'énoncé et ne transforme pas une hypothèse en fait établi.",
      },
    },
    required: ["correction"],
    additionalProperties: false,
  };
}

/**
 * ⚠️ Aucun champ `code` ici, et ce n'est pas un oubli.
 *
 * Le code est la clé étrangère des observations. L'application l'attribue depuis le
 * préfixe du domaine (ADR-026). Un code écrit par le tuteur entrerait en
 * collision avec un code existant et les observations suivraient la mauvaise
 * compétence, sans erreur visible. Le prompt l'interdisait ; le schéma le rend
 * inexprimable.
 */
function schemaReferentiel(minCompetences = 1): SchemaJson {
  return {
    type: "object",
    properties: {
      domaine: { type: "string", description: "Domaine existant, ou nouvelle branche." },
      prefixe: { type: "string", description: "2 à 5 majuscules ; ignoré si le domaine existe." },
      description: { type: "string", description: "Une phrase : ce que la branche couvre." },
      competences: {
        type: "array",
        minItems: minCompetences,
        items: {
          type: "object",
          properties: {
            palier: { type: "string", enum: [...PALIERS] },
            importance: { type: "number", minimum: 0, maximum: 1 },
            // L'intitulé n'est plus une phrase libre — ADR-086.
            //
            // Un `enum` fermé de verbes, un objet borné, une précision bornée.
            // C'est le seul garde-fou d'atomicité qui ne se contourne pas : un
            // modèle ne peut pas écrire « Modéliser ET résoudre … ET évaluer »
            // dans un champ qui n'accepte qu'un verbe. Même mécanique que les
            // codes, qu'il désigne sans jamais les frapper (ADR-026/031/043).
            //
            // C'est l'APPLICATION qui assemble la phrase (`composerIntitule`),
            // si bien que deux compétences proposées dans deux échanges
            // différents s'écrivent de la même façon.
            verbeAction: {
              type: "string",
              enum: [...VERBES_ACTION],
              description: "Un seul verbe. Deux verbes, ce sont deux compétences.",
            },
            /*
             * Le budget est répété dans la DESCRIPTION, pas seulement dans
             * `maxLength`.
             *
             * Mesuré le 21/08/2026 : `mistral-large-latest` ignore `maxLength`
             * et rend des objets de 56 caractères et des précisions de 39. Les
             * seize compétences d'une proposition étaient alors refusées une à
             * une, la proposition entière tombait, et l'écran affichait
             * « Aucun référentiel exploitable n'a été produit » — un refus
             * total pour une contrainte que le modèle n'avait jamais lue en
             * français. Un même modèle respecte la borne quand elle est écrite
             * dans la phrase.
             */
            objet: {
              type: "string",
              maxLength: OBJET_MAX,
              description: `Un seul objet, sans énumération, ${OBJET_MAX} caractères MAXIMUM. Ex. « un stock de sécurité ». Trop long = compétence refusée.`,
            },
            precision: {
              type: "string",
              maxLength: PRECISION_MAX,
              description: `Facultatif : la condition qui borne l'objet, ${PRECISION_MAX} caractères MAXIMUM — deux ou trois mots. Ex. « sous demande variable ». Jamais une 2e compétence. Trop long = compétence refusée ; dans le doute, omets ce champ.`,
            },
          },
          required: ["palier", "importance", "verbeAction", "objet"],
          additionalProperties: false,
        },
        description: "Du plus fondamental au plus avancé.",
      },
      justification: { type: "string", description: "Ce que l'utilisateur a dit ou fait." },
    },
    required: ["domaine", "description", "competences", "justification"],
    additionalProperties: false,
  };
}

/**
 * Le schéma de correction dépend de l'exercice : le nombre de critères y entre
 * en borne haute du numéro de critère.
 *
 * Borner par le schéma plutôt que par une phrase du prompt n'est pas un détail
 * de style. « Numérote de 1 à 5 » est une consigne qu'un modèle peut manquer ;
 * `maximum: 5` est une valeur que le schéma n'admet pas. C'est la même
 * bascule que celle du domaine en `enum` dans `schemaExercice` — une consigne
 * de prompt devenue contrainte de structure.
 *
 * `valeur` est un `enum` de chaînes et non un nombre : `SchemaJson.enum` est
 * déclaré `string[]`, et l'élargir toucherait l'interface partagée par les deux
 * moteurs pour un besoin local. C'est déjà l'habitude de la maison —
 * `PropositionExercice.difficulte` est une chaîne. La conversion explicite
 * existe de toute façon en aval (`conversion-correction.ts`).
 */
function schemaCorrection(nombreDeCriteres: number): SchemaJson {
  return {
    type: "object",
    properties: {
      resultat: {
        type: "string",
        enum: RESULTATS.map((r) => r.valeur),
        // Les aides viennent de `lib/domain/bilan.ts`, donc du même texte que
        // celui affiché sous chaque bouton du formulaire. Deux échelles qui
        // divergent ne lèveraient aucune erreur : elles produiraient une
        // mesure fausse et silencieuse.
        description: RESULTATS.map((r) => `${r.valeur} = ${r.aide}`).join(" · "),
      },
      appreciations: {
        type: "array",
        minItems: 1,
        description:
          "Une entrée par critère, exactement : ni plus, ni moins. Un critère non couvert fait rejeter la correction entière.",
        items: {
          type: "object",
          properties: {
            critere: {
              type: "integer",
              minimum: 1,
              maximum: Math.max(1, nombreDeCriteres),
              description: "Numéro du critère, dans l'ordre où il t'a été donné.",
            },
            valeur: {
              type: "string",
              enum: APPRECIATIONS.map((a) => String(a.valeur)),
              description: APPRECIATIONS.map((a) => `${a.valeur} = ${a.libelle}`).join(" · "),
            },
            justification: {
              type: "string",
              description: `Une à deux phrases citant ce que la réponse contient ou omet. Ne recopie pas la correction. ${JUSTIFICATION_MAX} caractères au maximum.`,
            },
          },
          required: ["critere", "valeur", "justification"],
          additionalProperties: false,
        },
      },
      bilan: {
        type: "object",
        description:
          "Ton retour d'ensemble, adressé à la personne. Il ne porte aucune note : il explique et il oriente.",
        properties: {
          points_forts: {
            type: "string",
            description: `Ce qui est réellement acquis dans CETTE réponse, cité. Si rien ne l'est, dis-le plutôt que d'encourager à vide. ${FEEDBACK_MAX} caractères au maximum.`,
          },
          points_bloquants: {
            type: "string",
            description: `Ce qui ne va pas ET pourquoi c'est un problème — l'erreur, puis ce qu'elle empêche. Nomme l'incompréhension, pas seulement le symptôme. ${FEEDBACK_MAX} caractères au maximum.`,
          },
          a_retravailler: {
            type: "array",
            minItems: 1,
            maxItems: RETRAVAILLER_ITEMS_MAX,
            description:
              "Points à reprendre, formulés sur la PERSONNE et non sur cet exercice — « confond médiane et moyenne », pas « question 3 fausse ». Ce sont les seuls éléments que tu reverras plus tard : écris-les pour ton toi futur.",
            items: {
              type: "string",
              description: `Un point, court et autonome. ${RETRAVAILLER_MAX} caractères au maximum.`,
            },
          },
        },
        required: ["points_forts", "points_bloquants", "a_retravailler"],
        additionalProperties: false,
      },
    },
    required: ["resultat", "appreciations", "bilan"],
    additionalProperties: false,
  };
}

const JALONS_ACTIVITE_MAX = 12;
const ETAPES_WORKSPACE_MAX = 12;
const CONSEILS_PROJET_MAX = 8;

function schemaJalonsActivite(): SchemaJson {
  return {
    type: "array",
    minItems: 1,
    maxItems: JALONS_ACTIVITE_MAX,
    items: {
      type: "object",
      properties: {
        titre: { type: "string" },
        consigne: { type: "string" },
        resultat_attendu: {
          type: "string",
          description:
            "Production observable attendue à ce jalon. Ce jalon décrit une production, jamais une Observation par lui-même.",
        },
      },
      required: ["titre", "consigne", "resultat_attendu"],
      additionalProperties: false,
    },
  };
}

function schemaMiniProjetAdaptatif(): SchemaJson {
  return {
    type: "object",
    properties: {
      titre: { type: "string" },
      description: { type: "string" },
      brief: { type: "string" },
      jalons: schemaJalonsActivite(),
      workspace: {
        type: "object",
        properties: {
          demarrage: { type: "string" },
          canevas_artefact: {
            type: "array",
            minItems: 1,
            maxItems: ETAPES_WORKSPACE_MAX,
            items: {
              type: "object",
              properties: {
                section: { type: "string" },
                consigne: { type: "string" },
              },
              required: ["section", "consigne"],
              additionalProperties: false,
            },
          },
          conseils_realisation: {
            type: "array",
            maxItems: CONSEILS_PROJET_MAX,
            items: { type: "string" },
          },
          consigne_soumission: { type: "string" },
        },
        required: [
          "demarrage",
          "canevas_artefact",
          "conseils_realisation",
          "consigne_soumission",
        ],
        additionalProperties: false,
      },
    },
    required: ["titre", "description", "brief", "jalons", "workspace"],
    additionalProperties: false,
  };
}

/**
 * L'outil de correction, pour un exercice donné.
 *
 * Rendu séparément et **jamais** ajouté à `outilsTuteur` : c'est ce qui le tient
 * hors du chat, et donc ce qui borne l'exception à ADR-036 (voir
 * `OUTIL_CORRECTION`).
 */
export function outilCorrection(
  criteres: { dimension: string; libelle: string }[],
): OutilTuteur {
  return {
    nom: OUTIL_CORRECTION,
    description:
      "Rends ton verdict sur la réponse de l'utilisateur, critère par critère. Tu n'enregistres rien : l'utilisateur relit ton verdict et le valide, le modifie, ou le rejette. Juge ce que la réponse CONTIENT ; ce qui n'y figure pas n'est pas démontré.",
    schema: schemaCorrection(criteres.length),
  };
}

/**
 * Outil one-shot de contenu adaptatif. Le serveur fixe le contrat avant
 * l'appel ; il n'apparaît dans aucun champ modifiable du schéma.
 */
export function outilGenerationActivite(): OutilTuteur {
  return {
    nom: OUTIL_MINI_PROJET_ADAPTATIF,
    description:
      "Rédige uniquement le contenu d'un mini-projet dont les cibles, ressources et critères sont déjà fixés par le serveur. Tu n'enregistres rien et tu ne notes rien.",
    schema: schemaMiniProjetAdaptatif(),
  };
}

/**
 * L'outil du protocole de traitement d'un cours (ADR-130).
 *
 * Le serveur fixe l'intention déclarée, le texte du cours et l'enum des codes
 * actifs ; le tuteur ne remplit que les champs éditoriaux du plan. La
 * description porte les bornes que le validateur (`motifRefusProtocole`)
 * revérifie de toute façon : un fournisseur qui ignore le schéma ne passe pas.
 */
export function outilProtocoleCours(codesActifs: string[]): OutilTuteur {
  return {
    nom: OUTIL_PROTOCOLE_COURS,
    description: `Propose un plan de 1 à ${SEANCES_PROTOCOLE_MAX} séances pour travailler un cours, du plus fondamental au plus avancé. Chaque séance vise 1 à ${CODES_SEANCE_PROTOCOLE_MAX} compétences de la liste fournie — tu n'inventes aucun code et tu n'évalues rien.`,
    schema: {
      type: "object",
      properties: {
        resume: {
          type: "string",
          maxLength: 1_000,
          description:
            "Une à trois phrases : comment le plan couvre le cours et sert l'intention déclarée.",
        },
        seances: {
          type: "array",
          minItems: 1,
          maxItems: SEANCES_PROTOCOLE_MAX,
          items: {
            type: "object",
            properties: {
              titre: {
                type: "string",
                maxLength: 120,
                description: "Titre court de la séance, lisible tel quel.",
              },
              dimension: {
                type: "string",
                enum: [...DIMENSIONS_SEANCE],
                description:
                  "comprehension = vérifier que les notions sont comprises ; application = les appliquer à des exercices typiques ; contextualisation = les transposer à des cas nouveaux ; memorisation = fixer les points clés.",
              },
              codes: {
                type: "array",
                minItems: 1,
                maxItems: CODES_SEANCE_PROTOCOLE_MAX,
                items: { type: "string", enum: codesActifs },
                description: "Les compétences visées, choisies dans la liste fournie.",
              },
              consigne: {
                type: "string",
                maxLength: 600,
                description:
                  "Ce que la séance fait faire, en une à trois phrases, ancré dans le contenu du cours.",
              },
              dureeCibleMin: {
                type: "integer",
                minimum: 5,
                maximum: 480,
                description:
                  "Durée cible en minutes. Au moins 5 minutes par compétence visée.",
              },
            },
            required: ["titre", "dimension", "codes", "consigne", "dureeCibleMin"],
            additionalProperties: false,
          },
        },
      },
      required: ["resume", "seances"],
      additionalProperties: false,
    },
  };
}

/**
 * Outil one-shot d'évaluation de compréhension d'un concept par auto-explication.
 */
export function outilEvaluationExplication(): OutilTuteur {
  return {
    nom: OUTIL_EVALUATION_EXPLICATION,
    description:
      "Évalue l'auto-explication d'un concept par l'apprenant. Vérifie la compréhension réelle, les points clés maîtrisés et les éléments manquants.",
    schema: {
      type: "object",
      properties: {
        resultat: {
          type: "string",
          enum: [...RESULTATS_TENTATIVE],
          description: "reussi = concept compris et expliqué correctement ; partiel = intuition présente mais imprécisions importantes ; echec = contre-sens ou hors sujet",
        },
        score_comprehension: {
          type: "number",
          description: "Note de 0.0 à 1.0 évaluant la clarté et l'exactitude de la compréhension conceptuelle.",
        },
        score_justification: {
          type: "number",
          description: "Note de 0.0 à 1.0 évaluant la capacité à expliquer le pourquoi et le comment.",
        },
        points_cles: {
          type: "array",
          items: { type: "string" },
          description: "Aspects clés du concept qui ont été correctement expliqués.",
        },
        points_manquants: {
          type: "array",
          items: { type: "string" },
          description: "Aspects importants omis, imprécis ou erronés.",
        },
        feedback_formatif: {
          type: "string",
          description: "Commentaire pédagogique concis et constructif.",
        },
        conseil_suivant: {
          type: "string",
          description: "Conseil court pour l'étape suivante.",
        },
      },
      required: [
        "resultat",
        "score_comprehension",
        "score_justification",
        "points_cles",
        "points_manquants",
        "feedback_formatif",
        "conseil_suivant",
      ],
    },
  };
}

/**
 * L'outil de proposition d'un référentiel complet.
 *
 * Chaque branche réutilise `schemaReferentiel()` — un seul endroit définit ce
 * qu'est une branche, et l'interdit du champ `code` en hérite gratuitement.
 */
/**
 * Plafond de branches quand le compte a déjà des domaines — ADR-104.
 *
 * Le défaut est mesuré : un seul sujet, « les LLM », a produit **cinq domaines
 * et 40 compétences, aucune mesurée**, soit 43 % du référentiel actif, pendant
 * que deux autres domaines restaient vides. Le prompt demandait « trois à six
 * branches pour un sujet large » et le tuteur a lu « branche » comme
 * « domaine ».
 *
 * Le plafond est porté par le SCHÉMA, pas par la consigne : `maxItems` ne se
 * contourne pas, une phrase si. Deux et non un — un sujet réellement double
 * existe — mais le découpage au-delà part en domaines neufs explicites,
 * sans préfixe de code imposé ni gouvernance supplémentaire.
 *
 * Sur un compte VIDE le plafond ne s'applique pas : il n'y a alors rien à
 * surcharger, et l'amorçage a besoin de poser la structure d'un coup.
 */
export const BRANCHES_MAX_COMPTE_ETABLI = 2;

export function outilReferentielComplet(
  referentiel?: Referentiel,
  sujet = "",
): OutilTuteur {
  const domainesVivants = (referentiel?.domaines ?? []).filter((d) => !d.archive).length;
  const cadrage = analyserDemandeReferentiel(sujet);
  const vueEnsemble = cadrage.portee === "large";
  const branches: SchemaJson = {
    type: "array",
    minItems: vueEnsemble ? 2 : 1,
    items: schemaReferentiel(vueEnsemble ? 3 : 1),
    ...(domainesVivants > 0 ? { maxItems: BRANCHES_MAX_COMPTE_ETABLI } : {}),
  };

  return {
    nom: OUTIL_REFERENTIEL_COMPLET,
    description:
      domainesVivants > 0
        ? `Propose un référentiel pour un sujet. Ce compte a déjà ${domainesVivants} domaine(s) : n'en crée pas plus de ${BRANCHES_MAX_COMPTE_ETABLI}. Pour découper un sujet large, rattache les compétences à un domaine existant ou à un seul domaine neuf. L'application attribue tous les codes.${vueEnsemble ? " Cette demande est une vue d'ensemble : renvoie au moins deux branches et trois compétences observables par branche." : ""}`
        : `Propose un référentiel complet pour un sujet, découpé en branches cohérentes. Une branche par grand domaine : ne mets pas vingt compétences dans un seul domaine, et n'en fais pas dix pour un sujet qui en tient trois. L'application attribue tous les codes.${vueEnsemble ? " Cette demande est une vue d'ensemble : renvoie au moins deux branches et trois compétences observables par branche." : ""}`,
    schema: {
      type: "object",
      properties: {
        resume: {
          type: "string",
          description:
            "Une à trois phrases : comment tu as découpé le sujet, et pourquoi ce découpage.",
        },
        branches,
      },
      required: ["resume", "branches"],
      additionalProperties: false,
    },
  };
}

/**
 * L'outil de révision d'une branche existante.
 *
 * `codesVivants` est l'ensemble fermé des identifiants **déjà attribués** dans
 * ce domaine — voir `OUTIL_REVISION` pour la distinction frapper / désigner.
 * Le préfixe du domaine n'est pas modifiable : il engendre les codes.
 */
/**
 * L'outil des relations — voir `OUTIL_RELATIONS` pour le pourquoi de la forme.
 *
 * Deux `enum` fermés, pour deux interdits différents :
 *
 * - `codeExistant` sur les codes actifs du compte : désigner sans frapper ;
 * - `domaineId` sur les domaines existants : placer sans en inventer.
 *
 * Le second est celui qu'on serait tenté d'ouvrir « pour laisser le tuteur
 * proposer un domaine ». Ce serait rendre l'inflation exprimable.
 */
export function outilsRelations(codesActifs: string[], domainesIds: string[]): OutilTuteur {
  const codeExistant: SchemaJson =
    codesActifs.length > 0
      ? {
          type: "string",
          enum: codesActifs,
          description:
            "Code d'une compétence déjà au référentiel, si cette relation en désigne une. Sinon, omets ce champ.",
        }
      : { type: "string", description: "Aucune compétence existante à désigner." };

  const domaineId: SchemaJson =
    domainesIds.length > 0
      ? {
          type: "string",
          enum: domainesIds,
          description:
            "Domaine existant où cette compétence doit vivre. Omets ce champ si aucun ne convient — n'en invente pas.",
        }
      : { type: "string", description: "Aucun domaine existant." };

  const relation: SchemaJson = {
    type: "object",
    // Aucun champ pour frapper un code neuf : l'interdit d'ADR-026/031 tient.
    properties: {
      codeExistant,
      intitule: {
        type: "string",
        description: "Savoir-faire observable, pas un sujet. Obligatoire, même si tu désignes un code.",
      },
      palier: { type: "string", enum: [...PALIERS] },
      domaineId,
      justification: {
        type: "string",
        description: "Une phrase : pourquoi cette relation, en partant de la compétence lue.",
      },
    },
    required: ["intitule", "palier", "justification"],
    additionalProperties: false,
  };

  return {
    nom: OUTIL_RELATIONS,
    description:
      "Propose les prérequis et les suites logiques d'une compétence. Tu n'écris rien : la personne valide chaque relation séparément. Les compétences que tu proposes peuvent ne pas encore exister — leur code sera attribué par l'application. Tu ne peux désigner que des codes et des domaines de la liste.",
    schema: {
      type: "object",
      properties: {
        resume: {
          type: "string",
          description: "Une à trois phrases : la logique de progression que tu proposes.",
        },
        prerequis: {
          type: "array",
          maxItems: MAX_RELATIONS_PROPOSEES,
          items: relation,
          description: "Ce qu'il faut savoir faire AVANT la compétence lue.",
        },
        suivantes: {
          type: "array",
          maxItems: MAX_RELATIONS_PROPOSEES,
          items: relation,
          description: "Ce que la compétence lue ouvre, une fois acquise.",
        },
      },
      /*
       * Les deux listes sont exigées, à la différence d'`OUTIL_REVISION` où les
       * sections sont facultatives parce qu'une révision peut ne toucher qu'un
       * champ. Ici l'outil est seul armé, donc `tool_choice` force l'appel : un
       * modèle qui ne rend que les champs obligatoires renvoyait `resume` et
       * rien d'autre, et la validation rejetait l'appel entier — « le tuteur
       * n'a proposé aucune relation exploitable » alors qu'il avait répondu.
       * Une liste vide reste exprimable, et se lit comme « rien de ce côté ».
       */
      required: ["resume", "prerequis", "suivantes"],
      additionalProperties: false,
    },
  };
}

/**
 * L'outil qui situe un domaine sur la carte des savoirs.
 *
 * Un seul rattachement est demandé, pas une liste : un domaine occupe une
 * place, et proposer trois places reviendrait à renvoyer l'arbitrage à la
 * personne sans l'avoir aidée. Quand le tuteur hésite vraiment, il le dit dans
 * sa justification.
 *
 * L'`enum` est fermé côté serveur. Un `enum` vide n'admettrait aucune valeur :
 * on retombe alors sur une chaîne libre que `validerRattachementCarte`
 * rejettera de toute façon, faute de nœud connu — même raisonnement que
 * `outilsRevision` sur un domaine vide.
 */
export function outilsRattachementCarte(noeuds: string[]): OutilTuteur {
  const noeud: SchemaJson =
    noeuds.length > 0
      ? {
          type: "string",
          enum: noeuds,
          description: "Identifiant d'une région de la carte des savoirs.",
        }
      : { type: "string", description: "Aucune région disponible." };

  return {
    nom: OUTIL_CARTE,
    description:
      "Propose o\u00f9 situer ce domaine sur la carte partagée des savoirs. Tu n'écris rien : la personne valide ou refuse. Tu ne peux désigner qu'une région de la liste — la carte n'accepte aucun nom neuf.",
    schema: {
      type: "object",
      properties: {
        noeud,
        justification: {
          type: "string",
          description:
            "Une à deux phrases : ce qui, dans ce domaine, relève de cette région. Dis-le si tu hésites entre deux.",
        },
      },
      required: ["noeud", "justification"],
      additionalProperties: false,
    },
  };
}

/**
 * L'outil qui propose où une compétence sert (ADR-107).
 *
 * Une liste, à la différence de la carte : une compétence peut légitimement
 * servir plusieurs domaines, et n'en proposer qu'un forcerait un choix que le
 * modèle n'a pas à faire. Le plafond existe pour la même raison que partout
 * ailleurs — au-delà, on ne relit plus, on coche.
 */
export function outilsTagsCompetence(domainesVivants: string[]): OutilTuteur {
  const domaineId: SchemaJson =
    domainesVivants.length > 0
      ? {
          type: "string",
          enum: domainesVivants,
          description: "Identifiant d'un domaine existant du compte.",
        }
      : { type: "string", description: "Aucun domaine existant." };

  return {
    nom: OUTIL_TAGS,
    description:
      "Propose les domaines où cette compétence sert vraiment. Tu n'écris rien : la personne valide ou refuse chaque tag. Tu ne peux désigner que des domaines de la liste — un domaine neuf se crée par une autre commande. Ne propose que ce que l'intitulé justifie : une liste large ne se relit pas.",
    schema: {
      type: "object",
      properties: {
        tags: {
          type: "array",
          maxItems: MAX_TAGS_PROPOSES,
          items: {
            type: "object",
            properties: {
              domaineId,
              justification: {
                type: "string",
                description:
                  "Une phrase : ce que cette compétence apporte à ce domaine. Sans motif, la personne ne peut pas arbitrer.",
              },
            },
            required: ["domaineId", "justification"],
            additionalProperties: false,
          },
        },
      },
      // Une liste vide reste exprimable, et se lit comme « aucun domaine
      // existant ne convient » — ce qui est une réponse, pas un échec.
      required: ["tags"],
      additionalProperties: false,
    },
  };
}

/**
 * L'outil qui relit le référentiel entier (ADR-108).
 *
 * ## Pourquoi un seul outil et non trois
 *
 * Les quatre genres du tuteur se contredisent utilement. Proposer un sous-domaine
 * « Gestion kanban » et proposer d'ajouter une compétence kanban sont deux
 * lectures du même signal ; les demander en trois appels séparés produirait
 * trois lots qui s'ignorent, et la personne arbitrerait trois fois la même
 * observation. Un appel, un lot, une lecture cohérente.
 *
 * ## Ce que les `enum` ferment, et ce qu'ils laissent ouvert
 *
 * `codeExistant`, `parentId` et `domaineId` sont fermés sur le référentiel réel
 * du compte, construits ici et **revalidés** par `validerRelecture`. Restent
 * ouverts, et c'est voulu : les intitulés et les justifications. Un savoir-faire
 * que le référentiel ne porte pas encore n'a pas de code à désigner — c'est tout
 * l'objet du genre `manque` —, et son code lui sera attribué par l'application
 * si la personne le retient (ADR-026).
 *
 * ## Les plafonds
 *
 * Ce ne sont pas des seuils de déclenchement — ADR-108 en écarte explicitement
 * le principe, et c'est la version du domaine qui périme, pas un nombre. Ce sont
 * des plafonds de **lecture**, la convention déjà posée par `MAX_TAGS_PROPOSES`
 * et `MAX_RELATIONS_PROPOSEES` : au-delà, on ne relit plus un lot, on le coche.
 */
export function outilsRelecture(
  codesVivants: string[],
  domainesVivants: string[],
  sourcesProgression: {
    codesMaitrises: string[];
    intentions: Array<"moyen" | "long">;
  } = { codesMaitrises: [], intentions: [] },
): OutilTuteur {
  const codeExistant: SchemaJson =
    codesVivants.length > 0
      ? {
          type: "string",
          enum: codesVivants,
          description:
            "Code d'une compétence déjà au référentiel, si tu en désignes une. Omets ce champ pour décrire une compétence qui n'existe pas encore.",
        }
      : { type: "string", description: "Aucune compétence existante à désigner." };

  const domaineId: SchemaJson =
    domainesVivants.length > 0
      ? {
          type: "string",
          enum: domainesVivants,
          description: "Identifiant d'un domaine existant du compte. N'en invente aucun.",
        }
      : { type: "string", description: "Aucun domaine existant." };

  const competenceDesignee: SchemaJson = {
    type: "object",
    // Aucun champ pour frapper un code neuf : l'interdit d'ADR-026/031 tient.
    properties: {
      codeExistant,
      intitule: {
        type: "string",
        description:
          "Savoir-faire observable, pas un sujet. Obligatoire, même quand tu désignes un code existant.",
      },
      palier: { type: "string", enum: [...PALIERS] },
    },
    required: ["intitule", "palier"],
    additionalProperties: false,
  };

  const sourceProgression: SchemaJson = {
    type: "object",
    description:
      "Le fait nouveau qui justifie d'aller plus loin. Utilise maitrise avec un code fourni, ou intention avec la portée fournie.",
    properties: {
      type: { type: "string", enum: ["maitrise", "intention"] },
      codeExistant: sourcesProgression.codesMaitrises.length > 0
        ? {
            type: "string",
            enum: sourcesProgression.codesMaitrises,
            description: "Obligatoire avec type maitrise ; omis avec type intention.",
          }
        : { type: "string", description: "Aucune maîtrise nouvelle n'est disponible." },
      portee: sourcesProgression.intentions.length > 0
        ? {
            type: "string",
            enum: sourcesProgression.intentions,
            description: "Obligatoire avec type intention ; omis avec type maitrise.",
          }
        : { type: "string", description: "Aucune intention nouvelle n'est disponible." },
    },
    required: ["type"],
    additionalProperties: false,
  };

  return {
    nom: OUTIL_RELECTURE,
    description:
      "Relis le référentiel entier et propose comment il pourrait se ranger et s'étendre. Tu n'écris rien : chaque proposition s'affiche seule et la personne l'accepte ou la refuse. Tu ne peux désigner que des codes et des domaines de la liste — un identifiant neuf se crée par une autre commande.",
    schema: {
      type: "object",
      properties: {
        scissions: {
          type: "array",
          maxItems: MAX_SCISSIONS_PROPOSEES,
          description:
            "Des sous-domaines à tirer d'un domaine existant, quand il porte visiblement plusieurs sujets distincts.",
          items: {
            type: "object",
            properties: {
              parentId: domaineId,
              nom: {
                type: "string",
                description:
                  "Nom du sous-domaine, tel qu'une personne le lirait. Pas d'identifiant, pas de préfixe : l'application les attribue.",
              },
              description: {
                type: "string",
                description: "Une phrase : ce que ce sous-domaine regroupe.",
              },
              codes: {
                type: "array",
                items: codeExistant,
                description:
                  "Les compétences existantes qui iraient dans ce sous-domaine. Uniquement des codes de la liste.",
              },
              justification: {
                type: "string",
                description:
                  "Une à deux phrases : ce qui, dans ces intitulés, forme un sujet à part. Cite ce que tu as lu.",
              },
            },
            required: ["parentId", "nom", "description", "codes", "justification"],
            additionalProperties: false,
          },
        },
        relations: {
          type: "array",
          maxItems: MAX_RELATIONS_PROPOSEES,
          description:
            "Des prérequis qu'aucune co-mobilisation n'a encore révélés, à l'échelle du référentiel entier.",
          items: {
            type: "object",
            properties: {
              amont: competenceDesignee,
              aval: competenceDesignee,
              justification: {
                type: "string",
                description: "Une phrase : pourquoi l'amont prépare l'aval.",
              },
              sourceProgression,
            },
            required: ["amont", "aval", "justification"],
            additionalProperties: false,
          },
        },
        manques: {
          type: "array",
          maxItems: MAX_MANQUES_PROPOSES,
          description:
            "Des savoir-faire absents du référentiel que le travail réel ou les intentions déclarées supposent.",
          items: {
            type: "object",
            properties: {
              domaineId,
              intitule: {
                type: "string",
                description: "Savoir-faire observable, pas un sujet ni un titre de cours.",
              },
              palier: { type: "string", enum: [...PALIERS] },
              ancrage: {
                type: "string",
                description:
                  "La maîtrise nouvellement franchie ou l'intention nouvellement modifiée qui appelle ce savoir-faire. Cite-la. Sans cet ancrage, ce n'est pas une proposition, c'est un programme.",
              },
              justification: {
                type: "string",
                description: "Une phrase : ce que cette compétence ouvrirait.",
              },
              sourceProgression,
            },
            required: ["domaineId", "intitule", "palier", "ancrage", "justification", "sourceProgression"],
            additionalProperties: false,
          },
        },
        rattachements: {
          type: "array",
          maxItems: MAX_RATTACHEMENTS_PROPOSES,
          description:
            "Des compétences DÉJÀ au référentiel qui gagneraient à être visibles dans un domaine existant où elles ne le sont pas encore.",
          items: {
            type: "object",
            properties: {
              codeExistant,
              domaineId,
              justification: {
                type: "string",
                description:
                  "Une phrase : ce que cette compétence apporte à ce domaine. Pars de ce que l'intitulé fait faire.",
              },
            },
            required: ["codeExistant", "domaineId", "justification"],
            additionalProperties: false,
          },
        },
      },
      /*
       * Les listes sont exigées, pour la raison déjà rencontrée sur
       * `OUTIL_RELATIONS` : l'outil est seul armé, donc `tool_choice` force
       * l'appel, et un modèle qui ne rend que les champs obligatoires renvoyait
       * un objet vide que la validation rejetait — « le tuteur n'a rien proposé »
       * alors qu'il avait répondu. Une liste vide reste exprimable, et se lit
       * comme « rien de ce côté », ce qui est une réponse.
       */
      required: ["scissions", "relations", "manques", "rattachements"],
      additionalProperties: false,
    },
  };
}

export function outilsRevision(codesVivants: string[]): OutilTuteur {
  // Un `enum: []` n'admettrait aucune valeur et rendrait `modifications` et
  // `retraits` inexprimables — ce qui est correct sur un domaine vide, mais
  // doit rester lisible : on retombe alors sur une chaîne libre que le
  // validateur rejettera de toute façon, faute de code connu.
  const code: SchemaJson =
    codesVivants.length > 0
      ? { type: "string", enum: codesVivants, description: "Code d'une compétence existante." }
      : { type: "string", description: "Aucune compétence existante dans ce domaine." };

  return {
    nom: OUTIL_REVISION,
    description:
      "Propose une révision de cette branche : ajouter, reformuler, retirer. Tu ne l'appliques pas — la personne relit chaque ligne et coche ce qu'elle garde. Les codes des compétences nouvelles sont attribués par l'application ; tu ne peux désigner que des codes existants.",
    schema: {
      type: "object",
      properties: {
        resume: {
          type: "string",
          description:
            "Une à trois phrases : ce que tu changes et pourquoi, en repartant de ce que la personne a demandé.",
        },
        domaine: {
          type: "object",
          properties: {
            nom: { type: "string" },
            description: { type: "string", description: "Une phrase : ce que la branche couvre." },
          },
          additionalProperties: false,
        },
        ajouts: {
          type: "array",
          // Aucun champ `code` : l'interdit d'ADR-026/031 reste intact là où il
          // compte — la frappe d'un identifiant neuf.
          items: {
            type: "object",
            properties: {
              palier: { type: "string", enum: [...PALIERS] },
              importance: { type: "number", minimum: 0, maximum: 1 },
              intitule: { type: "string", description: "Savoir-faire observable, pas un sujet." },
              prerequis: { type: "array", items: code },
              justification: { type: "string" },
            },
            required: ["palier", "importance", "intitule"],
            additionalProperties: false,
          },
        },
        modifications: {
          type: "array",
          description: "Ne mets que les champs qui changent.",
          items: {
            type: "object",
            properties: {
              code,
              intitule: { type: "string" },
              palier: { type: "string", enum: [...PALIERS] },
              importance: { type: "number", minimum: 0, maximum: 1 },
              justification: { type: "string" },
            },
            required: ["code"],
            additionalProperties: false,
          },
        },
        retraits: {
          type: "array",
          description:
            "L'application décide seule entre suppression et archivage, selon les observations enregistrées : ne le propose pas.",
          items: {
            type: "object",
            properties: {
              code,
              justification: {
                type: "string",
                description: "Pourquoi elle n'a plus sa place. Obligatoire.",
              },
            },
            required: ["code", "justification"],
            additionalProperties: false,
          },
        },
      },
      required: ["resume"],
      additionalProperties: false,
    },
  };
}


/**
 * L'outil de traduction d'un besoin exprimé en une action déjà connue.
 *
 * Le schéma porte l'essentiel du cadrage, pas le prompt : les quatre genres sont
 * un `enum`, les codes en sont un autre, et il n'existe aucun champ par lequel
 * une quatrième famille d'action pourrait entrer. Un modèle qui « inventerait »
 * un projet ou une évaluation ne produirait pas un appel valide.
 *
 * `alternatives` n'est pas décoratif : un besoin exprimé en langage libre est
 * souvent ambigu — « je bloque sur les coûts » peut vouloir dire s'entraîner,
 * relire une ressource, ou constater que rien au référentiel ne couvre le
 * sujet. Rendre une seule lecture obligerait l'utilisateur à reformuler pour
 * corriger le tir ; en rendre deux ou trois lui laisse choisir sans réécrire.
 *
 * `codesActifs` peut arriver vide — un compte neuf. Le schéma retombe alors sur
 * une chaîne libre plutôt qu'un `enum: []` invalide ; la validation en aval
 * écarte de toute façon tout code inconnu, donc l'ensemble vide écarte tout.
 * Un compte sans référentiel ne peut produire qu'un `referentiel` ou une
 * `note`, et c'est le résultat voulu.
 */
export function outilIntention(codesActifs: string[]): OutilTuteur {
  const code: SchemaJson =
    codesActifs.length > 0
      ? { type: "string", enum: codesActifs, description: "Code d'une compétence existante." }
      : { type: "string", description: "Aucune compétence active dans ce compte." };

  const action: SchemaJson = {
    type: "object",
    properties: {
      genre: {
        type: "string",
        enum: [...GENRES_INTENTION],
        description:
          "travail = préparer une séance d'entraînement sur des compétences existantes ; projet = produire un artefact qui mobilise plusieurs compétences à la fois ; note = garder une ressource, un PDF, un cours ou un contexte, sans mesure ; referentiel = ajouter ou structurer un sujet absent du référentiel ; clarification = poser une question quand deux destinations restent réellement possibles.",
      },
      titre: {
        type: "string",
        description: "Ce qui sera fait, en une ligne lisible. Pas d'identifiant, pas de code.",
      },
      pourquoi: {
        type: "string",
        description: "Pourquoi cette action répond au besoin exprimé, en une ou deux phrases.",
      },
      codes: {
        type: "array",
        items: code,
        description:
          "Compétences visées pour un travail ciblé. Vide pour une séance générale sans sujet, une note, une extension du référentiel ou une clarification.",
      },
      sujet: {
        type: "string",
        description:
          "Le sujet en clair. Pour referentiel, recopie l’intitulé précis d’une compétence demandée ou la demande complète de domaine (nombre de domaines, granularité, nombre de compétences compris). Pour projet, recopie ce qui sera produit. Pour clarification, écris la question à poser.",
      },
    },
    /*
     * `sujet` n'est PAS requis au schéma, alors qu'il l'est pour un `projet` et
     * une extension de `referentiel`.
     *
     * L'exiger de tous obligeait le modèle à écrire un sujet pour un `travail`
     * qui n'en a pas besoin — un champ à remplir pour rien sur le genre le plus
     * fréquent, et une raison de plus de rater l'appel. La règle par genre est
     * portée par `validerActionIntention`, qui refuse le projet ou l'extension
     * sans sujet : une seule autorité, celle qui sait de quel genre il s'agit.
     */
    required: ["genre", "titre", "pourquoi", "codes"],
    additionalProperties: false,
  };

  return {
    nom: OUTIL_INTENTION,
    description:
      "Traduis le besoin exprimé en une action que le système sait déjà exécuter, ou pose une question si la destination est réellement ambiguë. Tu n'exécutes rien : la personne relit et confirme. Ne rapproche pas de force — si aucune compétence active ne couvre le sujet, dis-le en proposant une extension du référentiel plutôt qu'un travail sur des compétences voisines.",
    schema: {
      type: "object",
      properties: {
        action: action,
        alternatives: {
          type: "array",
          maxItems: 3,
          items: action,
          description: "Autres lectures possibles du même besoin, de la plus au moins probable. Facultatif.",
        },
      },
      // Seule l'action principale est exigée : une traduction sans alternative
      // est complète, et `validerTraductionIntention` traite déjà l'absence.
      required: ["action"],
      additionalProperties: false,
    },
  };
}

/**
 * Les codes actifs tels que le schéma d'intention les a énumérés.
 *
 * On relit l'ensemble effectivement reçu par le fournisseur plutôt qu'une
 * liste parallèle qui pourrait diverger.
 */
function codesDuSchemaIntention(outils: OutilTuteur[]): Set<string> {
  const intention = outils.find((o) => o.nom === OUTIL_INTENTION);
  const codes =
    intention?.schema.properties?.action?.properties?.codes?.items?.enum ?? [];
  return new Set(codes);
}

/**
 * Les codes actifs tels que le schéma du protocole les a énumérés.
 *
 * Même règle que `codesDuSchemaIntention` : on valide contre l'ensemble
 * effectivement reçu par le fournisseur, jamais contre une liste parallèle.
 */
function codesDuSchemaProtocole(outils: OutilTuteur[]): Set<string> {
  const protocole = outils.find((o) => o.nom === OUTIL_PROTOCOLE_COURS);
  const codes =
    protocole?.schema.properties?.seances?.items?.properties?.codes?.items?.enum ?? [];
  return new Set(codes);
}

/*
 * Les modèles recopient rarement les enums à la lettre : un code arrive en
 * minuscules, une dimension accentuée, une durée en chaîne. Comme
 * `convertirProposition` pour l'exercice, on PARSE — on ne fabrique rien :
 * une valeur illisible reste un refus.
 */
function normaliserCodeProtocole(valeur: unknown): string {
  return typeof valeur === "string" ? valeur.trim().toUpperCase() : "";
}

function dimensionNormalisee(valeur: unknown): string | null {
  if (typeof valeur !== "string") return null;
  const n = valeur
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  return (DIMENSIONS_SEANCE as readonly string[]).includes(n) ? n : null;
}

function dureeNormalisee(valeur: unknown): number | null {
  const n =
    typeof valeur === "number"
      ? valeur
      : typeof valeur === "string"
        ? Number.parseInt(valeur.trim(), 10)
        : Number.NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
}

function validerProtocoleCours(
  donnees: Record<string, unknown>,
  codesActifs: Set<string>,
): PropositionRecue | null {
  const resume = typeof donnees.resume === "string" ? donnees.resume : "";
  const seancesBrutes = Array.isArray(donnees.seances) ? donnees.seances : [];
  const seances: ProtocoleCours["seances"] = [];
  for (const brut of seancesBrutes) {
    const o = objet(brut);
    if (!o) return null;
    if (typeof o.titre !== "string") return null;
    const dimension = dimensionNormalisee(o.dimension);
    if (!dimension) return null;
    if (!Array.isArray(o.codes)) return null;
    const codes = o.codes.map(normaliserCodeProtocole).filter(Boolean);
    if (codes.length === 0) return null;
    if (typeof o.consigne !== "string") return null;
    const dureeCibleMin = dureeNormalisee(o.dureeCibleMin);
    if (dureeCibleMin === null) return null;
    seances.push({
      titre: o.titre,
      dimension: dimension as ProtocoleCours["seances"][number]["dimension"],
      codes,
      consigne: o.consigne,
      dureeCibleMin,
    });
  }
  if (seances.length === 0) return null;

  const protocole: ProtocoleCours = { resume, seances };
  if (motifRefusProtocole(protocole, codesActifs)) return null;
  return { genre: "protocole-cours", protocole };
}

/**
 * Les trois outils, pour un référentiel donné.
 *
 * Stable pour un compte tant que son référentiel ne change pas — même propriété
 * que `consignesInterface`, et pour la même raison : ce qui varie d'un message à
 * l'autre casserait le préfixe mis en cache.
 */
export function outilsTuteur(referentiel: Referentiel): OutilTuteur[] {
  const domaines = referentiel.domaines
    .filter((d) => referentiel.actifs.some((s) => s.domaine === d.id))
    .map((d) => d.id);

  return [
    {
      nom: OUTIL_EXERCICE,
      description:
        "Propose un exercice à ajouter au corpus. Tu ne l'ajoutes pas : l'utilisateur le valide.",
      schema: schemaExercice(domaines),
    },
    {
      nom: OUTIL_REFERENTIEL,
      description:
        // Les cinq conditions de mesurabilité vivaient dans `consignesInterface`,
        // à chaque message, ET au protocole de référentiel §2. Les retirer du
        // premier suffisait presque : le protocole n'est chargé que sur
        // mots-clés, et « je veux bosser la thermodynamique » n'en porte aucun.
        // Leur place est ici — la description part avec l'outil, donc toujours.
        `Propose une branche de compétences quand le sujet demandé n'existe pas encore au référentiel. L'application attribue les codes. Chaque intitulé doit être mesurable : ${PHRASE_MESURABILITE}.`,
      schema: schemaReferentiel(),
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Validation — la seule qui fait autorité                             */
/* ------------------------------------------------------------------ */

function texte(valeur: unknown): string {
  return typeof valeur === "string" ? valeur.trim() : "";
}

/** Chaîne ou nombre rendus en chaîne : les types de proposition sont textuels. */
function nombreTexte(valeur: unknown): string {
  if (typeof valeur === "number" && Number.isFinite(valeur)) return String(valeur);
  if (typeof valeur === "string") return valeur.trim();
  return "";
}

function listeDeTextes(valeur: unknown): string[] {
  if (!Array.isArray(valeur)) return [];
  return valeur.map(texte).filter((v) => v.length > 0);
}

function dansEnum(valeur: unknown, valeurs: readonly string[]): string {
  const v = texte(valeur).toLowerCase();
  const trouve = valeurs.find((x) => x.toLowerCase() === v);
  return trouve ?? "";
}

/**
 * Ce que l'interface reçoit une fois la validation passée.
 *
 * Les mêmes types que les parseurs de `proposition.ts`, délibérément : les
 * cartes du chat, le formulaire de création et l'écran de validation du
 * référentiel ne changent pas. La bascule est interne au tuteur.
 */
export interface PropositionEvaluationExplication {
  resultat: ResultatTentative;
  scoreComprehension: number;
  scoreJustification: number;
  pointsCles: string[];
  pointsManquants: string[];
  feedbackFormatif: string;
  conseilSuivant: string;
}

export type PropositionRecue =
  | { genre: "exercice"; exercice: PropositionExercice }
  | { genre: "coherence-exercice"; coherence: PropositionCoherenceExercice }
  | { genre: "reparation-correction-exercice"; correction: PropositionReparationCorrectionExercice }
  | { genre: "referentiel"; branche: PropositionReferentiel }
  | { genre: "correction"; correction: PropositionCorrection }
  | { genre: "contenu-activite"; contenu: PropositionContenuActivite }
  | { genre: "evaluation-explication"; evaluation: PropositionEvaluationExplication }
  | { genre: "revision"; revision: PropositionRevision }
  | { genre: "relations"; relations: PropositionRelations }
  | { genre: "carte"; carte: PropositionRattachementCarte }
  | { genre: "tags"; tags: PropositionTagsCompetence }
  | { genre: "relecture"; relecture: PropositionRelecture }
  | { genre: "referentiel-complet"; resume: string; branches: PropositionReferentiel[]; ecartees: number }
  | { genre: "intention"; traduction: TraductionIntention }
  | { genre: "protocole-cours"; protocole: ProtocoleCours };

export interface PropositionCoherenceExercice {
  /** Faux dès qu'une affirmation de la correction n'est pas étayée. */
  coherent: boolean;
  /** Motifs courts, réservés au diagnostic interne quand le contrôle échoue. */
  motifs: string[];
}

export interface PropositionReparationCorrectionExercice {
  correction: string;
}

/**
 * Outil one-shot de contrôle d'un exercice proposé.
 *
 * L'exercice n'est ni enregistré ni réécrit par ce contrôle. Il sert
 * uniquement de seconde lecture avant que la proposition ne soit affichée ou
 * acceptée.
 */
export function outilCoherenceExercice(): OutilTuteur {
  return {
    nom: OUTIL_COHERENCE_EXERCICE,
    description:
      "Contrôle si la correction reste démontrable à partir de l'énoncé. Ne complète pas les faits manquants : en cas de doute, signale une incohérence.",
    schema: schemaCoherenceExercice(),
  };
}

/** Outil interne : son résultat n'est jamais présenté comme un message. */
export function outilReparationCorrectionExercice(): OutilTuteur {
  return {
    nom: OUTIL_REPARATION_CORRECTION_EXERCICE,
    description:
      "Réécrit uniquement la correction d'un exercice pour la rendre démontrable à partir de son énoncé. Ne modifie pas l'énoncé et ne complète pas les faits manquants.",
    schema: schemaReparationCorrectionExercice(),
  };
}

export interface PropositionRevision {
  resume: string;
  domaine: { nom: string; description: string };
  ajouts: {
    intitule: string;
    palier: string;
    importance: string;
    prerequis: string[];
    justification: string;
  }[];
  /** `code` DÉSIGNE une compétence existante ; il n'en frappe aucune. */
  modifications: {
    code: string;
    intitule: string;
    palier: string;
    importance: string;
    justification: string;
  }[];
  retraits: { code: string; justification: string }[];
}

/**
 * Une relation proposée, pas encore écrite.
 *
 * `codeExistant` DÉSIGNE — son `enum` est fermé sur les codes du compte. Les
 * trois autres champs décrivent une compétence qui n'existe peut-être pas : son
 * code, si elle doit être créée, sera attribué par l'application (ADR-026).
 * `domaineId` est `null` quand le tuteur n'a su nommer aucun domaine existant :
 * la proposition reste lisible mais ne s'applique pas.
 */
export interface RelationProposee {
  codeExistant: string | null;
  intitule: string;
  palier: string;
  domaineId: string | null;
  justification: string;
}

export interface PropositionRelations {
  resume: string;
  prerequis: RelationProposee[];
  suivantes: RelationProposee[];
}

/**
 * Où le tuteur situe un domaine sur la carte des savoirs.
 *
 * `noeud` DÉSIGNE, il ne crée pas : son `enum` est fermé sur les identifiants
 * fournis par le serveur (`enumNoeudsCarte()`), exactement comme les codes de
 * compétence ne sont jamais inventés par le tuteur. La carte est un
 * référentiel partagé : un nœud neuf n'a pas de sens dans une proposition.
 *
 * `justification` n'est pas décorative. C'est elle que la personne lit pour
 * accepter ou refuser ; une proposition sans motif ne s'arbitre pas.
 */
export interface PropositionRattachementCarte {
  noeud: string;
  justification: string;
}

/**
 * Ce que le tuteur propose comme tags de domaine (ADR-107).
 *
 * `domaineId` DÉSIGNE, il ne crée pas : son `enum` est fermé sur les domaines
 * vivants du compte. Rien n'est écrit — c'est la validation humaine, et elle
 * seule, qui pose un tag.
 */
export interface PropositionTagsCompetence {
  tags: Array<{ domaineId: string; justification: string }>;
}

/** Au-delà, on ne relit plus une proposition de tags : on coche. */
export const MAX_TAGS_PROPOSES = 4;

/** Au-delà, ce n'est plus une proposition : c'est une liste à trier. */
export const MAX_CANDIDATS_CARTE = 2;

/** Cinq de chaque côté : au-delà, on ne relit plus, on coche. */
export const MAX_RELATIONS_PROPOSEES = 5;

/**
 * Plafonds de lecture du lot de relecture (ADR-108).
 *
 * Ce ne sont **pas** des seuils de déclenchement : ADR-108 écarte le seuil de
 * taille, et c'est la version du domaine qui périme une relecture, jamais un
 * nombre. Ce sont les mêmes plafonds d'affichage que `MAX_TAGS_PROPOSES` et
 * `MAX_RELATIONS_PROPOSEES`, pour la même raison — au-delà, une liste ne se
 * relit plus, elle se coche.
 *
 * Les scissions sont plafonnées plus bas que le reste : découper un référentiel
 * en cinq branches d'un coup n'est pas une proposition, c'est une refonte, et le
 * test de réfutation d'ADR-107 demande justement de surveiller les branches
 * créées pour classer.
 */
export const MAX_SCISSIONS_PROPOSEES = 3;

/** Le genre le plus risqué d'ADR-108 : peu, et chacune ancrée. */
export const MAX_MANQUES_PROPOSES = 4;

/**
 * Les rattachements se cochent vite — ils ne créent rien, ils rangent — donc
 * le plafond est plus haut que les autres. Il reste un plafond de LECTURE :
 * au-delà, on ne relit plus un lot, on le coche en bloc.
 */
export const MAX_RATTACHEMENTS_PROPOSES = 8;

/**
 * Un lot de relecture, tel que l'outil le rend — avant toute validation.
 *
 * La structure est garantie par le schéma ; les **valeurs** ne le sont pas.
 * `validerRelecture` (`lib/tutor/relecture-referentiel.ts`) revérifie que chaque
 * code et chaque identifiant de domaine appartient bien au référentiel réel du
 * compte. C'est la seconde couche d'ADR-031, et elle existe parce qu'un `enum`
 * de schéma est une consigne au modèle, pas une barrière.
 */
export interface PropositionRelecture {
  scissions: Array<{
    parentId: string;
    nom: string;
    description: string;
    codes: string[];
    justification: string;
  }>;
  relations: Array<{
    amont: { codeExistant?: string; intitule: string; palier: string };
    aval: { codeExistant?: string; intitule: string; palier: string };
    justification: string;
    sourceProgression?: SourceProgressionProposee;
  }>;
  manques: Array<{
    domaineId: string;
    intitule: string;
    palier: string;
    ancrage: string;
    justification: string;
    sourceProgression: SourceProgressionProposee;
  }>;
  /** Une compétence existante à taguer dans un domaine existant (24/08/2026). */
  rattachements: Array<{
    codeExistant: string;
    domaineId: string;
    justification: string;
  }>;
}

export type SourceProgressionProposee =
  | { type: "maitrise"; codeExistant: string }
  | { type: "intention"; portee: "moyen" | "long" };

/**
 * Une correction proposée, telle que l'outil la rend — tout en chaînes.
 *
 * Même convention que `PropositionExercice` : la validation garantit la
 * *structure*, la conversion (`conversion-correction.ts`) garantit les
 * *valeurs*, et elle refuse plutôt que de rabattre sur un défaut.
 */
export interface PropositionCorrection {
  resultat: string;
  appreciations: { critere: string; valeur: string; justification: string }[];
  /**
   * Le retour rédigé (ADR-046). Ne porte aucune mesure — c'est ce qui lui vaut
   * une borne plus large que `JUSTIFICATION_MAX`.
   *
   * ⚠️ Seul `aRetravailler` a le droit de revenir dans le contexte du chat.
   */
  bilan: {
    pointsForts: string;
    pointsBloquants: string;
    aRetravailler: string[];
  };
}

export interface PropositionJalonActivite {
  titre: string;
  consigne: string;
  resultatAttendu: string;
}

interface PropositionContenuCommun {
  titre: string;
  description: string;
  brief: string;
  jalons: PropositionJalonActivite[];
}

export interface PropositionMiniProjetAdaptatif extends PropositionContenuCommun {
  famille: "produire";
  workspace: {
    demarrage: string;
    canevasArtefact: { section: string; consigne: string }[];
    conseilsRealisation: string[];
    consigneSoumission: string;
  };
}

export type PropositionContenuActivite = PropositionMiniProjetAdaptatif;

function clesExactes(
  valeur: Record<string, unknown>,
  attendues: readonly string[],
): boolean {
  const cles = Object.keys(valeur);
  return cles.length === attendues.length && cles.every((cle) => attendues.includes(cle));
}

function texteBorne(
  valeur: unknown,
  maximum: number,
  requis = true,
): string | null {
  if (typeof valeur !== "string") return null;
  const resultat = valeur.trim();
  if ((requis && resultat.length === 0) || resultat.length > maximum) return null;
  return resultat;
}

function validerJalonsActivite(valeur: unknown): PropositionJalonActivite[] | null {
  if (
    !Array.isArray(valeur) ||
    valeur.length === 0 ||
    valeur.length > JALONS_ACTIVITE_MAX
  ) {
    return null;
  }

  const jalons: PropositionJalonActivite[] = [];
  for (const brut of valeur) {
    const jalon = objet(brut);
    if (!jalon || !clesExactes(jalon, ["titre", "consigne", "resultat_attendu"])) {
      return null;
    }
    const titre = texteBorne(jalon.titre, 160);
    const consigne = texteBorne(jalon.consigne, 1_500);
    const resultatAttendu = texteBorne(jalon.resultat_attendu, 800);
    if (titre === null || consigne === null || resultatAttendu === null) return null;
    jalons.push({ titre, consigne, resultatAttendu });
  }
  return jalons;
}

function validerMiniProjetAdaptatif(
  entree: Record<string, unknown>,
): PropositionRecue | null {
  if (!clesExactes(entree, ["titre", "description", "brief", "jalons", "workspace"])) {
    return null;
  }
  const titre = texteBorne(entree.titre, 160);
  const description = texteBorne(entree.description, 800);
  const brief = texteBorne(entree.brief, 8_000);
  const jalons = validerJalonsActivite(entree.jalons);
  const workspace = objet(entree.workspace);
  if (
    titre === null ||
    description === null ||
    brief === null ||
    jalons === null ||
    !workspace ||
    !clesExactes(workspace, [
      "demarrage",
      "canevas_artefact",
      "conseils_realisation",
      "consigne_soumission",
    ])
  ) {
    return null;
  }

  const demarrage = texteBorne(workspace.demarrage, 4_000);
  const consigneSoumission = texteBorne(workspace.consigne_soumission, 1_500);
  if (
    demarrage === null ||
    consigneSoumission === null ||
    !Array.isArray(workspace.canevas_artefact) ||
    workspace.canevas_artefact.length === 0 ||
    workspace.canevas_artefact.length > ETAPES_WORKSPACE_MAX ||
    !Array.isArray(workspace.conseils_realisation) ||
    workspace.conseils_realisation.length > CONSEILS_PROJET_MAX
  ) {
    return null;
  }

  const canevasArtefact: PropositionMiniProjetAdaptatif["workspace"]["canevasArtefact"] = [];
  for (const brute of workspace.canevas_artefact) {
    const section = objet(brute);
    if (!section || !clesExactes(section, ["section", "consigne"])) return null;
    const nom = texteBorne(section.section, 160);
    const consigne = texteBorne(section.consigne, 1_500);
    if (nom === null || consigne === null) return null;
    canevasArtefact.push({ section: nom, consigne });
  }

  const conseilsRealisation: string[] = [];
  for (const brut of workspace.conseils_realisation) {
    const conseil = texteBorne(brut, 600);
    if (conseil === null) return null;
    conseilsRealisation.push(conseil);
  }

  return {
    genre: "contenu-activite",
    contenu: {
      famille: "produire",
      titre,
      description,
      brief,
      jalons,
      workspace: { demarrage, canevasArtefact, conseilsRealisation, consigneSoumission },
    },
  };
}

/** Revalide une proposition sérialisée par le client avant toute acceptation. */
export function parsePropositionContenuActivite(
  valeur: unknown,
  familleAttendue: FamilleContenuAdaptatif,
): PropositionContenuActivite | null {
  const source = objet(valeur);
  if (!source || source.famille !== familleAttendue) return null;
  const jalons = Array.isArray(source.jalons)
    ? source.jalons.map((brut) => {
      const jalon = objet(brut);
      return jalon
        ? {
          titre: jalon.titre,
          consigne: jalon.consigne,
          resultat_attendu: jalon.resultatAttendu,
        }
        : brut;
    })
    : source.jalons;
  const workspace = objet(source.workspace);
  const recue = workspace
    ? validerMiniProjetAdaptatif({
      titre: source.titre,
      description: source.description,
      brief: source.brief,
      jalons,
      workspace: {
        demarrage: workspace.demarrage,
        canevas_artefact: Array.isArray(workspace.canevasArtefact)
          ? workspace.canevasArtefact.map((brut) => {
            const section = objet(brut);
            return section ? { section: section.section, consigne: section.consigne } : brut;
          })
          : workspace.canevasArtefact,
        conseils_realisation: workspace.conseilsRealisation,
        consigne_soumission: workspace.consigneSoumission,
      },
    })
    : null;
  return recue?.genre === "contenu-activite" ? recue.contenu : null;
}

function validerEvaluationExplication(
  entree: Record<string, unknown>,
): PropositionRecue | null {
  if (
    !clesExactes(entree, [
      "resultat",
      "score_comprehension",
      "score_justification",
      "points_cles",
      "points_manquants",
      "feedback_formatif",
      "conseil_suivant",
    ])
  ) {
    return null;
  }

  const resultat = dansEnum(entree.resultat, RESULTATS_TENTATIVE);
  if (!resultat) return null;

  const scoreComp = typeof entree.score_comprehension === "number" ? entree.score_comprehension : null;
  const scoreJust = typeof entree.score_justification === "number" ? entree.score_justification : null;
  if (scoreComp === null || scoreComp < 0 || scoreComp > 1) return null;
  if (scoreJust === null || scoreJust < 0 || scoreJust > 1) return null;

  if (!Array.isArray(entree.points_cles) || !Array.isArray(entree.points_manquants)) return null;
  const pointsCles: string[] = [];
  for (const item of entree.points_cles) {
    const p = texteBorne(item, 500);
    if (p === null) return null;
    pointsCles.push(p);
  }
  const pointsManquants: string[] = [];
  for (const item of entree.points_manquants) {
    const p = texteBorne(item, 500);
    if (p === null) return null;
    pointsManquants.push(p);
  }

  const feedbackFormatif = texteBorne(entree.feedback_formatif, 1_500);
  const conseilSuivant = texteBorne(entree.conseil_suivant, 800);
  if (feedbackFormatif === null || conseilSuivant === null) return null;

  return {
    genre: "evaluation-explication",
    evaluation: {
      resultat: resultat as ResultatTentative,
      scoreComprehension: Math.round(scoreComp * 100) / 100,
      scoreJustification: Math.round(scoreJust * 100) / 100,
      pointsCles,
      pointsManquants,
      feedbackFormatif,
      conseilSuivant,
    },
  };
}

function validerExercice(entree: Record<string, unknown>): PropositionRecue | null {
  const criteres = (Array.isArray(entree.criteres) ? entree.criteres : [])
    .map((c) => {
      const o = objet(c);
      if (!o) return null;
      const dimension = dansEnum(o.dimension, DIMENSIONS);
      const libelle = texte(o.libelle);
      // Une dimension hors référentiel rendrait le critère non notable : le
      // critère est écarté, pas réécrit vers une dimension voisine.
      return dimension && libelle ? { dimension, libelle } : null;
    })
    .filter((c): c is { dimension: string; libelle: string } => c !== null);

  const exercice: PropositionExercice = {
    titre: texte(entree.titre),
    domaine: texte(entree.domaine).toLowerCase(),
    type: dansEnum(entree.type, TYPES_EXERCICE),
    difficulte: nombreTexte(entree.difficulte),
    competences: listeDeTextes(entree.competences).map((c) => c.toUpperCase()),
    dureeEstimeeMin: nombreTexte(entree.duree_estimee_min).replace(/[^0-9]/g, ""),
    enonce: texte(entree.enonce),
    indices: listeDeTextes(entree.indices),
    correction: texte(entree.correction),
    criteres,
    // `dansEnum` rend "" si absente ou hors liste — jamais fabriquée.
    intention: dansEnum(entree.intention, INTENTIONS),
  };

  // Même prédicat que l'interface et que le formulaire : une seule définition
  // de « complet », appliquée ici au plus tôt. C'est ce qui rend une réponse
  // tronquée rejetable au lieu d'être acceptée à moitié.
  if (!exerciceComplet(exercice)) return null;
  if (!exercice.type || !exercice.domaine) return null;

  return { genre: "exercice", exercice };
}

function validerCoherenceExercice(
  entree: Record<string, unknown>,
): PropositionRecue | null {
  if (typeof entree.coherent !== "boolean" || !Array.isArray(entree.motifs)) return null;

  const motifs: string[] = [];
  for (const brut of entree.motifs) {
    const motif = texteBorne(brut, MOTIF_COHERENCE_MAX);
    if (motif === null) return null;
    motifs.push(motif);
  }

  // Un refus sans motif ne permettrait pas de réparer la génération. Ce n'est
  // pas une incohérence à inventer : c'est une sortie de contrôle invalide.
  if (!entree.coherent && motifs.length === 0) return null;
  return { genre: "coherence-exercice", coherence: { coherent: entree.coherent, motifs } };
}

function validerReparationCorrectionExercice(
  entree: Record<string, unknown>,
): PropositionRecue | null {
  const correction = texteBorne(entree.correction, CORRECTION_REPAREE_MAX);
  return correction === null
    ? null
    : { genre: "reparation-correction-exercice", correction: { correction } };
}

/**
 * Assemble une compétence proposée, ou l'écarte — ADR-086.
 *
 * Deux filets, dans cet ordre :
 *
 * 1. `motifsRefusStructure` vérifie que le verbe est bien de la liste et que
 *    les bornes tiennent. Le schéma le garantit déjà côté fournisseur, mais un
 *    modèle sans support d'`enum` peut rendre autre chose ;
 * 2. `motifsNonAtomique` relit la phrase ASSEMBLÉE. C'est le filet qui compte :
 *    rien n'empêche d'écrire « un flux et analyser un goulot » dans le champ
 *    `objet`, et la structure seule ne l'attraperait pas.
 *
 * Une compétence écartée ne fait PAS échouer la branche : elle disparaît, et
 * les autres passent. `preparerAjouts` lève une erreur sur ce qu'il reçoit —
 * lui laisser un intitulé non atomique tuerait toute la proposition pour une
 * ligne, alors que 52 % des compétences écrites par le tuteur échouaient à ces
 * règles avant qu'il reçoive ce schéma.
 */
function competenceProposee(
  entree: Record<string, unknown>,
): { palier: string; importance: string; intitule: string } | null {
  const structure = {
    verbeAction: texte(entree.verbeAction),
    objet: texte(entree.objet),
    precision: texte(entree.precision) || undefined,
  };

  if (motifsRefusStructure(structure).length > 0) return null;
  const intitule = composerIntitule(structure);
  if (motifsNonAtomique(intitule).length > 0) return null;

  return {
    palier: dansEnum(entree.palier, PALIERS),
    importance: nombreTexte(entree.importance),
    intitule,
  };
}

function validerReferentiel(
  entree: Record<string, unknown>,
  competencesMinimum = 1,
): PropositionRecue | null {
  const competences = (Array.isArray(entree.competences) ? entree.competences : [])
    .map((c) => {
      const o = objet(c);
      return o ? competenceProposee(o) : null;
    })
    .filter((c): c is { palier: string; importance: string; intitule: string } => c !== null);

  const domaine = texte(entree.domaine);
  if (!domaine || competences.length < competencesMinimum) return null;

  return {
    genre: "referentiel",
    branche: {
      domaine,
      // Le préfixe est ignoré quand le domaine existe déjà ; on ne le fabrique
      // pas quand il manque, l'écran de validation le demandera.
      prefixe: texte(entree.prefixe).toUpperCase(),
      description: texte(entree.description),
      competences,
      justification: texte(entree.justification),
    },
  };
}

/**
 * Valide une correction proposée.
 *
 * Trois rejets, et aucun repli — c'est le point de tout le module :
 *
 * 1. **Une valeur hors de l'échelle est rejetée, jamais ramenée à 0.** Un 0 est
 *    une mesure : « non démontré ». Le fabriquer à partir d'une valeur
 *    illisible est exactement ce que P2 interdit, et le résultat serait
 *    indiscernable d'un jugement réel.
 * 2. **Un numéro de critère hors liste est rejeté.** Le schéma le borne déjà ;
 *    un fournisseur qui ignore le schéma ne doit pas passer pour autant — le
 *    validateur écrit à la main reste l'autorité (ADR-031).
 * 3. **Une justification trop longue est rejetée.** C'est la borne de
 *    confinement de l'exception à ADR-036 : sans elle, la « justification »
 *    peut être la correction recopiée.
 *
 * La couverture exhaustive des critères n'est PAS vérifiée ici : elle demande
 * de connaître leur nombre, et elle vit dans `convertirCorrection`. Une règle,
 * une autorité.
 */
function validerCorrection(entree: Record<string, unknown>): PropositionRecue | null {
  const resultat = dansEnum(
    entree.resultat,
    RESULTATS.map((r) => r.valeur),
  );
  if (!resultat) return null;

  const brutes = Array.isArray(entree.appreciations) ? entree.appreciations : [];
  if (brutes.length === 0) return null;

  const echelle = APPRECIATIONS.map((a) => String(a.valeur));
  const appreciations: PropositionCorrection["appreciations"] = [];

  for (const brute of brutes) {
    const o = objet(brute);
    if (!o) return null;

    const critere = nombreTexte(o.critere).replace(/[^0-9]/g, "");
    if (!critere) return null;

    // `nombreTexte` rend « 0.5 » pour le nombre 0.5 et « 0,5 » tel quel ; la
    // normalisation de la virgule vit dans la conversion, avec le reste des
    // règles de lecture. Ici on n'accepte que ce que l'échelle nomme.
    const valeur = dansEnum(nombreTexte(o.valeur).replace(",", "."), echelle);
    if (!valeur) return null;

    const justification = texte(o.justification);
    if (!justification || justification.length > JUSTIFICATION_MAX) return null;

    appreciations.push({ critere, valeur, justification });
  }

  /*
   * Le bilan rédigé est REQUIS : un verdict sans lui redeviendrait la grille
   * de cases d'avant ADR-046, et le tuteur retomberait dans le rôle que ce lot
   * existe pour lui retirer. Refuser plutôt qu'accepter à moitié — un bilan
   * absent ne se distinguerait pas, à l'écran, d'un bilan vide.
   */
  const b = objet(entree.bilan);
  if (!b) return null;

  const pointsForts = texte(b.points_forts);
  const pointsBloquants = texte(b.points_bloquants);
  if (!pointsForts || pointsForts.length > FEEDBACK_MAX) return null;
  if (!pointsBloquants || pointsBloquants.length > FEEDBACK_MAX) return null;

  const brutsRetravailler = Array.isArray(b.a_retravailler) ? b.a_retravailler : [];
  if (brutsRetravailler.length === 0 || brutsRetravailler.length > RETRAVAILLER_ITEMS_MAX) {
    return null;
  }
  const aRetravailler: string[] = [];
  for (const brut of brutsRetravailler) {
    const point = texte(brut);
    if (!point || point.length > RETRAVAILLER_MAX) return null;
    aRetravailler.push(point);
  }

  return {
    genre: "correction",
    correction: {
      resultat,
      appreciations,
      bilan: { pointsForts, pointsBloquants, aRetravailler },
    },
  };
}

/**
 * Valide un référentiel complet — et **écarte** une branche invalide au lieu de
 * rejeter le lot.
 *
 * ⚠️ Divergence assumée avec la règle « refuser plutôt qu'accepter à moitié »
 * qui gouverne le reste de ce module. Elle tient à ce qu'est l'objet : les
 * parties d'un exercice forment **un** objet — un demi-exercice n'en est pas
 * un. Cinq branches sont **cinq** unités, relues séparément, cochées
 * séparément. Écarter la quatrième et livrer les quatre autres ne produit
 * aucun objet à moitié.
 *
 * La condition est que le nombre d'écartées soit **annoncé** : une liste
 * tronquée en silence se lirait comme un corpus complet (ADR-036). D'où
 * `ecartees` dans la proposition, affiché par l'écran de relecture.
 *
 * Zéro branche valide reste un rejet : il n'y a alors rien à relire.
 */
function validerReferentielComplet(
  entree: Record<string, unknown>,
  plafondBranches?: number,
  competencesMinimum = 1,
): PropositionRecue | null {
  const resume = texte(entree.resume);
  const brutes = Array.isArray(entree.branches) ? entree.branches : [];
  if (brutes.length === 0) return null;

  const branches: PropositionReferentiel[] = [];
  let ecartees = 0;

  // Le plafond du schéma, revérifié — ADR-088. Un fournisseur qui ignore
  // `maxItems` rendrait cinq domaines là où deux sont autorisés, et le
  // référentiel enflerait par le chemin même qui devait l'en empêcher.
  const plafond = plafondBranches ?? Number.POSITIVE_INFINITY;

  for (const brute of brutes) {
    if (branches.length >= plafond) {
      ecartees += 1;
      continue;
    }
    const o = objet(brute);
    // `validerReferentiel` est réutilisée telle quelle : une seule définition
    // de ce qu'est une branche recevable.
    const recu = o ? validerReferentiel(o, competencesMinimum) : null;
    if (recu?.genre === "referentiel") branches.push(recu.branche);
    else ecartees += 1;
  }

  if (branches.length === 0) return null;
  return { genre: "referentiel-complet", resume, branches, ecartees };
}

/**
 * Les codes vivants tels que le schéma de révision les a énumérés.
 *
 * Aucune liste parallèle : on relit l'ensemble que le fournisseur a
 * effectivement reçu. Un schéma sans `enum` — domaine vide — rend un ensemble
 * vide, donc toute désignation est rejetée, ce qui est correct.
 */
/**
 * Les ensembles que le schéma de relations a réellement énumérés.
 *
 * Même précaution que `codesDuSchemaRevision` : on relit ce que le fournisseur
 * a reçu, sans liste parallèle. C'est la deuxième couche d'ADR-031 — un
 * fournisseur qui ignore l'`enum` ne doit pas passer pour autant.
 */
function ensemblesDuSchemaRelations(outils: OutilTuteur[]): {
  codes: Set<string>;
  domaines: Set<string>;
} {
  const outil = outils.find((o) => o.nom === OUTIL_RELATIONS);
  const relation = outil?.schema.properties?.prerequis?.items;
  return {
    codes: new Set(relation?.properties?.codeExistant?.enum ?? []),
    domaines: new Set(relation?.properties?.domaineId?.enum ?? []),
  };
}

/**
 * Valide des relations proposées, contre les codes et domaines connus.
 *
 * Ce qui est **écarté ligne à ligne**, à la différence de `validerRevision` qui
 * rejette l'appel entier : une relation est indépendante des autres, et perdre
 * la quatrième ne fausse pas la lecture des trois premières. Une révision, elle,
 * décrit un référentiel d'ensemble — d'où la différence.
 *
 * - **intitulé ou justification vide** ⇒ rien à relire, rien à valider ;
 * - **`codeExistant` hors de l'`enum`** ⇒ le champ est ignoré, pas la ligne :
 *   l'intitulé reste exploitable, et l'écriture retrouvera l'homonyme ;
 * - **`domaineId` hors de l'`enum`** ⇒ ramené à `null`, ce qui affiche la
 *   proposition comme demandant un domaine neuf plutôt que de la placer au
 *   hasard.
 *
 * Ce qui n'est pas vérifié ici : la longueur des intitulés et l'existence des
 * cibles à l'écriture. `validerCompetence` le fait. Une règle, une autorité.
 */
function validerRelations(
  entree: Record<string, unknown>,
  connus: { codes: Set<string>; domaines: Set<string> },
): PropositionRecue | null {
  const resume = texte(entree.resume);

  const lire = (brutes: unknown): RelationProposee[] => {
    if (!Array.isArray(brutes)) return [];
    const relations: RelationProposee[] = [];
    for (const brut of brutes) {
      if (relations.length >= MAX_RELATIONS_PROPOSEES) break;
      const o = objet(brut);
      if (!o) continue;
      const intitule = texte(o.intitule);
      const justification = texte(o.justification);
      if (!intitule || !justification) continue;
      const codeBrut = texte(o.codeExistant);
      const domaineBrut = texte(o.domaineId);
      relations.push({
        codeExistant: connus.codes.has(codeBrut) ? codeBrut : null,
        intitule,
        palier: texte(o.palier),
        domaineId: connus.domaines.has(domaineBrut) ? domaineBrut : null,
        justification,
      });
    }
    return relations;
  };

  /*
   * Absent n'est pas vide.
   *
   * Une compétence peut n'avoir aucune relation à proposer — c'est une réponse,
   * et l'écran sait la dire côté par côté. Rejeter les deux listes vides
   * renvoyait « la proposition est arrivée incomplète », qui accuse le
   * fournisseur d'une panne alors que le tuteur avait répondu.
   *
   * Ce qui reste rejeté : les deux clés absentes ou non-tableaux. Là, l'appel ne
   * porte aucune des deux réponses attendues, et le schéma les exige.
   */
  if (!Array.isArray(entree.prerequis) && !Array.isArray(entree.suivantes)) return null;

  return {
    genre: "relations",
    relations: { resume, prerequis: lire(entree.prerequis), suivantes: lire(entree.suivantes) },
  };
}

/** Les nœuds réellement armés, relus dans le schéma envoyé — une seule source. */
function noeudsDuSchemaCarte(outils: OutilTuteur[]): Set<string> {
  const outil = outils.find((o) => o.nom === OUTIL_CARTE);
  return new Set(outil?.schema.properties?.noeud?.enum ?? []);
}

/**
 * Valide un rattachement proposé, contre les nœuds réellement armés.
 *
 * Deuxième couche après l'`enum` du schéma (ADR-031) : un fournisseur qui
 * ignore l'énumération ne doit pas passer pour autant. Un nœud inconnu fait
 * rejeter l'appel entier — il n'y a rien à trier, la proposition ne porte
 * qu'une place.
 */
function validerRattachementCarte(
  entree: Record<string, unknown>,
  noeudsConnus: Set<string>,
): PropositionRecue | null {
  const noeud = texte(entree.noeud);
  const justification = texte(entree.justification);
  if (!noeud || !justification) return null;
  if (noeudsConnus.size > 0 && !noeudsConnus.has(noeud)) return null;
  return { genre: "carte", carte: { noeud, justification } };
}

function domainesDuSchemaTags(outils: OutilTuteur[]): Set<string> {
  const outil = outils.find((o) => o.nom === OUTIL_TAGS);
  return new Set(outil?.schema.properties?.tags?.items?.properties?.domaineId?.enum ?? []);
}

/**
 * Valide des tags proposés, contre les domaines réellement armés.
 *
 * Deuxième couche après l'`enum` du schéma (ADR-031). Ici, à la différence de
 * la carte, une ligne fautive n'invalide pas l'appel entier : chaque tag est
 * une proposition indépendante, et la personne les arbitre une par une. Un
 * domaine inconnu est donc écarté, pas fatal — mais un appel dont il ne reste
 * rien de valide rend une liste vide, jamais une liste inventée.
 */
function validerTagsCompetence(
  entree: Record<string, unknown>,
  domainesConnus: Set<string>,
): PropositionRecue | null {
  const brut = Array.isArray(entree.tags) ? entree.tags : null;
  if (!brut) return null;
  const vus = new Set<string>();
  const tags: PropositionTagsCompetence["tags"] = [];
  for (const element of brut) {
    const ligne = objet(element);
    if (!ligne) continue;
    const domaineId = texte(ligne.domaineId);
    const justification = texte(ligne.justification);
    if (!domaineId || !justification) continue;
    if (domainesConnus.size > 0 && !domainesConnus.has(domaineId)) continue;
    if (vus.has(domaineId)) continue;
    vus.add(domaineId);
    tags.push({ domaineId, justification });
  }
  return { genre: "tags", tags: { tags } };
}

/**
 * Les codes et domaines réellement armés pour la relecture, relus dans le
 * schéma envoyé — une seule source, jamais deux listes qui pourraient diverger.
 */
function ensemblesDuSchemaRelecture(outils: OutilTuteur[]): {
  codes: Set<string>;
  domaines: Set<string>;
} {
  const outil = outils.find((o) => o.nom === OUTIL_RELECTURE);
  const scission = outil?.schema.properties?.scissions?.items;
  return {
    codes: new Set(scission?.properties?.codes?.items?.enum ?? []),
    domaines: new Set(scission?.properties?.parentId?.enum ?? []),
  };
}

/**
 * Valide un lot de relecture, contre le référentiel réellement armé (ADR-108).
 *
 * Deuxième couche après l'`enum` du schéma (ADR-031). Elle existe parce qu'un
 * `enum` de schéma est une **consigne au modèle**, pas une barrière : un
 * fournisseur qui l'ignore, ou une réponse reconstruite depuis un flux
 * fragmenté, doit être arrêté ici. C'est ce que le test de merge exige de
 * démontrer — un code ou un domaine inventé est écarté par cette fonction, pas
 * seulement par le schéma.
 *
 * Le tri se fait **ligne à ligne**, comme pour les tags et les relations : une
 * proposition est indépendante des autres et s'arbitre seule, donc perdre la
 * troisième ne fausse pas la lecture des deux premières. Mais chaque genre a sa
 * propre notion de ligne irrécupérable :
 *
 * - **scission** : `parentId` inconnu ⇒ la ligne tombe, il n'y a nulle part où
 *   accrocher le sous-domaine. Les codes inconnus sont retirés un à un ; s'il
 *   n'en reste aucun, la ligne tombe aussi — un sous-domaine vide n'est pas une
 *   scission, c'est une branche créée pour classer, exactement ce que le test de
 *   réfutation d'ADR-107 demande de surveiller ;
 * - **relation** : `codeExistant` inconnu ⇒ le **champ** est ignoré, pas la
 *   ligne. L'intitulé reste exploitable et l'écriture retrouvera l'homonyme —
 *   même choix que `validerRelations` ;
 * - **manque** : `domaineId` inconnu ⇒ la ligne tombe. Placer au hasard une
 *   compétence qui n'existe pas encore ferait grossir un domaine que personne
 *   n'a désigné.
 *
 * Un lot dont il ne reste rien rend trois listes vides, jamais une ligne
 * inventée. « Rien à proposer » est une réponse, pas une panne.
 */
function validerRelecture(
  entree: Record<string, unknown>,
  connus: { codes: Set<string>; domaines: Set<string> },
): PropositionRecue | null {
  /*
   * Les trois clés absentes : l'appel ne porte aucune des réponses attendues.
   * Une seule liste présente, même vide, reste une réponse.
   */
  if (
    !Array.isArray(entree.scissions) &&
    !Array.isArray(entree.relations) &&
    !Array.isArray(entree.manques) &&
    !Array.isArray(entree.rattachements)
  ) {
    return null;
  }

  const connuCode = (code: string) => connus.codes.size === 0 || connus.codes.has(code);
  const connuDomaine = (id: string) => connus.domaines.size === 0 || connus.domaines.has(id);
  const lireSourceProgression = (brut: unknown): SourceProgressionProposee | null => {
    const o = objet(brut);
    if (!o) return null;
    const type = texte(o.type);
    if (type === "maitrise") {
      const codeExistant = texte(o.codeExistant);
      return codeExistant && connuCode(codeExistant)
        ? { type: "maitrise", codeExistant }
        : null;
    }
    if (type === "intention") {
      const portee = texte(o.portee);
      return portee === "moyen" || portee === "long" ? { type: "intention", portee } : null;
    }
    return null;
  };

  const scissions: PropositionRelecture["scissions"] = [];
  for (const brut of Array.isArray(entree.scissions) ? entree.scissions : []) {
    if (scissions.length >= MAX_SCISSIONS_PROPOSEES) break;
    const o = objet(brut);
    if (!o) continue;
    const parentId = texte(o.parentId);
    const nom = texte(o.nom);
    const justification = texte(o.justification);
    if (!parentId || !nom || !justification) continue;
    if (!connuDomaine(parentId)) continue;
    const codes = (Array.isArray(o.codes) ? o.codes : [])
      .map((c) => texte(c))
      .filter((c) => c.length > 0 && connuCode(c));
    const uniques = [...new Set(codes)];
    if (uniques.length === 0) continue;
    scissions.push({
      parentId,
      nom,
      description: texte(o.description),
      codes: uniques,
      justification,
    });
  }

  const lireDesignee = (
    brut: unknown,
  ): PropositionRelecture["relations"][number]["amont"] | null => {
    const o = objet(brut);
    if (!o) return null;
    const intitule = texte(o.intitule);
    if (!intitule) return null;
    const code = texte(o.codeExistant);
    return {
      ...(code && connuCode(code) ? { codeExistant: code } : {}),
      intitule,
      palier: texte(o.palier),
    };
  };

  const relations: PropositionRelecture["relations"] = [];
  for (const brut of Array.isArray(entree.relations) ? entree.relations : []) {
    if (relations.length >= MAX_RELATIONS_PROPOSEES) break;
    const o = objet(brut);
    if (!o) continue;
    const justification = texte(o.justification);
    const amont = lireDesignee(o.amont);
    const aval = lireDesignee(o.aval);
    if (!amont || !aval || !justification) continue;
    // Une compétence ne se prépare pas elle-même.
    if (amont.codeExistant && amont.codeExistant === aval.codeExistant) continue;
    /*
     * Au moins un côté doit exister.
     *
     * Une relation entre deux compétences dont AUCUNE n'est au référentiel
     * n'est pas écrivable : il faudrait créer les deux, et ce schéma ne porte
     * pas de domaine où les placer. Ranger par défaut dans un domaine que
     * personne n'a désigné est précisément le mécanisme qui produit les
     * domaines immenses — `appliquerRelationProposee` le refuse déjà pour la
     * même raison. Mieux vaut ne pas proposer que proposer une ligne dont le
     * bouton « accepter » ne pourrait rien faire.
     */
    if (!amont.codeExistant && !aval.codeExistant) continue;
    const cree = !amont.codeExistant || !aval.codeExistant;
    const sourceProgression = cree ? lireSourceProgression(o.sourceProgression) : null;
    if (cree && !sourceProgression) continue;
    relations.push({
      amont,
      aval,
      justification,
      ...(sourceProgression ? { sourceProgression } : {}),
    });
  }

  const manques: PropositionRelecture["manques"] = [];
  for (const brut of Array.isArray(entree.manques) ? entree.manques : []) {
    if (manques.length >= MAX_MANQUES_PROPOSES) break;
    const o = objet(brut);
    if (!o) continue;
    const domaineId = texte(o.domaineId);
    const intitule = texte(o.intitule);
    const ancrage = texte(o.ancrage);
    const justification = texte(o.justification);
    // Sans ancrage, ce n'est pas une proposition tirée du compte : c'est un
    // jugement de programme. ADR-108 nomme ce risque, et c'est ici qu'il se
    // refuse.
    if (!domaineId || !intitule || !ancrage || !justification) continue;
    if (!connuDomaine(domaineId)) continue;
    const sourceProgression = lireSourceProgression(o.sourceProgression);
    if (!sourceProgression) continue;
    manques.push({
      domaineId,
      intitule,
      palier: texte(o.palier),
      ancrage,
      justification,
      sourceProgression,
    });
  }

  /*
   * Le rattachement exige les DEUX identifiants dans leur `enum` : il ne crée
   * rien, il désigne un existant de chaque côté. Un code ou un domaine inventé
   * fait tomber la ligne — il n'y a rien à récupérer, à la différence d'une
   * relation où l'intitulé reste exploitable.
   */
  const rattachements: PropositionRelecture["rattachements"] = [];
  const vusRattachement = new Set<string>();
  for (const brut of Array.isArray(entree.rattachements) ? entree.rattachements : []) {
    if (rattachements.length >= MAX_RATTACHEMENTS_PROPOSES) break;
    const o = objet(brut);
    if (!o) continue;
    const codeExistant = texte(o.codeExistant);
    const domaineId = texte(o.domaineId);
    const justification = texte(o.justification);
    if (!codeExistant || !domaineId || !justification) continue;
    if (!connuCode(codeExistant) || !connuDomaine(domaineId)) continue;
    const cle = `${codeExistant}>${domaineId}`;
    if (vusRattachement.has(cle)) continue;
    vusRattachement.add(cle);
    rattachements.push({ codeExistant, domaineId, justification });
  }

  return { genre: "relecture", relecture: { scissions, relations, manques, rattachements } };
}

function codesDuSchemaRevision(outils: OutilTuteur[]): Set<string> {
  const revision = outils.find((o) => o.nom === OUTIL_REVISION);
  const codes = revision?.schema.properties?.retraits?.items?.properties?.code?.enum ?? [];
  return new Set(codes);
}

/**
 * Valide une révision, contre les codes réellement connus.
 *
 * `codesConnus` est la deuxième des trois couches décrites sous
 * `OUTIL_REVISION` : le schéma a déjà fermé l'`enum`, mais un fournisseur qui
 * l'ignore ne doit pas passer pour autant (ADR-031).
 *
 * Les rejets, et pourquoi ils rejettent **l'appel entier** plutôt que de trier :
 *
 * - **un code inconnu** ⇒ la proposition parle d'un autre référentiel. Écarter
 *   la ligne fautive et garder le reste laisserait croire à une révision
 *   complète, alors que le modèle a raisonné sur autre chose ;
 * - **un même code modifié ET retiré** ⇒ contradictoire : appliquer les deux
 *   dans un ordre ou dans l'autre ne donne pas le même référentiel ;
 * - **un doublon dans une section** ⇒ laquelle des deux vaut ?
 * - **les quatre sections vides** ⇒ il n'y a rien à relire ; un écran de diff
 *   vide se lit comme « le tuteur n'a rien trouvé à redire », ce qui est une
 *   affirmation, pas une absence.
 *
 * Ce qui n'est **pas** vérifié ici : la longueur des intitulés. `validerCompetence`
 * (`INTITULE_MIN`/`MAX`) le fait à l'écriture. Une règle, une autorité.
 */
function validerRevision(
  entree: Record<string, unknown>,
  codesConnus: Set<string>,
): PropositionRecue | null {
  const resume = texte(entree.resume);
  if (!resume) return null;

  const vus = new Set<string>();
  const codeValide = (brut: unknown): string | null => {
    const c = texte(brut).toUpperCase();
    if (!c || !codesConnus.has(c) || vus.has(c)) return null;
    vus.add(c);
    return c;
  };

  const ajouts: PropositionRevision["ajouts"] = [];
  for (const brut of Array.isArray(entree.ajouts) ? entree.ajouts : []) {
    const o = objet(brut);
    if (!o) return null;
    const intitule = texte(o.intitule);
    if (!intitule) return null;
    // Les créations passent par le même garde-fou que les branches : une
    // proposition historique trop large est écartée ici et ne doit pas faire
    // échouer toute la validation au clic.
    if (motifsNonAtomique(intitule).length > 0) continue;
    ajouts.push({
      intitule,
      palier: dansEnum(o.palier, PALIERS),
      importance: nombreTexte(o.importance),
      // Un prérequis inconnu est écarté, pas rejeté : c'est une arête du
      // graphe, pas l'objet de la proposition.
      prerequis: listeDeTextes(o.prerequis)
        .map((c) => c.toUpperCase())
        .filter((c) => codesConnus.has(c)),
      justification: texte(o.justification),
    });
  }

  const modifications: PropositionRevision["modifications"] = [];
  for (const brut of Array.isArray(entree.modifications) ? entree.modifications : []) {
    const o = objet(brut);
    if (!o) return null;
    const code = codeValide(o.code);
    if (!code) return null;

    const intitule = texte(o.intitule);
    const palier = dansEnum(o.palier, PALIERS);
    const importance = nombreTexte(o.importance);
    // Une modification réduite à son code ne modifie rien. L'écarter plutôt
    // que rejeter : c'est du bruit, pas une contradiction.
    if (!intitule && !palier && !importance) continue;

    modifications.push({
      code,
      intitule,
      palier,
      importance,
      justification: texte(o.justification),
    });
  }

  const retraits: PropositionRevision["retraits"] = [];
  for (const brut of Array.isArray(entree.retraits) ? entree.retraits : []) {
    const o = objet(brut);
    if (!o) return null;
    const code = codeValide(o.code);
    if (!code) return null;
    // Le geste le plus destructeur doit s'annoncer (ADR-027) : sans motif, la
    // personne ne peut pas instruire l'arbitrage.
    const justification = texte(o.justification);
    if (!justification) return null;
    retraits.push({ code, justification });
  }

  const domaine = objet(entree.domaine) ?? {};
  if (ajouts.length === 0 && modifications.length === 0 && retraits.length === 0) return null;

  return {
    genre: "revision",
    revision: {
      resume,
      domaine: { nom: texte(domaine.nom), description: texte(domaine.description) },
      ajouts,
      modifications,
      retraits,
    },
  };
}

/**
 * Les codes actifs tels que le schéma de l'outil les a énumérés.
 *

/**
 * Valide un appel d'outil et rend la proposition, ou `null`.
 *
 * `null` n'est pas un cas silencieux : les moteurs émettent un événement
 * `proposition-rejetee` que l'interface affiche. Une proposition rejetée doit
 * se voir — c'est tout l'objet de la bascule.
 */
export function validerAppelOutil(
  nom: string,
  entree: unknown,
  /**
   * Les outils réellement armés pour cet appel.
   *
   * Sert à `proposer_revision`, dont la validation a besoin des codes connus.
   * Les tirer du schéma plutôt que de les passer à part garantit qu'on valide
   * contre **exactement** l'ensemble que le fournisseur a reçu : deux listes
   * pourraient diverger, une seule ne le peut pas.
   */
  outils: OutilTuteur[] = [],
): PropositionRecue | null {
  const donnees = objet(entree);
  if (!donnees) return null;

  switch (nom) {
    case OUTIL_EXERCICE:
      return validerExercice(donnees);
    case OUTIL_COHERENCE_EXERCICE:
      return validerCoherenceExercice(donnees);
    case OUTIL_REPARATION_CORRECTION_EXERCICE:
      return validerReparationCorrectionExercice(donnees);
    case OUTIL_REFERENTIEL:
      return validerReferentiel(donnees);
    case OUTIL_CORRECTION:
      return validerCorrection(donnees);
    case OUTIL_MINI_PROJET_ADAPTATIF:
      return validerMiniProjetAdaptatif(donnees);
    case OUTIL_EVALUATION_EXPLICATION:
      return validerEvaluationExplication(donnees);
    case OUTIL_REVISION:
      return validerRevision(donnees, codesDuSchemaRevision(outils));
    case OUTIL_RELATIONS:
      return validerRelations(donnees, ensemblesDuSchemaRelations(outils));
    case OUTIL_CARTE:
      return validerRattachementCarte(donnees, noeudsDuSchemaCarte(outils));
    case OUTIL_TAGS:
      return validerTagsCompetence(donnees, domainesDuSchemaTags(outils));
    case OUTIL_RELECTURE:
      return validerRelecture(donnees, ensemblesDuSchemaRelecture(outils));
    case OUTIL_REFERENTIEL_COMPLET:
      // Le plafond effectif est relu depuis le schéma REELLEMENT armé, jamais
      // recalculé : deux sources pourraient diverger, une seule ne le peut pas.
      // Même raisonnement que les codes de `proposer_revision`.
      return validerReferentielComplet(
        donnees,
        outils.find((o) => o.nom === OUTIL_REFERENTIEL_COMPLET)?.schema.properties?.branches
          ?.maxItems,
        outils.find((o) => o.nom === OUTIL_REFERENTIEL_COMPLET)?.schema.properties?.branches
          ?.items?.properties?.competences?.minItems,
      );
    case OUTIL_INTENTION: {
      const traduction = validerTraductionIntention(donnees, codesDuSchemaIntention(outils));
      return traduction ? { genre: "intention", traduction } : null;
    }
    case OUTIL_PROTOCOLE_COURS:
      return validerProtocoleCours(donnees, codesDuSchemaProtocole(outils));
    default:
      return null;
  }
}

/**
 * Pourquoi un appel d'outil a été refusé, en français.
 *
 * Un validateur qui rend `null` dit « non » sans dire « pourquoi ». Sur le
 * référentiel complet, ce silence a coûté cher : seize compétences refusées
 * une à une pour des objets et des précisions trop longs, et un écran qui
 * annonçait « Aucun référentiel exploitable n'a été produit » — message vrai,
 * mais qui ne permet ni de corriger le prompt, ni de changer de modèle, ni
 * même de savoir que la faute est réparable.
 *
 * Les motifs eux-mêmes ne sont pas réécrits ici : ce sont ceux de
 * `lib/domain/atomicite.ts`, la seule autorité sur ce qu'est une compétence
 * atomique. Cette fonction ne fait que les remonter.
 *
 * Bornée à `MOTIFS_REFUS_MAX` : au-delà, on ne lit plus une explication, on
 * lit un journal. Le total est annoncé séparément.
 */
const MOTIFS_REFUS_MAX = 3;

export function motifsRefusAppelOutil(
  nom: string,
  argumentsJson: string,
  /**
   * Les outils armés — pour relire l'enum réellement reçu par le fournisseur
   * (mêmes raisons que `validerAppelOutil`). Facultatif : sans lui, les motifs
   * d'appartenance des codes sont silencieux.
   */
  outils: OutilTuteur[] = [],
): string[] {
  let entree: unknown;
  try {
    entree = JSON.parse(argumentsJson);
  } catch {
    return [
      "La réponse n'est pas un JSON complet — le plus souvent une réponse coupée en cours de rédaction.",
    ];
  }

  if (nom !== OUTIL_REFERENTIEL_COMPLET && nom !== OUTIL_REFERENTIEL && nom !== OUTIL_PROTOCOLE_COURS) {
    return [];
  }

  const racine = objet(entree);
  if (!racine) return [];

  /*
   * Un plan de protocole refusé doit dire pourquoi : « arrivée incomplète »
   * était faux dans le cas le plus courant — le plan est entier mais une
   * dimension est inconnue ou un code hors liste. Même leçon que les motifs
   * d'atomicité ci-dessous, appliquée au protocole (ADR-130).
   */
  if (nom === OUTIL_PROTOCOLE_COURS) {
    const motifs: string[] = [];
    const codesActifs = codesDuSchemaProtocole(outils);
    const seancesBrutes = Array.isArray(racine.seances) ? racine.seances : [];
    if (seancesBrutes.length === 0) {
      motifs.push("aucune séance dans le plan");
    } else if (seancesBrutes.length > SEANCES_PROTOCOLE_MAX) {
      motifs.push(`${seancesBrutes.length} séances pour ${SEANCES_PROTOCOLE_MAX} au plus`);
    }
    for (const [index, brute] of seancesBrutes.entries()) {
      const o = objet(brute);
      if (!o) continue;
      const ou = `séance ${index + 1}`;
      if (typeof o.titre !== "string" || !o.titre.trim()) motifs.push(`${ou} : titre absent`);
      if (!dimensionNormalisee(o.dimension)) {
        motifs.push(`${ou} : dimension inconnue (attendu : comprehension, application, contextualisation ou memorisation)`);
      }
      if (!Array.isArray(o.codes) || o.codes.length === 0) {
        motifs.push(`${ou} : aucune compétence visée`);
      } else {
        const codes = o.codes.map(normaliserCodeProtocole).filter(Boolean);
        if (codes.length > CODES_SEANCE_PROTOCOLE_MAX) {
          motifs.push(`${ou} : ${codes.length} compétences pour ${CODES_SEANCE_PROTOCOLE_MAX} au plus`);
        }
        const inconnus = codes.filter((code) => !codesActifs.has(code));
        if (inconnus.length > 0) {
          motifs.push(`${ou} : compétence(s) hors référentiel (${inconnus.slice(0, 3).join(", ")})`);
        }
        const duree = dureeNormalisee(o.dureeCibleMin);
        if (duree === null) {
          motifs.push(`${ou} : durée cible illisible`);
        } else if (duree < codes.length * 5 || duree > 480) {
          motifs.push(`${ou} : durée cible hors bornes (au moins ${codes.length * 5} min pour ${codes.length} compétence(s), 480 au plus)`);
        }
      }
      if (typeof o.consigne !== "string" || !o.consigne.trim()) {
        motifs.push(`${ou} : consigne absente`);
      }
      if (motifs.length >= MOTIFS_REFUS_MAX) break;
    }
    return motifs.slice(0, MOTIFS_REFUS_MAX);
  }

  const branchesBrutes =
    nom === OUTIL_REFERENTIEL_COMPLET
      ? Array.isArray(racine.branches)
        ? racine.branches
        : []
      : [racine];

  const motifs: string[] = [];
  let total = 0;

  for (const brute of branchesBrutes) {
    const branche = objet(brute);
    if (!branche) continue;
    const competences = Array.isArray(branche.competences) ? branche.competences : [];
    for (const c of competences) {
      const o = objet(c);
      if (!o) continue;
      const structure = {
        verbeAction: texte(o.verbeAction),
        objet: texte(o.objet),
        precision: texte(o.precision) || undefined,
      };
      const refus = motifsRefusStructure(structure);
      const causes =
        refus.length > 0
          ? refus
          : motifsNonAtomique(composerIntitule(structure)).map((m) => m.message);
      if (causes.length === 0) continue;
      total += 1;
      for (const cause of causes) {
        if (!motifs.includes(cause)) motifs.push(cause);
      }
    }
  }

  if (total === 0) return [];
  const retenus = motifs.slice(0, MOTIFS_REFUS_MAX);
  if (motifs.length > MOTIFS_REFUS_MAX || total > retenus.length) {
    retenus.push(`(${total} compétence${total > 1 ? "s" : ""} refusée${total > 1 ? "s" : ""} au total.)`);
  }
  return retenus;
}

/**
 * Valide un appel dont les arguments arrivent en texte JSON (moteurs
 * compatibles OpenAI, qui fragmentent `function.arguments` sur le flux).
 *
 * Un JSON illisible est le symptôme le plus courant d'une réponse coupée par la
 * limite de jetons : il rend `null`, donc un rejet annoncé.
 */
export function validerAppelOutilJson(
  nom: string,
  argumentsJson: string,
  outils: OutilTuteur[] = [],
): PropositionRecue | null {
  let entree: unknown;
  try {
    entree = JSON.parse(argumentsJson);
  } catch {
    return null;
  }
  return validerAppelOutil(nom, entree, outils);
}
