/**
 * Engagements — faits datés déclarés par la personne (couche 1).
 *
 * Un engagement est un fait déclaré, jamais une mesure : « j'ai un examen le
 * 12/09 », « un rendu pour vendredi ». Il vit dans la table `engagements`,
 * append-only — clôturer ou reporter n'y réécrit rien d'autre que la clôture,
 * et un report CRÉE un remplaçant au lieu de déplacer l'ancien.
 *
 * Tout ce qui se calcule sur ces faits (jours restants, fenêtre de
 * recommandation, couverture des compétences ciblées) se dérive ici à la
 * demande, jamais stocké (P1). L'absence de preuve sur une compétence ciblée
 * reste une absence : « rien encore observé » ne devient jamais zéro (P2).
 */

import type { NiveauCompetence, SkillState } from "./types";

export type TypeEngagement = "examen" | "rendu";

export const TYPES_ENGAGEMENT = ["examen", "rendu"] as const;

export type ClotureEngagement = "passe" | "reporte";

export interface Engagement {
  id: string;
  type: TypeEngagement;
  libelle: string;
  /** Échéance, date ISO locale `YYYY-MM-DD` — la base l'impose par CHECK. */
  echeanceLe: string;
  /** Codes du référentiel du compte visés par cet engagement. Vide : non ciblé. */
  codes: string[];
  /**
   * Le module (un domaine vivant du référentiel, ADR-137) auquel cette
   * échéance se rattache. Fait déclaré posé à la création et jamais réécrit ;
   * absent : l'échéance n'est rattachée à aucun module. Le sens inverse — les
   * échéances d'un module — se dérive (`echeancesDuModule`), jamais stocké.
   * Un identifiant peut devenir orphelin (module archivé ou supprimé) :
   * l'échéance reste un fait entier, affichée sans son module.
   */
  moduleDomaineId?: string;
  /** Instant de clôture (ISO complet). Présent : l'engagement est fermé. */
  clotureLe?: string;
  clotureType?: ClotureEngagement;
}

/* ------------------------------------------------------------------ */
/* Dates — tout en jours calendaires, sans heure ni fuseau              */
/* ------------------------------------------------------------------ */

const MS_PAR_JOUR = 86_400_000;

/** Nombre de jours calendaires entre aujourd'hui et l'échéance (négatif : passée). */
export function joursRestants(echeanceLe: string, maintenant: Date): number {
  const [annee, mois, jour] = echeanceLe.split("-").map(Number);
  if (!annee || !mois || !jour) return Number.NaN;
  const echeance = Date.UTC(annee, mois - 1, jour);
  const aujourdhui = Date.UTC(
    maintenant.getFullYear(),
    maintenant.getMonth(),
    maintenant.getDate(),
  );
  return Math.round((echeance - aujourdhui) / MS_PAR_JOUR);
}

/** La fenêtre de recommandation : de J-21 inclus à la veille (J-1) inclus. */
export const FENETRE_ECHEANCE_JOURS = 21;

/**
 * L'échéance est-elle dans la fenêtre où le moteur en tient compte ?
 *
 * Deux bords assumés :
 * - **J-21 inclus** : trois semaines, assez loin pour orienter sans écraser
 *   les autres facteurs ;
 * - **veille incluse, jour même exclu** : passé la veille, le bonus ne sert
 *   plus à préparer quoi que ce soit — il ne ferait que gonfler le score d'un
 *   classement qui n'a plus le temps d'agir. Hors fenêtre : zéro, jamais une
 *   pénalité (une échéance lointaine ou dépassée ne dit rien du travail utile
 *   aujourd'hui).
 */
export function fenetreEcheance(maintenant: Date, echeanceLe: string): boolean {
  const jours = joursRestants(echeanceLe, maintenant);
  return jours >= 1 && jours <= FENETRE_ECHEANCE_JOURS;
}

/**
 * Libellé honnête de la distance à l'échéance. Une échéance dépassée reste
 * affichée comme telle (« passé depuis N jours ») tant qu'elle n'est pas
 * clôturée : faire disparaître le retard reviendrait à réécrire le fait.
 */
export function libelleCompte(jours: number): string {
  if (jours > 1) return `dans ${jours} jours`;
  if (jours === 1) return "demain";
  if (jours === 0) return "aujourd'hui";
  return `passé depuis ${-jours} jour${jours === -1 ? "" : "s"}`;
}

/* ------------------------------------------------------------------ */
/* Lecture                                                              */
/* ------------------------------------------------------------------ */

/** Ouvert : ni clos ni reporté. Les deux champs vont ensemble ou pas du tout. */
export function estOuvert(engagement: Engagement): boolean {
  return engagement.clotureLe === undefined && engagement.clotureType === undefined;
}

/** Copie triée du plus proche au plus lointain ; départage stable par identifiant. */
export function triParUrgence<T extends Engagement>(engagements: T[]): T[] {
  return [...engagements].sort(
    (a, b) => a.echeanceLe.localeCompare(b.echeanceLe) || a.id.localeCompare(b.id),
  );
}

/**
 * Les échéances ouvertes rattachées à un module — entièrement dérivé (P1).
 *
 * Correspondance par identifiant EXACT : une échéance liée au module « M » ne
 * remonte pas dans ses sous-domaines. Étendre aux descendants fabriquerait un
 * rattachement que personne n'a déclaré ; qui veut voir un sous-module porter
 * l'échéance le déclare sur lui. Trié du plus proche au plus lointain.
 */
export function echeancesDuModule(
  moduleDomaineId: string,
  engagements: readonly Engagement[],
): Engagement[] {
  return triParUrgence(
    engagements.filter(
      (engagement) => estOuvert(engagement) && engagement.moduleDomaineId === moduleDomaineId,
    ),
  );
}

/**
 * Les points d'un ciblage qui demandent le plus le travail, du plus pressé au
 * moins pressé : jamais observés d'abord — l'absence de preuve n'est pas un
 * zéro, c'est ce qui reste à découvrir avant une échéance —, puis ce qui est
 * observé sans niveau établi, puis les niveaux croissants. Pur
 * réordonnancement : aucune valeur n'est fabriquée ici, l'ordre se dérive.
 */
export function prioriserCouverture(
  couverture: readonly CouvertureCode[],
): CouvertureCode[] {
  return [...couverture].sort((a, b) => {
    if (a.observe !== b.observe) return a.observe ? 1 : -1;
    if (a.niveau === null && b.niveau === null) return 0;
    if (a.niveau === null) return -1;
    if (b.niveau === null) return 1;
    return a.niveau - b.niveau;
  });
}

/* ------------------------------------------------------------------ */
/* Validation à la création — refus bruyant, aucun repli                */
/* ------------------------------------------------------------------ */

/** Ce qu'un formulaire (ou un chemin assisté) soumet avant validation. */
export interface EntreeEngagement {
  type: string;
  libelle: string;
  echeanceLe: string;
  codes?: string[];
  /** Module facultatif — un domaine vivant du référentiel (ADR-137). */
  moduleDomaineId?: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function refuserCreation(motif: string): never {
  throw new Error(`Engagement refusé : ${motif}`);
}

/**
 * Valide une création d'engagement et renvoie les champs prêts à écrire.
 *
 * Chaque règle lève avec son motif exact :
 * - `type` appartient à l'énumération fermée examen/rendu ;
 * - libellé non vide après rognage ;
 * - date ISO `YYYY-MM-DD` réelle (le 31/02 est refusé, pas corrigé) ;
 * - chaque code existe dans le référentiel fourni — un code invalide est un
 *   refus bruyant, jamais ignoré (garde-fou : le tuteur ne crée jamais de
 *   code, et ici personne ne crée de code non plus) ;
 * - `moduleDomaineId`, s'il est renseigné, désigne un domaine VIVANT du compte
 *   — un module archivé ou inconnu est refusé avec son motif, jamais ignoré.
 */
export function validerNouvelEngagement(
  entree: EntreeEngagement,
  codesActifs: ReadonlySet<string>,
  domainesActifs: ReadonlySet<string> = new Set(),
): {
  type: TypeEngagement;
  libelle: string;
  echeanceLe: string;
  codes: string[];
  moduleDomaineId?: string;
} {
  if (!TYPES_ENGAGEMENT.includes(entree.type as TypeEngagement)) {
    refuserCreation(`type « ${entree.type} » inconnu — examen ou rendu attendu.`);
  }

  const libelle = entree.libelle.trim();
  if (libelle.length === 0) {
    refuserCreation("le libellé ne peut pas être vide.");
  }

  const echeance = entree.echeanceLe.trim();
  if (!ISO_DATE.test(echeance)) {
    refuserCreation("la date doit être au format AAAA-MM-JJ.");
  }
  const [annee, mois, jour] = echeance.split("-").map(Number);
  const relue = new Date(annee, mois - 1, jour);
  if (
    relue.getFullYear() !== annee ||
    relue.getMonth() !== mois - 1 ||
    relue.getDate() !== jour
  ) {
    refuserCreation(`la date ${echeance} n'existe pas au calendrier.`);
  }

  const codes = [...new Set(entree.codes ?? [])];
  const inconnus = codes.filter((code) => !codesActifs.has(code));
  if (inconnus.length > 0) {
    refuserCreation(
      `compétence(s) inconnue(s) du référentiel : ${inconnus.join(", ")}.`,
    );
  }

  const moduleDomaineId = entree.moduleDomaineId?.trim() || undefined;
  if (moduleDomaineId && !domainesActifs.has(moduleDomaineId)) {
    refuserCreation(
      `module « ${moduleDomaineId} » inconnu ou mis de côté — déclarez le domaine d'abord.`,
    );
  }

  return {
    type: entree.type as TypeEngagement,
    libelle,
    echeanceLe: echeance,
    codes,
    moduleDomaineId,
  };
}

/* ------------------------------------------------------------------ */
/* Couverture dérivée (A5) — calculée à la demande, jamais stockée      */
/* ------------------------------------------------------------------ */

export interface CouvertureCode {
  code: string;
  /** Faux : aucune observation directe n'existe encore pour ce code. */
  observe: boolean;
  /** `null` tant qu'aucune observation — absence de preuve, jamais zéro. */
  niveau: NiveauCompetence | null;
  /** Dernière activité observée (date ISO), ou `null`. */
  derniereActivite: string | null;
  /** Phrase prête à afficher, qui dit aussi l'absence. */
  phrase: string;
}

/**
 * Ce que les états existants disent des compétences ciblées par un engagement.
 *
 * Pur dérivé des `SkillState` courants : rien n'est écrit, rien n'est calculé
 * à l'avance, et une compétence ciblée mais jamais travaillée ressort
 * explicitement « rien encore observé » — pas un niveau 0, pas un tiret muet.
 * Le code peut être absent du map (compétence sortie du périmètre depuis la
 * déclaration) : même réponse, même honnêteté.
 */
export function couvertureCompetences(
  codes: readonly string[],
  etatsParCode: ReadonlyMap<string, SkillState>,
): CouvertureCode[] {
  return codes.map((code) => {
    const etat = etatsParCode.get(code);
    if (!etat || etat.observations.length === 0) {
      return {
        code,
        observe: false,
        niveau: null,
        derniereActivite: null,
        phrase: `Rien encore observé sur ${code}.`,
      };
    }
    return {
      code,
      observe: true,
      niveau: etat.niveau,
      derniereActivite: etat.derniereObservation,
      phrase:
        etat.niveau === null
          ? `${code} : observations présentes, niveau pas encore établi.`
          : `${code} : niveau ${etat.niveau}, dernière activité le ${etat.derniereObservation?.slice(0, 10)}.`,
    };
  });
}
