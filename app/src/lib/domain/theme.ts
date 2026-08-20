/**
 * Le thème : une portée modulaire sur le référentiel (chantier 10/08/2026,
 * ADR-053).
 *
 * ## Le problème qu'il résout
 *
 * Le domaine est aujourd'hui le seul regroupement de compétences, et c'est une
 * partition stricte : une compétence appartient à un domaine et un seul. Or
 * « travailler le stoïcisme » traverse cinq domaines (FTS, MEJ, ECV, LRS, AMS),
 * et « japonais + toyotisme » n'a même pas de domaine commun. Le thème couvre
 * ce cas sans toucher au domaine, qui reste la source du préfixe de code
 * (ADR-026) et la cible de la clé étrangère des observations.
 *
 * ## Pourquoi ce n'est pas une table d'arêtes compétence↔compétence
 *
 * `competences.prerequis TEXT[]` est déjà une arête, et son sort est un
 * avertissement : 17 compétences sur 77 la portent, un seul facteur du moteur
 * la lit, et le formulaire d'édition ne sait même pas l'écrire. Une seconde
 * table d'arêtes sans consommateur connaîtrait le même sort.
 *
 * Un thème est une **hyper-arête nommée** : `{Japonais, Toyotisme, Histoire
 * industrielle}` est une relation à N branches qui porte son *pourquoi*
 * (`libelle`, `intention`). Une arête binaire n'en est qu'un cas particulier à
 * 2 membres — la co-appartenance est donc plus expressive, pas moins, et elle
 * a un consommateur dès le premier jour : `composerSeance`.
 */

import type { DomaineId, Referentiel } from "./types";
import type { PorteeSeance } from "./types";
import type { ThemeSeance } from "../engine/caf";
import { slugifier } from "./referentiel-compte";

export const LIBELLE_THEME_MIN = 1;
export const LIBELLE_THEME_MAX = 100;
export const INTENTION_THEME_MAX = 500;
export const CODES_PAR_THEME_MIN = 1;
export const CODES_PAR_THEME_MAX = 500;

/**
 * Un regroupement de compétences nommé par la personne (ou proposé par le
 * tuteur puis validé), traversant librement les domaines.
 *
 * Ce qui n'est PAS stocké (P1) : la portée qu'il produit, le nombre de
 * domaines traversés, tout compte dérivable de `codes`. Recalculé à chaque
 * lecture par `themeVersThemeSeance`.
 */
export interface Theme {
  id: string;
  libelle: string;
  /** Pourquoi ce regroupement, en clair. Facultatif — même raison que
   * `BesoinDeclare.intention` : exiger une phrase rédigée coûte plus cher que
   * le geste qu'elle documente. Absente = absente, jamais dérivée du libellé. */
  intention?: string;
  codes: string[];
  origine: "utilisateur" | "tuteur";
  creeLe: string;
  modifieLe?: string;
  archive: boolean;
}

/** Ce qu'on écrit pour créer un thème — pas d'`id`, attribué par le store. */
export interface NouveauTheme {
  libelle: string;
  intention?: string;
  codes: string[];
  origine: "utilisateur" | "tuteur";
}

/**
 * Identifiant stable d'un thème, dérivé de son libellé.
 *
 * Même mécanique que les codes de compétence : jamais frappé par le tuteur,
 * toujours attribué côté application. Un thème n'a pas de FK d'observation à
 * protéger comme un code de compétence — une collision se résout par suffixe
 * numérique plutôt que par un motif à deux lettres (pas de préfixe de domaine
 * à réutiliser ici).
 */
export function idTheme(libelle: string, dejaPris: Iterable<string>): string {
  const pris = new Set(dejaPris);
  const base = slugifier(libelle) || "theme";
  if (!pris.has(base)) return base;
  let n = 2;
  while (pris.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/**
 * Les refus d'un thème — autorité unique, partagée par l'action serveur et
 * l'écran (même règle qu'ADR-047 pour l'édition d'exercice : deux copies
 * finiraient par diverger, et la divergence serait invisible).
 *
 * `codesConnus` n'est volontairement pas vérifié pour interdire un code
 * absent : voir `themeVersThemeSeance`, qui filtre à la lecture plutôt que de
 * rejeter le thème entier (même choix que `creerBranche` pour `prerequis`).
 * Ici, seule la forme est jugée : un thème sans aucun code n'a pas de sens à
 * exister.
 */
export function motifRefusTheme(theme: NouveauTheme): string | null {
  const libelle = theme.libelle.trim();
  if (libelle.length < LIBELLE_THEME_MIN || libelle.length > LIBELLE_THEME_MAX) {
    return `Libellé hors bornes : ${libelle.length} caractère(s). Il doit compter de ${LIBELLE_THEME_MIN} à ${LIBELLE_THEME_MAX}.`;
  }
  if (theme.intention !== undefined && theme.intention.length > INTENTION_THEME_MAX) {
    return `Intention trop longue : ${theme.intention.length} caractères, maximum ${INTENTION_THEME_MAX}.`;
  }
  const codes = [...new Set(theme.codes)];
  if (codes.length < CODES_PAR_THEME_MIN) {
    return "Un thème sans aucune compétence n'a rien à composer.";
  }
  if (codes.length > CODES_PAR_THEME_MAX) {
    return `Trop de compétences pour un thème : ${codes.length}, maximum ${CODES_PAR_THEME_MAX}.`;
  }
  return null;
}

/**
 * Un thème, vu comme portée de séance — le pont vers `composerSeance`.
 *
 * ⚠️ Filtre les codes archivés ou disparus **sans rejeter le thème** : un
 * thème créé il y a un mois peut viser un code retiré depuis. Précédent
 * explicite : `creerBranche` (`lib/store/referentiel-actions.ts`) — « une
 * arête inconnue est écartée, pas l'objet ».
 *
 * Rend `null` si plus aucun code du thème n'est actif : la portée serait
 * vide, et `composerSeance` sait déjà dire « rien à composer » — mais
 * seulement pour une portée non vide en entrée (voir `motifRefusDemande`).
 */
export function themeVersThemeSeance(theme: Theme, referentiel: Referentiel): ThemeSeance | null {
  const codesActifs = theme.codes.filter((c) => referentiel.codesActifs.has(c));
  if (codesActifs.length === 0) return null;

  const domaines = new Set<DomaineId>(
    codesActifs.map((c) => referentiel.parCode.get(c)?.domaine).filter((d): d is DomaineId => !!d),
  );

  return {
    cle: `theme:${theme.id}`,
    libelle: theme.libelle,
    detail: `${codesActifs.length} compétence${codesActifs.length > 1 ? "s" : ""} · ${domaines.size} domaine${domaines.size > 1 ? "s" : ""}`,
    portee: { type: "theme", themeId: theme.id, codes: codesActifs } satisfies PorteeSeance,
    codesImposes: [],
  };
}

/**
 * Les thèmes enregistrés, actifs, prêts à figurer à côté des thèmes suggérés
 * par le moteur dans le compositeur.
 *
 * Dédoublonné par `id` : le compositeur de séance (`ConcepteurSeance`) fusionne
 * les thèmes déjà persistés côté serveur avec ceux créés pendant la session en
 * cours (avant que `revalidatePath` ne les réinjecte dans les premiers), et les
 * deux listes peuvent contenir la même entité le temps d'un aller-retour
 * serveur. Dédoublonner ici, dans la fonction pure partagée, plutôt que dans
 * chaque appelant (garde-fou : une seule implémentation par validation
 * partagée).
 */
export function themesEnregistres(themes: Theme[], referentiel: Referentiel): ThemeSeance[] {
  const vus = new Set<string>();
  const resultat: ThemeSeance[] = [];
  for (const t of themes) {
    if (t.archive || vus.has(t.id)) continue;
    vus.add(t.id);
    const converti = themeVersThemeSeance(t, referentiel);
    if (converti) resultat.push(converti);
  }
  return resultat;
}
