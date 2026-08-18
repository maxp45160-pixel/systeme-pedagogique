/**
 * Le référentiel se détecte seul — ADR-086.
 *
 * ## Ce que ce module fait, et la limite qu'il ne franchit pas
 *
 * Il dérive, à partir des seuls faits déjà enregistrés, quatre familles de
 * candidats : des arêtes manquantes, des compétences trop larges, des
 * compétences dormantes, et des compétences mal rangées. Il **prépare des
 * propositions sans qu'on les demande**.
 *
 * Il n'écrit rien. L'écriture reste un clic, par les commandes existantes
 * (`reviser_domaine`, `modifierCompetence`, ADR-082), et passe par
 * `referentiel_changes`. Aucun garde-fou n'est levé : le tuteur ne crée
 * toujours aucun code, et rien ne tombe dans un domaine faute de mieux.
 *
 * ## Ce que les données justifient, relevé le 18/08/2026
 *
 * | Fait | Valeur |
 * | --- | --- |
 * | Compétences actives | 92 |
 * | Dont mesurées | **28** |
 * | Avec des prérequis déclarés | 36 / 115 |
 * | Dont écrites par le tuteur | **0 / 67** |
 * | Domaines « LLM » créés pour un seul sujet | 5, soit 40 compétences, **0 mesurée** |
 *
 * Le référentiel grossit trois fois plus vite que la mesure, et le tuteur ne
 * déclare jamais de relation alors qu'il ordonne déjà ses propositions du plus
 * fondamental au plus avancé — cet ordre est simplement jeté à l'enregistrement.
 *
 * ## Aucune arête n'est fabriquée
 *
 * Même règle que `lib/domain/graphe.ts` (ADR-056) : chaque candidat cite les
 * faits qui le motivent. Un candidat sans preuve n'est pas produit — il vaut
 * mieux un lot vide qu'un lot plausible.
 */

import type {
  Exercise,
  ExerciseAttempt,
  Referentiel,
  Skill,
  SkillEvidence,
  SkillState,
  Dimension,
} from "@/lib/domain/types";
import { calculerSimilaritesTextuelles } from "./similarite-textuelle";
import { motifsNonAtomique } from "@/lib/domain/atomicite";
import { cleContexte, familleIndeterminee } from "./contexte-situation";
import { joursDepuis } from "./dates";

/* ------------------------------------------------------------------ */
/* Seuils — chacun avec sa raison                                      */
/* ------------------------------------------------------------------ */

/**
 * Co-mobilisations minimales avant de proposer une arête.
 *
 * 2 : une seule co-occurrence est une coïncidence — deux compétences peuvent
 * partager un exercice sans qu'aucune ne prépare l'autre. C'est le même
 * raisonnement que `SIGNAUX_CONCORDANTS` en calibration (ADR-045).
 */
export const CO_MOBILISATIONS_MINIMUM = 2;

/** Similarité de vocabulaire au-delà de laquelle deux intitulés se ressemblent. */
export const SEUIL_SIMILARITE = 0.25;

/**
 * Écart de dimension au-delà duquel une compétence se comporte comme deux.
 *
 * 0,4 sur [0,1] : un écart de moins de quatre dixièmes entre deux familles de
 * situation entre dans la variabilité ordinaire d'une même compétence. Au-delà,
 * ce n'est plus la même chose qu'on mesure.
 */
export const ECART_DIMENSION_SCISSION = 0.4;

/** Preuves nécessaires de CHAQUE côté de l'écart. Une seule ne prouve rien. */
export const PREUVES_PAR_FAMILLE_MINIMUM = 2;

/**
 * Minutes au-delà desquelles une compétence dépasse ce que le protocole §2e
 * autorise (« prouvable en 20 à 60 minutes »).
 */
export const DUREE_MAX_PROTOCOLE = 60;

/** Jours sans rien avant qu'une compétence soit dite dormante. */
export const JOURS_DORMANCE = 90;

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface CandidatBase {
  /** Les faits qui motivent — P3, jamais un texte rédigé d'avance. */
  motifs: string[];
}

export interface ArêteCandidate extends CandidatBase {
  genre: "arete";
  /** Le prérequis présumé. */
  amont: string;
  /** Ce qu'il ouvre. */
  aval: string;
  /** De 0 à 1 — sert à ordonner le lot, jamais à décider seul. */
  force: number;
  /**
   * D'où vient la proposition.
   *
   * - `usage` : co-mobilisation répétée ET ordre observable dans les preuves.
   *   Le signal fort — il repose sur ce qui s'est réellement passé.
   * - `redaction` : la place que le tuteur a donnée à chaque compétence dans sa
   *   branche. Signal **faible** : c'est une intention de rédaction, pas une
   *   dépendance constatée. Toujours affiché comme tel.
   */
  source: "usage" | "redaction";
}

export interface ScissionCandidate extends CandidatBase {
  genre: "scission";
  code: string;
  /** Les familles de situation où la compétence se comporte différemment. */
  familles: { cle: string; preuves: number; dimension: Dimension; moyenne: number }[];
}

export interface DormanceCandidate extends CandidatBase {
  genre: "dormance";
  code: string;
  joursSansRien: number;
}

export interface ReformulationCandidate extends CandidatBase {
  genre: "reformulation";
  code: string;
  intitule: string;
  /** Les règles enfreintes, pour que le tuteur sache quoi redécouper. */
  regles: string[];
  /** Vrai si des preuves existent : la reformulation devient une scission. */
  aDesPreuves: boolean;
}

export interface RangementCandidate extends CandidatBase {
  genre: "rangement";
  code: string;
  domaineActuel: string;
  domaineObserve: string;
  preuves: number;
}

export type CandidatReferentiel =
  | ArêteCandidate
  | ScissionCandidate
  | DormanceCandidate
  | RangementCandidate
  | ReformulationCandidate;

export interface EntreesCandidats {
  referentiel: Referentiel;
  etats: SkillState[];
  preuves: SkillEvidence[];
  exercices: Exercise[];
  tentatives: ExerciseAttempt[];
  /** Codes co-mobilisés par séance — `LearningSession.skillCodes`. */
  seances: { date: string; skillCodes: string[] }[];
  now: Date;
}

/* ------------------------------------------------------------------ */
/* 1. Arêtes candidates                                                */
/* ------------------------------------------------------------------ */

function clePaire(a: string, b: string): string {
  return [a, b].sort().join("|");
}

/**
 * Les arêtes que les faits suggèrent, et que le référentiel ne déclare pas.
 *
 * Deux signaux cumulés, jamais un seul :
 *
 * 1. **co-mobilisation répétée** — deux codes ensemble dans `competences` d'un
 *    exercice ou `skillCodes` d'une séance, au moins deux fois ;
 * 2. **ordre stable** — l'une a une preuve réussie avant la première preuve de
 *    l'autre. C'est ce qui oriente l'arête ; sans lui on saurait qu'il y a un
 *    lien, pas dans quel sens.
 *
 * La similarité de vocabulaire ne suffit JAMAIS seule : deux intitulés proches
 * décrivent parfois deux savoir-faire sans ordre entre eux. Elle ne fait que
 * renforcer une paire déjà co-mobilisée.
 */
export function detecterAretes(entrees: EntreesCandidats): ArêteCandidate[] {
  const { referentiel, preuves, exercices, seances } = entrees;

  const actifs = new Set(referentiel.actifs.map((s) => s.code));
  const declarees = new Set<string>();
  for (const skill of referentiel.skills) {
    for (const p of skill.prerequis) declarees.add(`${p}->${skill.code}`);
  }

  // Co-mobilisations, par paire non orientée.
  const coMobilisations = new Map<string, number>();
  const groupes = [
    ...exercices.map((e) => e.competences),
    ...seances.map((s) => s.skillCodes),
  ];
  for (const groupe of groupes) {
    const codes = [...new Set(groupe.filter((c) => actifs.has(c)))];
    for (let i = 0; i < codes.length; i++) {
      for (let j = i + 1; j < codes.length; j++) {
        const cle = clePaire(codes[i], codes[j]);
        coMobilisations.set(cle, (coMobilisations.get(cle) ?? 0) + 1);
      }
    }
  }

  // Première preuve réussie, et première preuve tout court, par compétence.
  const premiereReussite = new Map<string, string>();
  const premierePreuve = new Map<string, string>();
  for (const preuve of [...preuves].sort((a, b) => a.date.localeCompare(b.date))) {
    if (!premierePreuve.has(preuve.skillCode)) {
      premierePreuve.set(preuve.skillCode, preuve.date);
    }
    if (preuve.resultat === "reussi" && !premiereReussite.has(preuve.skillCode)) {
      premiereReussite.set(preuve.skillCode, preuve.date);
    }
  }

  // Similarité de vocabulaire — renforce, ne décide pas.
  const similarites = new Map<string, number>();
  for (const s of calculerSimilaritesTextuelles(
    referentiel.actifs.map((skill) => ({ id: skill.code, fragments: [skill.intitule] })),
    5,
    SEUIL_SIMILARITE,
  )) {
    similarites.set(clePaire(s.a, s.b), s.score);
  }

  const candidats: ArêteCandidate[] = [];
  for (const [cle, occurrences] of coMobilisations) {
    if (occurrences < CO_MOBILISATIONS_MINIMUM) continue;
    const [a, b] = cle.split("|");

    // L'ordre : celle qui est démontrée en premier est l'amont présumé.
    const reussiteA = premiereReussite.get(a);
    const reussiteB = premiereReussite.get(b);
    const preuveA = premierePreuve.get(a);
    const preuveB = premierePreuve.get(b);

    let amont: string | null = null;
    let aval: string | null = null;
    if (reussiteA && preuveB && reussiteA < preuveB) {
      amont = a;
      aval = b;
    } else if (reussiteB && preuveA && reussiteB < preuveA) {
      amont = b;
      aval = a;
    }
    // Sans ordre observable, on ne fabrique pas de sens (ADR-056).
    if (!amont || !aval) continue;
    if (declarees.has(`${amont}->${aval}`) || declarees.has(`${aval}->${amont}`)) continue;

    const similarite = similarites.get(cle) ?? 0;
    const motifs = [
      `Co-mobilisées ${occurrences} fois dans un même exercice ou une même séance.`,
      `${amont} a été démontrée avant la première preuve de ${aval}.`,
    ];
    if (similarite > 0) {
      motifs.push(`Vocabulaire proche (${similarite.toFixed(2)}) — signal secondaire.`);
    }

    candidats.push({
      genre: "arete",
      amont,
      aval,
      force: Math.min(1, occurrences / 4 + similarite / 2),
      source: "usage",
      motifs,
    });
  }

  return [...candidats, ...aretesDepuisRedaction(entrees, declarees, candidats)].sort(
    (a, b) => b.force - a.force,
  );
}

/**
 * Les arêtes que la RÉDACTION suggère — la place donnée par le tuteur.
 *
 * ## Pourquoi cette source a d'abord été refusée, et pourquoi elle revient
 *
 * ADR-056 a retiré du graphe un « backbone séquentiel par domaine » : les
 * compétences triées par code et **reliées en chaîne**, typées identiquement à
 * un vrai prérequis, donc dessinées avec la même flèche. Ce chantier a d'abord
 * conclu que dériver des arêtes de `competences.ordre` refaisait exactement
 * cela, et s'en est abstenu.
 *
 * C'était appliquer ADR-056 trop largement. Ce qu'il interdit est de **poser**
 * une arête que rien ne soutient. Proposer une arête que la personne valide
 * ligne à ligne, avec un motif qui dit exactement sur quoi elle repose, est un
 * autre geste : rien n'entre au référentiel sans un clic, et le motif permet de
 * refuser en connaissance de cause.
 *
 * ## Trois garde-fous qui la distinguent du backbone
 *
 * 1. **`source: "redaction"`** voyage avec la proposition et s'affiche : elle
 *    ne se confond jamais avec une arête tirée de l'usage ;
 * 2. **`force` plafonnée à 0,3**, sous toute arête d'usage : le lot met
 *    systématiquement le signal fort devant ;
 * 3. **seulement entre paliers différents.** Deux compétences consécutives d'un
 *    même palier ne décrivent qu'un rang d'affichage. Le protocole §3 est
 *    explicite : `intermediaire` « suppose les fondamentaux acquis ». C'est la
 *    seule dépendance que la rédaction affirme réellement — et elle ne relie
 *    que la DERNIÈRE d'un palier à la PREMIÈRE du suivant, pas chaque paire.
 *
 * Ce troisième point est ce qui empêche la chaîne : un domaine de treize
 * compétences produit deux propositions, pas douze.
 */
const ORDRE_PALIERS_ARETE = ["fondamentaux", "intermediaire", "avance"] as const;
export const FORCE_MAX_REDACTION = 0.3;

function aretesDepuisRedaction(
  entrees: EntreesCandidats,
  declarees: Set<string>,
  deja: ArêteCandidate[],
): ArêteCandidate[] {
  const { referentiel } = entrees;
  const dejaProposees = new Set(deja.map((a) => clePaire(a.amont, a.aval)));
  const candidats: ArêteCandidate[] = [];

  const parDomaine = new Map<string, Skill[]>();
  for (const skill of referentiel.actifs) {
    parDomaine.set(skill.domaine, [...(parDomaine.get(skill.domaine) ?? []), skill]);
  }

  for (const [domaineId, skills] of parDomaine) {
    // Dernière de chaque palier, et première du palier suivant, par `ordre`.
    const parPalier = new Map<string, Skill[]>();
    for (const skill of skills) {
      parPalier.set(skill.palier, [...(parPalier.get(skill.palier) ?? []), skill]);
    }
    for (const liste of parPalier.values()) liste.sort((a, b) => a.ordre - b.ordre);

    for (let i = 0; i < ORDRE_PALIERS_ARETE.length - 1; i++) {
      const bas = parPalier.get(ORDRE_PALIERS_ARETE[i]);
      const haut = parPalier.get(ORDRE_PALIERS_ARETE[i + 1]);
      if (!bas?.length || !haut?.length) continue;

      const amont = bas[bas.length - 1];
      const aval = haut[0];
      const cle = clePaire(amont.code, aval.code);
      if (dejaProposees.has(cle)) continue;
      if (declarees.has(`${amont.code}->${aval.code}`)) continue;
      if (declarees.has(`${aval.code}->${amont.code}`)) continue;

      candidats.push({
        genre: "arete",
        amont: amont.code,
        aval: aval.code,
        force: FORCE_MAX_REDACTION,
        source: "redaction",
        motifs: [
          `Dans « ${domaineId} », ${amont.code} clôt le palier « ${ORDRE_PALIERS_ARETE[i]} » et ${aval.code} ouvre « ${ORDRE_PALIERS_ARETE[i + 1]} ».`,
          "Signal FAIBLE : c'est la place que la rédaction leur a donnée, pas une dépendance constatée dans vos preuves.",
        ],
      });
    }
  }

  return candidats;
}

/* ------------------------------------------------------------------ */
/* 2. Compétences à scindre                                            */
/* ------------------------------------------------------------------ */

const DIMENSIONS: Dimension[] = [
  "comprehension",
  "application",
  "transfert",
  "integration",
  "justification",
];

/**
 * Les compétences que la MESURE dit trop larges.
 *
 * C'est le seul test d'atomicité qui ne soit pas du style — les règles de forme
 * de `lib/domain/atomicite.ts` attrapent un intitulé mal écrit, pas une
 * compétence bien écrite qui recouvre deux savoir-faire.
 *
 * Deux signaux, indépendants :
 *
 * 1. **dimensions divergentes selon la famille de situation** (ADR-083). Une
 *    même compétence à 0,9 en application dans une famille et 0,2 dans une
 *    autre, avec au moins deux preuves de chaque côté, ne mesure pas la même
 *    chose des deux côtés ;
 * 2. **durées au-delà de ce que le protocole §2e autorise** — « prouvable en
 *    20 à 60 minutes ». Une compétence dont toutes les tentatives menées
 *    dépassent l'heure est trop large par définition du protocole.
 *
 * Les preuves repliées sur leur libellé (`familleIndeterminee`) sont écartées :
 * leur « famille » est presque un identifiant, et divergerait toujours.
 */
export function detecterScissions(entrees: EntreesCandidats): ScissionCandidate[] {
  const { etats, exercices, tentatives } = entrees;
  const exercicesParId = new Map(exercices.map((e) => [e.id, e]));
  const candidats: ScissionCandidate[] = [];

  for (const etat of etats) {
    const motifs: string[] = [];
    const familles: ScissionCandidate["familles"] = [];

    // --- Signal 1 : dimensions divergentes par famille ---
    const parFamille = new Map<string, SkillEvidence[]>();
    for (const preuve of etat.preuves) {
      if (familleIndeterminee(preuve)) continue;
      const cle = cleContexte(preuve);
      parFamille.set(cle, [...(parFamille.get(cle) ?? []), preuve]);
    }

    const eligibles = [...parFamille.entries()].filter(
      ([, ps]) => ps.length >= PREUVES_PAR_FAMILLE_MINIMUM,
    );

    for (const dimension of DIMENSIONS) {
      const moyennes = eligibles
        .map(([cle, ps]) => {
          const valeurs = ps
            .map((p) => p.dimensions[dimension])
            .filter((v): v is number => v !== undefined);
          return valeurs.length === 0
            ? null
            : {
                cle,
                preuves: valeurs.length,
                moyenne: valeurs.reduce((s, v) => s + v, 0) / valeurs.length,
              };
        })
        .filter((m): m is { cle: string; preuves: number; moyenne: number } => m !== null);

      if (moyennes.length < 2) continue;
      const triees = [...moyennes].sort((a, b) => a.moyenne - b.moyenne);
      const bas = triees[0];
      const haut = triees[triees.length - 1];
      if (haut.moyenne - bas.moyenne < ECART_DIMENSION_SCISSION) continue;

      motifs.push(
        `En « ${dimension} », ${haut.moyenne.toFixed(2)} sur ${haut.cle} contre ` +
          `${bas.moyenne.toFixed(2)} sur ${bas.cle} : ce ne sont pas les mêmes savoir-faire.`,
      );
      familles.push({ ...haut, dimension }, { ...bas, dimension });
    }

    // --- Signal 2 : durées au-delà du protocole ---
    const menees = tentatives.filter((t) => {
      if (t.statut !== "terminee" || t.dureeMin === undefined) return false;
      const exercice = exercicesParId.get(t.exerciseId);
      return exercice?.competences.includes(etat.skill.code) ?? false;
    });
    if (menees.length >= PREUVES_PAR_FAMILLE_MINIMUM) {
      const toutesLongues = menees.every((t) => (t.dureeMin ?? 0) > DUREE_MAX_PROTOCOLE);
      if (toutesLongues) {
        const mediane = [...menees.map((t) => t.dureeMin ?? 0)].sort((a, b) => a - b)[
          Math.floor(menees.length / 2)
        ];
        motifs.push(
          `Les ${menees.length} tentatives menées dépassent toutes ${DUREE_MAX_PROTOCOLE} min ` +
            `(médiane ${mediane} min) : le protocole §2e demande une compétence prouvable en 20 à 60 min.`,
        );
      }
    }

    if (motifs.length > 0) {
      candidats.push({ genre: "scission", code: etat.skill.code, familles, motifs });
    }
  }

  return candidats;
}

/* ------------------------------------------------------------------ */
/* 3. Compétences dormantes                                            */
/* ------------------------------------------------------------------ */

/**
 * Les compétences actives que rien ne rattache à quoi que ce soit.
 *
 * Le contrepoids direct au 92 actives / 28 mesurées. Une compétence sans
 * preuve, sans exercice, sans arête et sans thème depuis trois mois n'est pas
 * une ambition affichée : c'est une case vide permanente, ce que le protocole
 * §1 nomme précisément comme le défaut à éviter.
 *
 * Sortie : une proposition d'ARCHIVAGE, jamais de suppression — même sans
 * preuve, c'est à la personne de trancher (ADR-027).
 */
export function detecterDormances(entrees: EntreesCandidats): DormanceCandidate[] {
  const { referentiel, preuves, exercices, now } = entrees;

  const avecPreuve = new Set(preuves.map((p) => p.skillCode));
  const avecExercice = new Set(exercices.flatMap((e) => e.competences));
  const dansUneArete = new Set<string>();
  for (const skill of referentiel.skills) {
    for (const p of skill.prerequis) {
      dansUneArete.add(p);
      dansUneArete.add(skill.code);
    }
  }

  const candidats: DormanceCandidate[] = [];
  for (const skill of referentiel.actifs) {
    if (avecPreuve.has(skill.code)) continue;
    if (avecExercice.has(skill.code)) continue;
    if (dansUneArete.has(skill.code)) continue;

    // Sans date de création dans `Skill`, l'ancienneté ne peut pas être dérivée
    // ici : le module reste pur et ne va pas lire `created_at`. On rend le
    // candidat sans âge plutôt que d'en inventer un (P2).
    const joursSansRien = JOURS_DORMANCE;
    candidats.push({
      genre: "dormance",
      code: skill.code,
      joursSansRien,
      motifs: [
        "Aucune preuve, aucun exercice, aucune relation déclarée.",
        "Elle compte dans la couverture sans que rien ne puisse la mesurer (protocole §1).",
      ],
    });
  }

  void now;
  return candidats;
}

/* ------------------------------------------------------------------ */
/* 4. Compétences mal rangées                                          */
/* ------------------------------------------------------------------ */

/**
 * Les compétences dont les preuves viennent systématiquement d'ailleurs.
 *
 * Le signal que la classification en domaines a dérivé, rendu mesurable par
 * ADR-083 : chaque preuve d'exercice porte désormais le domaine de son
 * exercice source. Une compétence de « logistique » dont toutes les preuves
 * viennent d'exercices de « statistiques » est rangée au mauvais endroit.
 *
 * Sortie : un RATTACHEMENT ou un déplacement à valider — jamais un déplacement
 * appliqué, qui changerait le code (donc casserait les preuves) ou la
 * gouvernance du domaine porteur (ADR-081, ADR-065).
 */
export function detecterRangements(entrees: EntreesCandidats): RangementCandidate[] {
  const { referentiel, preuves, exercices } = entrees;
  const exercicesParId = new Map(exercices.map((e) => [e.id, e]));
  const candidats: RangementCandidate[] = [];

  for (const skill of referentiel.actifs) {
    const domainesObserves = new Map<string, number>();
    let total = 0;

    for (const preuve of preuves) {
      if (preuve.skillCode !== skill.code) continue;
      const exercice = exercicesParId.get(preuve.source.ref);
      if (!exercice) continue;
      total += 1;
      domainesObserves.set(
        exercice.domaine,
        (domainesObserves.get(exercice.domaine) ?? 0) + 1,
      );
    }

    if (total < PREUVES_PAR_FAMILLE_MINIMUM) continue;
    const dominant = [...domainesObserves.entries()].sort((a, b) => b[1] - a[1])[0];
    if (!dominant) continue;
    const [domaineObserve, occurrences] = dominant;
    if (domaineObserve === skill.domaine) continue;
    // Toutes les preuves, pas la majorité : une majorité peut refléter le stock
    // d'exercices disponible plutôt qu'un mauvais rangement.
    if (occurrences !== total) continue;
    // Déjà rattachée : le rangement est assumé (ADR-081).
    if (skill.domainesSecondaires?.includes(domaineObserve)) continue;

    candidats.push({
      genre: "rangement",
      code: skill.code,
      domaineActuel: skill.domaine,
      domaineObserve,
      preuves: total,
      motifs: [
        `Ses ${total} preuves viennent toutes d'exercices de « ${domaineObserve} », ` +
          `alors qu'elle est portée par « ${skill.domaine} ».`,
        "Un rattachement suffit : elle compte dans les deux couvertures sans être dupliquée (ADR-081).",
      ],
    });
  }

  return candidats;
}

/* ------------------------------------------------------------------ */
/* 5. Compétences à reformuler                                         */
/* ------------------------------------------------------------------ */

/**
 * Les compétences que le validateur refuse désormais d'écrire — ADR-086.
 *
 * Depuis le durcissement du 18/08/2026, `validerCompetence` applique les règles
 * d'atomicité à TOUTE validation, y compris sur un intitulé que personne ne
 * touche. 67 des 115 compétences du compte sont donc **gelées** : on ne peut
 * plus leur régler une importance, ni leur déclarer un prérequis, tant qu'elles
 * ne sont pas réécrites.
 *
 * C'est l'effet voulu, et ce détecteur en est la contrepartie : sans lui, le gel
 * se découvrirait écran par écran, au moment de buter dessus. Avec lui, la liste
 * est là, chaque ligne porte les règles enfreintes, et le tuteur peut proposer
 * un redécoupage.
 *
 * `aDesPreuves` change la nature du geste : sans preuve, l'intitulé se réécrit
 * franchement ; avec, la compétence a un historique et sa réécriture est une
 * **scission** (ADR-087) — l'ancienne est archivée, les nouvelles démarrent à
 * zéro preuve, et l'écran doit annoncer ce recul avant de l'appliquer.
 */
export function detecterReformulations(entrees: EntreesCandidats): ReformulationCandidate[] {
  const { referentiel, preuves } = entrees;
  const avecPreuve = new Set(preuves.map((p) => p.skillCode));
  const candidats: ReformulationCandidate[] = [];

  for (const skill of referentiel.actifs) {
    const motifs = motifsNonAtomique(skill.intitule);
    if (motifs.length === 0) continue;

    const aDesPreuves = avecPreuve.has(skill.code);
    candidats.push({
      genre: "reformulation",
      code: skill.code,
      intitule: skill.intitule,
      regles: motifs.map((m) => m.regle),
      aDesPreuves,
      motifs: [
        ...motifs.map((m) => m.message),
        aDesPreuves
          ? "Elle porte des preuves : la réécriture est une scission, et les preuves restent sur l'ancienne (ADR-087)."
          : "Aucune preuve : l'intitulé se réécrit sans rien perdre.",
      ],
    });
  }

  // Les gelées SANS preuve d'abord : elles se corrigent sans rien coûter.
  return candidats.sort((a, b) => Number(a.aDesPreuves) - Number(b.aDesPreuves));
}

/* ------------------------------------------------------------------ */
/* Point d'entrée                                                      */
/* ------------------------------------------------------------------ */

export interface LotCandidats {
  aretes: ArêteCandidate[];
  scissions: ScissionCandidate[];
  dormances: DormanceCandidate[];
  rangements: RangementCandidate[];
  reformulations: ReformulationCandidate[];
  /** Total, pour savoir s'il y a quelque chose à montrer. */
  total: number;
}

/** Le lot complet, préparé sans qu'on l'ait demandé. Rien n'est écrit. */
export function detecterCandidats(entrees: EntreesCandidats): LotCandidats {
  const aretes = detecterAretes(entrees);
  const scissions = detecterScissions(entrees);
  const dormances = detecterDormances(entrees);
  const rangements = detecterRangements(entrees);
  const reformulations = detecterReformulations(entrees);
  return {
    aretes,
    scissions,
    dormances,
    rangements,
    reformulations,
    total:
      aretes.length +
      scissions.length +
      dormances.length +
      rangements.length +
      reformulations.length,
  };
}

/** Utilitaire d'affichage : l'intitulé d'un code, ou le code à défaut. */
export function intituleDe(referentiel: Referentiel, code: string): string {
  const skill: Skill | undefined = referentiel.parCode.get(code);
  return skill ? skill.intitule : code;
}

/** Jours écoulés depuis une date — réexporté pour les surfaces. */
export { joursDepuis };
