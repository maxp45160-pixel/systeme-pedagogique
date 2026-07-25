/**
 * Expérience, niveaux et badges — tous DÉRIVÉS du journal de preuves.
 *
 * Conséquence structurelle : aucun XP ne peut être produit par une action
 * d'interface. Ouvrir l'application, cliquer, naviguer ou cocher une case
 * ne génère rien, puisque chaque `XPEvent` exige un `sourceEvidenceId`
 * pointant vers une preuve pédagogique réelle.
 *
 * Une preuve produit AU PLUS un événement d'XP, au motif le mieux-disant.
 * Cela évite l'empilement de motifs sur un même travail.
 */

import {
  BAREME_XP,
  type Badge,
  type BadgeId,
  type Exercise,
  type MotifXp,
  type Project,
  type SkillEvidence,
  type XPEvent,
} from "@/lib/domain/types";
import { joursEntre } from "./dates";

/* ------------------------------------------------------------------ */
/* Niveaux globaux                                                     */
/* ------------------------------------------------------------------ */

export interface PalierNiveau {
  niveau: number;
  nom: string;
  seuil: number;
}

/** Noms sobres, cohérents avec un parcours d'ingénierie. */
export const PALIERS: PalierNiveau[] = [
  { niveau: 1, nom: "Observateur", seuil: 0 },
  { niveau: 2, nom: "Explorateur", seuil: 150 },
  { niveau: 3, nom: "Praticien", seuil: 400 },
  { niveau: 4, nom: "Analyste", seuil: 900 },
  { niveau: 5, nom: "Concepteur", seuil: 1800 },
  { niveau: 6, nom: "Intégrateur", seuil: 3200 },
  { niveau: 7, nom: "Ingénieur système", seuil: 5500 },
];

export interface EtatNiveau {
  palier: PalierNiveau;
  suivant: PalierNiveau | null;
  xpTotal: number;
  xpDansPalier: number;
  xpRequisPalier: number;
  /** Progression dans le palier courant, de 0 à 1. */
  fraction: number;
}

export function calculerNiveau(xpTotal: number): EtatNiveau {
  let index = 0;
  for (let i = PALIERS.length - 1; i >= 0; i--) {
    if (xpTotal >= PALIERS[i].seuil) {
      index = i;
      break;
    }
  }
  const palier = PALIERS[index];
  const suivant = PALIERS[index + 1] ?? null;
  const xpDansPalier = xpTotal - palier.seuil;
  const xpRequisPalier = suivant ? suivant.seuil - palier.seuil : 0;
  return {
    palier,
    suivant,
    xpTotal,
    xpDansPalier,
    xpRequisPalier,
    fraction: suivant ? Math.min(1, xpDansPalier / xpRequisPalier) : 1,
  };
}

/* ------------------------------------------------------------------ */
/* Dérivation des événements d'XP                                      */
/* ------------------------------------------------------------------ */

interface ContexteXp {
  exercices: Map<string, Exercise>;
  /** Preuves déjà traitées pour la même compétence, dans l'ordre. */
  precedentes: SkillEvidence[];
}

/**
 * Détermine le motif d'XP d'une preuve, ou `null` si elle n'en vaut aucun.
 * Une preuve en échec, très guidée (A0/A1) ou de faible qualité ne rapporte
 * rien : l'XP récompense la valeur pédagogique, pas l'activité.
 */
function motifPour(e: SkillEvidence, ctx: ContexteXp): MotifXp | null {
  if (e.resultat === "echec") return null;
  if (e.autonomie === "A0") return null;

  const candidats: MotifXp[] = [];

  if (e.type === "correction-erreur" && e.resultat === "reussi") {
    candidats.push("erreur-corrigee");
  }

  const contextesConnus = new Set(ctx.precedentes.map((p) => p.contexte));
  const contexteInedit = !contextesConnus.has(e.contexte);

  if (
    e.resultat === "reussi" &&
    (e.autonomie === "A3" || e.autonomie === "A4") &&
    ((e.dimensions.transfert ?? 0) >= 0.6 || e.type === "transfert") &&
    contexteInedit &&
    ctx.precedentes.length > 0
  ) {
    candidats.push("transfert");
  }

  if (
    e.resultat === "reussi" &&
    e.qualite === "forte" &&
    (e.autonomie === "A3" || e.autonomie === "A4") &&
    contexteInedit
  ) {
    candidats.push("probleme-nouveau");
  }

  if (e.source.kind === "exercice") {
    const ex = ctx.exercices.get(e.source.ref);
    if (e.resultat === "reussi" && ex && ex.difficulte >= 4 && e.autonomie !== "A1") {
      candidats.push("exercice-difficile");
    } else {
      candidats.push("exercice-termine");
    }
  }

  // Maintien : réussite sur une compétence non pratiquée depuis 21 jours.
  const derniere = ctx.precedentes.at(-1);
  if (
    e.resultat === "reussi" &&
    derniere &&
    joursEntre(derniere.date, e.date) >= 21 &&
    candidats.length === 0
  ) {
    candidats.push("maintien");
  }

  if (candidats.length === 0) return null;
  return candidats.reduce((meilleur, m) =>
    BAREME_XP[m].valeur > BAREME_XP[meilleur].valeur ? m : meilleur,
  );
}

/**
 * Reconstruit l'intégralité des événements d'XP à partir du journal.
 * Fonction pure : mêmes preuves → mêmes XP, toujours.
 */
export function deriverXP(
  preuves: SkillEvidence[],
  exercices: Exercise[] = [],
  projets: Project[] = [],
): XPEvent[] {
  const index = new Map(exercices.map((e) => [e.id, e]));
  const parSkill = new Map<string, SkillEvidence[]>();
  const evenements: XPEvent[] = [];

  const triees = [...preuves].sort((a, b) => a.date.localeCompare(b.date));

  for (const e of triees) {
    const precedentes = parSkill.get(e.skillCode) ?? [];
    const motif = motifPour(e, { exercices: index, precedentes });
    if (motif) {
      evenements.push({
        id: `xp-${e.id}`,
        date: e.date,
        motif,
        valeur: BAREME_XP[motif].valeur,
        skillCode: e.skillCode,
        sourceEvidenceId: e.id,
      });
    }
    parSkill.set(e.skillCode, [...precedentes, e]);
  }

  // Les projets terminés produisent leur propre événement, adossé au projet.
  for (const p of projets) {
    if (p.statut === "termine" && p.dateFin) {
      evenements.push({
        id: `xp-projet-${p.id}`,
        date: p.dateFin,
        motif: "projet-termine",
        valeur: BAREME_XP["projet-termine"].valeur,
        sourceEvidenceId: `projet:${p.id}`,
      });
    }
  }

  return evenements.sort((a, b) => a.date.localeCompare(b.date));
}

export function totalXP(evenements: XPEvent[]): number {
  return evenements.reduce((s, e) => s + e.valeur, 0);
}

/* ------------------------------------------------------------------ */
/* Badges                                                              */
/* ------------------------------------------------------------------ */

export const BADGES: Badge[] = [
  {
    id: "premiere-resolution-autonome",
    titre: "Première résolution autonome",
    description: "Un problème résolu sans aucun indice.",
    critere: "Une preuve réussie en autonomie A3 ou A4.",
  },
  {
    id: "premiere-modelisation",
    titre: "Première modélisation",
    description: "Un système réel traduit en modèle formel.",
    critere: "Une preuve réussie sur une compétence de modélisation.",
  },
  {
    id: "premiere-simulation",
    titre: "Première simulation",
    description: "Un comportement système reproduit par le calcul.",
    critere: "Une preuve réussie de type simulation.",
  },
  {
    id: "premier-transfert",
    titre: "Premier transfert",
    description: "Une compétence réutilisée dans un contexte nouveau.",
    critere: "Deux réussites autonomes sur la même compétence, dans deux contextes distincts.",
  },
  {
    id: "erreur-corrigee",
    titre: "Erreur récurrente corrigée",
    description: "Une faiblesse identifiée puis démontrée résolue.",
    critere: "Une erreur passée au statut « corrigée » avec preuve à l'appui.",
  },
  {
    id: "projet-termine",
    titre: "Projet terminé",
    description: "Un travail long mené jusqu'à son bilan.",
    critere: "Un projet au statut « terminé » avec bilan de compétences.",
  },
];

export interface BadgeObtenu {
  badge: Badge;
  date: string;
  /** Preuve qui déclenche le badge — jamais un badge sans source. */
  source: string;
}

const CODES_MODELISATION = ["SYSC-02", "RO-01", "RO-03", "LOG-01", "LOG-05", "PROD-01"];
const CODES_SIMULATION = ["ALGO-06", "SYSC-03", "RO-05"];

export function deriverBadges(
  preuves: SkillEvidence[],
  projets: Project[] = [],
  erreursCorrigees: { id: string; concept: string; date: string }[] = [],
): BadgeObtenu[] {
  const triees = [...preuves].sort((a, b) => a.date.localeCompare(b.date));
  const obtenus = new Map<BadgeId, BadgeObtenu>();
  const par = (id: BadgeId) => BADGES.find((b) => b.id === id)!;

  const ajouter = (id: BadgeId, date: string, source: string) => {
    if (!obtenus.has(id)) obtenus.set(id, { badge: par(id), date, source });
  };

  const contextesParSkill = new Map<string, Set<string>>();

  for (const e of triees) {
    if (e.resultat !== "reussi") continue;

    if (e.autonomie === "A3" || e.autonomie === "A4") {
      ajouter("premiere-resolution-autonome", e.date, `Preuve ${e.id} — ${e.skillCode}`);
    }
    if (CODES_MODELISATION.includes(e.skillCode)) {
      ajouter("premiere-modelisation", e.date, `Preuve ${e.id} — ${e.skillCode}`);
    }
    if (CODES_SIMULATION.includes(e.skillCode) || e.type === "code") {
      if (CODES_SIMULATION.includes(e.skillCode)) {
        ajouter("premiere-simulation", e.date, `Preuve ${e.id} — ${e.skillCode}`);
      }
    }

    if (e.autonomie === "A3" || e.autonomie === "A4") {
      const set = contextesParSkill.get(e.skillCode) ?? new Set<string>();
      set.add(e.contexte);
      contextesParSkill.set(e.skillCode, set);
      if (set.size >= 2) {
        ajouter("premier-transfert", e.date, `${e.skillCode} sur ${set.size} contextes`);
      }
    }
  }

  for (const err of erreursCorrigees) {
    ajouter("erreur-corrigee", err.date, `Erreur « ${err.concept} »`);
  }

  for (const p of projets) {
    if (p.statut === "termine" && p.dateFin && p.bilan) {
      ajouter("projet-termine", p.dateFin, `Projet « ${p.titre} »`);
    }
  }

  return [...obtenus.values()].sort((a, b) => a.date.localeCompare(b.date));
}
