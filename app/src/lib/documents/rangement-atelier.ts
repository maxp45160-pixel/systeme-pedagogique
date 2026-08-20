/**
 * Où vit un élément de l'Atelier — quatre zones, jamais un chemin de dossier.
 *
 * L'Atelier rangeait ses fiches dans une arborescence calculée à chaque rendu :
 * `Domaines/Algèbre/Compétences/Fondamentaux`, `Transversal/Notes de
 * support/Cours`. Aucun de ces dossiers n'existe en base. Pire, une même
 * compétence était déposée dans deux branches — son domaine et
 * `Transversal/Compétences` — pour rester « accessible » : deux entrées, un
 * seul objet, et une personne qui ne sait plus laquelle est la vraie.
 *
 * Le rangement se réduit donc à ce que la base sait dire :
 *
 * | Zone | Ce qu'elle contient | Règle |
 * |---|---|---|
 * | `domaine` | domaines, compétences, exercices, fiches produites | le domaine est déclaré en base |
 * | `ressource` | cours, papiers, notes, projets, séances | rattachée à des compétences |
 * | `hors-corpus` | les preuves | une preuve est un événement, pas un fichier |
 *
 * Une ressource sans rattachement n'est pas perdue : elle est **à trier**, et
 * l'Atelier lui demande explicitement à quoi la relier.
 */
export type ZoneAtelier = "domaine" | "ressource" | "hors-corpus";

export interface RangementAtelier {
  zone: ZoneAtelier;
  /** Renseigné pour la seule zone `domaine`. */
  domaineId?: string;
  /**
   * Compétences auxquelles la ressource est rattachée. Toujours des codes du
   * référentiel du compte : rien n'est inventé, ce sont les liens réellement
   * écrits dans la fiche.
   */
  rattachements: string[];
}

/**
 * Une preuve ne se range pas.
 *
 * Elle reste lisible — depuis la frise de la compétence, depuis l'exercice qui
 * l'a produite, depuis la recherche — mais elle n'occupe aucune place dans le
 * corpus. Ce sont les fiches les plus nombreuses et les moins consultables :
 * les laisser dans un dossier revenait à noyer les documents qu'on cherche
 * vraiment sous des identifiants techniques.
 */
export function rangementPreuve(): RangementAtelier {
  return { zone: "hors-corpus", rattachements: [] };
}

export function rangementDomaine(domaineId: string): RangementAtelier {
  return { zone: "domaine", domaineId, rattachements: [] };
}

export function rangementRessource(rattachements: string[]): RangementAtelier {
  return { zone: "ressource", rattachements: [...new Set(rattachements)].sort() };
}

/**
 * Range un document du corpus.
 *
 * Ordre des règles, du plus contraignant au plus lâche :
 *  1. une preuve sort du corpus ;
 *  2. une fiche produite par le système pour un domaine connu rejoint ce
 *     domaine — c'est là qu'on ira la chercher ;
 *  3. tout le reste est une ressource, rattachée aux compétences qu'elle cite.
 */
export function rangerDocument(parametres: {
  estPreuve: boolean;
  /** Domaine déclaré dans le front-matter, s'il correspond à un domaine connu. */
  domaineConnu?: string;
  /** `support`, `operationnel`, ou absent pour une production du système. */
  role?: unknown;
  /** Codes de compétence effectivement cités par la fiche. */
  competencesCitees: string[];
}): RangementAtelier {
  if (parametres.estPreuve) return rangementPreuve();
  if (parametres.domaineConnu && !parametres.role) return rangementDomaine(parametres.domaineConnu);
  return rangementRessource(parametres.competencesCitees);
}

/** Une ressource que personne n'a encore reliée à une compétence. */
export function estATrier(rangement: RangementAtelier): boolean {
  return rangement.zone === "ressource" && rangement.rattachements.length === 0;
}
