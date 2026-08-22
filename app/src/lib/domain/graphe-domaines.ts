/**
 * Le graphe **des domaines** — la vue d'ensemble de l'Atelier.
 *
 * `graphe.ts` répond à « comment mes compétences se tiennent ». Ce module
 * répond à l'échelon au-dessus : « comment mes domaines se tiennent ». Ce
 * n'est pas un second classement des mêmes objets (l'erreur de l'onglet
 * « Transversal » retiré) : les nœuds sont d'une autre nature — un domaine,
 * pas une compétence — et aucune arête n'est reprise telle quelle.
 *
 * ## La règle héritée de `graphe.ts`, et non négociable ici non plus
 *
 * **Aucune arête n'est fabriquée.** Trois liens, tous dérivés d'un fait déjà
 * déclaré dans le référentiel du compte :
 *
 *   - `prerequis`     : une compétence de A est prérequis d'une compétence de
 *     B (`Skill.prerequis` traversant une frontière de domaine), orienté ;
 *   - `rattachement`  : une même compétence est taguée sur A et sur B
 *     (`Skill.tagsDomaine`, ADR-107), non orienté ;
 *   - `exercice`      : un même exercice vivant mobilise des compétences de A
 *     et de B, non orienté.
 *
 * Un domaine sans aucune de ces trois traces reste **isolé**. C'est une
 * information vraie — « rien ne relie encore ce sujet au reste » — et non un
 * défaut d'affichage à combler par une proximité de vocabulaire. La
 * similarité textuelle est délibérément absente : sur deux ou trois mots de
 * nom de domaine elle produirait des voisinages au hasard, là où elle a du
 * sens sur des intitulés de compétences.
 *
 * ## Ce que le module ne fait pas
 *
 * Il ne situe pas le référentiel du compte sur une carte partagée des savoirs :
 * la carte globale a été retirée le 21/08/2026 (ADR-099) et son retour est
 * conditionné à un contenu initial nommé. Ce graphe ne compose que des faits
 * locaux, et se suffit à lui-même.
 *
 * Couche 3 (Décide) : entièrement dérivé, recalculé à chaque lecture, jamais
 * stocké.
 */

import type { DomaineId, Exercise, Referentiel, SkillState } from "./types";
import { domainesVisibles } from "./hierarchie-domaines";
import { joursDepuis } from "@/lib/engine/dates";

/* ------------------------------------------------------------------ */
/* Types exportés                                                      */
/* ------------------------------------------------------------------ */

export interface NoeudDomaine {
  id: DomaineId;
  nom: string;
  prefixe: string;
  description: string;
  /** Tags directs **et** hérités du sous-arbre (ADR-107) : ce que le domaine couvre réellement. */
  nombreCompetences: number;
  /** Parmi elles, celles qui portent au moins une observation. */
  nombreEvaluees: number;
  /** `nombreEvaluees / nombreCompetences`, 0 quand le domaine est vide. */
  couverture: number;
  /** Observation la plus récente du domaine (ISO), `null` si aucune. */
  derniereObservation: string | null;
  /**
   * Travaillé récemment — dérivé de `derniereObservation` et de la fenêtre
   * passée en option. Ce qui distingue la vue « domaines actifs » du reste.
   */
  actif: boolean;
}

export type TypeLienDomaine = "prerequis" | "rattachement" | "exercice";

export interface LienDomaine {
  source: DomaineId;
  target: DomaineId;
  type: TypeLienDomaine;
  /**
   * Combien de faits distincts soutiennent ce lien — couples de compétences
   * pour `prerequis`, compétences rattachées pour `rattachement`, exercices
   * partagés pour `exercice`. Un compte, jamais une mesure de performance.
   */
  occurrences: number;
  /** `occurrences` rapporté au maximum du **même type**, dans ]0, 1]. */
  poids: number;
  oriente: boolean;
}

export interface GrapheDomaines {
  noeuds: NoeudDomaine[];
  liens: LienDomaine[];
}

export interface OptionsGrapheDomaines {
  /** Horloge injectée — le module reste pur et testable. */
  maintenant?: Date;
  /** En deçà de combien de jours un domaine est dit « actif ». Défaut : 30. */
  fenetreActiviteJours?: number;
}

export const FENETRE_ACTIVITE_JOURS = 30;

/* ------------------------------------------------------------------ */
/* Construction                                                        */
/* ------------------------------------------------------------------ */

export function construireGrapheDomaines(
  referentiel: Referentiel,
  etats: SkillState[],
  exercices: Exercise[],
  options: OptionsGrapheDomaines = {},
): GrapheDomaines {
  const { maintenant = new Date(), fenetreActiviteJours = FENETRE_ACTIVITE_JOURS } = options;
  const { codesActifs, parCode } = referentiel;

  const domainesVivants = referentiel.domaines.filter((domaine) => !domaine.archive);
  const idsVivants = new Set(domainesVivants.map((domaine) => domaine.id));

  /* ── Agrégats par domaine ───────────────────────────────────────── */

  interface Agregat {
    competences: number;
    evaluees: number;
    derniere: string | null;
  }
  const agregats = new Map<DomaineId, Agregat>(
    domainesVivants.map((domaine) => [domaine.id, { competences: 0, evaluees: 0, derniere: null }]),
  );

  for (const etat of etats) {
    if (!codesActifs.has(etat.skill.code)) continue;
    /*
     * Une compétence compte dans la couverture de chaque domaine qu'elle sert
     * — ses tags, et leurs ancêtres par héritage (ADR-107) — jamais dans un
     * score global, qui somme sur les compétences et non sur les domaines.
     */
    const cibles = domainesVisibles(referentiel.domaines, etat.skill.tagsDomaine ?? []);
    for (const cible of cibles) {
      const agregat = agregats.get(cible);
      if (!agregat) continue; // domaine archivé ou inconnu — écarté, pas fabriqué
      agregat.competences += 1;
      if (etat.statut === "evalue") agregat.evaluees += 1;
      if (
        etat.derniereObservation &&
        (agregat.derniere === null || etat.derniereObservation > agregat.derniere)
      ) {
        agregat.derniere = etat.derniereObservation;
      }
    }
  }

  const noeuds: NoeudDomaine[] = domainesVivants
    .map((domaine) => {
      const agregat = agregats.get(domaine.id) ?? { competences: 0, evaluees: 0, derniere: null };
      return {
        id: domaine.id,
        nom: domaine.nom,
        prefixe: domaine.prefixe,
        description: domaine.description,
        nombreCompetences: agregat.competences,
        nombreEvaluees: agregat.evaluees,
        couverture: agregat.competences === 0 ? 0 : agregat.evaluees / agregat.competences,
        derniereObservation: agregat.derniere,
        actif:
          agregat.derniere !== null &&
          joursDepuis(agregat.derniere, maintenant) <= fenetreActiviteJours,
      };
    })
    .sort((a, b) => ordreDomaine(referentiel, a.id) - ordreDomaine(referentiel, b.id));

  /* ── Arêtes ─────────────────────────────────────────────────────── */

  const compteurs = new Map<string, LienDomaine>();

  function ajouter(
    source: DomaineId,
    target: DomaineId,
    type: TypeLienDomaine,
    oriente: boolean,
  ) {
    if (source === target) return;
    if (!idsVivants.has(source) || !idsVivants.has(target)) return;
    /* Un lien non orienté a une seule clé, quel que soit l'ordre des extrémités. */
    const [a, b] = oriente ? [source, target] : [source, target].sort();
    const cle = `${type}:${a}->${b}`;
    const existant = compteurs.get(cle);
    if (existant) {
      existant.occurrences += 1;
      return;
    }
    compteurs.set(cle, { source: a, target: b, type, occurrences: 1, poids: 0, oriente });
  }

  // Prérequis traversant une frontière de domaine.
  for (const etat of etats) {
    if (!codesActifs.has(etat.skill.code)) continue;
    for (const code of etat.skill.prerequis) {
      if (!codesActifs.has(code)) continue; // prérequis disparu — écarté, pas de repli
      const amont = parCode.get(code);
      if (!amont) continue;
      ajouter(amont.domaine, etat.skill.domaine, "prerequis", true);
    }
  }

  // Tags déclarés (ADR-107) : une compétence taguée sur plusieurs domaines les
  // relie deux à deux. Aucun sens de lecture — il n'y a plus de porteur dont
  // les autres dépendraient, seulement des domaines qu'une même compétence sert.
  for (const etat of etats) {
    if (!codesActifs.has(etat.skill.code)) continue;
    const tags = [...new Set(etat.skill.tagsDomaine ?? [])];
    for (let i = 0; i < tags.length; i += 1) {
      for (let j = i + 1; j < tags.length; j += 1) {
        ajouter(tags[i], tags[j], "rattachement", false);
      }
    }
  }

  // Exercices vivants mobilisant plusieurs domaines.
  for (const exercice of exercices) {
    if (exercice.archive) continue;
    const domaines = new Set<DomaineId>();
    for (const code of exercice.competences) {
      if (!codesActifs.has(code)) continue;
      const skill = parCode.get(code);
      if (!skill) continue;
      domaines.add(skill.domaine);
    }
    const liste = [...domaines].sort();
    for (let i = 0; i < liste.length; i += 1) {
      for (let j = i + 1; j < liste.length; j += 1) {
        ajouter(liste[i], liste[j], "exercice", false);
      }
    }
  }

  const liens = [...compteurs.values()];
  const maxParType = new Map<TypeLienDomaine, number>();
  for (const lien of liens) {
    maxParType.set(lien.type, Math.max(maxParType.get(lien.type) ?? 0, lien.occurrences));
  }
  for (const lien of liens) {
    lien.poids = lien.occurrences / (maxParType.get(lien.type) ?? 1);
  }

  liens.sort(
    (a, b) =>
      a.type.localeCompare(b.type) ||
      a.source.localeCompare(b.source) ||
      a.target.localeCompare(b.target),
  );

  return { noeuds, liens };
}

function ordreDomaine(referentiel: Referentiel, id: DomaineId): number {
  return referentiel.domainesParId.get(id)?.ordre ?? Number.MAX_SAFE_INTEGER;
}
