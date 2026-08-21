/**
 * Dérivation de l'état d'une compétence à partir de ses seules observations.
 *
 * Chaque règle ci-dessous cite le fichier de protocole qui l'impose.
 * Aucune valeur n'est stockée : appeler cette fonction est la seule façon
 * d'obtenir un niveau, un score, une confiance ou une robustesse.
 */

import {
  AUTONOMIE,
  POIDS_DIMENSIONS,
  QUALITE_OBSERVATION,
  type Confiance,
  type Dimension,
  type Explication,
  type NiveauCompetence,
  type Skill,
  type SkillObservation,
  type SkillState,
} from "@/lib/domain/types";
import { facteurRecence, joursDepuis, joursEntre } from "./dates";
import { cleContexte, familleIndeterminee } from "./contexte-situation";

const DIMENSIONS: Dimension[] = [
  "comprehension",
  "application",
  "transfert",
  "integration",
  "justification",
];

const ORDRE_AUTONOMIE = ["A0", "A1", "A2", "A3", "A4"] as const;

function autonomieAuMoins(e: SkillObservation, min: (typeof ORDRE_AUTONOMIE)[number]): boolean {
  return ORDRE_AUTONOMIE.indexOf(e.autonomie) >= ORDRE_AUTONOMIE.indexOf(min);
}

function dim(e: SkillObservation, d: Dimension): number {
  return e.dimensions[d] ?? 0;
}

/** Une observation ne compte que si elle est directe (A) ou indirecte (B) — anti-hallucination §2. */
function estRecevable(e: SkillObservation): boolean {
  return e.niveauObservation === "A" || e.niveauObservation === "B";
}

/* ------------------------------------------------------------------ */
/* Niveau                                                              */
/* ------------------------------------------------------------------ */

interface AppuiNiveau {
  niveau: NiveauCompetence;
  observations: SkillObservation[];
  raison: string;
}

/**
 * Détermine le niveau le plus élevé réellement soutenu par les observations.
 *
 * Protocole d'évaluation §4 pour la définition de chaque palier,
 * instructions §11 pour la règle de corroboration.
 */
function niveauSoutenu(observations: SkillObservation[]): AppuiNiveau[] {
  const reussies = observations.filter((e) => e.resultat === "reussi");
  const nonEchouees = observations.filter((e) => e.resultat !== "echec");
  const appuis: AppuiNiveau[] = [];

  // Niveau 1 — l'utilisateur peut expliquer ou reconnaître le concept.
  const l1 = nonEchouees.filter((e) => dim(e, "comprehension") >= 0.6);
  if (l1.length > 0) {
    appuis.push({ niveau: 1, observations: l1, raison: "compréhension démontrée" });
  }

  // Niveau 2 — application de la méthode avec aide.
  const l2 = reussies.filter((e) => dim(e, "application") >= 0.6 && autonomieAuMoins(e, "A1"));
  if (l2.length > 0) {
    appuis.push({ niveau: 2, observations: l2, raison: "méthode appliquée avec accompagnement" });
  }

  // Niveau 3 — problème standard résolu sans aide significative.
  // Instructions §11 : une réussite isolée ne vaut jamais maîtrise → 2 observations.
  const l3 = reussies.filter((e) => dim(e, "application") >= 0.7 && autonomieAuMoins(e, "A3"));
  if (l3.length >= 2) {
    appuis.push({ niveau: 3, observations: l3, raison: "deux résolutions autonomes concordantes" });
  }

  // Niveau 4 — transfert : réussite autonome dans un contexte DISTINCT.
  const l4 = reussies.filter(
    (e) => autonomieAuMoins(e, "A3") && dim(e, "transfert") >= 0.6,
  );
  const contextesL4 = new Set(l4.map(cleContexte));
  if (l4.length >= 2 && contextesL4.size >= 2) {
    appuis.push({
      niveau: 4,
      observations: l4,
      raison: `transfert démontré sur ${contextesL4.size} contextes distincts`,
    });
  }

  // Niveau 5 — intégration : plusieurs compétences combinées, avec justification.
  const l5 = reussies.filter(
    (e) =>
      (e.competencesCombinees?.length ?? 0) >= 1 &&
      dim(e, "integration") >= 0.6 &&
      dim(e, "justification") >= 0.6,
  );
  if (l5.length >= 1) {
    appuis.push({ niveau: 5, observations: l5, raison: "compétences combinées avec justification" });
  }

  return appuis;
}

/**
 * Règle de régression — protocole d'évaluation §9.
 *
 * Une mauvaise performance isolée ne fait PAS baisser le niveau : elle baisse
 * la confiance. Le niveau ne recule que si une difficulté est confirmée par
 * plusieurs observations — ici : les deux observations les plus récentes sont des échecs
 * en autonomie réelle (A2+), ce qui indique une compétence non mobilisable.
 */
function difficulteConfirmee(observationsTriees: SkillObservation[]): boolean {
  if (observationsTriees.length < 3) return false;
  const deuxDernieres = observationsTriees.slice(-2);
  return deuxDernieres.every((e) => e.resultat === "echec" && autonomieAuMoins(e, "A2"));
}

/* ------------------------------------------------------------------ */
/* Confiance                                                           */
/* ------------------------------------------------------------------ */

/** Protocole anti-hallucination §10 et protocole d'évaluation §7. */
function calculerConfiance(
  observations: SkillObservation[],
  contextes: number,
  contradictions: number,
  joursDerniereObservation: number | null,
): { valeur: Confiance; raisons: string[] } {
  const raisons: string[] = [];
  if (observations.length === 0) return { valeur: "nulle", raisons: ["aucune observation directe"] };

  const autonomes = observations.filter((e) => autonomieAuMoins(e, "A3")).length;

  let echelon: number; // 1 faible · 2 moyenne · 3 forte
  if (observations.length >= 4 && contextes >= 3 && autonomes >= 2) {
    echelon = 3;
    raisons.push(`${observations.length} observations sur ${contextes} contextes, dont ${autonomes} autonomes`);
  } else if (observations.length >= 2 && contextes >= 2) {
    echelon = 2;
    raisons.push(`${observations.length} observations cohérentes sur ${contextes} contextes`);
  } else {
    echelon = 1;
    raisons.push(
      observations.length === 1 ? "une seule observation disponible" : "observations peu diversifiées",
    );
  }

  if (contradictions > 0) {
    echelon -= 1;
    raisons.push(`${contradictions} observation(s) contradictoire(s) conservée(s)`);
  }
  if (joursDerniereObservation !== null && joursDerniereObservation > 120) {
    echelon -= 1;
    raisons.push(`dernière observation il y a ${joursDerniereObservation} jours`);
  }

  const valeur: Confiance = echelon >= 3 ? "forte" : echelon === 2 ? "moyenne" : "faible";
  return { valeur, raisons };
}

/* ------------------------------------------------------------------ */
/* Robustesse                                                          */
/* ------------------------------------------------------------------ */

/**
 * Indice de robustesse — protocole d'évaluation §13.
 * Prend en compte : nombre d'observations, diversité des contextes, autonomie,
 * récence, réussite après délai, transfert.
 *
 * Volontairement distinct du niveau : « Niveau 4 / Robustesse faible » doit
 * rester un état affichable (§13 le donne en exemple).
 */
function calculerRobustesse(
  observations: SkillObservation[],
  contextes: number,
  now: Date,
): { valeur: number; facteurs: { libelle: string; valeur: string; poids: number }[] } {
  const reussies = observations.filter((e) => e.resultat === "reussi");

  const fNombre = Math.min(1, reussies.length / 5);
  const fContextes = Math.min(1, contextes / 3);
  const fAutonomie =
    observations.length === 0
      ? 0
      : observations.reduce((s, e) => s + AUTONOMIE[e.autonomie].poids, 0) / observations.length;
  const derniere = observations.at(-1);
  const fRecence = derniere ? facteurRecence(derniere.date, now) : 0;

  // Réussite après délai : deux réussites espacées de plus de 21 jours.
  let apresDelai = 0;
  for (let i = 1; i < reussies.length; i++) {
    if (joursEntre(reussies[i - 1].date, reussies[i].date) >= 21) {
      apresDelai = 1;
      break;
    }
  }

  const fTransfert = reussies.some((e) => e.type === "transfert" || dim(e, "transfert") >= 0.6)
    ? 1
    : 0;

  const facteurs = [
    { libelle: "Nombre d'observations réussies", valeur: `${reussies.length}`, poids: 0.25, v: fNombre },
    { libelle: "Diversité des contextes", valeur: `${contextes}`, poids: 0.2, v: fContextes },
    { libelle: "Autonomie moyenne", valeur: fAutonomie.toFixed(2), poids: 0.2, v: fAutonomie },
    { libelle: "Récence", valeur: fRecence.toFixed(2), poids: 0.15, v: fRecence },
    { libelle: "Réussite après délai", valeur: apresDelai ? "oui" : "non", poids: 0.1, v: apresDelai },
    { libelle: "Transfert observé", valeur: fTransfert ? "oui" : "non", poids: 0.1, v: fTransfert },
  ];

  const valeur = facteurs.reduce((s, f) => s + f.poids * f.v, 0);
  return {
    valeur: Math.min(1, valeur),
    facteurs: facteurs.map(({ libelle, valeur, poids }) => ({ libelle, valeur, poids })),
  };
}

/* ------------------------------------------------------------------ */
/* Dimensions et score                                                 */
/* ------------------------------------------------------------------ */

/**
 * Chaque dimension est la moyenne des observations qui la documentent, pondérée
 * par autonomie × qualité × récence (protocole d'évaluation §12).
 * Les échecs y participent : c'est ce qui rend le score honnête.
 */
function calculerDimensions(
  observations: SkillObservation[],
  now: Date,
): Record<Dimension, number> {
  const out = {} as Record<Dimension, number>;
  for (const d of DIMENSIONS) {
    const pertinentes = observations.filter((e) => e.dimensions[d] !== undefined);
    if (pertinentes.length === 0) {
      out[d] = 0;
      continue;
    }
    let num = 0;
    let den = 0;
    for (const e of pertinentes) {
      const poids =
        AUTONOMIE[e.autonomie].poids * QUALITE_OBSERVATION[e.qualite].poids * facteurRecence(e.date, now);
      num += dim(e, d) * poids;
      den += poids;
    }
    out[d] = den === 0 ? 0 : Math.max(0, Math.min(1, num / den));
  }
  return out;
}

const MODULATION_CONFIANCE: Record<Confiance, number> = {
  nulle: 0,
  faible: 0.85,
  moyenne: 0.95,
  forte: 1,
};

/* ------------------------------------------------------------------ */
/* Prochaine étape                                                     */
/* ------------------------------------------------------------------ */

function prochaineEtape(
  niveau: NiveauCompetence | null,
  contextes: number,
  intitule: string,
): string {
  switch (niveau) {
    case null:
      return `Commencer par un premier exercice sur « ${intitule} » pour établir une observation.`;
    case 0:
      return `Expliquer « ${intitule} » avec ses propres mots, puis vérifier l'idée sur un exemple simple.`;
    case 1:
      return `Appliquer la méthode de « ${intitule} » sur un exercice guidé.`;
    case 2:
      return `Reprendre « ${intitule} » sur un problème standard, sans ouvrir d'indice.`;
    case 3:
      return contextes >= 2
        ? `Confirmer le transfert de « ${intitule} » par une seconde résolution en contexte nouveau.`
        : `Résoudre un problème sur « ${intitule} » dans un contexte différent pour démontrer le transfert.`;
    case 4:
      return `Mobiliser « ${intitule} » dans un projet combinant plusieurs domaines.`;
    case 5:
      return `Entretenir « ${intitule} » : la réutiliser après un délai pour confirmer sa robustesse.`;
  }
}

/* ------------------------------------------------------------------ */
/* Point d'entrée                                                      */
/* ------------------------------------------------------------------ */

export function computeSkillState(
  skill: Skill,
  toutesObservations: SkillObservation[],
  now: Date = new Date(),
): SkillState {
  const observations = toutesObservations
    .filter((e) => e.skillCode === skill.code && estRecevable(e))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Des FAMILLES de situation, pas des titres d'exercice (ADR-083). C'est la
  // seule ligne qui décide de ce que « deux contextes distincts » veut dire,
  // et donc de la porte du niveau 4 comme de celle de la confiance.
  const contextesTestes = [...new Set(observations.map(cleContexte))];
  const derniere = observations.at(-1) ?? null;
  const joursDepuisDerniereObservation = derniere ? joursDepuis(derniere.date, now) : null;

  // Aucune observation : on ne fabrique NI niveau NI score (anti-hallucination §7).
  if (observations.length === 0) {
    const hypothese = skill.hypotheseInitiale;
    return {
      skill,
      niveau: null,
      score: null,
      confiance: "nulle",
      robustesse: null,
      dimensions: { comprehension: 0, application: 0, transfert: 0, integration: 0, justification: 0 },
      observations: [],
      contextesTestes: [],
      derniereObservation: null,
      joursDepuisDerniereObservation: null,
      contradictions: [],
      prochaineEtape: prochaineEtape(null, 0, skill.intitule),
      statut: hypothese ? "hypothese" : "non-evalue",
      explication: {
        resume: hypothese
          ? "Aucune observation directe. Une hypothèse existe mais n'autorise aucun niveau."
          : "Aucune observation directe. Compétence non évaluée.",
        facteurs: hypothese
          ? [{ libelle: "Hypothèse (observation de niveau D)", valeur: hypothese.justification }]
          : [],
        nombreObservations: 0,
        reserves: [
          "Aucun niveau ne peut être affirmé sans observation directe (protocole anti-hallucination §7).",
        ],
      },
    };
  }

  // Contradictions conservées, jamais supprimées (anti-hallucination §5 et §6).
  const aReussi = observations.some((e) => e.resultat === "reussi");
  const contradictions = aReussi ? observations.filter((e) => e.resultat === "echec") : [];

  const appuis = niveauSoutenu(observations);
  let niveau: NiveauCompetence = appuis.length > 0
    ? (Math.max(...appuis.map((a) => a.niveau)) as NiveauCompetence)
    : 0;

  const reserves: string[] = [];
  if (difficulteConfirmee(observations) && niveau > 1) {
    niveau = (niveau - 1) as NiveauCompetence;
    reserves.push(
      "Niveau abaissé d'un palier : les deux dernières observations sont des échecs en autonomie (protocole d'évaluation §9).",
    );
  }

  const { valeur: confiance, raisons: raisonsConfiance } = calculerConfiance(
    observations,
    contextesTestes.length,
    contradictions.length,
    joursDepuisDerniereObservation,
  );

  const robustesse = calculerRobustesse(observations, contextesTestes.length, now);
  const dimensions = calculerDimensions(observations, now);

  // Score macro — protocole d'évaluation §12, sur 5, une décimale.
  const brut = DIMENSIONS.reduce((s, d) => s + POIDS_DIMENSIONS[d] * dimensions[d], 0);
  const score = Math.round(brut * 5 * MODULATION_CONFIANCE[confiance] * 10) / 10;

  if (contradictions.length > 0) {
    reserves.push(
      `${contradictions.length} observation(s) contradictoire(s) conservée(s) : la confiance a été réduite plutôt que le niveau.`,
    );
  }
  if (joursDepuisDerniereObservation !== null && joursDepuisDerniereObservation > 120) {
    reserves.push(
      `Dernière observation il y a ${joursDepuisDerniereObservation} jours : le niveau reste acquis, la confiance baisse.`,
    );
  }
  if (contextesTestes.length === 1 && observations.length > 1) {
    reserves.push(
      "Toutes les observations proviennent de la même famille de situation : le transfert n'est pas établi.",
    );
  }
  // Une famille repliée vaut ce que vaut un libellé libre — presque un
  // identifiant. Le dire plutôt que de laisser ces observations gonfler un niveau
  // en silence, ce qu'elles ont fait jusqu'au 18/08/2026 (ADR-083).
  const repliees = observations.filter(familleIndeterminee).length;
  if (repliees > 0) {
    reserves.push(
      repliees === observations.length
        ? `Aucune des ${observations.length} observations n'a d'exercice source résoluble : les contextes sont comptés sur leur libellé, qui les distingue presque toujours.`
        : `${repliees} observation(s) sur ${observations.length} sans exercice source résoluble : leur contexte est compté sur le libellé, non sur la famille de situation.`,
    );
  }
  if (observations.length === 1) {
    reserves.push("Évaluation fondée sur une observation unique (instructions §11).");
  }

  const explication: Explication = {
    resume:
      appuis.length > 0
        ? `Niveau ${niveau} soutenu par : ${appuis
            .filter((a) => a.niveau <= niveau)
            .map((a) => a.raison)
            .join(" · ")}.`
        : "Observations insuffisantes pour dépasser le niveau 0 (exposition).",
    facteurs: [
      ...DIMENSIONS.map((d) => ({
        libelle: d,
        valeur: dimensions[d].toFixed(2),
        poids: POIDS_DIMENSIONS[d],
      })),
      ...robustesse.facteurs,
      { libelle: "Modulation par la confiance", valeur: `×${MODULATION_CONFIANCE[confiance]}` },
      { libelle: "Base de la confiance", valeur: raisonsConfiance.join(" ; ") },
    ],
    nombreObservations: observations.length,
    reserves,
  };

  return {
    skill,
    niveau,
    score,
    confiance,
    robustesse: robustesse.valeur,
    dimensions,
    observations,
    contextesTestes,
    derniereObservation: derniere?.date ?? null,
    joursDepuisDerniereObservation,
    contradictions,
    prochaineEtape: prochaineEtape(niveau, contextesTestes.length, skill.intitule),
    statut: "evalue",
    explication,
  };
}

/**
 * Dérive l'état de toutes les compétences en une passe.
 *
 * Les observations sont groupées par code UNE fois : le filtre complet que
 * `computeSkillState` refaisait pour chaque compétence faisait du calcul un
 * O(compétences × observations), premier poste du chemin chaud sur les comptes
 * chargés. Chaque compétence ne voit plus que ses observations ; son filtre
 * interne reste, redondant mais sans coût sur un lot déjà restreint.
 */
export function computeAllSkillStates(
  skills: Skill[],
  observations: SkillObservation[],
  now: Date = new Date(),
): SkillState[] {
  const parCode = new Map<string, SkillObservation[]>();
  for (const o of observations) {
    const liste = parCode.get(o.skillCode);
    if (liste) liste.push(o);
    else parCode.set(o.skillCode, [o]);
  }
  return skills.map((s) => computeSkillState(s, parCode.get(s.code) ?? [], now));
}
