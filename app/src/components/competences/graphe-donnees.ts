/**
 * Construction pure des données du graphe de compétences.
 *
 * Ce module n'importe ni React ni aucun code serveur : il reçoit les entités
 * du domaine et produit les structures plates que le composant Canvas consomme.
 * Il peut donc être testé unitairement et importé depuis un Server Component
 * pour sérialiser les props.
 *
 * Quatre types de nœuds, quatre types d'arêtes :
 *
 * Nœuds :
 *   - domaine   (niveau 1 — catégories)
 *   - competence (niveau 2)
 *   - exercice   (niveau 3)
 *   - theme      (hub virtuel reliant des compétences croisées)
 *
 * Arêtes :
 *   - prerequis       skill A → skill B  (directionnel)
 *   - theme           skill ↔ hub thème  (co-appartenance)
 *   - exercice-skill  exercice → skill   (targeting)
 *   - semantic        domaine ↔ domaine  (similarité cosinus, pondérée)
 */

import type {
  Exercise,
  NiveauCompetence,
  Palier,
  Difficulte,
  Referentiel,
  SkillState,
} from "@/lib/domain/types";
import type { Theme } from "@/lib/domain/theme";
import { calculerSimilarites, type CorpusDomaine } from "@/lib/ui/micro-embedding";

/* ------------------------------------------------------------------ */
/* Types exportés — consommés par le composant Canvas                   */
/* ------------------------------------------------------------------ */

export interface NoeudDomaine {
  id: string;
  nom: string;
  prefixe: string;
  nombreCompetences: number;
  scoreMoyen: number | null;
}

export interface NoeudCompetence {
  code: string;
  intitule: string;
  domaineId: string;
  palier: Palier;
  niveau: NiveauCompetence | null;
  score: number | null;
  nombrePreuves: number;
  prerequis: string[];
  dernierePreuve: string | null;
}

export interface NoeudExercice {
  id: string;
  titre: string;
  difficulte: Difficulte;
  competences: string[];
  domaineId: string;
}

export interface LienTheme {
  themeId: string;
  libelle: string;
  codes: string[];
}

export interface Arete {
  source: string;
  target: string;
  type: "prerequis" | "theme" | "exercice-skill" | "inter-domaine" | "semantic";
  /** Poids de l'arête (0–1). Utilisé par le moteur pour moduler l'attraction.
   *  1 = attraction maximale, 0 = arête décorative. Absent = 1. */
  poids?: number;
}

export interface DonneesGraphe {
  domaines: NoeudDomaine[];
  competences: NoeudCompetence[];
  exercices: NoeudExercice[];
  themes: LienTheme[];
  aretes: Arete[];
  /** Similarités sémantiques inter-domaines (pour debug / légende). */
  similarites: { domaineA: string; domaineB: string; score: number }[];
}

/* ------------------------------------------------------------------ */
/* Construction                                                        */
/* ------------------------------------------------------------------ */

export function construireGraphe(
  referentiel: Referentiel,
  etats: SkillState[],
  exercices: Exercise[],
  themes: Theme[],
): DonneesGraphe {
  const etatsParCode = new Map(etats.map((e) => [e.skill.code, e]));
  const codesActifs = new Set(referentiel.actifs.map((s) => s.code));

  // ── Nœuds domaines ──
  const noeudsParDomaine = new Map<string, NoeudDomaine>();
  for (const d of referentiel.domaines) {
    const competencesDomaine = etats.filter((e) => e.skill.domaine === d.id);
    const evaluees = competencesDomaine.filter((e) => e.niveau !== null);
    const scoreMoyen =
      evaluees.length > 0
        ? evaluees.reduce((s, e) => s + (e.score ?? 0), 0) / evaluees.length
        : null;

    noeudsParDomaine.set(d.id, {
      id: d.id,
      nom: d.nom,
      prefixe: d.prefixe,
      nombreCompetences: competencesDomaine.length,
      scoreMoyen,
    });
  }

  // ── Nœuds compétences ──
  const noeudsCompetences: NoeudCompetence[] = etats.map((e) => ({
    code: e.skill.code,
    intitule: e.skill.intitule,
    domaineId: e.skill.domaine,
    palier: e.skill.palier,
    niveau: e.niveau,
    score: e.score,
    nombrePreuves: e.preuves.length,
    prerequis: e.skill.prerequis.filter((p) => codesActifs.has(p)),
    dernierePreuve: e.dernierePreuve,
  }));

  // ── Nœuds exercices (non archivés uniquement) ──
  const noeudsExercices: NoeudExercice[] = exercices
    .filter((e) => !e.archive)
    .map((e) => ({
      id: e.id,
      titre: e.titre,
      difficulte: e.difficulte,
      competences: e.competences.filter((c) => codesActifs.has(c)),
      domaineId: e.domaine,
    }));

  // ── Thèmes actifs (non archivés, avec au moins 2 codes actifs) ──
  const themesActifs: LienTheme[] = themes
    .filter((t) => !t.archive)
    .map((t) => ({
      themeId: t.id,
      libelle: t.libelle,
      codes: t.codes.filter((c) => codesActifs.has(c)),
    }))
    .filter((t) => t.codes.length >= 2);

  // ── Arêtes ──
  const aretes: Arete[] = [];
  const areteSet = new Set<string>(); // dédoublonnage
  function ajouterArete(a: Arete) {
    const minCode = a.source < a.target ? a.source : a.target;
    const maxCode = a.source < a.target ? a.target : a.source;
    const cle = `${a.type}:${minCode}:${maxCode}`;
    if (!areteSet.has(cle)) {
      areteSet.add(cle);
      aretes.push(a);
    }
  }

  // 1. Prérequis explicites
  for (const c of noeudsCompetences) {
    for (const pre of c.prerequis) {
      if (etatsParCode.has(pre)) {
        ajouterArete({ source: pre, target: c.code, type: "prerequis", poids: 1 });
      }
    }
  }

  // 2. Backbone de progression naturelle par domaine (pour éviter les compétences orphelines comme FTS-01..07)
  // Pour chaque domaine, on trie les compétences par code et on relie les compétences consécutives d'un même palier
  const competencesParDomaine = new Map<string, NoeudCompetence[]>();
  for (const c of noeudsCompetences) {
    const list = competencesParDomaine.get(c.domaineId) ?? [];
    list.push(c);
    competencesParDomaine.set(c.domaineId, list);
  }

  for (const [, list] of competencesParDomaine) {
    // Trier par code (ex: FTS-01, FTS-02...)
    list.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

    // Si pas ou peu de prérequis explicites dans ce domaine, créer une chaîne séquentielle
    const prerequisCount = list.reduce((acc, c) => acc + c.prerequis.length, 0);
    if (prerequisCount < list.length - 1) {
      for (let i = 0; i < list.length - 1; i++) {
        ajouterArete({
          source: list[i].code,
          target: list[i + 1].code,
          type: "prerequis",
          poids: 0.7,
        });
      }
    }
  }

  // 3. Thèmes → chaîne séquentielle (et non pas clique complète N*(N-1)/2 pour éviter l'effet toile d'araignée sur MIG)
  for (const t of themesActifs) {
    for (let i = 0; i < t.codes.length - 1; i++) {
      ajouterArete({
        source: t.codes[i],
        target: t.codes[i + 1],
        type: "theme",
        poids: 0.6,
      });
    }
  }

  // 4. Exercice → compétence
  for (const ex of noeudsExercices) {
    for (const code of ex.competences) {
      ajouterArete({ source: ex.id, target: code, type: "exercice-skill", poids: 1 });
    }
  }

  // 5. Inter-domaines (dérivé des prérequis croisés, thèmes partagés et chaîne séquentielle)
  const domaineParCode = new Map<string, string>();
  for (const c of noeudsCompetences) {
    domaineParCode.set(c.code, c.domaineId);
  }

  // 5a. Prérequis inter-domaines explicites (priorité maximale, poids 1.0)
  for (const c of noeudsCompetences) {
    for (const pre of c.prerequis) {
      const domPre = domaineParCode.get(pre);
      if (domPre && domPre !== c.domaineId) {
        ajouterArete({ source: domPre, target: c.code, type: "inter-domaine", poids: 1 });
      }
    }
  }

  // 5b. Thèmes & Exercices inter-domaines (poids 0.8)
  for (const t of themesActifs) {
    const domainesTheme = new Set(
      t.codes.map((c) => domaineParCode.get(c)).filter(Boolean) as string[],
    );
    const liste = [...domainesTheme];
    for (let i = 0; i < liste.length - 1; i++) {
      ajouterArete({ source: liste[i], target: liste[i + 1], type: "inter-domaine", poids: 0.8 });
    }
  }

  for (const ex of noeudsExercices) {
    const domainesEx = new Set(
      ex.competences.map((c) => domaineParCode.get(c)).filter(Boolean) as string[],
    );
    const liste = [...domainesEx];
    for (let i = 0; i < liste.length - 1; i++) {
      ajouterArete({ source: liste[i], target: liste[i + 1], type: "inter-domaine", poids: 0.7 });
    }
  }

  // 5c. Chaîne séquentielle par matière / ordre du référentiel (Poids 0.5)
  // Garantit que CHAQUE domaine a au moins une ligne de connexion dans le graphe des catégories.
  const domainesListe = [...noeudsParDomaine.values()];

  // Regrouper dynamiquement les domaines par famille thématique (mots-clés principaux ou ordre)
  const groupesFamille = new Map<string, NoeudDomaine[]>();
  for (const d of domainesListe) {
    // Extraire la clé de famille (ex: stoïcisme, dev, math, ou 3 premières lettres)
    const nomLower = d.nom.toLowerCase();
    let famille = "autre";
    if (nomLower.includes("stoïc") || nomLower.includes("stoic") || nomLower.includes("éthique") || nomLower.includes("émotions")) {
      famille = "stoicisme";
    } else if (nomLower.includes("logici") || nomLower.includes("architect") || nomLower.includes("modul") || nomLower.includes("conway") || nomLower.includes("couplage") || nomLower.includes("domain-driven")) {
      famille = "logiciel";
    } else if (nomLower.includes("statist") || nomLower.includes("math") || nomLower.includes("probabi")) {
      famille = "logiciel"; // relier les stats/maths aux sciences/tech
    }
    const list = groupesFamille.get(famille) ?? [];
    list.push(d);
    groupesFamille.set(famille, list);
  }

  // Pour chaque famille de domaines, créer une chaîne séquentielle propre
  for (const [, list] of groupesFamille) {
    for (let i = 0; i < list.length - 1; i++) {
      ajouterArete({
        source: list[i].id,
        target: list[i + 1].id,
        type: "inter-domaine",
        poids: 0.5,
      });
    }
  }

  // fallback de secours : si un domaine n'a aucune ligne, le relier au domaine précédent dans la liste globale
  const degresDomaines = new Map<string, number>();
  for (const d of domainesListe) degresDomaines.set(d.id, 0);
  for (const a of aretes) {
    if (a.type === "inter-domaine") {
      degresDomaines.set(a.source, (degresDomaines.get(a.source) ?? 0) + 1);
      degresDomaines.set(a.target, (degresDomaines.get(a.target) ?? 0) + 1);
    }
  }

  for (let i = 0; i < domainesListe.length; i++) {
    const d = domainesListe[i];
    if ((degresDomaines.get(d.id) ?? 0) === 0 && i > 0) {
      const prev = domainesListe[i - 1];
      ajouterArete({ source: prev.id, target: d.id, type: "inter-domaine", poids: 0.4 });
    }
  }

  // 5d. Similarité sémantique (micro-embedding top-K) — arêtes `semantic`,
  // distinctes des liens durs pour être différenciées visuellement. Universel :
  // aucune chaîne en dur, s'applique à n'importe quelles données utilisateur.
  const corpus: CorpusDomaine[] = referentiel.domaines.map((d) => ({
    id: d.id,
    nom: d.nom,
    description: d.description,
    intitules: referentiel.actifs
      .filter((s) => s.domaine === d.id)
      .map((s) => s.intitule),
  }));

  const similarites = calculerSimilarites(corpus, 2, 0.05);

  for (const sim of similarites) {
    const [a, b] = [sim.domaineA, sim.domaineB].sort();
    ajouterArete({
      source: a,
      target: b,
      type: "semantic",
      poids: sim.score,
    });
  }

  return {
    domaines: [...noeudsParDomaine.values()].filter((d) => d.nombreCompetences > 0),
    competences: noeudsCompetences,
    exercices: noeudsExercices,
    themes: themesActifs,
    aretes,
    similarites,
  };
}
