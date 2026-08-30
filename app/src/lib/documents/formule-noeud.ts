import { echapperHtml } from "@/lib/documents/echappement-html";
import { segmenterFormulesEnLigne } from "@/lib/ui/formule";
import { rendreFormule } from "@/lib/ui/rendu-formule";

/**
 * Les formules dans l'éditeur WYSIWYG : composées, et réouvrables.
 *
 * ## Le défaut que ce module corrige (23/08/2026)
 *
 * Une fiche ressource n'a **pas** de vue rendue : son corps ne passe que par
 * `EditeurDirect`, un `contentEditable`. `<Markdown>` — donc KaTeX — n'y était
 * branché que sur l'aperçu d'un snapshot. Autrement dit, dans une fiche
 * ressource, aucune formule n'a jamais été composée : on lisait la source.
 *
 * Pire, `formaterEnLigneVersHtml` appliquait l'emphase Markdown **à
 * l'intérieur** du LaTeX. `*` est un opérateur en mathématiques et un
 * délimiteur d'italique en Markdown :
 *
 *     SS = k*\sigma*\sqrt{}*(L)   →   SS = k<em>\sigma</em>\sqrt{}*(L)
 *
 * `components/ui/markdown.tsx` segmente les formules AVANT l'emphase pour
 * cette raison exacte, et le note. Le chemin WYSIWYG ne le faisait pas.
 *
 * ## Le modèle retenu
 *
 * Une formule est un **nœud atomique** : `contenteditable="false"`, porteur de
 * son LaTeX d'origine en attribut. Le curseur passe devant ou derrière, jamais
 * dedans — le texte composé par KaTeX n'est pas de la matière éditable.
 *
 * Un clic **rouvre** le nœud en source (`[data-formule-source]`), et sortir le
 * curseur le recompose. La source affichée est celle d'origine, délimiteurs
 * compris : ce qui revient au Markdown est exactement ce qui en venait.
 *
 * Ce module ne touche pas au DOM ; il produit et lit des chaînes. Le va-et-vient
 * est piloté par `components/atelier/editeur-document.tsx`.
 */

/** Classe du nœud composé. Le CSS l'habille, l'éditeur le repère. */
export const CLASSE_NOEUD_FORMULE = "formule-noeud";

/** Classe du nœud rouvert en source, le temps qu'on l'édite. */
export const CLASSE_SOURCE_FORMULE = "formule-source";

/** Attribut portant le LaTeX d'origine, seul état durable du nœud composé. */
export const ATTRIBUT_LATEX = "data-latex";

/** Attribut marquant une formule hors-ligne (`\[…\]`) plutôt qu'en ligne. */
export const ATTRIBUT_BLOC = "data-bloc";

/** Attribut du nœud en cours d'édition — c'est lui que l'éditeur referme. */
export const ATTRIBUT_SOURCE = "data-formule-source";

/**
 * Le HTML d'un nœud de formule composé.
 *
 * `throwOnError: true` + repli : une formule que KaTeX refuse retombe sur le
 * texte Unicode de `latexVersTexte`, jamais sur un message d'erreur rouge ni
 * sur du vide — même contrat que `FormuleMath`.
 */
export function htmlNoeudFormule(latex: string, bloc: boolean): string {
  const { html, texteAccessible } = rendreFormule(latex, bloc);
  const texte = echapperHtml(texteAccessible);
  const corps = html === null
    ? `<span class="formule">${texte}</span>`
    : `<span aria-hidden="true">${html}</span>`;
  return (
    `<span class="${CLASSE_NOEUD_FORMULE}" role="math" aria-label="${texte}" contenteditable="false"` +
    ` ${ATTRIBUT_LATEX}="${echapperHtml(latex)}" ${ATTRIBUT_BLOC}="${bloc ? "1" : "0"}">` +
    `${corps}</span>`
  );
}

/**
 * La source Markdown d'une formule, délimiteurs compris.
 *
 * Toujours `\(…\)` ou `\[…\]`, jamais `$…$` : le dollar n'est reconnu par
 * `segmenterFormulesEnLigne` que sous conditions (un montant en euros ne doit
 * pas ouvrir une formule), et le réécrire risquerait de rendre au document une
 * formule que la relecture suivante ne reconnaîtrait plus.
 */
export function sourceFormule(latex: string, bloc: boolean): string {
  return bloc ? `\\[${latex}\\]` : `\\(${latex}\\)`;
}

/**
 * Le HTML d'une formule rouverte en source, prête à être tapée.
 *
 * Pas de `contenteditable="false"` ici : c'est justement le moment où le texte
 * redevient de la matière.
 */
export function htmlSourceFormule(source: string): string {
  return (
    `<span class="${CLASSE_SOURCE_FORMULE}" ${ATTRIBUT_SOURCE}="">` +
    `${echapperHtml(source)}</span>`
  );
}

/**
 * Relit un texte de source et rend de quoi reconstruire le nœud composé.
 *
 * Rend `null` si le texte n'est plus une formule — on a effacé un délimiteur,
 * ou tout remplacé par de la prose. L'appelant rend alors le texte nu : une
 * frappe ne doit jamais faire disparaître ce qui est écrit.
 */
export function relireSourceFormule(source: string): { latex: string; bloc: boolean } | null {
  const segment = segmenterFormulesEnLigne(source).find((s) => s.formule);
  if (!segment?.latex) return null;
  return { latex: segment.latex, bloc: /^\s*\\\[/.test(source) };
}
