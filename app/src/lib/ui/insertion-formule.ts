/**
 * Insertion d'un symbole de la palette dans un champ de texte brut.
 *
 * ## Pourquoi cette fonction existe
 *
 * La palette a d'abord été branchée sur le seul éditeur `contentEditable` de
 * l'Atelier. Or on écrit des mathématiques ailleurs, et surtout dans la
 * **fiche de saisie** — une zone de texte par section déclarée, la structure
 * de la création d'origine. Là, aucune palette : il fallait connaître LaTeX,
 * ou renoncer.
 *
 * Le DOM n'a rien à voir ici. Une zone de texte, c'est une chaîne et deux
 * index ; cette fonction est donc pure, et testable sans navigateur.
 *
 * ## Ce qu'elle garantit
 *
 * Le symbole tombe TOUJOURS dans une formule. Hors d'un `\(…\)`, un `\sigma`
 * nu n'est pas une formule pour `segmenterFormulesEnLigne` : le document le
 * garde tel quel et l'affiche tel quel. L'enveloppe est donc posée d'office
 * quand le curseur n'est pas déjà dans une formule.
 */

/** Les couples de délimiteurs que la palette sait poser et reconnaître. */
const OUVERTURES = ["\\(", "\\["] as const;
const FERMETURES = ["\\)", "\\]"] as const;

/**
 * Le curseur est-il à l'intérieur d'une formule ouverte ?
 *
 * Vrai si la dernière ouverture avant le curseur n'a pas été refermée. Le `$`
 * n'est pas considéré : `segmenterFormulesEnLigne` ne le reconnaît que sous
 * conditions (« payer 30$ puis 40$ » ne doit pas ouvrir une formule), et
 * traiter un montant comme une formule ouverte enfermerait le symbole dans du
 * texte qui n'en est pas une.
 */
export function curseurDansFormule(texte: string, position: number): boolean {
  const avant = texte.slice(0, position);
  const derniere = (delimiteurs: readonly string[]) =>
    delimiteurs.reduce((max, d) => Math.max(max, avant.lastIndexOf(d)), -1);
  return derniere(OUVERTURES) > derniere(FERMETURES);
}

/**
 * Écrit `latex` entre `debut` et `fin`, et rend le texte et la position du
 * curseur qui en résultent.
 *
 * `recul` est le nombre de caractères dont revenir depuis la fin de
 * l'insertion — `\frac{}{}` vaut 3, pour poser le curseur dans le numérateur.
 * Quand l'enveloppe vient d'être ajoutée, les deux caractères du `\)` fermant
 * s'y ajoutent : sans cela le curseur se poserait après la formule.
 */
export function insererFormuleDansTexte(
  texte: string,
  debut: number,
  fin: number,
  latex: string,
  recul: number,
): { texte: string; curseur: number } {
  /* `\(\)` et `\[\]` sont eux-mêmes des enveloppes : les envelopper à nouveau
     donnerait `\(\(\)\)`, que rien ne sait relire. */
  const estEnveloppe = /^\\[([]/.test(latex);
  const dedans = curseurDansFormule(texte, debut);

  const morceau = dedans || estEnveloppe ? latex : `\\(${latex}\\)`;
  const reculTotal = dedans || estEnveloppe ? recul : recul + 2;

  return {
    texte: texte.slice(0, debut) + morceau + texte.slice(fin),
    curseur: debut + morceau.length - reculTotal,
  };
}
