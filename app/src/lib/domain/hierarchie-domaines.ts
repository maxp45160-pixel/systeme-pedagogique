/**
 * La hiérarchie des domaines, lue et jamais écrite (ADR-107).
 *
 * Un domaine porte un `parentId`. C'est le seul fait stocké : tout le reste —
 * ancêtres, descendance, chemin, profondeur, visibilité héritée — se dérive à
 * chaque lecture. C'est la frontière d'AGENTS.md, « 1 et 2 ne se recalculent
 * pas, 3 ne se stocke pas », appliquée à la lettre : un tag posé sur un
 * sous-domaine rend la compétence visible dans tous ses ancêtres **sans
 * qu'aucune ligne d'ancêtre existe en base**.
 *
 * La conséquence est celle que le test de réfutation d'ADR-107 demande de
 * vérifier : déplacer un domaine ne réécrit ni compétence, ni observation, ni
 * score. Seule la lecture change, parce qu'elle est refaite.
 *
 * ## Pourquoi ces fonctions sont défensives
 *
 * `deplacer_domaine` refuse les cycles, et `domaines_parent_pas_soi` refuse
 * qu'un domaine soit son propre parent. Les traversées ci-dessous portent
 * malgré tout un ensemble de nœuds déjà vus, et s'arrêtent au premier
 * revu. La raison n'est pas la méfiance envers la commande : c'est
 * qu'une donnée venue de Supabase se valide avant d'entrer dans le moteur, et
 * qu'une boucle infinie au rendu serait un défaut bien pire qu'un chemin
 * tronqué. Une hiérarchie corrompue rend une lecture partielle, jamais un
 * blocage.
 */

import type { Domaine, DomaineId } from "./types";

/** Index parent → enfants, construit une fois pour toute une lecture. */
export type IndexHierarchie = ReadonlyMap<DomaineId, readonly Domaine[]>;

/**
 * Les enfants de chaque domaine, dans l'ordre d'affichage reçu.
 *
 * Les racines sont sous la clé `null` : un domaine sans parent, et un domaine
 * dont le parent a disparu du référentiel, s'affichent tous deux à la racine
 * plutôt que de devenir invisibles.
 */
export function indexerEnfants(domaines: readonly Domaine[]): Map<DomaineId | null, Domaine[]> {
  const connus = new Set(domaines.map(({ id }) => id));
  const index = new Map<DomaineId | null, Domaine[]>();
  for (const domaine of domaines) {
    const parent =
      domaine.parentId && connus.has(domaine.parentId) && domaine.parentId !== domaine.id
        ? domaine.parentId
        : null;
    const fratrie = index.get(parent) ?? [];
    fratrie.push(domaine);
    index.set(parent, fratrie);
  }
  return index;
}

/** Les domaines sans parent connu — le premier niveau de l'arbre. */
export function racines(domaines: readonly Domaine[]): Domaine[] {
  return indexerEnfants(domaines).get(null) ?? [];
}

/**
 * Les ancêtres d'un domaine, du parent immédiat vers la racine.
 *
 * Le domaine lui-même n'y figure pas. C'est cette liste qui porte la visibilité
 * héritée : une compétence taguée sur `d` se voit dans `ancetres(d)` aussi.
 */
export function ancetres(domaines: readonly Domaine[], id: DomaineId): DomaineId[] {
  const parId = new Map(domaines.map((domaine) => [domaine.id, domaine]));
  const lignee: DomaineId[] = [];
  const vus = new Set<DomaineId>([id]);
  let courant = parId.get(id)?.parentId;
  while (courant && parId.has(courant) && !vus.has(courant)) {
    vus.add(courant);
    lignee.push(courant);
    courant = parId.get(courant)?.parentId;
  }
  return lignee;
}

/**
 * Le chemin lisible d'un domaine, de la racine jusqu'à lui.
 *
 * « Sciences › Physique › Thermodynamique ». Sert à situer un domaine sans
 * imposer de comprendre l'arbre entier.
 */
export function chemin(domaines: readonly Domaine[], id: DomaineId): Domaine[] {
  const parId = new Map(domaines.map((domaine) => [domaine.id, domaine]));
  const soi = parId.get(id);
  if (!soi) return [];
  return [...ancetres(domaines, id).reverse().map((ancetre) => parId.get(ancetre)!), soi];
}

/** Profondeur dans l'arbre : 0 pour une racine. */
export function profondeur(domaines: readonly Domaine[], id: DomaineId): number {
  return ancetres(domaines, id).length;
}

/**
 * Le sous-arbre d'un domaine : lui-même et toute sa descendance.
 *
 * C'est le périmètre d'une vue de domaine (ADR-107) : elle agrège l'**union**
 * des compétences de son sous-arbre, dédupliquée par code.
 *
 * Un identifiant absent de `domaines` rend `{ id }` — un sous-arbre réduit à
 * lui-même — plutôt qu'un ensemble vide. Un identifiant peut venir d'une URL,
 * d'une observation ancienne, ou d'un appelant qui ne transmet pas la liste des
 * domaines : rendre vide ferait alors disparaître des compétences réellement
 * taguées, ce qui est pire que ne pas connaître sa descendance.
 */
export function sousArbre(domaines: readonly Domaine[], id: DomaineId): Set<DomaineId> {
  const enfants = indexerEnfants(domaines);
  const dedans = new Set<DomaineId>();
  const file: DomaineId[] = [id];
  while (file.length > 0) {
    const courant = file.shift()!;
    if (dedans.has(courant)) continue;
    dedans.add(courant);
    for (const enfant of enfants.get(courant) ?? []) file.push(enfant.id);
  }
  return dedans;
}

/**
 * Rattacher `id` sous `parentId` fermerait-il une boucle ?
 *
 * Le miroir exact du refus posé par `deplacer_domaine` en SQL. Il vit ici aussi
 * pour que l'interface puisse ne pas proposer une destination que le serveur
 * refusera — la commande reste la seule barrière qui compte.
 */
export function parenteCirculaire(
  domaines: readonly Domaine[],
  id: DomaineId,
  parentId: DomaineId | null,
): boolean {
  if (parentId === null) return false;
  if (parentId === id) return true;
  return sousArbre(domaines, id).has(parentId);
}

/**
 * Les destinations possibles pour un domaine : tout sauf lui-même et sa propre
 * descendance. « Aucun parent » se propose à part, dans l'interface.
 */
export function parentsPossibles(domaines: readonly Domaine[], id: DomaineId): Domaine[] {
  const interdits = sousArbre(domaines, id);
  return domaines.filter((domaine) => !interdits.has(domaine.id));
}

/**
 * Les domaines où une compétence est visible : ses tags, plus tous leurs
 * ancêtres.
 *
 * Rien de ce qui sort d'ici n'est écrit. C'est la définition même de la
 * visibilité héritée d'ADR-107, et elle est recalculée à chaque lecture.
 */
export function domainesVisibles(
  domaines: readonly Domaine[],
  tags: readonly DomaineId[],
): Set<DomaineId> {
  const visibles = new Set<DomaineId>();
  for (const tag of tags) {
    visibles.add(tag);
    for (const ancetre of ancetres(domaines, tag)) visibles.add(ancetre);
  }
  return visibles;
}

/**
 * Parcours en profondeur, parents avant enfants, dans l'ordre d'affichage.
 *
 * Rend chaque domaine avec sa profondeur : une liste à plat qu'un composant
 * peut indenter sans reconstruire l'arbre lui-même.
 */
export function parcourirHierarchie(
  domaines: readonly Domaine[],
): Array<{ domaine: Domaine; profondeur: number }> {
  const enfants = indexerEnfants(domaines);
  const sortie: Array<{ domaine: Domaine; profondeur: number }> = [];
  const vus = new Set<DomaineId>();

  const descendre = (niveau: readonly Domaine[], rang: number): void => {
    for (const domaine of niveau) {
      if (vus.has(domaine.id)) continue;
      vus.add(domaine.id);
      sortie.push({ domaine, profondeur: rang });
      descendre(enfants.get(domaine.id) ?? [], rang + 1);
    }
  };

  descendre(enfants.get(null) ?? [], 0);
  // Un domaine pris dans un cycle n'a pas de racine : il n'apparaîtrait nulle
  // part. On le rend à plat plutôt que de le faire disparaître de l'écran.
  for (const domaine of domaines) {
    if (!vus.has(domaine.id)) sortie.push({ domaine, profondeur: 0 });
  }
  return sortie;
}
