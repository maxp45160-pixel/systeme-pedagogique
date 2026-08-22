/**
 * Les sous-domaines qu'un domaine contient déjà sans le dire.
 *
 * ADR-104 laissait la question ouverte : « la manière de dériver
 * intelligemment des sous-domaines à l'intérieur d'un domaine large reste un
 * sujet de conception. Aucun arbre implicite ni regroupement automatique ne
 * doit être ajouté avant une décision et des données permettant de
 * l'évaluer. » Les données existent maintenant : « Logistique industrielle »
 * porte treize compétences dont quatre nomment le Kanban. Le regroupement est
 * là, écrit dans les intitulés, et personne ne le lit.
 *
 * ## La règle, et pourquoi elle tient
 *
 * Un sous-domaine n'est pas inventé : c'est un **terme que plusieurs intitulés
 * du domaine partagent**, et c'est ce terme lui-même qui le nomme. « Kanban »
 * ne sort pas d'un modèle, il sort des compétences. Cela donne trois
 * propriétés qu'aucun regroupement sémantique n'aurait :
 *
 *   - **déterministe** : même référentiel, même découpage, toujours ;
 *   - **explicable en une phrase** : « quatre compétences disent Kanban » ;
 *   - **réfutable d'un coup d'œil** : le terme est visible dans les intitulés.
 *
 * ## Ce que le module écarte, et pourquoi
 *
 * - **Les verbes d'action** (`VERBES_ACTION`, ADR-086). « Décrire »,
 *   « Appliquer », « Concevoir » décrivent la *forme* d'un intitulé, jamais
 *   son sujet. Sans cette exclusion, tout domaine se découperait en
 *   « les décrire » et « les appliquer », ce qui est un palier déguisé.
 * - **Un terme présent dans presque toutes les compétences.** Il nomme le
 *   domaine, pas un sous-ensemble : dans « Logistique », « stock » partout ne
 *   fait pas un sous-domaine « Stock ».
 * - **Un domaine trop petit.** En dessous de `MIN_COMPETENCES_DOMAINE`, un
 *   découpage divise ce qui se lit déjà d'un seul tenant.
 *
 * ## Ce que le module ne fait pas
 *
 * Il ne crée aucun domaine, n'écrit rien, ne déplace aucune compétence. Un
 * sous-domaine dérivé est une **lecture** (couche 3), recalculée à chaque
 * affichage. Le jour où l'un d'eux mérite d'exister vraiment, c'est une
 * personne qui le créera par la commande de référentiel, comme tout le reste.
 */

import { VERBES_ACTION, VERBES_NON_OBSERVABLES } from "@/lib/domain/atomicite";
import { tokeniser } from "./similarite-textuelle";

/** En dessous, un domaine se lit d'un seul tenant. */
export const MIN_COMPETENCES_DOMAINE = 5;

/** Un groupe d'une seule compétence n'est pas un groupe. */
export const MIN_COMPETENCES_GROUPE = 2;

/**
 * Au-delà de cette part des compétences du domaine, un terme nomme le domaine
 * lui-même et non un sous-ensemble.
 */
export const PART_MAX_TERME = 0.7;

export interface SousDomaineDerive {
  /** Le terme normalisé — clé stable, jamais affichée telle quelle. */
  terme: string;
  /** Le terme tel qu'il apparaît dans les intitulés, initiale capitalisée. */
  libelle: string;
  /** Codes des compétences que ce terme rassemble, dans l'ordre reçu. */
  codes: string[];
}

export interface DecoupageSousDomaines {
  groupes: SousDomaineDerive[];
  /**
   * Compétences qu'aucun terme partagé ne rassemble. Ni un défaut, ni un
   * fourre-tout : la plupart des domaines en ont, et c'est normal.
   */
  isolees: string[];
}

export interface CompetenceADecouper {
  code: string;
  intitule: string;
}

const MOTS_ECARTES = new Set<string>([
  ...VERBES_ACTION.map((verbe) => verbe.toLocaleLowerCase("fr-FR")),
  ...VERBES_NON_OBSERVABLES.map((verbe) => verbe.toLocaleLowerCase("fr-FR")),
]);

/**
 * `tokeniser` normalise (minuscules, pluriels) ; les verbes de la liste sont
 * écrits à l'infinitif. On compare donc les deux après le même passage, sinon
 * « décrire » écarté ne reconnaîtrait pas « décrire » tokenisé en « décrir ».
 */
const RACINES_ECARTEES = new Set<string>(
  [...MOTS_ECARTES].flatMap((verbe) => tokeniser(verbe)),
);

export function deriverSousDomaines(
  competences: readonly CompetenceADecouper[],
  options: { minDomaine?: number; minGroupe?: number; partMax?: number } = {},
): DecoupageSousDomaines {
  const {
    minDomaine = MIN_COMPETENCES_DOMAINE,
    minGroupe = MIN_COMPETENCES_GROUPE,
    partMax = PART_MAX_TERME,
  } = options;

  if (competences.length < minDomaine) {
    return { groupes: [], isolees: competences.map((competence) => competence.code) };
  }

  /* ── Termes de chaque compétence, verbes d'action écartés ─────────── */

  const termesParCode = new Map<string, string[]>();
  /** Forme lisible d'un terme : la première rencontrée, l'ordre étant stable. */
  const formeLisible = new Map<string, string>();

  for (const competence of competences) {
    const termes: string[] = [];
    for (const mot of competence.intitule.split(/\s+/)) {
      const [normalise] = tokeniser(mot);
      if (!normalise || RACINES_ECARTEES.has(normalise)) continue;
      if (!termes.includes(normalise)) termes.push(normalise);
      if (!formeLisible.has(normalise)) {
        formeLisible.set(normalise, mot.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, ""));
      }
    }
    termesParCode.set(competence.code, termes);
  }

  /* ── Combien de compétences portent chaque terme ──────────────────── */

  const frequence = new Map<string, number>();
  for (const termes of termesParCode.values()) {
    for (const terme of termes) frequence.set(terme, (frequence.get(terme) ?? 0) + 1);
  }

  const plafond = Math.floor(competences.length * partMax);
  const candidats = new Set(
    [...frequence.entries()]
      .filter(([, compte]) => compte >= minGroupe && compte <= plafond)
      .map(([terme]) => terme),
  );

  /* ── Chaque compétence rejoint AU PLUS un groupe ──────────────────── */

  /*
   * Le terme le plus PARTAGÉ l'emporte.
   *
   * La première version prenait le plus rare, en croyant prendre le plus
   * distinctif. Sur le cas réel, elle éclatait les quatre compétences Kanban
   * en « Base » (2) et « Tableau » (2) : deux fragments qui ne nomment rien,
   * pendant que « Kanban » (4) disparaissait. Un sous-domaine est ce qui
   * rassemble le plus, pas ce qui se répète le moins — et le terme qui
   * nommerait le domaine entier est déjà écarté par `partMax`.
   *
   * À égalité, l'ordre alphabétique tranche : arbitraire, mais reproductible.
   */
  const groupes = new Map<string, string[]>();
  const isolees: string[] = [];

  for (const competence of competences) {
    const retenus = (termesParCode.get(competence.code) ?? []).filter((terme) =>
      candidats.has(terme),
    );
    if (retenus.length === 0) {
      isolees.push(competence.code);
      continue;
    }
    retenus.sort(
      (a, b) => (frequence.get(b) ?? 0) - (frequence.get(a) ?? 0) || a.localeCompare(b, "fr"),
    );
    const terme = retenus[0];
    const liste = groupes.get(terme) ?? [];
    liste.push(competence.code);
    groupes.set(terme, liste);
  }

  /*
   * Un groupe peut fondre sous le seuil après l'affectation : ses compétences
   * sont parties vers un terme plus rare. Elles redeviennent isolées plutôt
   * que de former un groupe d'une seule ligne.
   */
  const retenus: SousDomaineDerive[] = [];
  for (const [terme, codes] of groupes) {
    if (codes.length < minGroupe) {
      isolees.push(...codes);
      continue;
    }
    retenus.push({
      terme,
      libelle: capitaliser(formeLisible.get(terme) ?? terme),
      codes,
    });
  }

  retenus.sort(
    (a, b) => b.codes.length - a.codes.length || a.libelle.localeCompare(b.libelle, "fr"),
  );
  isolees.sort((a, b) => a.localeCompare(b));

  return { groupes: retenus, isolees };
}

function capitaliser(mot: string): string {
  if (mot.length === 0) return mot;
  return mot[0].toLocaleUpperCase("fr-FR") + mot.slice(1);
}
