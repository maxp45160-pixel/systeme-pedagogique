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
import {
  exerciceComplet,
  type PropositionExercice,
  type PropositionReferentiel,
} from "./proposition";

/* ------------------------------------------------------------------ */
/* Noms d'outils et description neutre d'un schéma                     */
/* ------------------------------------------------------------------ */

export const OUTIL_EXERCICE = "proposer_exercice";
export const OUTIL_REFERENTIEL = "proposer_referentiel";

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
      difficulte: { type: "integer", minimum: 1, maximum: 5 },
      competences: {
        type: "array",
        minItems: 1,
        items: { type: "string" },
        description: "Codes du profil ; la première est la cible.",
      },
      duree_estimee_min: { type: "integer", minimum: 5, maximum: 240 },
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
            intitule: { type: "string", description: "Savoir-faire observable, pas un sujet." },
          },
          required: ["palier", "importance", "intitule"],
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
  | { genre: "referentiel"; branche: PropositionReferentiel };

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
  };

  // Même prédicat que l'interface et que le formulaire : une seule définition
  // de « complet », appliquée ici au plus tôt. C'est ce qui rend une réponse
  // tronquée rejetable au lieu d'être acceptée à moitié.
  if (!exerciceComplet(exercice)) return null;
  if (!exercice.type || !exercice.domaine) return null;

  return { genre: "exercice", exercice };
}

function validerReferentiel(entree: Record<string, unknown>): PropositionRecue | null {
  const competences = (Array.isArray(entree.competences) ? entree.competences : [])
    .map((c) => {
      const o = objet(c);
      if (!o) return null;
      const intitule = texte(o.intitule);
      if (!intitule) return null;
      return {
        palier: dansEnum(o.palier, PALIERS),
        importance: nombreTexte(o.importance),
        intitule,
      };
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
 * Valide un appel d'outil et rend la proposition, ou `null`.
 *
 * `null` n'est pas un cas silencieux : les moteurs émettent un événement
 * `proposition-rejetee` que l'interface affiche. Une proposition rejetée doit
 * se voir — c'est tout l'objet de la bascule.
 */
export function validerAppelOutil(nom: string, entree: unknown): PropositionRecue | null {
  const donnees = objet(entree);
  if (!donnees) return null;

  switch (nom) {
    case OUTIL_EXERCICE:
      return validerExercice(donnees);
    case OUTIL_REFERENTIEL:
      return validerReferentiel(donnees);
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
export function validerAppelOutilJson(nom: string, argumentsJson: string): PropositionRecue | null {
  let entree: unknown;
  try {
    entree = JSON.parse(argumentsJson);
  } catch {
    return null;
  }
  return validerAppelOutil(nom, entree);
}
