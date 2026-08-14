/**
 * Les lignes qu'une séance inscrit dans sa fiche.
 *
 * Le journal d'une note opérationnelle est écrit par le système, pas saisi.
 * Il reste néanmoins du Markdown ordinaire : le fichier exporté doit se lire
 * sans l'application, et rester modifiable à la main si besoin.
 *
 * D'où le préfixe explicite (`Exercice :`, `Compétence :`). Sans lui, une ligne
 * ne dit pas ce qu'elle désigne : `- [[LOG-1]]` et `- [[ex-1]]` se ressemblent,
 * et l'affichage devrait deviner. Deviner sur un identifiant, c'est se tromper
 * le jour où un code de compétence ressemble à un identifiant d'exercice.
 */

export type GenreLigneJournal = "exercice" | "competence" | "texte";

export interface LigneJournal {
  genre: GenreLigneJournal;
  /** Cible du wikilien, pour les genres `exercice` et `competence`. */
  cible?: string;
  /** Libellé lisible, présent pour un exercice. */
  libelle?: string;
  /** La ligne d'origine, seule information disponible pour le genre `texte`. */
  texte: string;
}

const PREFIXE_EXERCICE = "Exercice :";
const PREFIXE_COMPETENCE = "Compétence :";

export function ligneExerciceSeance(ref: string, libelle: string): string {
  return `- ${PREFIXE_EXERCICE} [[${ref}]] — ${libelle}`;
}

export function ligneCompetenceSeance(code: string): string {
  return `- ${PREFIXE_COMPETENCE} [[${code}]]`;
}

const MOTIF_EXERCICE = /^-\s*Exercice\s*:\s*\[\[([^\]]+)\]\]\s*(?:—\s*(.*))?$/;
const MOTIF_COMPETENCE = /^-\s*Compétence\s*:\s*\[\[([^\]]+)\]\]\s*$/;

/**
 * Relit une ligne de journal.
 *
 * Une ligne qu'on ne reconnaît pas est rendue telle quelle, jamais écartée :
 * la personne peut avoir écrit dans cette section, et faire disparaître ce
 * qu'on ne comprend pas serait effacer son travail sans le dire.
 */
export function analyserLigneJournal(ligne: string): LigneJournal {
  const texte = ligne.trim();

  const exercice = MOTIF_EXERCICE.exec(texte);
  if (exercice) {
    return {
      genre: "exercice",
      cible: exercice[1].trim(),
      libelle: exercice[2]?.trim() || exercice[1].trim(),
      texte,
    };
  }

  const competence = MOTIF_COMPETENCE.exec(texte);
  if (competence) return { genre: "competence", cible: competence[1].trim(), texte };

  return { genre: "texte", texte };
}

export function analyserJournal(corps: string): LigneJournal[] {
  return corps
    .split("\n")
    .map((ligne) => ligne.trim())
    .filter((ligne) => ligne.length > 0)
    .map(analyserLigneJournal);
}
