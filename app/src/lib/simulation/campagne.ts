/**
 * La campagne — beaucoup de parcours, pour que les chiffres veuillent dire
 * quelque chose.
 *
 * ## Le défaut que ce module corrige
 *
 * Un parcours unique donne un point sans dispersion : « 38 % des exercices dans
 * la zone » peut valoir 30 % ou 48 % à la graine suivante, et rien ne le dit.
 * Pire, tout est conditionné à UN profil d'apprenant : « le moteur sert trop
 * dur » veut alors dire « trop dur pour celui-là ». Un tel chiffre ne fonde
 * aucune décision.
 *
 * Trois réponses, et elles se cumulent :
 *
 * 1. **plusieurs graines** — chaque mesure devient une médiane et un écart
 *    interquartile ; une différence dont les intervalles se recouvrent n'est pas
 *    une différence ;
 * 2. **plusieurs archétypes** — un constat qui tient sur quatre profils sur six
 *    parle du moteur, un constat isolé décrit l'archétype ;
 * 3. **plusieurs bras** — le moteur face à des politiques naïves (le témoin) et
 *    face à lui-même amputé d'un sous-système (l'ablation). C'est ce qui
 *    transforme « écart de 0,73 » en « la calibration en explique 0,2 ».
 *
 * ## Ce que la campagne ne fait pas
 *
 * Elle ne teste aucune hypothèse au sens statistique : pas de valeur-p, pas
 * d'intervalle de confiance paramétrique. Les tirages ne sont pas des
 * observations indépendantes du monde réel, seulement des rejeux d'un modèle
 * qu'on a écrit soi-même — un test d'hypothèse là-dessus donnerait une rigueur
 * apparente à une convention. Médiane, quartiles, recouvrement : ce qui se lit
 * sans supposer une loi.
 */

import {
  ARCHETYPES,
  archetypeParId,
  construireMondeFictif,
  type Archetype,
} from "./monde";
import { BRAS, brasParId, deroulerParcoursLong, type Bras } from "./parcours-long";
import { construireTableauDeBord, type TableauDeBord } from "./tableau-de-bord";

/* ------------------------------------------------------------------ */
/* Les mesures suivies d'un run à l'autre                              */
/* ------------------------------------------------------------------ */

/** Vers où il vaut mieux aller. `null` : ni bien ni mal, on l'observe. */
export type Sens = "haut" | "bas" | "neutre";

export interface DefinitionMesure {
  cle: string;
  libelle: string;
  unite: string;
  sens: Sens;
  /**
   * Vraie quand la mesure ne dépend pas du moteur pour être calculée.
   *
   * Le score global, le niveau, les compétences « maîtrisées » sont produits
   * par le moteur lui-même : les comparer d'un bras à l'autre revient à lui
   * demander de se noter. Les mesures externes — aptitude réelle, temps passé,
   * objectifs atteints — sont les seules qui arbitrent honnêtement.
   */
  externe: boolean;
  valeur: (t: TableauDeBord) => number | null;
}

export const MESURES: DefinitionMesure[] = [
  {
    cle: "gain-par-heure",
    libelle: "Gain d'aptitude réelle par heure",
    unite: "niveau/h",
    sens: "haut",
    externe: true,
    valeur: (t) => t.resultatReel.gainParHeure,
  },
  {
    cle: "gain-total",
    libelle: "Gain d'aptitude réelle total",
    unite: "niveaux",
    sens: "haut",
    externe: true,
    valeur: (t) => t.resultatReel.gainAptitudeTotal,
  },
  {
    cle: "objectifs",
    libelle: "Objectifs résolus",
    unite: "part",
    sens: "haut",
    externe: true,
    valeur: (t) => t.resultatReel.partObjectifsResolus,
  },
  {
    cle: "jours-resolution",
    libelle: "Jours médians jusqu'à un objectif",
    unite: "jours",
    sens: "bas",
    externe: true,
    valeur: (t) => t.resultatReel.joursMedianResolution,
  },
  {
    cle: "couverture",
    libelle: "Compétences observées au moins une fois",
    unite: "part",
    sens: "haut",
    externe: true,
    valeur: (t) => t.resultatReel.couverture,
  },
  {
    cle: "heures",
    libelle: "Heures de travail",
    unite: "heures",
    sens: "neutre",
    externe: true,
    valeur: (t) => t.resultatReel.heures,
  },
  {
    cle: "ecart-moyen",
    libelle: "Écart au réel (niveau estimé − aptitude)",
    unite: "niveaux",
    sens: "bas",
    externe: false,
    valeur: (t) => t.justesse.ecartMoyen,
  },
  {
    cle: "biais",
    libelle: "Biais d'estimation",
    unite: "niveaux",
    sens: "neutre",
    externe: false,
    valeur: (t) => t.justesse.biais,
  },
  {
    cle: "correlation",
    libelle: "Corrélation de rangs estimé / réel",
    unite: "coefficient",
    sens: "haut",
    externe: false,
    valeur: (t) => t.justesse.correlationRangs,
  },
  {
    cle: "zone",
    libelle: "Exercices servis dans la zone (±1 niveau)",
    unite: "part",
    sens: "haut",
    externe: true,
    valeur: (t) => t.selection.partDansZone,
  },
  {
    cle: "reussite",
    libelle: "Taux de réussite des exercices menés",
    unite: "part",
    sens: "neutre",
    externe: true,
    valeur: (t) => t.selection.tauxReussite,
  },
  {
    cle: "exercices-generes",
    libelle: "Exercices fabriqués faute de disponible",
    unite: "exercices",
    sens: "bas",
    externe: false,
    valeur: (t) => t.entete.exercicesGeneres,
  },
  {
    cle: "brier",
    libelle: "Brier — prédiction de réussite",
    unite: "score",
    sens: "bas",
    externe: false,
    valeur: (t) => t.metriques.find((m) => m.nom === "brier-reussite")?.valeur ?? null,
  },
  {
    cle: "invariants",
    libelle: "Ruptures d'invariant",
    unite: "occurrences",
    sens: "bas",
    externe: false,
    valeur: (t) => t.entete.invariants,
  },
];

/* ------------------------------------------------------------------ */
/* Un run                                                              */
/* ------------------------------------------------------------------ */

export interface LigneRun {
  graine: number;
  archetype: string;
  bras: string;
  valeurs: Record<string, number | null>;
  /** Statut de chaque verdict du run — sert à mesurer leur stabilité. */
  verdicts: Record<string, string>;
}

export interface PlanCampagne {
  graines: number[];
  archetypes: string[];
  bras: string[];
  runs: { graine: number; archetype: string; bras: string }[];
}

export const GRAINES_PAR_DEFAUT = [20260821, 7, 4242, 1789, 90125];

/**
 * Le préréglage du navigateur : assez pour trancher, assez court pour attendre.
 *
 * Trois archétypes contrastés × trois graines × cinq bras = 45 parcours, une
 * trentaine de secondes. La matrice complète (six archétypes, cinq graines,
 * huit bras) vit dans le script Node : deux minutes et demie, hors d'un onglet.
 */
export function planRapide(): PlanCampagne {
  return planifierCampagne({
    graines: GRAINES_PAR_DEFAUT.slice(0, 3),
    archetypes: ["regulier", "irregulier", "en-difficulte"],
    bras: ["moteur", "aleatoire", "tourniquet", "sans-calibration", "sans-revision"],
  });
}

export function planComplet(): PlanCampagne {
  return planifierCampagne({
    graines: GRAINES_PAR_DEFAUT,
    archetypes: ARCHETYPES.map((a) => a.id),
    bras: BRAS.map((b) => b.id),
  });
}

export function planifierCampagne(options: {
  graines: number[];
  archetypes: string[];
  bras: string[];
}): PlanCampagne {
  const runs: PlanCampagne["runs"] = [];
  for (const archetype of options.archetypes) {
    for (const graine of options.graines) {
      for (const bras of options.bras) {
        runs.push({ graine, archetype, bras });
      }
    }
  }
  return { ...options, runs };
}

/** Un parcours complet, réduit à ses mesures. Rien d'autre n'est conservé. */
export function executerRun(run: {
  graine: number;
  archetype: string;
  bras: string;
}): LigneRun {
  const archetype: Archetype = archetypeParId(run.archetype);
  const bras: Bras = brasParId(run.bras);
  const monde = construireMondeFictif(run.graine, archetype);
  const tableau = construireTableauDeBord(deroulerParcoursLong(monde, { bras }));

  const valeurs: Record<string, number | null> = {};
  for (const mesure of MESURES) valeurs[mesure.cle] = mesure.valeur(tableau);

  const verdicts: Record<string, string> = {};
  for (const verdict of tableau.verdicts) verdicts[verdict.cle] = verdict.statut;

  return { graine: run.graine, archetype: run.archetype, bras: run.bras, valeurs, verdicts };
}

/* ------------------------------------------------------------------ */
/* Agrégation                                                          */
/* ------------------------------------------------------------------ */

export interface Serie {
  n: number;
  mediane: number;
  q1: number;
  q3: number;
  min: number;
  max: number;
}

function quantile(triees: number[], part: number): number {
  if (triees.length === 0) return 0;
  const rang = (triees.length - 1) * part;
  const bas = Math.floor(rang);
  const haut = Math.ceil(rang);
  if (bas === haut) return triees[bas];
  return triees[bas] + (triees[haut] - triees[bas]) * (rang - bas);
}

export function serie(valeurs: (number | null)[]): Serie | null {
  const nettes = valeurs.filter((v): v is number => v !== null && Number.isFinite(v));
  if (nettes.length === 0) return null;
  const triees = [...nettes].sort((a, b) => a - b);
  return {
    n: triees.length,
    mediane: Math.round(quantile(triees, 0.5) * 1000) / 1000,
    q1: Math.round(quantile(triees, 0.25) * 1000) / 1000,
    q3: Math.round(quantile(triees, 0.75) * 1000) / 1000,
    min: triees[0],
    max: triees[triees.length - 1],
  };
}

export type Comparaison = "mieux" | "equivalent" | "pire" | "indecidable";

/**
 * Deux séries se distinguent-elles ?
 *
 * Recouvrement des interquartiles : si les boîtes se chevauchent, on ne
 * conclut pas. C'est volontairement sévère — la moitié des « améliorations »
 * qu'on croit voir sur un run unique disparaissent à ce test.
 */
export function comparer(a: Serie | null, b: Serie | null, sens: Sens): Comparaison {
  if (a === null || b === null || sens === "neutre") return "indecidable";
  const disjoints = a.q1 > b.q3 || b.q1 > a.q3;
  if (!disjoints) return "equivalent";
  const meilleur = sens === "haut" ? a.mediane > b.mediane : a.mediane < b.mediane;
  return meilleur ? "mieux" : "pire";
}

export interface MesureCampagne {
  cle: string;
  libelle: string;
  unite: string;
  sens: Sens;
  externe: boolean;
  /** Distribution du bras moteur, tous archétypes confondus. */
  moteur: Serie | null;
  parBras: { bras: string; libelle: string; temoin: boolean; serie: Serie | null }[];
  parArchetype: { archetype: string; libelle: string; serie: Serie | null }[];
  /** Le meilleur témoin naïf, et ce que le moteur vaut face à lui. */
  meilleurTemoin: { bras: string; libelle: string; serie: Serie | null } | null;
  face: Comparaison;
  /** Ce que perd le moteur quand on lui retire un sous-système. */
  ablations: { bras: string; libelle: string; serie: Serie | null; effet: Comparaison }[];
}

export interface StabiliteVerdict {
  cle: string;
  /** Part des runs du bras moteur où le verdict n'est pas au vert. */
  partNonVert: number;
  /** Archétypes où la majorité des runs n'est pas au vert. */
  archetypesConcernes: string[];
  /** Retenu quand il tient sur au moins quatre archétypes sur six. */
  retenu: boolean;
}

export interface RapportCampagne {
  parametres: PlanCampagne;
  runs: number;
  dureeMs: number;
  mesures: MesureCampagne[];
  stabilite: StabiliteVerdict[];
  lignes: LigneRun[];
}

const SEUIL_ARCHETYPES_RETENUS = 4;

export function agregerCampagne(
  plan: PlanCampagne,
  lignes: LigneRun[],
  dureeMs: number,
): RapportCampagne {
  const brasUtilises = plan.bras.map(brasParId);
  const archetypesUtilises = plan.archetypes.map(archetypeParId);
  const duMoteur = lignes.filter((l) => l.bras === "moteur");

  const mesures: MesureCampagne[] = MESURES.map((definition) => {
    const pour = (filtre: (l: LigneRun) => boolean) =>
      serie(lignes.filter(filtre).map((l) => l.valeurs[definition.cle] ?? null));

    const moteur = pour((l) => l.bras === "moteur");
    const parBras = brasUtilises.map((bras) => ({
      bras: bras.id,
      libelle: bras.libelle,
      temoin: bras.temoin,
      serie: pour((l) => l.bras === bras.id),
    }));

    const temoins = parBras.filter((b) => b.temoin && b.serie !== null);
    const meilleurTemoin =
      temoins.length === 0
        ? null
        : temoins.reduce((meilleur, courant) => {
            if (definition.sens === "bas") {
              return (courant.serie as Serie).mediane < (meilleur.serie as Serie).mediane
                ? courant
                : meilleur;
            }
            return (courant.serie as Serie).mediane > (meilleur.serie as Serie).mediane
              ? courant
              : meilleur;
          });

    return {
      cle: definition.cle,
      libelle: definition.libelle,
      unite: definition.unite,
      sens: definition.sens,
      externe: definition.externe,
      moteur,
      parBras,
      parArchetype: archetypesUtilises.map((archetype) => ({
        archetype: archetype.id,
        libelle: archetype.libelle,
        serie: pour((l) => l.bras === "moteur" && l.archetype === archetype.id),
      })),
      meilleurTemoin: meilleurTemoin
        ? { bras: meilleurTemoin.bras, libelle: meilleurTemoin.libelle, serie: meilleurTemoin.serie }
        : null,
      face: comparer(moteur, meilleurTemoin?.serie ?? null, definition.sens),
      ablations: parBras
        .filter((b) => b.bras.startsWith("sans-"))
        .map((b) => ({
          bras: b.bras,
          libelle: b.libelle,
          serie: b.serie,
          // Lu du point de vue de l'ablation : « mieux » veut dire que le
          // sous-système retiré NUISAIT.
          effet: comparer(b.serie, moteur, definition.sens),
        })),
    };
  });

  const clesVerdicts = [...new Set(duMoteur.flatMap((l) => Object.keys(l.verdicts)))];
  const stabilite: StabiliteVerdict[] = clesVerdicts.map((cle) => {
    const nonVert = duMoteur.filter((l) => l.verdicts[cle] !== "ok");
    const archetypesConcernes = plan.archetypes.filter((archetype) => {
      const dedans = duMoteur.filter((l) => l.archetype === archetype);
      if (dedans.length === 0) return false;
      return dedans.filter((l) => l.verdicts[cle] !== "ok").length > dedans.length / 2;
    });
    return {
      cle,
      partNonVert: duMoteur.length === 0 ? 0 : nonVert.length / duMoteur.length,
      archetypesConcernes,
      retenu:
        archetypesConcernes.length >= Math.min(SEUIL_ARCHETYPES_RETENUS, plan.archetypes.length),
    };
  });

  return { parametres: plan, runs: lignes.length, dureeMs, mesures, stabilite, lignes };
}

/** Déroule toute la campagne d'un coup — pour un script, jamais pour un onglet. */
export function deroulerCampagne(
  plan: PlanCampagne,
  surAvancement?: (fait: number, total: number) => void,
): RapportCampagne {
  const debut = Date.now();
  const lignes: LigneRun[] = [];
  for (const run of plan.runs) {
    lignes.push(executerRun(run));
    surAvancement?.(lignes.length, plan.runs.length);
  }
  return agregerCampagne(plan, lignes, Date.now() - debut);
}
