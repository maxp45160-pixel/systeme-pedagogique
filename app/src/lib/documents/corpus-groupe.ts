/**
 * Regroupement visuel du corpus par domaine.
 *
 * Les fiches capturées par la personne — notes support et fiches de cours —
 * se lisent mieux réunies sous le nom du domaine auquel elles servent. Le
 * regroupement est une **lecture** : aucune donnée ne change, aucun rangement
 * n'est réécrit. Une fiche sans domaine identifiable reste affichée, hors
 * groupe, plutôt que rangée de force somewhere.
 */

import type { RangementAtelier } from "./rangement-atelier";

/** Ce que le regroupement lit d'une fiche — rien d'autre. */
export interface FicheCorpus {
  titre: string;
  /** Domaine déclaré en base, s'il y en a un (zone `domaine`). */
  domaineId?: string;
  rangement: RangementAtelier;
}

export interface GroupeCorpus<T extends FicheCorpus> {
  /** Identifiant du domaine ; `"__sans_domaine__"` pour le groupe fourre-tout final. */
  cle: string;
  /** Nom du domaine tel que la base l'écrit ; `null` pour le groupe fourre-tout. */
  nom: string | null;
  elements: T[];
}

export const CLE_SANS_DOMAINE = "__sans_domaine__";

/**
 * Réunit les fiches de corpus par domaine.
 *
 * - `estFicheCorpus` décrit ce qui se regroupe (rôle support, fiche de cours…) ;
 * - `domaineDe` résout la fiche vers un domaine : celui qu'elle déclare, ou
 *   à défaut celui de sa première compétence rattachée ;
 * - `nomDuDomaine` traduit un identifiant en nom lisible — jamais un code
 *   technique ni le mot « classe » : ce sont les domaines de la personne.
 */
export function regrouperFichesParDomaine<T extends FicheCorpus>(
  elements: readonly T[],
  parametres: {
    estFicheCorpus: (element: T) => boolean;
    domaineDe: (element: T) => string | null;
    nomDuDomaine: (domaineId: string) => string | null;
  },
): GroupeCorpus<T>[] {
  const groupes = new Map<string, T[]>();

  for (const element of elements) {
    if (!parametres.estFicheCorpus(element)) continue;
    const domaineId = parametres.domaineDe(element);
    const cle = domaineId ?? CLE_SANS_DOMAINE;
    const existant = groupes.get(cle);
    if (existant) existant.push(element);
    else groupes.set(cle, [element]);
  }

  return [...groupes.entries()]
    .map(([cle, membres]) => ({
      cle,
      nom: cle === CLE_SANS_DOMAINE ? null : parametres.nomDuDomaine(cle),
      elements: [...membres].sort((a, b) => a.titre.localeCompare(b.titre, "fr")),
    }))
    .sort((a, b) => {
      if (!a.nom) return 1;
      if (!b.nom) return -1;
      return a.nom.localeCompare(b.nom, "fr");
    });
}
