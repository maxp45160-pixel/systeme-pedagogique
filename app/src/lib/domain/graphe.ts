/**
 * Construction pure du graphe de compétences (chantier graphe, ADR-056).
 *
 * Remplace `components/competences/graphe-donnees.ts`. Ce module n'importe
 * ni React ni aucun code serveur : il reçoit les entités du domaine et
 * produit des nœuds et des liens plats, sérialisables, que le composant
 * Canvas consomme.
 *
 * ## La règle qui gouverne tout ce fichier
 *
 * **Aucune arête n'est fabriquée.** La version précédente inventait des
 * chaînes de faux prérequis (compétences triées par code et reliées en
 * séquence quand le référentiel n'en déclarait pas assez) et regroupait des
 * domaines par mots-clés codés en dur (« stoïc », « conway »,
 * « domain-driven ») — cela viole l'invariant 6 du projet (« ne jamais
 * inventer de données ») et ne fonctionne que sur le référentiel pour lequel
 * ces mots-clés ont été écrits. Une compétence sans prérequis, sans thème et
 * sans exercice reste **isolée** dans le graphe : c'est une information
 * vraie et actionnable, pas un défaut à masquer.
 *
 * Quatre liens, tous dérivés d'un fait réel :
 *   - `prerequis`  : `skill.prerequis`, orienté ;
 *   - `theme`      : `Theme.codes` (ADR-053), hub non orienté ;
 *   - `exercice`   : `Exercise.competences`, hub non orienté ;
 *   - `similarite` : proximité de vocabulaire des intitulés (top-K mutuel,
 *     `lib/engine/similarite-textuelle.ts`) — un lien dérivé, jamais une
 *     mesure (invariant 5), toujours identifiable comme tel (poids < 1,
 *     rendu en pointillé côté composant).
 *
 * ## Espace de noms des identifiants
 *
 * Chaque id de nœud est préfixé par son type (`competence:LOG-01`,
 * `theme:abc`, `exercice:xyz`). La version précédente mélangeait des ids de
 * domaine et des codes de compétence dans le même espace, et une règle
 * entière de liens s'y perdait silencieusement (filtrée comme référence
 * inconnue à l'affichage). Extensible sans réécriture : une future entité
 * « note » ajoute son propre préfixe.
 *
 * ## Étiquettes
 *
 * `etiquettes` est le point d'extension vers un système de classification
 * façon Obsidian (domaine, palier, niveau, couverture — dérivées ici).
 * Quand une table `notes` existera, ses étiquettes libres s'ajouteront au
 * même tableau et les filtres du panneau de réglages marcheront sans
 * changement de modèle.
 */

import type { Exercise, Referentiel, SkillState } from "./types";
import type { Theme } from "./theme";
import type { IndexDocumentaire } from "@/lib/documents/index";
import {
  calculerSimilaritesTextuelles,
  type DocumentTexte,
} from "@/lib/engine/similarite-textuelle";

/* ------------------------------------------------------------------ */
/* Types exportés — consommés par le composant Canvas                  */
/* ------------------------------------------------------------------ */

export type TypeNoeud = "competence" | "exercice" | "theme" | "document";
// Extensible sans réécriture : "note" | "projet" | "document" | "cours" (lot 2, hors chantier).

export interface NoeudGraphe {
  /** Préfixé par type — voir l'en-tête du fichier. */
  id: string;
  type: TypeNoeud;
  libelle: string;
  /** `null` pour un thème : il peut traverser plusieurs domaines par nature. */
  domaineId: string | null;
  /** Étiquettes dérivées — domaine, palier, niveau, couverture. Extensible. */
  etiquettes: string[];
  /** Pilote le rayon affiché — un fait compté (observations, codes), jamais une mesure. */
  poidsAffichage: number;
}

export type TypeLien = "prerequis" | "theme" | "exercice" | "similarite" | "document";

export interface LienGraphe {
  source: string;
  target: string;
  type: TypeLien;
  /** 0–1. Module l'attraction du moteur de forces et l'opacité du trait. */
  poids: number;
  oriente: boolean;
}

export interface DonneesGraphe {
  noeuds: NoeudGraphe[];
  liens: LienGraphe[];
}

/* ------------------------------------------------------------------ */
/* Construction                                                        */
/* ------------------------------------------------------------------ */

const SEUIL_SIMILARITE = 0.05;
const TOP_K_SIMILARITE = 3;

export function construireGraphe(
  referentiel: Referentiel,
  etats: SkillState[],
  exercices: Exercise[],
  themes: Theme[],
  indexDocumentaire?: IndexDocumentaire,
): DonneesGraphe {
  const codesActifs = referentiel.codesActifs;
  const nomsDomaines = new Map(referentiel.domaines.map((d) => [d.id, d.nom]));

  const noeuds: NoeudGraphe[] = [];
  const idsCompetences = new Set<string>();

  // ── Nœuds compétence ──
  for (const e of etats) {
    if (!codesActifs.has(e.skill.code)) continue;
    const id = `competence:${e.skill.code}`;
    idsCompetences.add(id);
    noeuds.push({
      id,
      type: "competence",
      libelle: e.skill.intitule,
      domaineId: e.skill.domaine,
      etiquettes: [
        `domaine:${e.skill.domaine}`,
        `palier:${e.skill.palier}`,
        e.niveau === null ? "niveau:aucune-observation" : `niveau:${e.niveau}`,
      ],
      poidsAffichage: e.observations.length,
    });
  }

  const codeVersId = (code: string) => `competence:${code}`;

  // ── Liens prérequis (orientés, réels) ──
  const liens: LienGraphe[] = [];
  const vus = new Set<string>();
  function ajouter(l: LienGraphe) {
    const cle = `${l.type}:${l.source}->${l.target}`;
    if (vus.has(cle)) return;
    vus.add(cle);
    liens.push(l);
  }

  for (const e of etats) {
    if (!codesActifs.has(e.skill.code)) continue;
    for (const pre of e.skill.prerequis) {
      if (!codesActifs.has(pre)) continue; // prérequis archivé/disparu — écarté, pas fabriqué de repli
      ajouter({
        source: codeVersId(pre),
        target: codeVersId(e.skill.code),
        type: "prerequis",
        poids: 1,
        oriente: true,
      });
    }
  }

  // ── Nœuds thème + liens (hub non orienté, réel — ADR-053) ──
  // Un thème avec un seul code actif n'apporte aucun lien : il n'entre pas dans le graphe.
  for (const t of themes) {
    if (t.archive) continue;
    const codes = t.codes.filter((c) => codesActifs.has(c));
    if (codes.length < 2) continue;
    const idTheme = `theme:${t.id}`;
    const domainesTraverses = Array.from(
      new Set(
        codes
          .map((c) => referentiel.parCode.get(c)?.domaine)
          .filter((d): d is string => Boolean(d)),
      ),
    );
    const nomsDomainesTraverses = domainesTraverses
      .map((d) => nomsDomaines.get(d) ?? d)
      .slice(0, 3)
      .join(", ");
    const suffixe = domainesTraverses.length > 3 ? "…" : "";

    noeuds.push({
      id: idTheme,
      type: "theme",
      libelle: t.libelle,
      domaineId: null,
      etiquettes: [
        "Thème transversal",
        `${domainesTraverses.length} domaine${domainesTraverses.length > 1 ? "s" : ""} : ${nomsDomainesTraverses}${suffixe}`,
        `${codes.length} compétences reliées`,
        ...domainesTraverses.map((d) => `traverse:${d}`),
      ],
      poidsAffichage: codes.length,
    });
    for (const c of codes) {
      ajouter({ source: idTheme, target: codeVersId(c), type: "theme", poids: 0.6, oriente: false });
    }
  }

  // ── Nœuds exercice + liens (hub non orienté, réel) ──
  for (const ex of exercices) {
    if (ex.archive) continue;
    const codes = ex.competences.filter((c) => codesActifs.has(c));
    if (codes.length === 0) continue;
    const idExercice = `exercice:${ex.id}`;
    noeuds.push({
      id: idExercice,
      type: "exercice",
      libelle: ex.titre,
      domaineId: ex.domaine,
      etiquettes: [`domaine:${ex.domaine}`, "type:exercice"],
      poidsAffichage: codes.length,
    });
    for (const c of codes) {
      ajouter({ source: idExercice, target: codeVersId(c), type: "exercice", poids: 1, oriente: false });
    }
  }

  // ── Nœuds documents + liens Markdown réels ──
  // Les documents sont une extension du graphe existant, pas une hiérarchie
  // parallèle. Un lien n'entre ici que si sa cible correspond à un document,
  // une compétence active ou un exercice vivant.
  if (indexDocumentaire) {
    const idsDocuments = new Set<string>();
    for (const document of indexDocumentaire.documents) {
      const id = `document:${document.id}`;
      idsDocuments.add(id);
      const domaineBrut = document.frontMatter.domaine ?? document.frontMatter.domain;
      const domaineId = typeof domaineBrut === "string" && domaineBrut.trim() ? domaineBrut : null;
      const connexions =
        (indexDocumentaire.sortants.get(document.id)?.length ?? 0) +
        (indexDocumentaire.entrants.get(document.id)?.length ?? 0);
      noeuds.push({
        id,
        type: "document",
        libelle: document.titre,
        domaineId,
        etiquettes: [
          `type:${document.type ?? "document"}`,
          ...(document.typeConnu ? [`categorie:${document.typeConnu}`] : []),
        ],
        poidsAffichage: Math.max(1, connexions),
      });
    }

    const exercicesVivants = new Set(
      exercices.filter((exercice) => !exercice.archive).map((exercice) => exercice.id),
    );
    const cibleDocumentaire = (cible: string): string | null => {
      if (idsDocuments.has(`document:${cible}`)) return `document:${cible}`;
      if (codesActifs.has(cible)) return codeVersId(cible);
      const exerciceId = cible.startsWith("exercice:") ? cible.slice("exercice:".length) : cible;
      if (exercicesVivants.has(exerciceId)) return `exercice:${exerciceId}`;
      return null;
    };

    for (const lien of indexDocumentaire.liens) {
      if (!lien.resolu) continue;
      const source = `document:${lien.sourceId}`;
      const target = cibleDocumentaire(lien.cible);
      if (!idsDocuments.has(source) || !target) continue;
      ajouter({ source, target, type: "document", poids: 0.8, oriente: true });
    }
  }

  // ── Liens similarité (proximité de vocabulaire, dérivée — jamais une mesure) ──
  // Le palier n'entre PAS dans le corpus : c'est une étiquette catégorielle
  // (fondamentaux/intermédiaire/avancé), pas du vocabulaire distinctif — la
  // partager ferait apparaître « proches » des compétences qui n'ont rien de
  // commun sinon leur niveau. Seuls l'intitulé et le nom du domaine, le
  // contenu réel, alimentent la similarité.
  const documents: DocumentTexte[] = etats
    .filter((e) => codesActifs.has(e.skill.code))
    .map((e) => ({
      id: e.skill.code,
      fragments: [e.skill.intitule, nomsDomaines.get(e.skill.domaine) ?? ""],
    }));

  const similarites = calculerSimilaritesTextuelles(documents, TOP_K_SIMILARITE, SEUIL_SIMILARITE);
  for (const sim of similarites) {
    ajouter({
      source: codeVersId(sim.a),
      target: codeVersId(sim.b),
      type: "similarite",
      poids: sim.score,
      oriente: false,
    });
  }

  return { noeuds, liens };
}
