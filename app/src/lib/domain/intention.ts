/**
 * L'intention déclarée, et sa traduction en une action déjà connue du système.
 *
 * Le produit demandait à l'utilisateur de choisir **l'objet** qu'il voulait
 * créer — une compétence, un thème, un exercice, une séance, une note, un
 * projet — soit treize modales de création pour sept écrans. Choisir l'objet
 * suppose de connaître le modèle de données ; personne n'ouvre l'application
 * pour ça. On lui demande maintenant **ce dont il a besoin**, en une phrase, et
 * le système choisit l'objet.
 *
 * ## Ce que ce fichier n'est pas
 *
 * Ce n'est pas une nouvelle entité. Rien n'est persisté : une intention est
 * traduite, exécutée, et disparaît. Les trois genres ci-dessous pointent tous
 * vers une surface qui existait déjà — le compositeur de séance, la création de
 * note, la proposition de branche. Aucun écran ne naît de ce fichier.
 *
 * ## Frontière
 *
 * Couche 1 (domaine pur) : aucune dépendance au tuteur, au store ni à React.
 * La traduction par le modèle vit dans `lib/tutor/intention.ts` ; ce fichier
 * détient la seule validation qui fasse autorité, et les tests qui la tiennent.
 */

import { EXERCICES_PAR_LOT_MAX } from "./exercice";

/* ------------------------------------------------------------------ */
/* Genres                                                              */
/* ------------------------------------------------------------------ */

/**
 * Les quatre traductions possibles d'un besoin exprimé.
 *
 * - `travail` — s'entraîner sur des compétences qui existent déjà. Mène au
 *   compositeur de séance, qui sait déjà générer un ou plusieurs exercices.
 * - `projet` — produire un artefact qui mobilise plusieurs compétences à la
 *   fois. Mène au parcours de projet, qui recible lui-même les compétences.
 * - `note` — déposer une ressource ou un contexte. Ne mesure rien (P5).
 * - `referentiel` — le sujet demandé n'existe pas encore : il faut d'abord des
 *   compétences pour pouvoir mesurer quoi que ce soit.
 *
 * Il n'y a délibérément **pas** de genre « reprendre » : un travail déjà ouvert
 * est un fait lu en base, pas une intention à interpréter. Le tableau de bord
 * le signale lui-même, sans passer par le modèle — le faire proposer
 * reviendrait à laisser le tuteur affirmer un état du compte.
 */
export const GENRES_INTENTION = ["travail", "projet", "note", "referentiel"] as const;

export type GenreIntention = (typeof GENRES_INTENTION)[number];

export const LIBELLES_GENRE: Record<GenreIntention, string> = {
  travail: "S'entraîner",
  projet: "Produire",
  note: "Déposer une ressource",
  referentiel: "Étendre le référentiel",
};

/* ------------------------------------------------------------------ */
/* L'action traduite                                                   */
/* ------------------------------------------------------------------ */

export interface ActionIntention {
  genre: GenreIntention;
  /** Ce qui sera fait, formulé pour être lu — pas un identifiant. */
  titre: string;
  /** Pourquoi cette action répond au besoin. Jamais vide (P3). */
  pourquoi: string;
  /**
   * Compétences visées. **Toujours** un sous-ensemble des codes actifs : un
   * code inventé est écarté ici, pas plus loin (garde-fou du référentiel —
   * le tuteur ne crée jamais de code).
   */
  codes: string[];
  /**
   * Le sujet en clair, pour les genres qui n'ont pas de code à viser.
   * Obligatoire pour `referentiel`, facultatif ailleurs.
   */
  sujet: string;
}

/** Ce que la traduction rend : une action tenue, et ses replis. */
export interface TraductionIntention {
  action: ActionIntention;
  /** Autres lectures du même besoin, proposées en retrait. */
  alternatives: ActionIntention[];
}

/* ------------------------------------------------------------------ */
/* Bornes                                                              */
/* ------------------------------------------------------------------ */

export const BESOIN_MIN = 3;
export const BESOIN_MAX = 400;
const TITRE_MAX = 120;
const POURQUOI_MAX = 300;
const ALTERNATIVES_MAX = 3;

/** Un besoin exploitable : ni vide, ni un roman collé depuis ailleurs. */
export function besoinValide(besoin: string): boolean {
  const t = besoin.trim();
  return t.length >= BESOIN_MIN && t.length <= BESOIN_MAX;
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

function texte(valeur: unknown, max: number): string {
  if (typeof valeur !== "string") return "";
  const t = valeur.trim();
  return t.length > max ? t.slice(0, max).trim() : t;
}

/**
 * Valide une action rendue par le modèle contre les codes réellement actifs.
 *
 * Rend `null` plutôt qu'une action rabotée quand il manque ce qui la rend
 * exécutable : un travail sans compétence visée n'a rien à composer. Fabriquer
 * une valeur de repli à partir d'une donnée invalide est précisément ce qu'on
 * s'interdit — l'appelant annonce l'échec et laisse la saisie manuelle.
 *
 * Un code hors de l'ensemble actif est écarté sans faire tomber l'action : le
 * reste de la désignation peut rester bon. Mais si l'écrémage vide la liste
 * d'un `travail`, l'action tombe — c'est alors qu'il n'y avait rien de réel
 * derrière.
 */
export function validerActionIntention(
  brut: unknown,
  codesActifs: ReadonlySet<string>,
): ActionIntention | null {
  if (typeof brut !== "object" || brut === null || Array.isArray(brut)) return null;
  const entree = brut as Record<string, unknown>;

  const genre = GENRES_INTENTION.find(
    (g) => typeof entree.genre === "string" && entree.genre.trim().toLowerCase() === g,
  );
  if (!genre) return null;

  const titre = texte(entree.titre, TITRE_MAX);
  const pourquoi = texte(entree.pourquoi, POURQUOI_MAX);
  if (!titre || !pourquoi) return null;

  const codes = [
    ...new Set(
      (Array.isArray(entree.codes) ? entree.codes : [])
        .map((c) => (typeof c === "string" ? c.trim().toUpperCase() : ""))
        .filter((c) => c.length > 0 && codesActifs.has(c)),
    ),
  ].slice(0, EXERCICES_PAR_LOT_MAX);

  /*
   * `projet` et `referentiel` partent d'une phrase, pas d'une liste de codes.
   * Cette phrase, c'est `sujet` — et à défaut `titre`, qui dit déjà en une
   * ligne ce qui sera fait.
   *
   * Le repli n'invente rien : c'est **exactement** ce que les deux
   * consommateurs font depuis toujours (`CaptureIntention.executer` ouvre le
   * parcours sur `action.sujet || action.titre`). L'exiger ici refusait donc
   * des actions parfaitement exécutables : « génère moi un domaine
   * mathématiques » revenait comme « proposition incomplète » alors que le
   * titre portait le sujet. Une phrase relue par la personne dans l'écran
   * suivant, dans les deux cas.
   */
  const sujet = texte(entree.sujet, TITRE_MAX) || (genre === "travail" ? "" : titre);

  if (genre === "travail" && codes.length === 0) return null;

  return { genre, titre, pourquoi, codes, sujet };
}

/**
 * Valide la traduction entière.
 *
 * L'action principale est obligatoire ; les alternatives sont un confort, et
 * une alternative mal formée est écartée en silence plutôt que de faire tomber
 * une traduction par ailleurs bonne. Un doublon de genre + titre est retiré :
 * proposer deux fois la même chose donne l'impression d'un choix qui n'existe
 * pas.
 */
export function validerTraductionIntention(
  brut: unknown,
  codesActifs: ReadonlySet<string>,
): TraductionIntention | null {
  if (typeof brut !== "object" || brut === null) return null;
  const entree = brut as Record<string, unknown>;

  const action = validerActionIntention(entree.action, codesActifs);
  if (!action) return null;

  const vues = new Set([`${action.genre}|${action.titre.toLowerCase()}`]);
  const alternatives: ActionIntention[] = [];
  for (const candidate of Array.isArray(entree.alternatives) ? entree.alternatives : []) {
    if (alternatives.length >= ALTERNATIVES_MAX) break;
    const valide = validerActionIntention(candidate, codesActifs);
    if (!valide) continue;
    const cle = `${valide.genre}|${valide.titre.toLowerCase()}`;
    if (vues.has(cle)) continue;
    vues.add(cle);
    alternatives.push(valide);
  }

  return { action, alternatives };
}

/* ------------------------------------------------------------------ */
/* Destination                                                         */
/* ------------------------------------------------------------------ */

/**
 * L'URL du compositeur de séance pour un `travail`.
 *
 * Exactement celle que `BoutonGenerer` fabriquait déjà : le point d'entrée
 * unique n'invente aucune destination, il en réutilise une. `intention` porte
 * la phrase de l'utilisateur, que le compositeur affiche comme titre proposé.
 */
export function urlComposition(codes: string[], intention: string): string {
  const parametres = new URLSearchParams({ composer: "1" });
  for (const code of codes.slice(0, EXERCICES_PAR_LOT_MAX)) parametres.append("code", code);
  const t = intention.trim();
  if (t) parametres.set("intention", t);
  return `/seances?${parametres.toString()}`;
}

/**
 * La même destination, pour un thème déjà enregistré.
 *
 * On passe l'identifiant plutôt que la liste de codes : un thème est une
 * **portée** (`{type: "theme"}`), pas une liste imposée (ADR-053). Recopier ses
 * codes dans l'URL les transformerait en `codesImposes` et priverait le moteur
 * du choix qu'il doit faire à l'intérieur du thème — et le `themeId` du besoin
 * déclaré serait perdu.
 */
export function urlCompositionTheme(themeId: string, intention: string): string {
  const parametres = new URLSearchParams({ composer: "1", theme: themeId });
  const t = intention.trim();
  if (t) parametres.set("intention", t);
  return `/seances?${parametres.toString()}`;
}
