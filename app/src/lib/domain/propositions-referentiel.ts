/**
 * Les propositions de relecture du référentiel — ADR-108.
 *
 * ## Ce qu'est une proposition, et ce qu'elle n'est pas
 *
 * Une proposition est un **fait daté** : « telle relecture, tel jour, a proposé
 * ceci ». Le précédent est ADR-004 — un contenu produit par le tuteur est un
 * fait observé et a sa place sur le disque sans contrevenir à P1. Ce qui reste
 * interdit est de stocker l'**état dérivé** qu'elle décrit : aucun score, aucun
 * niveau, aucun classement ne se range ici. Une proposition de scission ne
 * stocke pas « ce domaine est mal découpé » ; elle stocke « le J, un découpage
 * a été proposé, en voici le texte ».
 *
 * Son arbitrage est un second fait daté, écrit une fois et jamais recalculé.
 *
 * ## La péremption
 *
 * ADR-108 écarte le seuil de taille comme déclencheur : c'est la **version**
 * qui périme. Une proposition emporte les versions des domaines qu'elle a lus
 * (`versionsLues`). Dès que l'une d'elles bouge — une commande de référentiel
 * validée les incrémente — la proposition ne porte plus sur le référentiel
 * qu'elle décrivait, et elle sort du lot. Elle n'est pas effacée : le fait
 * qu'elle a été produite reste vrai, et le taux de rétention le compte.
 *
 * `estPerimee` est donc **dérivée**, recalculée à chaque lecture, jamais écrite.
 *
 * ## Le refus
 *
 * Deux relectures du même référentiel proposent souvent la même chose. Sans
 * mémoire, un refus se rallumerait au lot suivant et l'écran cesserait d'être
 * lu. L'`empreinte` donne à chaque proposition une identité stable, indépendante
 * du lot qui l'a produite : deux propositions de même empreinte sont la même
 * proposition, et une empreinte refusée ne revient pas.
 *
 * À la différence de `refus_recommandations`, ce refus **n'expire pas**.
 * ADR-108 dit « un refus s'enregistre, et ne revient pas », sans délai — et
 * choisir un délai reviendrait à inventer un nombre que l'ADR ne donne pas.
 * Un refus de structure n'a d'ailleurs pas la même durée de vie qu'un refus
 * d'exercice : décliner un exercice aujourd'hui ne dit rien de la semaine
 * prochaine, décliner un découpage dit quelque chose de durable.
 */

import type { DomaineId } from "./types";

/* ------------------------------------------------------------------ */
/* Genres                                                              */
/* ------------------------------------------------------------------ */

/**
 * Les genres de proposition. **Vocabulaire interne.**
 *
 * Aucun de ces mots n'apparaît à l'écran : ce sont des termes de maintenance,
 * et l'écran des propositions parle de ce que la personne y gagne, pas de la
 * mécanique qui les produit. Ils servent aux données, aux tests, et à la mesure
 * de rétention qu'exige le test de réfutation d'ADR-108.
 */
export const GENRES_DETERMINISTES = [
  "arete",
  "dormance",
  "reformulation",
  "rangement",
] as const;

export const GENRES_TUTEUR = ["scission", "relation", "manque"] as const;

export const GENRES_PROPOSITION = [
  ...GENRES_DETERMINISTES,
  ...GENRES_TUTEUR,
] as const;

export type GenreProposition = (typeof GENRES_PROPOSITION)[number];
export type GenreDeterministe = (typeof GENRES_DETERMINISTES)[number];
export type GenreTuteur = (typeof GENRES_TUTEUR)[number];

export function estGenreProposition(valeur: unknown): valeur is GenreProposition {
  return (
    typeof valeur === "string" &&
    (GENRES_PROPOSITION as readonly string[]).includes(valeur)
  );
}

export function estGenreTuteur(genre: GenreProposition): genre is GenreTuteur {
  return (GENRES_TUTEUR as readonly string[]).includes(genre);
}

/**
 * Le genre `manque` — « élargir » — est-il ouvert ?
 *
 * **C'est la question ouverte n°2 d'ADR-108**, et ce drapeau est là pour qu'elle
 * reste une question : la refermer coûte une ligne, et non un chantier.
 *
 * ADR-108 propose de le livrer DÉSACTIVÉ, au motif que proposer une compétence
 * absente suppose de savoir ce qu'un sujet exige — un jugement de programme, pas
 * une lecture du compte. Maxime a tranché l'inverse le 22/08/2026 : c'est le
 * seul genre qui fasse GRANDIR le référentiel, et c'était la moitié de la
 * demande d'origine. Construire n'est pas trancher : ADR-108 reste ❓, et ce
 * drapeau est ce qui rend le retour en arrière trivial si le taux de rétention
 * du genre ne tient pas.
 *
 * Une consigne de prompt ne suffirait pas : `relireReferentiel` revide la liste
 * côté serveur après validation, quoi que le modèle réponde.
 */
export const ELARGISSEMENT_ACTIF = true;

/* ------------------------------------------------------------------ */
/* Contenus                                                            */
/* ------------------------------------------------------------------ */

/**
 * Une compétence désignée par une proposition.
 *
 * `code` renseigné : elle existe déjà au référentiel. `code` absent : le tuteur
 * en décrit une qui n'existe pas, et son code sera **attribué par
 * l'application** si la personne la retient (ADR-026). Le tuteur ne frappe
 * jamais de code — c'est ce que l'`enum` fermé garantit, et que la seconde
 * couche de validation revérifie.
 */
export interface CompetenceDesignee {
  code?: string;
  intitule: string;
  palier: string;
}

export interface ContenuArete {
  genre: "arete";
  amont: string;
  aval: string;
  force: number;
  source: "usage" | "redaction";
}

export interface ContenuDormance {
  genre: "dormance";
  code: string;
  joursSansRien: number;
}

export interface ContenuReformulation {
  genre: "reformulation";
  code: string;
  intitule: string;
  regles: string[];
  aDesObservations: boolean;
}

export interface ContenuRangement {
  genre: "rangement";
  code: string;
  domaineActuel: DomaineId;
  domaineObserve: DomaineId;
  observations: number;
}

/**
 * Un sous-domaine à créer sous un domaine existant, et ce qu'on y range.
 *
 * `codes` ne contient que des codes **vivants** du compte : le sous-domaine
 * naît du référentiel existant, il ne l'invente pas. Son identifiant et son
 * préfixe sont calculés par l'application au moment de l'écriture, jamais
 * proposés par le tuteur.
 */
export interface ContenuScission {
  genre: "scission";
  parentId: DomaineId;
  nom: string;
  description: string;
  codes: string[];
}

export interface ContenuRelation {
  genre: "relation";
  amont: CompetenceDesignee;
  aval: CompetenceDesignee;
}

/**
 * Une compétence absente que le travail réel ou une intention déclarée suppose.
 *
 * Le genre le plus risqué d'ADR-108, et le seul qui **agrandit** le référentiel
 * au lieu de le ranger. `domaineId` dit où elle irait — toujours un domaine
 * existant ; proposer un domaine neuf est une autre commande.
 */
export interface ContenuManque {
  genre: "manque";
  domaineId: DomaineId;
  intitule: string;
  palier: string;
  /** Ce qui, dans le travail réel ou les intentions, appelle cette compétence. */
  ancrage: string;
}

export type ContenuProposition =
  | ContenuArete
  | ContenuDormance
  | ContenuReformulation
  | ContenuRangement
  | ContenuScission
  | ContenuRelation
  | ContenuManque;

/* ------------------------------------------------------------------ */
/* La proposition et son arbitrage                                     */
/* ------------------------------------------------------------------ */

export type DecisionArbitrage = "retenue" | "refusee";

export interface Arbitrage {
  decision: DecisionArbitrage;
  /** Date ISO du geste. Un fait, jamais recalculé. */
  date: string;
}

export interface PropositionReferentielRelue {
  id: string;
  /** Le lot qui l'a produite — c'est l'unité que mesure le test de réfutation. */
  lotId: string;
  genre: GenreProposition;
  /** Le domaine visé, quand la proposition en vise un. Sinon `null`. */
  domaineId: DomaineId | null;
  /** Identité stable, indépendante du lot. Deux lots identiques la partagent. */
  empreinte: string;
  /** Les versions lues à la production. La péremption s'en déduit. */
  versionsLues: Readonly<Record<DomaineId, number>>;
  contenu: ContenuProposition;
  /** Les faits qui la motivent — jamais un texte rédigé d'avance (P3). */
  motifs: string[];
  creeLe: string;
  arbitrage: Arbitrage | null;
}

/* ------------------------------------------------------------------ */
/* Empreinte                                                           */
/* ------------------------------------------------------------------ */

/** Réduit un intitulé à ce qui le rend comparable : sans accent, sans casse. */
function nu(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * L'identité stable d'une proposition, indépendante du lot qui l'a produite.
 *
 * Elle porte **ce qui est proposé**, jamais la justification : deux relectures
 * qui proposent le même découpage avec deux phrases différentes proposent la
 * même chose, et un refus doit valoir pour les deux. C'est exactement ce qui
 * empêche le lot de se rallumer indéfiniment.
 *
 * Pour la scission, les codes sont triés : le même sous-domaine proposé dans un
 * autre ordre reste le même sous-domaine. Le nom entre dans l'empreinte parce
 * qu'il fait partie de ce qu'on accepte ou refuse — refuser « Gestion kanban »
 * ne doit pas empêcher qu'on propose plus tard « Flux tirés » sur les mêmes
 * compétences.
 */
export function empreinteProposition(contenu: ContenuProposition): string {
  switch (contenu.genre) {
    case "arete":
      return `arete:${contenu.amont}>${contenu.aval}`;
    case "dormance":
      return `dormance:${contenu.code}`;
    case "reformulation":
      return `reformulation:${contenu.code}`;
    case "rangement":
      return `rangement:${contenu.code}>${contenu.domaineObserve}`;
    case "scission":
      return `scission:${contenu.parentId}:${nu(contenu.nom)}:${[...contenu.codes]
        .sort()
        .join(",")}`;
    case "relation": {
      const cle = (c: CompetenceDesignee) => c.code ?? `~${nu(c.intitule)}`;
      return `relation:${cle(contenu.amont)}>${cle(contenu.aval)}`;
    }
    case "manque":
      return `manque:${contenu.domaineId}:${nu(contenu.intitule)}`;
  }
}

/* ------------------------------------------------------------------ */
/* Péremption — dérivée, jamais stockée                                */
/* ------------------------------------------------------------------ */

/**
 * La proposition porte-t-elle encore sur le référentiel d'aujourd'hui ?
 *
 * Une version lue qui a bougé, ou un domaine lu qui a disparu, périme. Un
 * domaine absent de `versionsActuelles` est traité comme disparu et non comme
 * inchangé : c'est le sens de P2 — une valeur qu'on n'a pas ne se remplace pas
 * par une valeur plausible.
 */
export function estPerimee(
  proposition: Pick<PropositionReferentielRelue, "versionsLues">,
  versionsActuelles: ReadonlyMap<DomaineId, number>,
): boolean {
  for (const [domaineId, version] of Object.entries(proposition.versionsLues)) {
    if (versionsActuelles.get(domaineId) !== version) return true;
  }
  return false;
}

/** Les versions courantes des domaines, sous la forme que la péremption attend. */
export function versionsCourantes(
  domaines: readonly { id: DomaineId; version: number }[],
): Map<DomaineId, number> {
  return new Map(domaines.map((domaine) => [domaine.id, domaine.version]));
}

/* ------------------------------------------------------------------ */
/* Le lot lisible                                                      */
/* ------------------------------------------------------------------ */

/**
 * Ce qui reste à arbitrer : ni déjà arbitré, ni périmé, ni déjà refusé sous
 * une autre identité de lot.
 *
 * Le filtrage des refus se fait **à la lecture**, comme `refus_recommandations`
 * : rien n'est effacé en base, et le jour où l'on veut savoir combien de fois
 * une proposition a été refusée, l'information est encore là.
 */
export function lotOuvert(
  propositions: readonly PropositionReferentielRelue[],
  versionsActuelles: ReadonlyMap<DomaineId, number>,
): PropositionReferentielRelue[] {
  const refusees = empreintesRefusees(propositions);
  const vues = new Set<string>();
  const ouvertes: PropositionReferentielRelue[] = [];

  for (const proposition of propositions) {
    if (proposition.arbitrage) continue;
    if (refusees.has(proposition.empreinte)) continue;
    if (estPerimee(proposition, versionsActuelles)) continue;
    // Deux lots successifs peuvent porter la même proposition encore valide :
    // elle ne s'affiche qu'une fois.
    if (vues.has(proposition.empreinte)) continue;
    vues.add(proposition.empreinte);
    ouvertes.push(proposition);
  }
  return ouvertes;
}

/**
 * Les empreintes qu'une nouvelle relecture ne doit pas reproposer.
 *
 * Ce sont les refus, et eux seuls. Une proposition retenue ne revient pas non
 * plus, mais pour une autre raison : ce qu'elle proposait est désormais écrit,
 * et le détecteur qui la produisait ne la produit plus.
 */
export function empreintesRefusees(
  propositions: readonly PropositionReferentielRelue[],
): Set<string> {
  return new Set(
    propositions
      .filter((p) => p.arbitrage?.decision === "refusee")
      .map((p) => p.empreinte),
  );
}

/* ------------------------------------------------------------------ */
/* Rétention — la mesure qu'exige le test de réfutation                */
/* ------------------------------------------------------------------ */

export interface RetentionGenre {
  genre: GenreProposition;
  proposees: number;
  /** Arbitrées : retenues + refusées. Une proposition périmée n'a rien tranché. */
  arbitrees: number;
  retenues: number;
  /** `null` tant que rien n'a été arbitré — P2 : pas de taux sans arbitrage. */
  taux: number | null;
}

/**
 * Le taux de rétention par genre, entièrement dérivé des faits enregistrés.
 *
 * C'est la « mesure préalable indispensable » d'ADR-108 : sans elle, aucun des
 * trois critères de réfutation n'est exécutable. Elle ne se stocke nulle part —
 * elle se recalcule, comme tout ce qui est de couche 3.
 *
 * Le dénominateur est le nombre d'**arbitrées**, pas de proposées : une
 * proposition qu'on n'a pas encore regardée n'est ni un succès ni un échec, et
 * la compter comme un refus ferait baisser le taux à mesure que le lot grossit.
 */
export function retentionParGenre(
  propositions: readonly PropositionReferentielRelue[],
): RetentionGenre[] {
  return GENRES_PROPOSITION.map((genre) => {
    const duGenre = propositions.filter((p) => p.genre === genre);
    const arbitrees = duGenre.filter((p) => p.arbitrage !== null);
    const retenues = arbitrees.filter((p) => p.arbitrage!.decision === "retenue");
    return {
      genre,
      proposees: duGenre.length,
      arbitrees: arbitrees.length,
      retenues: retenues.length,
      taux: arbitrees.length === 0 ? null : retenues.length / arbitrees.length,
    };
  });
}
