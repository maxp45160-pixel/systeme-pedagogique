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

import type { Referentiel } from "@/lib/domain/types";
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
  PRECISION_MAX,
  VERBES_ACTION,
} from "@/lib/domain/atomicite";

/* ------------------------------------------------------------------ */
/* Noms d'outils et description neutre d'un schéma                     */
/* ------------------------------------------------------------------ */

export const OUTIL_EXERCICE = "proposer_exercice";
export const OUTIL_REFERENTIEL = "proposer_referentiel";

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
 * critère, il n'entre dans aucune preuve, il ne pré-remplit rien. C'est du
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
 * ⚠️ `proposer_evolution` n'entre pas non plus dans `outilsTuteur`.
 *
 * Il ne s'arme que sur une compétence dont `estMaitrisee` est vrai, et la route
 * le revérifie côté serveur. Proposer une évolution sur une compétence qui n'a
 * rien démontré serait exactement l'invention que ce système combat : un
 * « successeur » de quelque chose qui n'est pas su.
 *
 * Et comme `proposer_referentiel`, **son schéma n'a aucun champ `code`**. Un
 * successeur est une compétence NOUVELLE : son code sort d'`attribuerCodes`,
 * comme tous les autres (ADR-026, ADR-031).
 */
export const OUTIL_EVOLUTION = "proposer_evolution";

/**
 * ⚠️ `proposer_revision` — le point d'architecture du lot C.
 *
 * CLAUDE.md §8 interdit de laisser le tuteur écrire un code de compétence.
 * Réviser un référentiel existant exige pourtant de **désigner** les
 * compétences à reformuler ou à retirer. Il faut donc nommer une distinction
 * que l'interdit d'origine ne faisait pas :
 *
 * > **Frapper un code** = produire un identifiant que l'application n'a pas
 * > attribué. Interdit : collision, preuves qui suivent la mauvaise
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

/**
 * Un référentiel entier — plusieurs branches d'un seul geste.
 *
 * `proposer_referentiel` rend **une** branche. Un sujet un peu large n'en tient
 * pas une seule : « le stoïcisme » se découpe en thèmes, et forcer le tuteur à
 * tout mettre dans un domaine produit une branche de vingt compétences que
 * personne ne relit.
 *
 * Aucun champ `code` ici non plus : chaque branche réutilise exactement le
 * schéma de `proposer_referentiel`.
 */
export const OUTIL_REFERENTIEL_COMPLET = "proposer_referentiel_complet";

/**
 * ⚠️ `proposer_theme` — résolution d'une intention libre en compétences
 * existantes (chantier « thèmes », 10/08/2026, ADR-053).
 *
 * N'entre PAS dans `outilsTuteur`, sur le même modèle que
 * `proposer_correction` : c'est le 3ᵉ verrou d'ADR-041, transposé ici — un
 * outil qui voyage avec chaque message du chat cesse d'être un chemin confiné.
 * `proposer_theme` n'est armé que sur la route `POST /api/themes/resoudre`.
 *
 * Même distinction frapper/désigner qu'`OUTIL_REVISION` : `codes` est un
 * `enum` fermé, construit côté serveur sur les codes actifs du **compte
 * entier** (pas d'un seul domaine — un thème traverse les domaines par
 * construction). Aucun champ `code` en écriture libre nulle part dans ce
 * schéma.
 *
 * ⚠️ Ne pas « simplifier » cet `enum` en `type: "string"` : ce serait rendre
 * la frappe de code exprimable sur un chemin cross-domaine. Le cas « aucun
 * code actif » est traité par une garde côté route, avant tout appel au
 * tuteur — pas par un assouplissement du schéma.
 */
export const OUTIL_THEME = "proposer_theme";

/**
 * ⚠️ `traduire_intention` — le point d'entrée unique de création.
 *
 * N'entre PAS dans `outilsTuteur`, pour la même raison que `proposer_theme` :
 * il n'est armé que sur `POST /api/intention`, où le serveur a déjà fixé les
 * codes actifs et le contexte du compte.
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
 * Outils confinés de la boucle adaptative.
 *
 * Ils ne sont jamais ajoutés à `outilsTuteur` : le serveur les arme pour une
 * requête one-shot après avoir fixé la famille, les cibles, les contraintes,
 * les ressources et le contrat d'évaluation. Le tuteur ne peut donc produire
 * que le contenu du workspace, puis éventuellement une proposition de lecture
 * d'un artefact figé. Il n'écrit ni activité, ni évaluation finale, ni preuve.
 */
export const OUTIL_EXPLORATION_ADAPTATIVE = "proposer_exploration_adaptative";
export const OUTIL_MINI_PROJET_ADAPTATIF = "proposer_mini_projet_adaptatif";
export const OUTIL_EVALUATION_PROJET = "proposer_evaluation_projet";

export const APPRECIATIONS_PROJET = [
  "non-demontre",
  "partiellement-demontre",
  "demontre",
] as const;

export type FamilleContenuAdaptatif = "explorer" | "produire";

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

/**
 * ⚠️ Aucun champ `code` ici, et ce n'est pas un oubli.
 *
 * Le code est la clé étrangère des preuves. L'application l'attribue depuis le
 * préfixe du domaine (ADR-026). Un code écrit par le tuteur entrerait en
 * collision avec un code existant et les preuves suivraient la mauvaise
 * compétence, sans erreur visible. Le prompt l'interdisait ; le schéma le rend
 * inexprimable.
 */
function schemaReferentiel(): SchemaJson {
  return {
    type: "object",
    properties: {
      domaine: { type: "string", description: "Domaine existant, ou nouvelle branche." },
      prefixe: { type: "string", description: "2 à 5 majuscules ; ignoré si le domaine existe." },
      description: { type: "string", description: "Une phrase : ce que la branche couvre." },
      competences: {
        type: "array",
        minItems: 1,
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
            objet: {
              type: "string",
              maxLength: OBJET_MAX,
              description: "Un seul objet, sans énumération. Ex. « un stock de sécurité ».",
            },
            precision: {
              type: "string",
              maxLength: PRECISION_MAX,
              description: "Facultatif : la condition qui borne l'objet. Jamais une 2e compétence.",
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
const ELEMENTS_OBSERVES_MAX = 5;
const RESERVES_EVALUATION_MAX = 6;

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
            "Production observable attendue à ce jalon. Ce jalon reste une observation, jamais une preuve par lui-même.",
        },
      },
      required: ["titre", "consigne", "resultat_attendu"],
      additionalProperties: false,
    },
  };
}

function schemaExplorationAdaptative(): SchemaJson {
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
          introduction: { type: "string" },
          parcours: {
            type: "array",
            minItems: 1,
            maxItems: ETAPES_WORKSPACE_MAX,
            items: {
              type: "object",
              properties: {
                titre: { type: "string" },
                contenu: { type: "string" },
                invite_annotation: {
                  type: "string",
                  description:
                    "Invitation facultative à noter une idée ou une question. Chaîne vide si elle n'est pas utile.",
                },
              },
              required: ["titre", "contenu", "invite_annotation"],
              additionalProperties: false,
            },
          },
          synthese_facultative: {
            type: "string",
            description:
              "Invitation facultative à synthétiser. Elle soutient l'apprentissage mais ne produit aucune preuve.",
          },
        },
        required: ["introduction", "parcours", "synthese_facultative"],
        additionalProperties: false,
      },
    },
    required: ["titre", "description", "brief", "jalons", "workspace"],
    additionalProperties: false,
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

function schemaEvaluationProjet(idsCriteres: string[]): SchemaJson {
  const critere: SchemaJson =
    idsCriteres.length > 0
      ? { type: "string", enum: idsCriteres }
      : { type: "string", description: "Aucun critère armé : la requête doit être refusée." };

  return {
    type: "object",
    properties: {
      criteres: {
        type: "array",
        minItems: Math.max(1, idsCriteres.length),
        maxItems: Math.max(1, idsCriteres.length),
        description:
          "Une proposition pour chaque critère fourni, exactement une fois. La personne valide ou modifie ensuite chaque ligne.",
        items: {
          type: "object",
          properties: {
            critere_id: critere,
            appreciation: { type: "string", enum: [...APPRECIATIONS_PROJET] },
            justification: {
              type: "string",
              description:
                "Ce que l'artefact figé montre ou ne montre pas pour ce seul critère. N'invente aucun élément absent.",
            },
            elements_observes: {
              type: "array",
              minItems: 1,
              maxItems: ELEMENTS_OBSERVES_MAX,
              items: { type: "string" },
            },
          },
          required: ["critere_id", "appreciation", "justification", "elements_observes"],
          additionalProperties: false,
        },
      },
      synthese: {
        type: "string",
        description:
          "Synthèse de la proposition. N'attribue ni niveau, ni qualité de preuve, ni autonomie.",
      },
      reserves: {
        type: "array",
        maxItems: RESERVES_EVALUATION_MAX,
        items: { type: "string" },
        description:
          "Limites de lecture de l'artefact. Une absence d'information reste une réserve, jamais une valeur fabriquée.",
      },
    },
    required: ["criteres", "synthese", "reserves"],
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
 * Outil one-shot de contenu adaptatif. La famille est choisie par le serveur
 * avant l'appel et n'apparaît dans aucun champ modifiable du schéma.
 */
export function outilGenerationActivite(
  famille: FamilleContenuAdaptatif,
): OutilTuteur {
  if (famille === "explorer") {
    return {
      nom: OUTIL_EXPLORATION_ADAPTATIVE,
      description:
        "Rédige uniquement le contenu d'une exploration guidée dont le contrat est déjà fixé par le serveur. Tu n'enregistres rien et tu ne produis aucune preuve.",
      schema: schemaExplorationAdaptative(),
    };
  }

  return {
    nom: OUTIL_MINI_PROJET_ADAPTATIF,
    description:
      "Rédige uniquement le contenu d'un mini-projet dont les cibles, ressources et critères sont déjà fixés par le serveur. Tu n'enregistres rien et tu ne notes rien.",
    schema: schemaMiniProjetAdaptatif(),
  };
}

/**
 * Outil one-shot de proposition d'évaluation d'un projet.
 *
 * Les identifiants viennent exclusivement du contrat serveur et voyagent dans
 * un `enum`. Le schéma ne comporte volontairement aucun niveau de compétence,
 * score, qualité de preuve ou autonomie : ces décisions restent humaines et
 * applicatives après revue.
 */
export function outilEvaluationProjet(
  criteres: { id: string }[],
): OutilTuteur {
  const ids = [...new Set(criteres.map((c) => c.id.trim()).filter(Boolean))];
  return {
    nom: OUTIL_EVALUATION_PROJET,
    description:
      "Propose une lecture critère par critère d'un artefact figé. Tu n'enregistres rien : la personne valide, modifie ou rejette chaque ligne avant toute évaluation finale ou preuve.",
    schema: schemaEvaluationProjet(ids),
  };
}

/** Les trois évolutions possibles d'une compétence maîtrisée (ADR-042). */
export const EVOLUTIONS = ["successeur", "elargissement", "retrait"] as const;

/**
 * L'outil d'évolution d'une compétence maîtrisée.
 *
 * `SchemaJson` ne sait pas exprimer un `oneOf` : les champs conditionnellement
 * requis — `intitule` pour un successeur, `contexte` pour un élargissement —
 * sont vérifiés dans le validateur écrit à la main. C'est la philosophie
 * déclarée du fichier : ce qui n'est pas exprimable dans ce type ne l'est pas
 * dans un schéma non plus, et se valide là où la garantie est réelle.
 */
export function outilEvolution(): OutilTuteur {
  return {
    nom: OUTIL_EVOLUTION,
    description:
      "Propose ce que devient une compétence que la personne maîtrise. Trois voies, une seule à la fois : « successeur » (une compétence nouvelle, au palier au-dessus, qui s'appuie sur celle-ci) · « elargissement » (remesurer la même compétence dans un contexte nouveau, quand la maîtrise tient sur des contextes trop proches) · « retrait » (elle n'a plus sa place dans le périmètre). N'affirme rien qui ne figure pas dans ce qui t'a été donné. Tu ne l'appliques pas : la personne arbitre.",
    schema: {
      type: "object",
      properties: {
        evolution: { type: "string", enum: [...EVOLUTIONS] },
        raisonnement: {
          type: "string",
          description:
            "Ce que les preuves montrent, et ce qu'elles ne montrent pas. Cite les valeurs qui t'ont été données ; n'en ajoute aucune.",
        },
        intitule: {
          type: "string",
          description:
            "Successeur uniquement : un savoir-faire observable, pas un sujet. Ne redouble aucun intitulé voisin.",
        },
        palier: { type: "string", enum: [...PALIERS] },
        importance: { type: "number", minimum: 0, maximum: 1 },
        contexte: {
          type: "string",
          description:
            "Élargissement uniquement : le contexte nouveau où remesurer, formulé comme un thème d'exercice.",
        },
      },
      required: ["evolution", "raisonnement"],
      additionalProperties: false,
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
 * Plafond de branches quand le compte a déjà des domaines — ADR-088.
 *
 * Le défaut est mesuré : un seul sujet, « les LLM », a produit **cinq domaines
 * et 40 compétences, aucune mesurée**, soit 43 % du référentiel actif, pendant
 * que deux autres domaines restaient vides. Le prompt demandait « trois à six
 * branches pour un sujet large » et le tuteur a lu « branche » comme
 * « domaine ».
 *
 * Le plafond est porté par le SCHÉMA, pas par la consigne : `maxItems` ne se
 * contourne pas, une phrase si. Deux et non un — un sujet réellement double
 * existe — mais le découpage au-delà part en **thèmes** (`themes`, ADR-053),
 * qui traversent les domaines par construction et n'engagent aucun préfixe de
 * code ni aucune gouvernance.
 *
 * Sur un compte VIDE le plafond ne s'applique pas : il n'y a alors rien à
 * surcharger, et l'amorçage a besoin de poser la structure d'un coup.
 */
export const BRANCHES_MAX_COMPTE_ETABLI = 2;

export function outilReferentielComplet(referentiel?: Referentiel): OutilTuteur {
  const domainesVivants = (referentiel?.domaines ?? []).filter((d) => !d.archive).length;
  const branches: SchemaJson = {
    type: "array",
    minItems: 1,
    items: schemaReferentiel(),
    ...(domainesVivants > 0 ? { maxItems: BRANCHES_MAX_COMPTE_ETABLI } : {}),
  };

  return {
    nom: OUTIL_REFERENTIEL_COMPLET,
    description:
      domainesVivants > 0
        ? `Propose un référentiel pour un sujet. Ce compte a déjà ${domainesVivants} domaine(s) : n'en crée pas plus de ${BRANCHES_MAX_COMPTE_ETABLI}. Un domaine n'est PAS un thème — pour découper un sujet large, rattache les compétences à un domaine existant ou à un seul domaine neuf, et laisse la personne créer des thèmes ensuite. L'application attribue tous les codes.`
        : "Propose un référentiel complet pour un sujet, découpé en branches cohérentes. Une branche par grand thème : ne mets pas vingt compétences dans un seul domaine, et n'en fais pas dix pour un sujet qui en tient trois. L'application attribue tous les codes.",
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
            "L'application décide seule entre suppression et archivage, selon les preuves enregistrées : ne le propose pas.",
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
 * L'outil de résolution d'une intention libre en compétences existantes.
 *
 * `codesActifs` est l'ensemble fermé des codes déjà attribués, tous domaines
 * confondus — voir `OUTIL_THEME` pour le raisonnement. Le codeVide se traite
 * en amont : la route `/api/themes/resoudre` refuse d'appeler le tuteur si le
 * référentiel n'a aucune compétence active, donc `codesActifs` n'arrive
 * jamais vide ici en usage normal — cette fonction reste défensive quand même
 * (même repli qu'`outilsRevision`), plutôt que de fabriquer un `enum: []`
 * invalide.
 */
export function outilTheme(codesActifs: string[]): OutilTuteur {
  const code: SchemaJson =
    codesActifs.length > 0
      ? { type: "string", enum: codesActifs, description: "Code d'une compétence existante." }
      : { type: "string", description: "Aucune compétence active dans ce compte." };

  return {
    nom: OUTIL_THEME,
    description:
      "Désigne, parmi les compétences existantes, celles qui correspondent à l'intention exprimée par la personne. Tu ne frappes aucun code : uniquement ceux qu'on te donne. Si rien ne correspond vraiment, rends une liste de codes vide plutôt que de rapprocher de force — l'écran proposera alors de créer une compétence.",
    schema: {
      type: "object",
      properties: {
        libelle: {
          type: "string",
          description: "Un nom court pour ce regroupement, ex. « Histoire de l'industrie japonaise ».",
        },
        codes: { type: "array", items: code },
        justification: {
          type: "string",
          description: "Pourquoi ces compétences précisément répondent à l'intention.",
        },
      },
      required: ["libelle", "codes", "justification"],
      additionalProperties: false,
    },
  };
}

/**
 * L'outil de traduction d'un besoin exprimé en une action déjà connue.
 *
 * Le schéma porte l'essentiel du cadrage, pas le prompt : les trois genres sont
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
 * une chaîne libre plutôt qu'un `enum: []` invalide, exactement comme
 * `outilTheme` ; la validation en aval écarte de toute façon tout code inconnu,
 * donc l'ensemble vide écarte tout. Un compte sans référentiel ne peut produire
 * qu'un `referentiel` ou une `note`, et c'est le résultat voulu.
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
          "travail = s'entraîner sur des compétences existantes ; projet = produire un artefact qui mobilise plusieurs compétences à la fois ; note = déposer une ressource ou un contexte, sans mesure ; referentiel = le sujet n'existe pas encore au référentiel et il faut d'abord le décrire.",
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
          "Compétences visées, uniquement pour un travail. Vide pour une note ou une extension de référentiel.",
      },
      sujet: {
        type: "string",
        description:
          "Le sujet en clair. Obligatoire pour referentiel (ce sur quoi une branche sera proposée) et pour projet (ce qui sera produit) — ces deux parcours partent d'une phrase, pas de codes.",
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
      "Traduis le besoin exprimé en une action que le système sait déjà exécuter. Tu n'exécutes rien : la personne relit et confirme. Ne rapproche pas de force — si aucune compétence active ne couvre le sujet, dis-le en proposant une extension du référentiel plutôt qu'un travail sur des compétences voisines.",
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
 * Même précaution que `codesDuSchemaTheme` : on relit l'ensemble effectivement
 * reçu par le fournisseur plutôt qu'une liste parallèle qui pourrait diverger.
 */
function codesDuSchemaIntention(outils: OutilTuteur[]): Set<string> {
  const intention = outils.find((o) => o.nom === OUTIL_INTENTION);
  const codes =
    intention?.schema.properties?.action?.properties?.codes?.items?.enum ?? [];
  return new Set(codes);
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
        "Propose une branche de compétences quand le sujet demandé n'existe pas encore au référentiel. L'application attribue les codes. Chaque intitulé doit être mesurable : un savoir-faire observable et non un sujet, notable sur au moins une dimension, testable dans deux contextes, exerçable par un des types d'exercice, et prouvable en 20 à 60 minutes.",
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

function objet(valeur: unknown): Record<string, unknown> | null {
  return typeof valeur === "object" && valeur !== null && !Array.isArray(valeur)
    ? (valeur as Record<string, unknown>)
    : null;
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
export type PropositionRecue =
  | { genre: "exercice"; exercice: PropositionExercice }
  | { genre: "referentiel"; branche: PropositionReferentiel }
  | { genre: "correction"; correction: PropositionCorrection }
  | { genre: "contenu-activite"; contenu: PropositionContenuActivite }
  | { genre: "evaluation-projet"; evaluation: PropositionEvaluationProjet }
  | { genre: "evolution"; evolution: PropositionEvolution }
  | { genre: "revision"; revision: PropositionRevision }
  | { genre: "relations"; relations: PropositionRelations }
  | { genre: "referentiel-complet"; resume: string; branches: PropositionReferentiel[]; ecartees: number }
  | { genre: "theme"; theme: PropositionTheme }
  | { genre: "intention"; traduction: TraductionIntention };

/**
 * Une résolution de thème proposée. `codes` DÉSIGNE des compétences
 * existantes ; aucun n'est frappé (voir `OUTIL_THEME`).
 */
export interface PropositionTheme {
  libelle: string;
  codes: string[];
  justification: string;
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

/** Cinq de chaque côté : au-delà, on ne relit plus, on coche. */
export const MAX_RELATIONS_PROPOSEES = 5;

/**
 * Une évolution proposée. Tout en chaînes, comme les autres — sauf `evolution`,
 * qui est déjà contraint par l'`enum` et validé ci-dessous.
 *
 * **Aucun champ `code`** : un successeur est une compétence nouvelle, et son
 * code est attribué par l'application (ADR-026).
 */
export interface PropositionEvolution {
  evolution: (typeof EVOLUTIONS)[number];
  raisonnement: string;
  intitule: string;
  palier: string;
  importance: string;
  contexte: string;
}

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

export interface PropositionExplorationAdaptative extends PropositionContenuCommun {
  famille: "explorer";
  workspace: {
    introduction: string;
    parcours: { titre: string; contenu: string; inviteAnnotation: string }[];
    syntheseFacultative: string;
  };
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

export type PropositionContenuActivite =
  | PropositionExplorationAdaptative
  | PropositionMiniProjetAdaptatif;

/**
 * Lecture proposée par le tuteur. Ce type ne représente ni une évaluation
 * finale ni une preuve : aucune écriture n'est possible depuis ce module.
 */
export interface PropositionEvaluationProjet {
  criteres: {
    critereId: string;
    appreciation: (typeof APPRECIATIONS_PROJET)[number];
    justification: string;
    elementsObserves: string[];
  }[];
  synthese: string;
  reserves: string[];
}

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

function validerExplorationAdaptative(
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
    !clesExactes(workspace, ["introduction", "parcours", "synthese_facultative"])
  ) {
    return null;
  }

  const introduction = texteBorne(workspace.introduction, 4_000);
  const syntheseFacultative = texteBorne(workspace.synthese_facultative, 1_000, false);
  if (
    introduction === null ||
    syntheseFacultative === null ||
    !Array.isArray(workspace.parcours) ||
    workspace.parcours.length === 0 ||
    workspace.parcours.length > ETAPES_WORKSPACE_MAX
  ) {
    return null;
  }

  const parcours: PropositionExplorationAdaptative["workspace"]["parcours"] = [];
  for (const brute of workspace.parcours) {
    const etape = objet(brute);
    if (!etape || !clesExactes(etape, ["titre", "contenu", "invite_annotation"])) {
      return null;
    }
    const titreEtape = texteBorne(etape.titre, 160);
    const contenu = texteBorne(etape.contenu, 12_000);
    const inviteAnnotation = texteBorne(etape.invite_annotation, 600, false);
    if (titreEtape === null || contenu === null || inviteAnnotation === null) return null;
    parcours.push({ titre: titreEtape, contenu, inviteAnnotation });
  }

  return {
    genre: "contenu-activite",
    contenu: {
      famille: "explorer",
      titre,
      description,
      brief,
      jalons,
      workspace: { introduction, parcours, syntheseFacultative },
    },
  };
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
  if (familleAttendue === "explorer") {
    const workspace = objet(source.workspace);
    const recue = workspace
      ? validerExplorationAdaptative({
        titre: source.titre,
        description: source.description,
        brief: source.brief,
        jalons,
        workspace: {
          introduction: workspace.introduction,
          parcours: Array.isArray(workspace.parcours)
            ? workspace.parcours.map((brut) => {
              const etape = objet(brut);
              return etape
                ? {
                  titre: etape.titre,
                  contenu: etape.contenu,
                  invite_annotation: etape.inviteAnnotation,
                }
                : brut;
            })
            : workspace.parcours,
          synthese_facultative: workspace.syntheseFacultative,
        },
      })
      : null;
    return recue?.genre === "contenu-activite" ? recue.contenu : null;
  }
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

function idsCriteresEvaluation(outils: OutilTuteur[]): Set<string> {
  const outil = outils.find((o) => o.nom === OUTIL_EVALUATION_PROJET);
  const ids = outil?.schema.properties?.criteres?.items?.properties?.critere_id?.enum ?? [];
  return new Set(ids);
}

function validerEvaluationProjet(
  entree: Record<string, unknown>,
  idsAttendus: Set<string>,
): PropositionRecue | null {
  if (
    idsAttendus.size === 0 ||
    !clesExactes(entree, ["criteres", "synthese", "reserves"]) ||
    !Array.isArray(entree.criteres) ||
    entree.criteres.length !== idsAttendus.size
  ) {
    return null;
  }

  const criteres: PropositionEvaluationProjet["criteres"] = [];
  const vus = new Set<string>();
  for (const brut of entree.criteres) {
    const critere = objet(brut);
    if (
      !critere ||
      !clesExactes(critere, [
        "critere_id",
        "appreciation",
        "justification",
        "elements_observes",
      ])
    ) {
      return null;
    }
    const critereId = texteBorne(critere.critere_id, 160);
    const appreciation = dansEnum(critere.appreciation, APPRECIATIONS_PROJET);
    const justification = texteBorne(critere.justification, 1_500);
    if (
      critereId === null ||
      !idsAttendus.has(critereId) ||
      vus.has(critereId) ||
      !appreciation ||
      justification === null ||
      !Array.isArray(critere.elements_observes) ||
      critere.elements_observes.length === 0 ||
      critere.elements_observes.length > ELEMENTS_OBSERVES_MAX
    ) {
      return null;
    }

    const elementsObserves: string[] = [];
    for (const brutElement of critere.elements_observes) {
      const element = texteBorne(brutElement, 600);
      if (element === null) return null;
      elementsObserves.push(element);
    }
    vus.add(critereId);
    criteres.push({
      critereId,
      appreciation: appreciation as PropositionEvaluationProjet["criteres"][number]["appreciation"],
      justification,
      elementsObserves,
    });
  }
  if (vus.size !== idsAttendus.size) return null;

  const synthese = texteBorne(entree.synthese, 2_000);
  if (
    synthese === null ||
    !Array.isArray(entree.reserves) ||
    entree.reserves.length > RESERVES_EVALUATION_MAX
  ) {
    return null;
  }
  const reserves: string[] = [];
  for (const brute of entree.reserves) {
    const reserve = texteBorne(brute, 800);
    if (reserve === null) return null;
    reserves.push(reserve);
  }

  return { genre: "evaluation-projet", evaluation: { criteres, synthese, reserves } };
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

function validerReferentiel(entree: Record<string, unknown>): PropositionRecue | null {
  const competences = (Array.isArray(entree.competences) ? entree.competences : [])
    .map((c) => {
      const o = objet(c);
      return o ? competenceProposee(o) : null;
    })
    .filter((c): c is { palier: string; importance: string; intitule: string } => c !== null);

  const domaine = texte(entree.domaine);
  if (!domaine || competences.length === 0) return null;

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
 * Valide une évolution proposée.
 *
 * Les champs conditionnellement requis sont vérifiés ici, faute de `oneOf` dans
 * `SchemaJson`. La règle : une évolution qu'on ne peut pas **appliquer** n'est
 * pas une proposition, c'est une phrase.
 *
 * - `successeur` sans `intitule` : l'écran de validation n'aurait rien à
 *   afficher ni `creerBranche` rien à écrire ;
 * - `elargissement` sans `contexte` : c'est le contexte qui devient le thème de
 *   l'exercice à générer ; sans lui l'élargissement n'élargit rien ;
 * - `retrait` avec un `intitule` : les champs surnuméraires sont ignorés, pas
 *   rejetés — proposer un retrait reste valide, le reste est du bruit.
 *
 * `raisonnement` est requis dans tous les cas : une évolution sans motif ne se
 * relit pas, et c'est un arbitrage que l'utilisateur doit pouvoir instruire (P3).
 */
function validerEvolution(entree: Record<string, unknown>): PropositionRecue | null {
  const evolution = dansEnum(entree.evolution, EVOLUTIONS);
  if (!evolution) return null;

  const raisonnement = texte(entree.raisonnement);
  if (!raisonnement) return null;

  const intitule = texte(entree.intitule);
  const contexte = texte(entree.contexte);

  if (evolution === "successeur" && !intitule) return null;
  if (evolution === "elargissement" && !contexte) return null;

  return {
    genre: "evolution",
    evolution: {
      evolution: evolution as PropositionEvolution["evolution"],
      raisonnement,
      intitule: evolution === "retrait" ? "" : intitule,
      palier: dansEnum(entree.palier, PALIERS),
      importance: nombreTexte(entree.importance),
      contexte,
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
    const recu = o ? validerReferentiel(o) : null;
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
 * Les codes actifs tels que le schéma de thème les a énumérés.
 *
 * Même précaution que `codesDuSchemaRevision` : aucune liste parallèle, on
 * relit l'ensemble effectivement reçu par le fournisseur.
 */
function codesDuSchemaTheme(outils: OutilTuteur[]): Set<string> {
  const theme = outils.find((o) => o.nom === OUTIL_THEME);
  const codes = theme?.schema.properties?.codes?.items?.enum ?? [];
  return new Set(codes);
}

/**
 * Valide une proposition de thème, contre les codes réellement connus.
 *
 * `libelle` et `justification` sont obligatoires (P3 — un regroupement affiché
 * sans « pourquoi » ne se lit pas). `codes` peut légitimement être vide : c'est
 * le refus demandé — « aucune compétence active ne correspond » — pas une
 * erreur de forme. Un code hors de l'`enum` est écarté, pas rejeté en bloc :
 * le reste de la désignation peut rester valable.
 */
function validerTheme(
  entree: Record<string, unknown>,
  codesConnus: Set<string>,
): PropositionRecue | null {
  const libelle = texte(entree.libelle);
  const justification = texte(entree.justification);
  if (!libelle || !justification) return null;

  const codes = [
    ...new Set(
      listeDeTextes(entree.codes)
        .map((c) => c.toUpperCase())
        .filter((c) => codesConnus.has(c)),
    ),
  ];

  return { genre: "theme", theme: { libelle, codes, justification } };
}

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
    case OUTIL_REFERENTIEL:
      return validerReferentiel(donnees);
    case OUTIL_CORRECTION:
      return validerCorrection(donnees);
    case OUTIL_EXPLORATION_ADAPTATIVE:
      return validerExplorationAdaptative(donnees);
    case OUTIL_MINI_PROJET_ADAPTATIF:
      return validerMiniProjetAdaptatif(donnees);
    case OUTIL_EVALUATION_PROJET:
      return validerEvaluationProjet(donnees, idsCriteresEvaluation(outils));
    case OUTIL_EVOLUTION:
      return validerEvolution(donnees);
    case OUTIL_REVISION:
      return validerRevision(donnees, codesDuSchemaRevision(outils));
    case OUTIL_RELATIONS:
      return validerRelations(donnees, ensemblesDuSchemaRelations(outils));
    case OUTIL_REFERENTIEL_COMPLET:
      // Le plafond effectif est relu depuis le schéma REELLEMENT armé, jamais
      // recalculé : deux sources pourraient diverger, une seule ne le peut pas.
      // Même raisonnement que les codes de `proposer_revision`.
      return validerReferentielComplet(
        donnees,
        outils.find((o) => o.nom === OUTIL_REFERENTIEL_COMPLET)?.schema.properties?.branches
          ?.maxItems,
      );
    case OUTIL_THEME:
      return validerTheme(donnees, codesDuSchemaTheme(outils));
    case OUTIL_INTENTION: {
      const traduction = validerTraductionIntention(donnees, codesDuSchemaIntention(outils));
      return traduction ? { genre: "intention", traduction } : null;
    }
    default:
      return null;
  }
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
