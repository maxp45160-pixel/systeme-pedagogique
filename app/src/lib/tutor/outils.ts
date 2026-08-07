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
    },
    required: ["resultat", "appreciations"],
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
  | { genre: "correction"; correction: PropositionCorrection };

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

  return { genre: "correction", correction: { resultat, appreciations } };
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
    case OUTIL_CORRECTION:
      return validerCorrection(donnees);
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
