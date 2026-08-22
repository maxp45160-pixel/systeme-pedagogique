/**
 * L'arbre de progression d'un domaine.
 *
 * Le référentiel porte déjà tout ce qu'il faut pour le dessiner : `palier`
 * ordonne les rangées (`ORDRE_PALIERS`), `ordre` départage à l'intérieur d'une
 * rangée, `prerequis` donne les arêtes. Rien n'est ajouté au modèle — ce
 * module ne fait que projeter des faits déclarés dans une forme lisible.
 *
 * ## Ce qui est grisé, et pourquoi c'est vrai
 *
 * `graphe.ts` écarte un prérequis dont le code n'est pas actif (« prérequis
 * archivé/disparu — écarté, pas fabriqué de repli »). C'est correct pour un
 * graphe de forces, où un nœud sans données ne saurait pas quoi afficher.
 * Ici, l'information est au contraire ce que l'utilisateur veut voir : une
 * compétence en cite une autre qui n'existe pas encore dans son périmètre.
 * Ces nœuds entrent donc dans l'arbre, **marqués comme tels** :
 *
 *   - `hors-perimetre` : le code est connu du référentiel (`parCode`) mais
 *     archivé ou désactivé. Son intitulé et son palier sont réels ;
 *   - `non-creee` : le code n'est connu de personne. Ni intitulé ni palier
 *     n'existent — le nœud porte son code, et son palier est **emprunté** à
 *     la compétence qui le cite (`palierInconnu`), faute de tout autre.
 *
 * ## Ce que ce module refuse de faire
 *
 * Il n'invente **aucune arête vers l'avant**. Une « prochaine compétence
 * suggérée » ne peut apparaître que si quelque chose la déclare : une
 * compétence existante qui la cite en prérequis, ou plus tard une proposition
 * de tuteur horodatée. En attendant, l'arbre expose ses `feuilles` — les
 * compétences travaillées dont aucune suite n'est déclarée. C'est là, et
 * seulement là, que l'interface propose d'ouvrir un chemin. Un bouton de
 * création n'est pas une donnée fabriquée ; un faux nœud « à venir » en
 * serait une (invariant 6).
 *
 * ## Les prérequis restent indicatifs
 *
 * `Skill.prerequis` est documenté « indicatif, jamais bloquant ». Le statut
 * `prerequis-incomplet` est donc une **teinte d'affichage**, pas une serrure :
 * rien dans le produit n'empêche de travailler la compétence, et ce module ne
 * fournit à personne de quoi le faire.
 *
 * Couche 3 (Décide) : entièrement dérivé, jamais stocké.
 */

import {
  ORDRE_PALIERS,
  type DomaineId,
  type NiveauCompetence,
  type Palier,
  type Referentiel,
  type SkillState,
} from "./types";
import { estMaitrisee } from "@/lib/engine/maitrise";

/* ------------------------------------------------------------------ */
/* Types exportés                                                      */
/* ------------------------------------------------------------------ */

export type StatutNoeudArbre =
  /** Niveau ≥ seuil de maîtrise avec une confiance suffisante (`estMaitrisee`). */
  | "maitrisee"
  /** Au moins une observation, pas encore la maîtrise. */
  | "en-cours"
  /** Aucune observation ; aucun prérequis déclaré, ou tous maîtrisés. */
  | "disponible"
  /** Aucune observation ; au moins un prérequis pas encore maîtrisé. Indicatif. */
  | "prerequis-incomplet"
  /** Citée en prérequis, connue du référentiel, hors du périmètre de travail. */
  | "hors-perimetre"
  /** Citée en prérequis, inconnue du référentiel. Le chemin s'arrête là. */
  | "non-creee";

/** Les deux statuts qui ne correspondent à aucune compétence travaillable. */
export const STATUTS_FANTOMES: StatutNoeudArbre[] = ["hors-perimetre", "non-creee"];

export interface NoeudArbre {
  code: string;
  /** Le code lui-même quand aucun intitulé n'existe (`non-creee`). */
  intitule: string;
  palier: Palier;
  /**
   * Vrai quand le palier est **emprunté** à la compétence qui cite ce code,
   * faute d'en connaître un. Uniquement sur `non-creee`.
   */
  palierInconnu: boolean;
  /** `Skill.ordre` — départage les compétences d'un même palier. */
  rang: number;
  statut: StatutNoeudArbre;
  niveau: NiveauCompetence | null;
  nombreObservations: number;
  importance: number;
  /** Sert ce domaine sans en être portée (ADR-081). */
  rattachee: boolean;
  /** Le domaine porteur — le domaine courant sauf pour une rattachée. */
  domaine: DomaineId;
  /** Codes cités en prérequis, fantômes compris. */
  prerequis: string[];
  /** Codes des compétences actives qui citent celle-ci en prérequis. */
  suivantes: string[];
}

export interface RangeeArbre {
  palier: Palier;
  noeuds: NoeudArbre[];
}

export interface AreteArbre {
  /** Code du prérequis. */
  source: string;
  /** Code de la compétence qui le cite. */
  target: string;
  /** Vrai quand l'une des deux extrémités est un nœud fantôme. */
  fantome: boolean;
}

export interface ArbreDomaine {
  domaineId: DomaineId;
  rangees: RangeeArbre[];
  aretes: AreteArbre[];
  /**
   * Compétences déjà travaillées dont **aucune suite n'est déclarée**. Les
   * bouts du chemin : l'interface y propose d'en ouvrir la suite, sans
   * jamais préjuger de laquelle.
   */
  feuilles: string[];
}

/* ------------------------------------------------------------------ */
/* Construction                                                        */
/* ------------------------------------------------------------------ */

export function construireArbreDomaine(
  domaineId: DomaineId,
  referentiel: Referentiel,
  etats: SkillState[],
): ArbreDomaine {
  const { codesActifs } = referentiel;

  /* Les compétences du domaine : portées + rattachées (ADR-081). */
  const etatsDuDomaine = etats.filter((etat) => {
    if (!codesActifs.has(etat.skill.code)) return false;
    if (etat.skill.domaine === domaineId) return true;
    return (etat.skill.domainesSecondaires ?? []).includes(domaineId);
  });

  const maitrisees = new Set(
    etats.filter((etat) => estMaitrisee(etat)).map((etat) => etat.skill.code),
  );

  const suivantesParCode = new Map<string, string[]>();
  for (const etat of etats) {
    if (!codesActifs.has(etat.skill.code)) continue;
    for (const code of etat.skill.prerequis) {
      const liste = suivantesParCode.get(code);
      if (liste) liste.push(etat.skill.code);
      else suivantesParCode.set(code, [etat.skill.code]);
    }
  }

  const noeuds = new Map<string, NoeudArbre>();
  const aretes: AreteArbre[] = [];

  for (const etat of etatsDuDomaine) {
    const { skill } = etat;
    noeuds.set(skill.code, {
      code: skill.code,
      intitule: skill.intitule,
      palier: skill.palier,
      palierInconnu: false,
      rang: skill.ordre,
      statut: statutCompetence(etat, maitrisees),
      niveau: etat.niveau,
      nombreObservations: etat.observations.length,
      importance: skill.importance,
      rattachee: skill.domaine !== domaineId,
      domaine: skill.domaine,
      prerequis: [...skill.prerequis],
      suivantes: suivantesParCode.get(skill.code) ?? [],
    });
  }

  /*
   * Les nœuds fantômes. On ne les ajoute que pour un prérequis cité par une
   * compétence du domaine : un fantôme sans arête n'apprendrait rien.
   */
  for (const etat of etatsDuDomaine) {
    for (const code of etat.skill.prerequis) {
      if (!noeuds.has(code)) {
        noeuds.set(code, fantome(code, etat.skill.palier, referentiel, suivantesParCode));
      }
      const source = noeuds.get(code)!;
      aretes.push({
        source: code,
        target: etat.skill.code,
        fantome: STATUTS_FANTOMES.includes(source.statut),
      });
    }
  }

  const rangees: RangeeArbre[] = ORDRE_PALIERS.map((palier) => ({
    palier,
    noeuds: [...noeuds.values()]
      .filter((noeud) => noeud.palier === palier)
      .sort((a, b) => a.rang - b.rang || a.code.localeCompare(b.code)),
  })).filter((rangee) => rangee.noeuds.length > 0);

  const feuilles = [...noeuds.values()]
    .filter(
      (noeud) =>
        !STATUTS_FANTOMES.includes(noeud.statut) &&
        noeud.nombreObservations > 0 &&
        noeud.suivantes.length === 0,
    )
    .map((noeud) => noeud.code)
    .sort();

  aretes.sort((a, b) => a.source.localeCompare(b.source) || a.target.localeCompare(b.target));

  return { domaineId, rangees, aretes, feuilles };
}

function statutCompetence(etat: SkillState, maitrisees: Set<string>): StatutNoeudArbre {
  if (maitrisees.has(etat.skill.code)) return "maitrisee";
  if (etat.statut === "evalue" || etat.observations.length > 0) return "en-cours";
  const enAttente = etat.skill.prerequis.some((code) => !maitrisees.has(code));
  return enAttente ? "prerequis-incomplet" : "disponible";
}

/**
 * Un prérequis cité qu'on ne peut pas travailler.
 *
 * Deux cas nettement distincts, et jamais confondus à l'affichage : le
 * référentiel le connaît (intitulé et palier réels) ou personne ne le connaît
 * (le code fait office d'intitulé, le palier est emprunté).
 */
function fantome(
  code: string,
  palierCitant: Palier,
  referentiel: Referentiel,
  suivantesParCode: Map<string, string[]>,
): NoeudArbre {
  const connue = referentiel.parCode.get(code);
  return {
    code,
    intitule: connue?.intitule ?? code,
    palier: connue?.palier ?? palierCitant,
    palierInconnu: connue === undefined,
    rang: connue?.ordre ?? Number.MAX_SAFE_INTEGER,
    statut: connue ? "hors-perimetre" : "non-creee",
    niveau: null,
    nombreObservations: 0,
    importance: connue?.importance ?? 0,
    rattachee: false,
    domaine: connue?.domaine ?? "",
    prerequis: connue ? [...connue.prerequis] : [],
    suivantes: suivantesParCode.get(code) ?? [],
  };
}
