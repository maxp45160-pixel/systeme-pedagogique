/**
 * L'arbre des savoirs — un seul arbre, trois profondeurs.
 *
 * `arbre-competences.ts` dessine un domaine. Ce module dessine **tout**, sur
 * trois étages qui sont des zooms d'une même chose et non trois écrans :
 *
 *   région de la carte  →  domaine du compte  →  compétence
 *
 * C'est le classement (ADR-105) qui fournit le tronc. Sans lui, un « arbre
 * global » n'est qu'un nuage de compétences plus gros que le précédent : rien
 * ne dit ce qui va avec quoi au-dessus du domaine. C'est la raison d'être du
 * classement, et son premier bénéfice visible.
 *
 * ## Ce qui n'est pas fabriqué
 *
 * - **Un domaine non classé n'a pas de parent.** Aucune région « Divers »,
 *   aucun rattachement par défaut : il flotte, et c'est une information vraie —
 *   personne n'a encore dit où il va. L'interface l'affiche à part.
 * - **Une région n'apparaît que si un domaine y est classé.** La carte compte
 *   quarante-cinq nœuds ; les afficher tous donnerait un arbre dont l'immense
 *   majorité serait vide, ce qui décrit la carte et non le compte.
 * - **Une compétence rattachée (ADR-081) n'apparaît qu'une fois**, sous son
 *   domaine porteur. Un arbre où le même nœud existe deux fois n'est plus un
 *   arbre, et le dédoublement mentirait sur le nombre de compétences.
 * - **Aucune arête vers l'avant.** Comme dans `arbre-competences.ts` : les
 *   prérequis déclarés, rien d'autre. Un prérequis dont le code n'existe pas
 *   entre quand même, marqué fantôme — l'information « le chemin s'arrête ici »
 *   vaut mieux que le silence.
 *
 * Couche 3 (Décide) : entièrement dérivé, recalculé à chaque lecture.
 */

import { cheminCarte, rattachementDomaine } from "./carte-savoirs";
import { estMaitrisee } from "@/lib/engine/maitrise";
import { joursDepuis } from "@/lib/engine/dates";
import { FENETRE_ACTIVITE_JOURS } from "./graphe-domaines";
import type { DomaineId, Referentiel, SkillState } from "./types";

export type NiveauArbre = "region" | "domaine" | "competence";

/**
 * L'état d'une compétence dans l'arbre.
 *
 * Volontairement plus court que `StatutNoeudArbre` : à l'échelle où un écran
 * porte cent nœuds, six teintes ne se distinguent plus. `arbre-competences.ts`
 * garde la nuance fine pour la vue d'un domaine.
 */
export type EtatCompetenceArbre = "maitrisee" | "en-cours" | "ouverte" | "fantome";

export interface NoeudArbreSavoirs {
  /** Préfixé par niveau : `region:…`, `domaine:…`, `competence:…`. */
  id: string;
  niveau: NiveauArbre;
  libelle: string;
  /** Le nœud qui contient celui-ci. `null` pour une région, ou un domaine non classé. */
  parent: string | null;
  /** Renseigné pour une compétence, `null` au-dessus. */
  etat: EtatCompetenceArbre | null;
  /**
   * Ce qui pilote la taille affichée : nombre de descendants pour une région
   * ou un domaine, nombre d'observations pour une compétence. Un compte, jamais
   * une mesure de performance.
   */
  poids: number;
  /** Travaillé récemment — dérivé, jamais stocké. Faux sur un fantôme. */
  actif: boolean;
  /** Le domaine dont ce nœud relève, pour la teinte. `null` sur une région. */
  domaineId: DomaineId | null;
}

export interface LienArbreSavoirs {
  source: string;
  target: string;
  /** `contient` structure l'arbre ; `prerequis` le traverse. */
  type: "contient" | "prerequis";
  /** Vrai quand une extrémité est une compétence qui n'existe pas au référentiel. */
  fantome: boolean;
}

export interface ArbreSavoirs {
  noeuds: NoeudArbreSavoirs[];
  liens: LienArbreSavoirs[];
  /** Domaines vivants qu'aucune région ne recueille. Un fait, pas un défaut. */
  domainesNonClasses: DomaineId[];
}

export interface OptionsArbreSavoirs {
  /** Horloge injectée — le module reste pur et testable. */
  maintenant?: Date;
  fenetreActiviteJours?: number;
}

export function construireArbreSavoirs(
  referentiel: Referentiel,
  etats: SkillState[],
  options: OptionsArbreSavoirs = {},
): ArbreSavoirs {
  const { maintenant = new Date(), fenetreActiviteJours = FENETRE_ACTIVITE_JOURS } = options;
  const { codesActifs, parCode } = referentiel;

  const noeuds: NoeudArbreSavoirs[] = [];
  const liens: LienArbreSavoirs[] = [];
  const domainesNonClasses: DomaineId[] = [];

  const maitrisees = new Set(
    etats.filter((etat) => estMaitrisee(etat)).map((etat) => etat.skill.code),
  );

  /* ── Étage 3 : les compétences, groupées par domaine porteur ────────── */

  const etatsParDomaine = new Map<DomaineId, SkillState[]>();
  for (const etat of etats) {
    if (!codesActifs.has(etat.skill.code)) continue;
    const liste = etatsParDomaine.get(etat.skill.domaine) ?? [];
    liste.push(etat);
    etatsParDomaine.set(etat.skill.domaine, liste);
  }

  /* ── Étage 2 : les domaines vivants ─────────────────────────────────── */

  const domainesVivants = referentiel.domaines.filter((domaine) => !domaine.archive);
  /** Régions retenues : seulement celles qui recueillent réellement un domaine. */
  const regionsRetenues = new Map<string, string>();

  for (const domaine of domainesVivants) {
    const idDomaine = `domaine:${domaine.id}`;
    const competences = etatsParDomaine.get(domaine.id) ?? [];

    /*
     * Le classement pointe une discipline (« Informatique ») ; l'étage du
     * dessus est sa région (« Créations humaines »), c'est-à-dire l'ancêtre
     * juste sous la racine. Un rattachement devenu obsolète ne rattache plus :
     * son chemin est vide, le domaine flotte, et l'écran le dit.
     */
    const rattachement = rattachementDomaine(domaine);
    const chemin = rattachement && !rattachement.obsolete ? cheminCarte(rattachement.noeud) : [];
    const region = chemin.length > 1 ? chemin[1] : null;

    if (region) {
      regionsRetenues.set(region.id, region.nom);
      liens.push({
        source: `region:${region.id}`,
        target: idDomaine,
        type: "contient",
        fantome: false,
      });
    } else {
      domainesNonClasses.push(domaine.id);
    }

    const derniere = competences.reduce<string | null>(
      (recente, etat) =>
        etat.derniereObservation && (recente === null || etat.derniereObservation > recente)
          ? etat.derniereObservation
          : recente,
      null,
    );

    noeuds.push({
      id: idDomaine,
      niveau: "domaine",
      libelle: domaine.nom,
      parent: region ? `region:${region.id}` : null,
      etat: null,
      poids: competences.length,
      actif: derniere !== null && joursDepuis(derniere, maintenant) <= fenetreActiviteJours,
      domaineId: domaine.id,
    });

    for (const etat of competences) {
      const code = etat.skill.code;
      noeuds.push({
        id: `competence:${code}`,
        niveau: "competence",
        libelle: etat.skill.intitule,
        parent: idDomaine,
        etat: maitrisees.has(code)
          ? "maitrisee"
          : etat.observations.length > 0
            ? "en-cours"
            : "ouverte",
        poids: etat.observations.length,
        actif:
          etat.derniereObservation !== null &&
          joursDepuis(etat.derniereObservation, maintenant) <= fenetreActiviteJours,
        domaineId: domaine.id,
      });
      liens.push({
        source: idDomaine,
        target: `competence:${code}`,
        type: "contient",
        fantome: false,
      });
    }
  }

  /* ── Étage 1 : les régions qui recueillent quelque chose ────────────── */

  for (const [id, nom] of regionsRetenues) {
    noeuds.push({
      id: `region:${id}`,
      niveau: "region",
      libelle: nom,
      parent: null,
      etat: null,
      poids: liens.filter((lien) => lien.source === `region:${id}`).length,
      actif: false,
      domaineId: null,
    });
  }

  /* ── Les prérequis, y compris ceux qui pointent dans le vide ────────── */

  const presents = new Set(noeuds.map((noeud) => noeud.id));
  const fantomes = new Map<string, NoeudArbreSavoirs>();

  for (const etat of etats) {
    if (!codesActifs.has(etat.skill.code)) continue;
    for (const code of etat.skill.prerequis) {
      const idPrerequis = `competence:${code}`;
      const estFantome = !presents.has(idPrerequis);
      if (estFantome && !fantomes.has(idPrerequis)) {
        const connue = parCode.get(code);
        fantomes.set(idPrerequis, {
          id: idPrerequis,
          niveau: "competence",
          libelle: connue?.intitule ?? code,
          /* Sans domaine porteur vivant, il n'a pas de branche : il pend au sien. */
          parent: `domaine:${etat.skill.domaine}`,
          etat: "fantome",
          poids: 0,
          actif: false,
          domaineId: etat.skill.domaine,
        });
      }
      liens.push({
        source: idPrerequis,
        target: `competence:${etat.skill.code}`,
        type: "prerequis",
        fantome: estFantome,
      });
    }
  }
  noeuds.push(...fantomes.values());

  /*
   * Ordre stable : deux lectures du même référentiel rendent le même tableau.
   * Le rendu place ensuite les nœuds par simulation, mais l'entrée, elle, ne
   * doit pas varier — sinon rien n'est comparable d'une fois sur l'autre.
   */
  noeuds.sort((a, b) => a.niveau.localeCompare(b.niveau) || a.id.localeCompare(b.id));
  liens.sort(
    (a, b) =>
      a.type.localeCompare(b.type) ||
      a.source.localeCompare(b.source) ||
      a.target.localeCompare(b.target),
  );

  return { noeuds, liens, domainesNonClasses: [...domainesNonClasses].sort() };
}
