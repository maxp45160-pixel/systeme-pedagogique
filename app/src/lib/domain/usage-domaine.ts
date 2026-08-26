/**
 * L'usage déclaré d'un domaine — module académique, progression continue, ou à
 * préciser (ADR-138).
 *
 * Un `Domaine` reste l'unique brique de classement. Cet usage dit seulement le
 * cadre de travail que la personne lui donne, et il est DÉCLARÉ : jamais déduit
 * du nom (« Maths L1 »), du parent, des documents déposés ou des échéances
 * liées. Déduire serait fabriquer un cadre que personne n'a posé.
 *
 * Frontières non négociables :
 * - le module est un cadre, pas un propriétaire : il ne possède aucune
 *   compétence, et une compétence taguée dans un module et dans un domaine
 *   continu garde une seule identité, un historique et un état uniques ;
 * - « à préciser » protège les données existantes : tout ce qui précède
 *   ADR-138 naît indéterminé et y reste sans geste explicite ;
 * - la clôture d'un module est un fait daté : elle ne supprime, ne copie et ne
 *   réinitialise aucune compétence ni observation ;
 * - rien ici n'écrit : la commande transactionnelle vit en base
 *   (`declarer_usage_domaine`), ce module valide et lit.
 */

import type { Domaine, UsageDomaine } from "./types";

/** L'usage des données existantes et le défaut de toute création. */
export const USAGE_INDETERMINE: UsageDomaine = { type: "indetermine" };

/** Les trois natures fermées qu'un formulaire peut soumettre. */
export const TYPES_USAGE = ["indetermine", "continu", "module"] as const;

export type TypeUsage = (typeof TYPES_USAGE)[number];

/** Ce qu'un formulaire (ou un chemin assisté) soumet avant validation. */
export interface EntreeUsageDomaine {
  type: string;
  anneeAcademique?: string;
  periode?: string;
}

/** L'usage validé, prêt pour la commande `declarer_usage_domaine`. */
export interface UsageDeclare {
  /** NULL en base : remettre le domaine « à préciser ». */
  usageType: "indetermine" | "continu" | "module" | null;
  anneeAcademique: string | null;
  periode: string | null;
}

function refuserUsage(motif: string): never {
  throw new Error(`Usage du domaine refusé : ${motif}`);
}

/**
 * Le motif exact pour lequel cette déclaration est refusée, ou `null` si elle
 * est recevable. Une seule implémentation : le formulaire s'en sert pour
 * afficher avant envoi, l'action serveur pour refuser bruyamment, et la base
 * revérifie (`domaines_usage_complete`, miroir de ces règles).
 */
export function motifRefusUsageDomaine(entree: EntreeUsageDomaine): string | null {
  if (!TYPES_USAGE.includes(entree.type as TypeUsage)) {
    return `nature « ${entree.type} » inconnue — à préciser, progression continue ou module académique attendu.`;
  }

  const annee = entree.anneeAcademique?.trim() ?? "";
  const periode = entree.periode?.trim() ?? "";

  if (entree.type !== "module" && (annee.length > 0 || periode.length > 0)) {
    return "une année ou une période académique ne se déclare que pour un module.";
  }
  if (entree.type === "module" && annee.length === 0) {
    return "un module académique exige son année académique (ex. « 2026-2027 »).";
  }

  return null;
}

/**
 * Valide une déclaration et renvoie les champs prêts à écrire. Chaque règle
 * lève avec son motif exact — aucun repli silencieux vers « à préciser » :
 * masquer une année manquante créerait un module deviné, exactement ce
 * qu'ADR-138 interdit.
 */
export function validerNouvelUsage(entree: EntreeUsageDomaine): UsageDeclare {
  const motif = motifRefusUsageDomaine(entree);
  if (motif) refuserUsage(motif);

  if (entree.type === "module") {
    return {
      usageType: "module",
      anneeAcademique: entree.anneeAcademique!.trim(),
      periode: entree.periode?.trim() || null,
    };
  }

  return {
    usageType: entree.type === "continu" ? "continu" : null,
    anneeAcademique: null,
    periode: null,
  };
}

/** La nature brute d'une ligne SQL, avant cohérence — voir `validerDomaine`. */
export type UsageBrut =
  | { usageType: "continu" }
  | { usageType: "module"; anneeAcademique: string; periode?: string; closLe?: string };

/**
 * Lit l'usage déclaré d'un domaine. Absence de champ et « à préciser » sont le
 * même fait : l'appelant ne doit jamais avoir à traiter `undefined` à part.
 */
export function usageDuDomaine(domaine: Pick<Domaine, "usage">): UsageDomaine {
  return domaine.usage ?? USAGE_INDETERMINE;
}

/** Un module actif est vivant et non clôturé ; un module clos reste listé. */
export function estModuleActif(domaine: Domaine): boolean {
  const usage = usageDuDomaine(domaine);
  return (
    !domaine.archive &&
    usage.type === "module" &&
    usage.module.closLe === undefined
  );
}

export interface RepartitionUsages {
  /** Modules académiques vivants et non clôturés, triés par année puis période. */
  modulesActifs: Domaine[];
  /** Modules clôturés — l'historique reste atteignable, rien n'a été effacé. */
  modulesClos: Domaine[];
  /** Domaines durables de progression, hors cours. */
  continues: Domaine[];
  /** Domaines dont l'usage reste à préciser — jamais deviné à leur place. */
  aPreciser: Domaine[];
}

/**
 * Répartit des domaines vivants selon leur usage déclaré — pur dérivé (P1),
 * tri déterministe sur des valeurs déclarées (année, période, nom), jamais sur
 * une supposition.
 *
 * Les domaines archivés n'entrent dans aucune liste : ils ont quitté le
 * référentiel de travail (ADR-065) et leur lecture appartient aux surfaces
 * d'archive, pas aux vues de travail.
 */
export function repartirDomainesParUsage(
  domaines: readonly Domaine[],
): RepartitionUsages {
  const repartition: RepartitionUsages = {
    modulesActifs: [],
    modulesClos: [],
    continues: [],
    aPreciser: [],
  };

  for (const domaine of domaines) {
    if (domaine.archive) continue;
    const usage = usageDuDomaine(domaine);
    if (usage.type === "module") {
      if (usage.module.closLe === undefined) repartition.modulesActifs.push(domaine);
      else repartition.modulesClos.push(domaine);
    } else if (usage.type === "continu") {
      repartition.continues.push(domaine);
    } else {
      repartition.aPreciser.push(domaine);
    }
  }

  const parNom = (a: Domaine, b: Domaine) => a.nom.localeCompare(b.nom, "fr");
  const parCadre = (a: Domaine, b: Domaine): number => {
    const ua = usageDuDomaine(a);
    const ub = usageDuDomaine(b);
    if (ua.type !== "module" || ub.type !== "module") return parNom(a, b);
    return (
      ua.module.anneeAcademique.localeCompare(ub.module.anneeAcademique, "fr") ||
      (ua.module.periode ?? "").localeCompare(ub.module.periode ?? "", "fr") ||
      parNom(a, b)
    );
  };

  repartition.modulesActifs.sort(parCadre);
  repartition.modulesClos.sort(parCadre);
  repartition.continues.sort(parNom);
  repartition.aPreciser.sort(parNom);
  return repartition;
}
