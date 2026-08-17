/**
 * Graphe du workflow utilisateur — types, parcours BFS et statistiques.
 *
 * ## Rôle de ce module
 *
 * L'application est une boucle (génération → évaluation → adaptation) mais
 * l'utilisateur, lui, se déplace dans un graphe d'écrans, de modales et
 * d'actions. Ce module fournit les **types** de ce graphe (nœuds, arêtes),
 * le **parcours en largeur** (BFS) depuis une racine, et les **statistiques**
 * de base (degrés, puits, sources, diamètre).
 *
 * Le graphe lui-même n'est **plus déclaré ici** : il est produit
 * dynamiquement par `workflow-scanner.ts`, qui introspecte le code source
 * (routes, `<Link>`, `router.push`, `redirect`, `<Modale>`). Ce module ne
 * connaît pas le contenu du graphe — il le reçoit en paramètre.
 *
 * ## Frontière (AGENTS.md)
 *
 * Les types sont de la couche 1 (Connaît) : ils décrivent ce qui existe. Le
 * BFS et les statistiques sont de la couche 3 (Décide) : ils **dérivent** le
 * graphe complet depuis une déclaration. Rien n'est stocké — tout est
 * recalculable.
 *
 * ## Export formel
 *
 * `workflow-export.ts` transforme le résultat du BFS en objets mathématiques
 * standard : matrice d'adjacence, liste d'adjacence, format DOT (Graphviz),
 * JSON. C'est ce qui permet d'appliquer la théorie des graphes (centralité,
 * chemins critiques, composantes fortement connexes…) à l'optimisation du
 * workflow.
 */

/* ------------------------------------------------------------------ */
/* Types du graphe                                                     */
/* ------------------------------------------------------------------ */

export type PerspectiveWorkflow = "architecture" | "ux" | "ux-atomique";

export type GroupeWorkflow =
  | "dashboard"
  | "atelier"
  | "seances"
  | "exercice"
  | "tuteur"
  | "profil";

export type TypeNoeudWorkflow =
  | "page" // écran plein (route Next.js)
  | "sous-vue" // sous-état UX interactif ou vue interne
  | "modal" // fenêtre modale
  | "tiroir" // panneau latéral (tuteur, réglages)
  | "etape" // étape d'un parcours (acte Chercher/Comparer/Mesurer)
  | "action"; // effet de bord (server action, écriture)

export type TypeLienWorkflow =
  | "navigation" // lien ou redirection entre pages
  | "ouverture" // ouvre une modale / un tiroir
  | "transition" // change d'étape dans un parcours
  | "interaction" // interaction directe (clic canvas, onglet, widget)
  | "soumission" // formulaire / server action
  | "retour"; // ferme une modale ou revient en arrière

export interface NoeudWorkflow {
  id: string;
  type: TypeNoeudWorkflow;
  libelle: string;
  /** Route Next.js ou URL canonique. Absente pour les états sans URL. */
  url?: string;
  /** Condition d'existence — un état conditionnel n'est pas un défaut. */
  condition?: string;
  /** Sous-système / cluster UX pour regroupement visuel et filtrage. */
  groupe?: GroupeWorkflow;
  /** Badge visuel succinct (ex: "Canvas 2D", "Chrono", "Markdown"). */
  badge?: string;
  /** Description détaillée de l'expérience vécue à cette étape. */
  description?: string;
  /**
   * Vrai pour un nœud inféré d'un motif de code (micro-interaction
   * heuristique) plutôt que d'une déclaration explicite. Ces nœuds restent
   * affichés mais ne comptent pas comme « fins de parcours ».
   */
  heuristique?: boolean;
}

export interface LienWorkflow {
  source: string;
  target: string;
  type: TypeLienWorkflow;
  /** Libellé du bouton / lien / geste qui déclenche la transition. */
  libelle: string;
  /** Déclencheur utilisateur précis (ex: "Clic sur le radar", "Déblocage indice 1/3"). */
  declencheur?: string;
  /** Condition d'activation — l'arête n'existe que si la condition est vraie. */
  condition?: string;
}

export interface GrapheWorkflow {
  noeuds: NoeudWorkflow[];
  liens: LienWorkflow[];
}

/* ------------------------------------------------------------------ */
/* Parcours BFS                                                        */
/* ------------------------------------------------------------------ */

export interface ResultatBFS {
  /** Ordre de découverte (BFS). */
  ordre: string[];
  /** Nœuds atteignables depuis la racine. */
  noeuds: NoeudWorkflow[];
  /** Arêtes du sous-graphe atteignable. */
  liens: LienWorkflow[];
  /** Nœuds déclarés mais non atteignables depuis la racine. */
  inatteignables: NoeudWorkflow[];
  /** Profondeur de chaque nœud (distance en arêtes depuis la racine). */
  profondeurs: Map<string, number>;
}

/**
 * Parcours en largeur (BFS) du graphe de workflow depuis un nœud racine.
 *
 * Le graphe est orienté : on ne suit que les arêtes sortantes. Un nœud
 * déclaré mais jamais atteint depuis la racine est signalé — c'est soit un
 * état mort (défaut), soit une entrée volontairement hors du flux principal
 * (ex. `/login`).
 *
 * @param graphe  le graphe à parcourir
 * @param racine  l'identifiant du nœud de départ (défaut : `page:/`)
 */
export function parcourirWorkflow(
  graphe: GrapheWorkflow,
  racine = "page:/",
): ResultatBFS {
  const parId = new Map(graphe.noeuds.map((n) => [n.id, n]));
  const sortants = new Map<string, LienWorkflow[]>();
  for (const lien of graphe.liens) {
    const liste = sortants.get(lien.source) ?? [];
    liste.push(lien);
    sortants.set(lien.source, liste);
  }

  const racineExiste = parId.has(racine);
  if (!racineExiste) {
    throw new Error(`Nœud racine inconnu : ${racine}`);
  }

  const visites = new Set<string>([racine]);
  const file: string[] = [racine];
  const ordre: string[] = [];
  const profondeurs = new Map<string, number>([[racine, 0]]);
  const liensAtteints: LienWorkflow[] = [];

  while (file.length > 0) {
    const courant = file.shift()!;
    ordre.push(courant);

    for (const lien of sortants.get(courant) ?? []) {
      // Une arête vers un nœud inconnu est un défaut de déclaration.
      if (!parId.has(lien.target)) {
        throw new Error(
          `Arête ${lien.source} → ${lien.target} : nœud cible non déclaré.`,
        );
      }
      liensAtteints.push(lien);
      if (!visites.has(lien.target)) {
        visites.add(lien.target);
        profondeurs.set(lien.target, (profondeurs.get(courant) ?? 0) + 1);
        file.push(lien.target);
      }
    }
  }

  const noeudsAtteints = ordre.map((id) => parId.get(id)!);
  const inatteignables = graphe.noeuds.filter((n) => !visites.has(n.id));

  return {
    ordre,
    noeuds: noeudsAtteints,
    liens: liensAtteints,
    inatteignables,
    profondeurs,
  };
}

/* ------------------------------------------------------------------ */
/* Statistiques de base                                                */
/* ------------------------------------------------------------------ */

export interface StatistiquesGraphe {
  totalNoeuds: number;
  totalLiens: number;
  atteignables: number;
  inatteignables: number;
  /** Degré sortant moyen des nœuds atteignables. */
  degreSortantMoyen: number;
  /** Degré entrant moyen des nœuds atteignables. */
  degreEntrantMoyen: number;
  /** Nœuds sans arête sortante — états terminaux. */
  puits: string[];
  /** Nœuds sans arête entrante — points d'entrée. */
  sources: string[];
  /** Diamètre approximatif : profondeur maximale du BFS. */
  diametreBFS: number;
}

export function statistiquesGraphe(
  resultat: ResultatBFS,
  graphe: GrapheWorkflow,
): StatistiquesGraphe {
  const ids = new Set(resultat.noeuds.map((n) => n.id));
  const sortants = new Map<string, number>();
  const entrants = new Map<string, number>();
  for (const id of ids) sortants.set(id, 0);
  for (const id of ids) entrants.set(id, 0);

  for (const lien of resultat.liens) {
    if (!ids.has(lien.source) || !ids.has(lien.target)) continue;
    sortants.set(lien.source, (sortants.get(lien.source) ?? 0) + 1);
    entrants.set(lien.target, (entrants.get(lien.target) ?? 0) + 1);
  }

  const parNoeud = new Map(graphe.noeuds.map((n) => [n.id, n]));
  const puits = [...ids].filter(
    (id) =>
      (sortants.get(id) ?? 0) === 0 &&
      // Un nœud heuristique est une affordance (canvas, chrono, accordéon…),
      // pas un état terminal : l'exclure rend la métrique « fins de parcours »
      // fidèle au parcours réel.
      !parNoeud.get(id)?.heuristique,
  );
  const sources = [...ids].filter((id) => (entrants.get(id) ?? 0) === 0);

  const degreSortantMoyen =
    resultat.noeuds.length > 0
      ? [...sortants.values()].reduce((s, v) => s + v, 0) / resultat.noeuds.length
      : 0;
  const degreEntrantMoyen =
    resultat.noeuds.length > 0
      ? [...entrants.values()].reduce((s, v) => s + v, 0) / resultat.noeuds.length
      : 0;

  const diametreBFS = Math.max(0, ...resultat.profondeurs.values());

  return {
    totalNoeuds: graphe.noeuds.length,
    totalLiens: graphe.liens.length,
    atteignables: resultat.noeuds.length,
    inatteignables: resultat.inatteignables.length,
    degreSortantMoyen,
    degreEntrantMoyen,
    puits,
    sources,
    diametreBFS,
  };
}