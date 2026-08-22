/**
 * La carte des savoirs — référentiel partagé, versionné, sourcé, non exhaustif.
 *
 * ## Pourquoi une constante et non des tables
 *
 * Le 21/08/2026, ADR-099 a retiré six tables `carte_globale_*` : elles
 * contenaient zéro ligne, n'avaient aucun chemin d'écriture, et aucun
 * curateur n'avait jamais pu être nommé. Le schéma avait précédé le contenu.
 * L'ADR pose sa propre condition de réouverture : **contenu initial nommé et
 * chemin d'écriture défini avant toute table**.
 *
 * Ce fichier est ce contenu initial. Il vit en dépôt, il se relit en diff, il
 * se versionne avec le code. Tant qu'aucun compte ne publie dedans, une table
 * n'ajouterait qu'une latence et une politique RLS à maintenir. Le jour où une
 * publication par un compte devient nécessaire, la migration part de ce
 * contenu-là — pas d'un schéma vide.
 *
 * ## Provenance
 *
 * Transcription d'une carte conceptuelle des savoirs humains fournie par le
 * titulaire du dépôt le 22/08/2026 (quatre régions : créations humaines,
 * monde physique, monde vivant, être humain). Traduite en français, sans
 * ajout de discipline absente de la source. Elle ne prétend ni à
 * l'exhaustivité ni à la neutralité : c'est un point de départ daté et
 * attribué, que `VERSION_CARTE` permet de faire évoluer explicitement.
 *
 * ## Ce que la carte ne contient pas, et ne contiendra jamais
 *
 * Aucune donnée personnelle, aucun élément d'un compte. Un domaine local ne
 * « remonte » pas ici parce qu'il ressemble à un nœud : il ne peut y entrer
 * que par une promotion explicite, anonymisée, validée par une personne, avec
 * sa provenance — invariant 8 et TWINY_MODEL §17. Rien dans ce module n'offre
 * de chemin d'écriture : il est en lecture seule par construction.
 *
 * ## Sur les mots-clés
 *
 * `graphe.ts` condamne les regroupements « par mots-clés codés en dur » — à
 * juste titre : là-bas, les mots-clés inventaient des arêtes entre les
 * domaines **d'un compte**, et n'étaient vrais que pour le référentiel pour
 * lequel ils avaient été écrits. Ici, ils sont l'inverse : le vocabulaire
 * déclaré d'un référentiel partagé, et ils ne produisent jamais une arête.
 * Ils alimentent une **proposition faite à une personne**, qui la valide ou
 * la refuse (`lib/engine/classification-domaine.ts`).
 */

/** Fait évoluer la carte explicitement. Une proposition enregistrée garde la sienne. */
export const VERSION_CARTE = "2026-08-22";

/** D'où vient ce contenu. Cité tel quel dans l'interface et les explications. */
export const SOURCE_CARTE =
  "Carte conceptuelle des savoirs humains fournie par le titulaire du dépôt, 22/08/2026.";

export interface NoeudCarte {
  /** Slug stable — c'est lui qu'un rattachement enregistre, jamais le nom. */
  id: string;
  nom: string;
  /** `PART_OF` : la région qui contient ce nœud. `null` pour la racine. */
  parent: string | null;
  /**
   * Vocabulaire déclaré du nœud. Sert au rapprochement lexical, jamais à
   * affirmer quoi que ce soit. Le nom du nœud n'a pas besoin d'y figurer :
   * il entre dans le calcul de son propre chef.
   */
  motsCles: string[];
}

/** `RELATED_TO` — un voisinage déclaré entre deux régions, jamais déduit. */
export interface RelationCarte {
  source: string;
  cible: string;
  /** Pourquoi ce voisinage est déclaré. Une relation sans justification n'entre pas. */
  motif: string;
}

export const RACINE_CARTE = "savoirs-humains";

export const NOEUDS_CARTE: NoeudCarte[] = [
  { id: RACINE_CARTE, nom: "Savoirs humains", parent: null, motsCles: [] },

  /* ── Région : créations humaines ──────────────────────────────────── */
  {
    id: "creations-humaines",
    nom: "Créations humaines",
    parent: RACINE_CARTE,
    motsCles: ["artefact", "technique", "production", "conception"],
  },
  {
    id: "philosophie",
    nom: "Philosophie",
    parent: "creations-humaines",
    motsCles: ["métaphysique", "épistémologie", "logique", "raisonnement", "argumentation", "éthique"],
  },
  {
    id: "mathematiques",
    nom: "Mathématiques",
    parent: "creations-humaines",
    motsCles: [
      "algèbre",
      "géométrie",
      "analyse",
      "probabilité",
      "statistique",
      "calcul",
      "démonstration",
      "fonction",
      "équation",
      "optimisation",
      "matrice",
    ],
  },
  {
    id: "informatique",
    nom: "Informatique",
    parent: "creations-humaines",
    motsCles: ["algorithme", "programmation", "logiciel", "donnée", "réseau", "code", "développement", "base"],
  },
  {
    id: "theorie-des-systemes",
    nom: "Théorie des systèmes",
    parent: "creations-humaines",
    motsCles: ["système", "cybernétique", "complexité", "rétroaction", "modélisation", "flux"],
  },
  {
    id: "industrie",
    nom: "Industrie",
    parent: "creations-humaines",
    motsCles: ["production", "usine", "logistique", "chaîne", "qualité", "maintenance", "process"],
  },
  {
    id: "technologie",
    nom: "Technologie",
    parent: "creations-humaines",
    motsCles: ["ingénierie", "machine", "électronique", "matériau", "énergie", "automatisation"],
  },
  {
    id: "artisanat",
    nom: "Artisanat",
    parent: "creations-humaines",
    motsCles: ["métier", "geste", "outil", "fabrication", "atelier", "main"],
  },
  {
    id: "arts-et-sports",
    nom: "Arts et sports",
    parent: "creations-humaines",
    motsCles: [
      "musique",
      "peinture",
      "danse",
      "théâtre",
      "dessin",
      "entraînement",
      "performance",
      "corps",
      "instrument",
      "guitare",
      "piano",
      "sport",
    ],
  },

  /* ── Région : monde physique ──────────────────────────────────────── */
  {
    id: "monde-physique",
    nom: "Monde physique",
    parent: RACINE_CARTE,
    motsCles: ["matière", "énergie", "univers", "phénomène"],
  },
  {
    id: "cosmologie",
    nom: "Cosmologie",
    parent: "monde-physique",
    motsCles: ["univers", "origine", "expansion", "espace-temps"],
  },
  {
    id: "astrophysique",
    nom: "Astrophysique",
    parent: "monde-physique",
    motsCles: ["étoile", "galaxie", "rayonnement", "gravitation"],
  },
  {
    id: "astronomie",
    nom: "Astronomie",
    parent: "monde-physique",
    motsCles: ["planète", "observation", "télescope", "orbite", "ciel"],
  },
  {
    id: "aeronomie",
    nom: "Aéronomie",
    parent: "monde-physique",
    motsCles: ["atmosphère", "climat", "météorologie", "air"],
  },
  {
    id: "hydrologie",
    nom: "Hydrologie",
    parent: "monde-physique",
    motsCles: ["eau", "rivière", "nappe", "précipitation", "bassin"],
  },
  {
    id: "oceanographie",
    nom: "Océanographie",
    parent: "monde-physique",
    motsCles: ["océan", "marée", "courant", "littoral", "mer"],
  },
  {
    id: "geographie-physique",
    nom: "Géographie physique",
    parent: "monde-physique",
    motsCles: ["relief", "territoire", "carte", "paysage", "sol"],
  },
  {
    id: "geologie",
    nom: "Géologie",
    parent: "monde-physique",
    motsCles: ["roche", "minéral", "tectonique", "sédiment", "volcan"],
  },
  {
    id: "physique",
    nom: "Physique",
    parent: "monde-physique",
    motsCles: ["mécanique", "thermodynamique", "optique", "électricité", "force", "onde", "quantique"],
  },
  {
    id: "chimie",
    nom: "Chimie",
    parent: "monde-physique",
    motsCles: ["molécule", "atome", "réaction", "solution", "composé", "liaison"],
  },

  /* ── Région : monde vivant ────────────────────────────────────────── */
  {
    id: "monde-vivant",
    nom: "Monde vivant",
    parent: RACINE_CARTE,
    motsCles: ["vie", "organisme", "espèce"],
  },
  {
    id: "biologie",
    nom: "Biologie",
    parent: "monde-vivant",
    motsCles: ["cellule", "gène", "métabolisme", "organisme", "adn", "protéine"],
  },
  {
    id: "evolution",
    nom: "Évolution",
    parent: "monde-vivant",
    motsCles: ["sélection", "espèce", "adaptation", "phylogénie", "mutation"],
  },
  {
    id: "histoire-naturelle",
    nom: "Histoire naturelle",
    parent: "monde-vivant",
    motsCles: ["fossile", "classification", "spécimen", "collection"],
  },
  {
    id: "microbiologie",
    nom: "Microbiologie",
    parent: "monde-vivant",
    motsCles: ["bactérie", "virus", "microbe", "culture", "champignon"],
  },
  {
    id: "botanique",
    nom: "Botanique",
    parent: "monde-vivant",
    motsCles: ["plante", "fleur", "arbre", "graine", "photosynthèse"],
  },
  {
    id: "zoologie",
    nom: "Zoologie",
    parent: "monde-vivant",
    motsCles: ["animal", "vertébré", "insecte", "faune"],
  },
  {
    id: "ethologie",
    nom: "Éthologie",
    parent: "monde-vivant",
    motsCles: ["comportement", "animal", "instinct", "social"],
  },
  {
    id: "ecosystemes",
    nom: "Écosystèmes",
    parent: "monde-vivant",
    motsCles: ["écologie", "biodiversité", "milieu", "chaîne", "équilibre"],
  },
  {
    id: "biosphere",
    nom: "Biosphère",
    parent: "monde-vivant",
    motsCles: ["planète", "climat", "cycle", "global"],
  },
  {
    id: "biologie-humaine",
    nom: "Biologie humaine",
    parent: "monde-vivant",
    motsCles: ["anatomie", "physiologie", "organe", "corps", "santé"],
  },

  /* ── Région : être humain ─────────────────────────────────────────── */
  {
    id: "etre-humain",
    nom: "Être humain",
    parent: RACINE_CARTE,
    motsCles: ["société", "personne", "culture"],
  },
  {
    id: "religion",
    nom: "Religion",
    parent: "etre-humain",
    motsCles: ["croyance", "rite", "sacré", "spiritualité", "culte"],
  },
  {
    id: "ethique",
    nom: "Éthique",
    parent: "etre-humain",
    motsCles: ["morale", "valeur", "devoir", "responsabilité", "dilemme"],
  },
  {
    id: "droit",
    nom: "Droit",
    parent: "etre-humain",
    motsCles: ["loi", "norme", "contrat", "justice", "règlement", "juridique"],
  },
  {
    id: "culture-et-civilisation",
    nom: "Culture et civilisation",
    parent: "etre-humain",
    motsCles: ["patrimoine", "tradition", "art", "civilisation", "identité"],
  },
  {
    id: "geographie-humaine",
    nom: "Géographie humaine",
    parent: "etre-humain",
    motsCles: ["population", "ville", "territoire", "migration", "aménagement"],
  },
  {
    id: "histoire",
    nom: "Histoire",
    parent: "etre-humain",
    motsCles: ["chronologie", "source", "période", "archive", "événement"],
  },
  {
    id: "economie",
    nom: "Économie",
    parent: "etre-humain",
    motsCles: ["marché", "prix", "monnaie", "entreprise", "comptabilité", "finance", "coût"],
  },
  {
    id: "politique",
    nom: "Politique",
    parent: "etre-humain",
    motsCles: ["état", "pouvoir", "institution", "démocratie", "élection"],
  },
  {
    id: "sociologie",
    nom: "Sociologie",
    parent: "etre-humain",
    motsCles: ["groupe", "société", "enquête", "classe", "norme"],
  },
  {
    id: "linguistique",
    nom: "Linguistique",
    parent: "etre-humain",
    motsCles: [
      "langue",
      "grammaire",
      "syntaxe",
      "sens",
      "traduction",
      "vocabulaire",
      "anglais",
      "étranger",
      "oral",
      "écrit",
      "conjugaison",
    ],
  },
  {
    id: "medecine-et-psychologie",
    nom: "Médecine et psychologie",
    parent: "etre-humain",
    motsCles: ["soin", "diagnostic", "trouble", "thérapie", "mémoire", "cognition", "apprentissage"],
  },
  {
    id: "anthropologie",
    nom: "Anthropologie",
    parent: "etre-humain",
    motsCles: ["ethnographie", "parenté", "rite", "terrain", "culture"],
  },
];

/**
 * Voisinages déclarés entre régions.
 *
 * Peu nombreux et justifiés un par un : une relation sans motif n'entre pas
 * (TWINY_MODEL §6 — « une relation déclarée ne doit pas être déduite
 * uniquement d'une proximité sémantique »).
 */
export const RELATIONS_CARTE: RelationCarte[] = [
  {
    source: "philosophie",
    cible: RACINE_CARTE,
    motif: "La source la place en surplomb : elle réexamine les autres régions.",
  },
  {
    source: "cosmologie",
    cible: "philosophie",
    motif: "La source les groupe ; l'origine de l'univers est une question partagée.",
  },
  {
    source: "biologie-humaine",
    cible: "medecine-et-psychologie",
    motif: "Le même objet, étudié comme organisme d'un côté, comme personne soignée de l'autre.",
  },
  {
    source: "mathematiques",
    cible: "informatique",
    motif: "L'informatique formalise ses objets avec les outils des mathématiques.",
  },
  {
    source: "mathematiques",
    cible: "physique",
    motif: "La physique énonce ses lois dans le langage des mathématiques.",
  },
  {
    source: "theorie-des-systemes",
    cible: "ecosystemes",
    motif: "La source relie l'étude des systèmes à celle des milieux vivants.",
  },
  {
    source: "industrie",
    cible: "economie",
    motif: "La production s'exerce dans des conditions économiques déclarées.",
  },
  {
    source: "geographie-physique",
    cible: "geographie-humaine",
    motif: "Deux lectures d'un même territoire, séparées par la source.",
  },
];

/* ------------------------------------------------------------------ */
/* Lectures — pures, sans état                                         */
/* ------------------------------------------------------------------ */

const PAR_ID = new Map(NOEUDS_CARTE.map((noeud) => [noeud.id, noeud]));

export function noeudCarte(id: string): NoeudCarte | undefined {
  return PAR_ID.get(id);
}

/** Les quatre régions de premier niveau, dans l'ordre de la source. */
export function regionsCarte(): NoeudCarte[] {
  return NOEUDS_CARTE.filter((noeud) => noeud.parent === RACINE_CARTE);
}

export function enfantsCarte(id: string): NoeudCarte[] {
  return NOEUDS_CARTE.filter((noeud) => noeud.parent === id);
}

/**
 * Le chemin de la racine jusqu'au nœud, inclus — « Savoirs humains ›
 * Créations humaines › Mathématiques ». Vide si l'identifiant est inconnu.
 *
 * Borné par le nombre de nœuds : un `parent` incohérent ferait boucler une
 * remontée naïve, et une donnée de dépôt n'est pas plus à l'abri d'une faute
 * de frappe qu'une donnée de base.
 */
export function cheminCarte(id: string): NoeudCarte[] {
  const chemin: NoeudCarte[] = [];
  const vus = new Set<string>();
  let courant = PAR_ID.get(id);
  while (courant && !vus.has(courant.id)) {
    vus.add(courant.id);
    chemin.unshift(courant);
    courant = courant.parent === null ? undefined : PAR_ID.get(courant.parent);
  }
  return chemin;
}

/** Les nœuds auxquels un domaine de compte peut être rattaché : tout sauf la racine. */
export function noeudsRattachables(): NoeudCarte[] {
  return NOEUDS_CARTE.filter((noeud) => noeud.id !== RACINE_CARTE);
}
