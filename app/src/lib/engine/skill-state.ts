/**
 * Dérivation de l'état d'une compétence à partir de ses seules preuves.
 *
 * Chaque règle ci-dessous cite le fichier de protocole qui l'impose.
 * Aucune valeur n'est stockée : appeler cette fonction est la seule façon
 * d'obtenir un niveau, un score, une confiance ou une robustesse.
 */

import {
  AUTONOMIE,
  POIDS_DIMENSIONS,
  QUALITE_PREUVE,
  type Confiance,
  type Dimension,
  type Explication,
  type NiveauCompetence,
  type Skill,
  type SkillEvidence,
  type SkillState,
} from "@/lib/domain/types";
import { facteurRecence, joursDepuis, joursEntre } from "./dates";

const DIMENSIONS: Dimension[] = [
  "comprehension",
  "application",
  "transfert",
  "integration",
  "justification",
];

const ORDRE_AUTONOMIE = ["A0", "A1", "A2", "A3", "A4"] as const;

function autonomieAuMoins(e: SkillEvidence, min: (typeof ORDRE_AUTONOMIE)[number]): boolean {
  return ORDRE_AUTONOMIE.indexOf(e.autonomie) >= ORDRE_AUTONOMIE.indexOf(min);
}

function dim(e: SkillEvidence, d: Dimension): number {
  return e.dimensions[d] ?? 0;
}

/** Une preuve ne compte que si elle est directe (A) ou indirecte (B) — anti-hallucination §2. */
function estRecevable(e: SkillEvidence): boolean {
  return e.niveauPreuve === "A" || e.niveauPreuve === "B";
}

/* ------------------------------------------------------------------ */
/* Niveau                                                              */
/* ------------------------------------------------------------------ */

interface AppuiNiveau {
  niveau: NiveauCompetence;
  preuves: SkillEvidence[];
  raison: string;
}

/**
 * Détermine le niveau le plus élevé réellement soutenu par les preuves.
 *
 * Protocole d'évaluation §4 pour la définition de chaque palier,
 * instructions §11 pour la règle de corroboration.
 */
function niveauSoutenu(preuves: SkillEvidence[]): AppuiNiveau[] {
  const reussies = preuves.filter((e) => e.resultat === "reussi");
  const nonEchouees = preuves.filter((e) => e.resultat !== "echec");
  const appuis: AppuiNiveau[] = [];

  // Niveau 1 — l'utilisateur peut expliquer ou reconnaître le concept.
  const l1 = nonEchouees.filter((e) => dim(e, "comprehension") >= 0.6);
  if (l1.length > 0) {
    appuis.push({ niveau: 1, preuves: l1, raison: "compréhension démontrée" });
  }

  // Niveau 2 — application de la méthode avec aide.
  const l2 = reussies.filter((e) => dim(e, "application") >= 0.6 && autonomieAuMoins(e, "A1"));
  if (l2.length > 0) {
    appuis.push({ niveau: 2, preuves: l2, raison: "méthode appliquée avec accompagnement" });
  }

  // Niveau 3 — problème standard résolu sans aide significative.
  // Instructions §11 : une réussite isolée ne vaut jamais maîtrise → 2 preuves.
  const l3 = reussies.filter((e) => dim(e, "application") >= 0.7 && autonomieAuMoins(e, "A3"));
  if (l3.length >= 2) {
    appuis.push({ niveau: 3, preuves: l3, raison: "deux résolutions autonomes concordantes" });
  }

  // Niveau 4 — transfert : réussite autonome dans un contexte DISTINCT.
  const l4 = reussies.filter(
    (e) => autonomieAuMoins(e, "A3") && dim(e, "transfert") >= 0.6,
  );
  const contextesL4 = new Set(l4.map((e) => e.contexte));
  if (l4.length >= 2 && contextesL4.size >= 2) {
    appuis.push({
      niveau: 4,
      preuves: l4,
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
    appuis.push({ niveau: 5, preuves: l5, raison: "compétences combinées avec justification" });
  }

  return appuis;
}

/**
 * Règle de régression — protocole d'évaluation §9.
 *
 * Une mauvaise performance isolée ne fait PAS baisser le niveau : elle baisse
 * la confiance. Le niveau ne recule que si une difficulté est confirmée par
 * plusieurs preuves — ici : les deux preuves les plus récentes sont des échecs
 * en autonomie réelle (A2+), ce qui indique une compétence non mobilisable.
 */
function difficulteConfirmee(preuvesTriees: SkillEvidence[]): boolean {
  if (preuvesTriees.length < 3) return false;
  const deuxDernieres = preuvesTriees.slice(-2);
  return deuxDernieres.every((e) => e.resultat === "echec" && autonomieAuMoins(e, "A2"));
}

/* ------------------------------------------------------------------ */
/* Confiance                                                           */
/* ------------------------------------------------------------------ */

/** Protocole anti-hallucination §10 et protocole d'évaluation §7. */
function calculerConfiance(
  preuves: SkillEvidence[],
  contextes: number,
  contradictions: number,
  joursDernierePreuve: number | null,
): { valeur: Confiance; raisons: string[] } {
  const raisons: string[] = [];
  if (preuves.length === 0) return { valeur: "nulle", raisons: ["aucune preuve directe"] };

  const autonomes = preuves.filter((e) => autonomieAuMoins(e, "A3")).length;

  let echelon: number; // 1 faible · 2 moyenne · 3 forte
  if (preuves.length >= 4 && contextes >= 3 && autonomes >= 2) {
    echelon = 3;
    raisons.push(`${preuves.length} preuves sur ${contextes} contextes, dont ${autonomes} autonomes`);
  } else if (preuves.length >= 2 && contextes >= 2) {
    echelon = 2;
    raisons.push(`${preuves.length} preuves cohérentes sur ${contextes} contextes`);
  } else {
    echelon = 1;
    raisons.push(
      preuves.length === 1 ? "une seule preuve disponible" : "preuves peu diversifiées",
    );
  }

  if (contradictions > 0) {
    echelon -= 1;
    raisons.push(`${contradictions} preuve(s) contradictoire(s) conservée(s)`);
  }
  if (joursDernierePreuve !== null && joursDernierePreuve > 120) {
    echelon -= 1;
    raisons.push(`dernière preuve il y a ${joursDernierePreuve} jours`);
  }

  const valeur: Confiance = echelon >= 3 ? "forte" : echelon === 2 ? "moyenne" : "faible";
  return { valeur, raisons };
}

/* ------------------------------------------------------------------ */
/* Robustesse                                                          */
/* ------------------------------------------------------------------ */

/**
 * Indice de robustesse — protocole d'évaluation §13.
 * Prend en compte : nombre de preuves, diversité des contextes, autonomie,
 * récence, réussite après délai, transfert.
 *
 * Volontairement distinct du niveau : « Niveau 4 / Robustesse faible » doit
 * rester un état affichable (§13 le donne en exemple).
 */
function calculerRobustesse(
  preuves: SkillEvidence[],
  contextes: number,
  now: Date,
): { valeur: number; facteurs: { libelle: string; valeur: string; poids: number }[] } {
  const reussies = preuves.filter((e) => e.resultat === "reussi");

  const fNombre = Math.min(1, reussies.length / 5);
  const fContextes = Math.min(1, contextes / 3);
  const fAutonomie =
    preuves.length === 0
      ? 0
      : preuves.reduce((s, e) => s + AUTONOMIE[e.autonomie].poids, 0) / preuves.length;
  const derniere = preuves.at(-1);
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
    { libelle: "Nombre de preuves réussies", valeur: `${reussies.length}`, poids: 0.25, v: fNombre },
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
 * Chaque dimension est la moyenne des preuves qui la documentent, pondérée
 * par autonomie × qualité × récence (protocole d'évaluation §12).
 * Les échecs y participent : c'est ce qui rend le score honnête.
 */
function calculerDimensions(
  preuves: SkillEvidence[],
  now: Date,
): Record<Dimension, number> {
  const out = {} as Record<Dimension, number>;
  for (const d of DIMENSIONS) {
    const pertinentes = preuves.filter((e) => e.dimensions[d] !== undefined);
    if (pertinentes.length === 0) {
      out[d] = 0;
      continue;
    }
    let num = 0;
    let den = 0;
    for (const e of pertinentes) {
      const poids =
        AUTONOMIE[e.autonomie].poids * QUALITE_PREUVE[e.qualite].poids * facteurRecence(e.date, now);
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

function prochaineEtape(niveau: NiveauCompetence | null, contextes: number): string {
  switch (niveau) {
    case null:
      return "Réaliser un premier diagnostic pour situer le niveau réel.";
    case 0:
      return "Expliquer le concept avec ses propres mots pour atteindre la compréhension.";
    case 1:
      return "Appliquer la méthode sur un exercice guidé.";
    case 2:
      return "Résoudre un problème standard sans indice pour démontrer l'autonomie.";
    case 3:
      return contextes >= 2
        ? "Confirmer le transfert par une seconde résolution en contexte nouveau."
        : "Résoudre un problème dans un contexte différent pour démontrer le transfert.";
    case 4:
      return "Mobiliser cette compétence dans un projet combinant plusieurs domaines.";
    case 5:
      return "Entretenir la compétence : la réutiliser après un délai pour confirmer sa robustesse.";
  }
}

/* ------------------------------------------------------------------ */
/* Point d'entrée                                                      */
/* ------------------------------------------------------------------ */

export function computeSkillState(
  skill: Skill,
  toutesPreuves: SkillEvidence[],
  erreursLiees: string[] = [],
  now: Date = new Date(),
): SkillState {
  const preuves = toutesPreuves
    .filter((e) => e.skillCode === skill.code && estRecevable(e))
    .sort((a, b) => a.date.localeCompare(b.date));

  const contextesTestes = [...new Set(preuves.map((e) => e.contexte))];
  const derniere = preuves.at(-1) ?? null;
  const joursDepuisDernierePreuve = derniere ? joursDepuis(derniere.date, now) : null;

  // Aucune preuve : on ne fabrique NI niveau NI score (anti-hallucination §7).
  if (preuves.length === 0) {
    const hypothese = skill.hypotheseInitiale;
    return {
      skill,
      niveau: null,
      score: null,
      confiance: "nulle",
      robustesse: null,
      dimensions: { comprehension: 0, application: 0, transfert: 0, integration: 0, justification: 0 },
      preuves: [],
      contextesTestes: [],
      dernierePreuve: null,
      joursDepuisDernierePreuve: null,
      contradictions: [],
      erreursLiees,
      prochaineEtape: prochaineEtape(null, 0),
      statut: hypothese ? "hypothese" : "non-evalue",
      explication: {
        resume: hypothese
          ? "Aucune preuve directe. Une hypothèse existe mais n'autorise aucun niveau."
          : "Aucune preuve directe. Compétence non évaluée.",
        facteurs: hypothese
          ? [{ libelle: "Hypothèse (preuve de niveau D)", valeur: hypothese.justification }]
          : [],
        nombrePreuves: 0,
        reserves: [
          "Aucun niveau ne peut être affirmé sans preuve directe (protocole anti-hallucination §7).",
        ],
      },
    };
  }

  // Contradictions conservées, jamais supprimées (anti-hallucination §5 et §6).
  const aReussi = preuves.some((e) => e.resultat === "reussi");
  const contradictions = aReussi ? preuves.filter((e) => e.resultat === "echec") : [];

  const appuis = niveauSoutenu(preuves);
  let niveau: NiveauCompetence = appuis.length > 0
    ? (Math.max(...appuis.map((a) => a.niveau)) as NiveauCompetence)
    : 0;

  const reserves: string[] = [];
  if (difficulteConfirmee(preuves) && niveau > 1) {
    niveau = (niveau - 1) as NiveauCompetence;
    reserves.push(
      "Niveau abaissé d'un palier : les deux dernières preuves sont des échecs en autonomie (protocole d'évaluation §9).",
    );
  }

  const { valeur: confiance, raisons: raisonsConfiance } = calculerConfiance(
    preuves,
    contextesTestes.length,
    contradictions.length,
    joursDepuisDernierePreuve,
  );

  const robustesse = calculerRobustesse(preuves, contextesTestes.length, now);
  const dimensions = calculerDimensions(preuves, now);

  // Score macro — protocole d'évaluation §12, sur 5, une décimale.
  const brut = DIMENSIONS.reduce((s, d) => s + POIDS_DIMENSIONS[d] * dimensions[d], 0);
  const score = Math.round(brut * 5 * MODULATION_CONFIANCE[confiance] * 10) / 10;

  if (contradictions.length > 0) {
    reserves.push(
      `${contradictions.length} preuve(s) contradictoire(s) conservée(s) : la confiance a été réduite plutôt que le niveau.`,
    );
  }
  if (joursDepuisDernierePreuve !== null && joursDepuisDernierePreuve > 120) {
    reserves.push(
      `Dernière preuve il y a ${joursDepuisDernierePreuve} jours : le niveau reste acquis, la confiance baisse.`,
    );
  }
  if (contextesTestes.length === 1 && preuves.length > 1) {
    reserves.push("Toutes les preuves proviennent du même contexte : le transfert n'est pas établi.");
  }
  if (preuves.length === 1) {
    reserves.push("Évaluation fondée sur une preuve unique (instructions §11).");
  }

  const explication: Explication = {
    resume:
      appuis.length > 0
        ? `Niveau ${niveau} soutenu par : ${appuis
            .filter((a) => a.niveau <= niveau)
            .map((a) => a.raison)
            .join(" · ")}.`
        : "Preuves insuffisantes pour dépasser le niveau 0 (exposition).",
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
    nombrePreuves: preuves.length,
    reserves,
  };

  return {
    skill,
    niveau,
    score,
    confiance,
    robustesse: robustesse.valeur,
    dimensions,
    preuves,
    contextesTestes,
    dernierePreuve: derniere?.date ?? null,
    joursDepuisDernierePreuve,
    contradictions,
    erreursLiees,
    prochaineEtape: prochaineEtape(niveau, contextesTestes.length),
    statut: "evalue",
    explication,
  };
}

/** Dérive l'état de toutes les compétences en une passe. */
export function computeAllSkillStates(
  skills: Skill[],
  preuves: SkillEvidence[],
  erreursParSkill: Map<string, string[]> = new Map(),
  now: Date = new Date(),
): SkillState[] {
  return skills.map((s) =>
    computeSkillState(s, preuves, erreursParSkill.get(s.code) ?? [], now),
  );
}
