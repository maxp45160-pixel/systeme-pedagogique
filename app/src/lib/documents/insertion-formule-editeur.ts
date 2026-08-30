import { htmlNoeudFormule } from "@/lib/documents/formule-noeud";

/**
 * Insère une formule composée dans un éditeur ContentEditable.
 *
 * La formule devient immédiatement un nœud atomique : le texte LaTeX reste
 * dans `data-latex`, mais n'est jamais présenté comme contenu de la zone.
 * Un clic sur le nœud permet toujours de rouvrir sa source dans l'éditeur.
 */
export function insererFormuleDansEditeur(
  editeur: HTMLElement | null,
  latex: string,
  recul: number,
): void {
  if (!editeur) return;
  editeur.focus();

  const selection = window.getSelection();
  if (!selection || !selection.rangeCount || !editeur.contains(selection.anchorNode)) {
    const plage = document.createRange();
    plage.selectNodeContents(editeur);
    plage.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(plage);
  }

  const ancre = selection?.anchorNode ?? null;
  const element =
    ancre === null ? null : ancre.nodeType === 1 ? (ancre as Element) : ancre.parentElement;
  const dejaDansUneFormule = element?.closest("[data-formule-source]") != null;
  const estEnveloppe = /^\\[([]/.test(latex);

  /* Dans une formule déjà ouverte, l'utilisateur édite volontairement la
     source : on conserve donc le comportement texte et le recul des curseurs.
     Dans la prose, l'insertion est immédiatement composée. */
  if (dejaDansUneFormule) {
    document.execCommand("insertText", false, latex);
    const curseur = window.getSelection();
    for (let pas = 0; pas < recul; pas++) {
      curseur?.modify("move", "backward", "character");
    }
  } else {
    /* Une enveloppe est une formule vide, pas une formule dont le LaTeX
       contiendrait littéralement `\(` et `\)`. Sinon la sérialisation
       produirait `\(\(\)\)` au prochain envoi. */
    const corps = estEnveloppe ? "" : latex;
    const bloc = estEnveloppe && latex.startsWith("\\[");
    document.execCommand("insertHTML", false, htmlNoeudFormule(corps, bloc));
  }

  editeur.dispatchEvent(new Event("input", { bubbles: true }));
}
