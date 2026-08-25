/**
 * La marge du cahier — ce qu'on griffonne à côté du travail.
 *
 * ## Le manque
 *
 * Le cahier n'offrait qu'un seul endroit où écrire : le champ « Annoter » d'une
 * séance **terminée**. On ne pouvait donc rien y noter avant, ni pendant, ni en
 * dehors d'une séance — alors que c'est exactement ce qu'on fait dans un cahier
 * : « je bloque sur les conversions », « revoir la formule de Little ». Ces
 * phrases sont le point d'entrée naturel de la boucle (un problème constaté,
 * puis une séance qui l'attaque), et elles n'avaient nulle part où atterrir.
 *
 * La capture de note existante (`creerNoteAction`) ne répond pas à ce besoin :
 * elle exige un titre, un contexte et un domaine. C'est un formulaire, pas une
 * marge — et une friction de trois champs devant une phrase de six mots fait
 * qu'on ne l'écrit pas.
 *
 * ## Pourquoi un document Markdown, et pas une table
 *
 * Parce qu'il n'y a rien à modéliser. La marge est une liste de phrases datées :
 * un document du corpus existant la porte sans migration, s'exporte avec le
 * reste, se relit hors de l'application et se corrige à la main. Une table
 * `notes_cahier` aurait ajouté une entité, ses politiques RLS et son schéma pour
 * stocker du texte libre — l'ajout que P1 et la discipline de ce projet
 * demandent d'éviter tant qu'une donnée n'est pas structurée.
 *
 * Ce module ne fait donc que lire et réécrire une section, exactement dans le
 * format qu'il écrit lui-même — même discipline que `projet.ts` : aucune
 * tolérance inventée, une ligne non conforme n'est pas devinée.
 */

import { lireValeursSections, mettreAJourSections } from "./sections-markdown";
import { SCHEMA_MARKDOWN } from "./markdown";

/** L'identifiant du document, fixe : il n'y a qu'une marge par compte. */
export const ID_MARGE = "marge-du-cahier";

/** La section qui porte les lignes. Le reste du document n'est jamais touché. */
export const SECTION_MARGE = "Marge";

/**
 * Le titre affiché du document. Renommé « Marge du cahier » → « Bloc-notes »
 * le 25/08/2026 (friction 2) : le libellé visible change, pas la donnée —
 * l'identifiant technique (`ID_MARGE`) et la section Markdown
 * (`SECTION_MARGE`) restent ce qu'ils ont toujours été, pour ne casser aucune
 * note déjà écrite.
 */
export const TITRE_MARGE = "Bloc-notes";

/**
 * Longueur d'une ligne de marge.
 *
 * Même raison que `INTENTION_MAX` (lib/domain/seance.ts) : la borne n'existe pas
 * pour contraindre la pensée, mais pour qu'un champ de saisie ne devienne pas un
 * journal intime. Une ligne de marge est une phrase, pas un paragraphe.
 */
export const LIGNE_MARGE_MAX = 280;

export interface LigneMarge {
  /** Le texte écrit, tel quel. */
  texte: string;
  /** Traitée : la question a trouvé sa réponse, ou le problème a été travaillé. */
  faite: boolean;
  /** Date de la note (AAAA-MM-JJ). Absente sur une ligne écrite à la main sans date. */
  notee?: string;
}

/*
 * `- [ ] texte <!-- 2026-08-16 -->`
 *
 * Le commentaire HTML porte la date : invisible au rendu Markdown, lisible par
 * la machine, et sans effet sur le texte qu'on reprendra pour composer une
 * séance. Une ligne écrite à la main sans commentaire reste valide — elle n'a
 * simplement pas de date, et on n'en invente pas.
 */
const LIGNE = /^-\s*\[( |x|X)\]\s*(.*?)\s*(?:<!--\s*(\d{4}-\d{2}-\d{2})\s*-->)?\s*$/;

/** Les lignes de la marge, dans l'ordre où elles ont été écrites. */
export function analyserMarge(contenuMd: string): LigneMarge[] {
  const corps = lireValeursSections(contenuMd, [SECTION_MARGE])[SECTION_MARGE] ?? "";
  const lignes: LigneMarge[] = [];
  for (const brute of corps.replace(/\r\n/g, "\n").split("\n")) {
    const correspondance = LIGNE.exec(brute.trim());
    if (!correspondance) continue;
    const texte = correspondance[2].trim();
    if (!texte) continue;
    lignes.push({
      texte,
      faite: correspondance[1].toLowerCase() === "x",
      ...(correspondance[3] ? { notee: correspondance[3] } : {}),
    });
  }
  return lignes;
}

function rendreLigne(ligne: LigneMarge): string {
  const date = ligne.notee ? ` <!-- ${ligne.notee} -->` : "";
  return `- [${ligne.faite ? "x" : " "}] ${ligne.texte}${date}`;
}

/**
 * Réécrit la section « Marge », et elle seule.
 *
 * `mettreAJourSections` garantit le reste : ni le front-matter, ni le titre, ni
 * une section ajoutée à la main ne bougent. C'est ce qui permet d'ouvrir le même
 * document dans l'Atelier et d'y écrire librement à côté.
 */
export function ecrireMarge(contenuMd: string, lignes: readonly LigneMarge[]): string {
  return mettreAJourSections(contenuMd, [SECTION_MARGE], {
    [SECTION_MARGE]: lignes.map(rendreLigne).join("\n"),
  });
}

/** Le document initial, quand la marge est écrite pour la première fois. */
export function documentMargeInitial(date = new Date().toISOString().slice(0, 10)): string {
  return [
    "---",
    `schema: ${SCHEMA_MARKDOWN}`,
    "type: note",
    `id: ${ID_MARGE}`,
    `created_at: ${date}`,
    "---",
    "",
    `# ${TITRE_MARGE}`,
    "",
    `## ${SECTION_MARGE}`,
    "",
    "",
  ].join("\n");
}

/**
 * Le refus d'une ligne, en un point d'autorité.
 *
 * Même discipline que `motifRefusBesoin` : l'écran et la Server Function
 * appellent la même fonction, sinon on ferait entrer par l'une ce que l'autre
 * refuse (ADR-044, ADR-047).
 */
export function motifRefusLigneMarge(texte: string): string | null {
  const propre = texte.trim();
  if (!propre) return "Une ligne de marge vide n'a rien à noter.";
  if (propre.length > LIGNE_MARGE_MAX) {
    return `Ligne trop longue : ${propre.length} caractères pour ${LIGNE_MARGE_MAX} au plus. La marge tient une phrase — le reste appartient à une note.`;
  }
  return null;
}

/**
 * Ajoute une ligne, sans doublon.
 *
 * Une même phrase déjà notée et **non traitée** n'est pas ré-empilée : une
 * double soumission, ou la même préoccupation notée deux fois dans la journée,
 * doit converger plutôt que de remplir la marge de copies. Une phrase identique
 * déjà cochée, en revanche, revient : le problème s'est reposé, et c'est un fait
 * neuf.
 */
export function ajouterLigneMarge(
  lignes: readonly LigneMarge[],
  texte: string,
  date = new Date().toISOString().slice(0, 10),
): LigneMarge[] {
  const propre = texte.trim().replace(/\s+/g, " ");
  if (lignes.some((ligne) => !ligne.faite && ligne.texte === propre)) return [...lignes];
  return [...lignes, { texte: propre, faite: false, notee: date }];
}

/**
 * Coche ou décoche une ligne. Un index hors bornes ne change rien et ne lève
 * pas : la liste a pu bouger entre l'affichage et le clic, et une marge n'est
 * pas un endroit où l'on veut voir une erreur.
 */
export function basculerLigneMarge(lignes: readonly LigneMarge[], index: number): LigneMarge[] {
  return lignes.map((ligne, position) =>
    position === index ? { ...ligne, faite: !ligne.faite } : ligne,
  );
}

/**
 * Retire une ligne.
 *
 * Une ligne de marge se supprime — ce n'est ni une observation, ni une tentative, ni
 * une mesure. C'est une note qu'on a prise pour soi, et P4 (« une faiblesse ne
 * disparaît pas sans nouvelle démonstration ») ne parle pas de cela : rien dans
 * le moteur ne lit la marge.
 */
export function retirerLigneMarge(lignes: readonly LigneMarge[], index: number): LigneMarge[] {
  return lignes.filter((_, position) => position !== index);
}
