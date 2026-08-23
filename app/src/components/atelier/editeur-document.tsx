"use client";

import "katex/dist/katex.min.css";
import { useCallback, useEffect, useRef } from "react";
import { cx } from "@/components/ui/primitives";
import { separerFrontMatterEtCorps, markdownVersHtml, domVersMarkdown } from "@/lib/documents/wysiwyg-markdown";
import {
  ATTRIBUT_BLOC,
  ATTRIBUT_LATEX,
  ATTRIBUT_SOURCE,
  htmlNoeudFormule,
  htmlSourceFormule,
  relireSourceFormule,
  sourceFormule,
} from "@/lib/documents/formule-noeud";

export interface EditeurDirectProps {
  documentId: string;
  contenuInitialMd: string;
  contenuCharge: boolean;
  lectureSeule: boolean;
  onSynchroniser: (nouveauMarkdownCorps: string) => void;
  onRaccourci: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  onSelectionChange?: () => void;
  onOuvrirWikilien?: (cible: string) => void;
  ref?: React.Ref<HTMLDivElement | null>;
}

/** Remplace un élément par un fragment HTML, et rend le nœud créé. */
function remplacerParHtml(cible: HTMLElement, html: string): Element | null {
  const gabarit = document.createElement("template");
  gabarit.innerHTML = html;
  const nouveau = gabarit.content.firstElementChild;
  if (!nouveau) return null;
  cible.replaceWith(nouveau);
  return nouveau;
}

/** Pose le curseur à la fin du contenu d'un élément. */
function curseurEnFinDe(element: Element) {
  const selection = window.getSelection();
  if (!selection) return;
  const plage = document.createRange();
  plage.selectNodeContents(element);
  plage.collapse(false);
  selection.removeAllRanges();
  selection.addRange(plage);
}

/** Pose le curseur juste après un nœud atomique. */
function curseurApres(noeud: Node) {
  const selection = window.getSelection();
  if (!selection) return;
  const plage = document.createRange();
  plage.setStartAfter(noeud);
  plage.collapse(true);
  selection.removeAllRanges();
  selection.addRange(plage);
}

/**
 * Éditeur direct ContentEditable synchronisé avec le Markdown.
 *
 * Le DOM n'est réinitialisé que lorsqu'un contenu externe diffère du contenu
 * affiché (annulation, retour de snapshot, rechargement). Quand l'utilisateur
 * tape, le brouillon est mis à jour avec la sérialisation du DOM lui-même —
 * les deux correspondent, on ne réinitialise pas.
 *
 * ## Les formules (23/08/2026)
 *
 * Une fiche ressource n'a pas de vue rendue : son corps ne passe que par ici.
 * Les formules y restaient donc à l'état de source — on écrivait `\sqrt{}` et
 * on lisait `\sqrt{}`, KaTeX n'étant branché que sur l'aperçu de snapshot.
 *
 * Elles sont désormais **composées sur place**, en nœuds atomiques
 * (`contenteditable="false"`, LaTeX en attribut). Le va-et-vient tient en deux
 * règles :
 *
 *  - un clic sur une formule composée la **rouvre en source** ;
 *  - toute source que le curseur a quittée se **recompose**.
 *
 * Aucun état React là-dedans : l'appartenance du curseur se lit dans le DOM à
 * chaque mouvement. Deux formules ouvertes en même temps sont donc impossibles
 * sans qu'on ait à le garantir.
 */
export function EditeurDirect({
  documentId,
  contenuInitialMd,
  contenuCharge,
  lectureSeule,
  onSynchroniser,
  onRaccourci,
  onSelectionChange,
  onOuvrirWikilien,
  ref,
}: EditeurDirectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const setRef = useCallback(
    (el: HTMLDivElement | null) => {
      containerRef.current = el;
      if (typeof ref === "function") {
        ref(el);
      } else if (ref) {
        ref.current = el;
      }
    },
    [ref],
  );

  useEffect(() => {
    if (!containerRef.current || !contenuCharge) return;
    const corpsEntrant = separerFrontMatterEtCorps(contenuInitialMd).corps.trim();
    const corpsDom = domVersMarkdown(containerRef.current).trim();
    if (corpsDom === corpsEntrant) return;
    containerRef.current.innerHTML = markdownVersHtml(corpsEntrant);
  }, [documentId, contenuCharge, contenuInitialMd]);

  const handleInput = useCallback(() => {
    if (!containerRef.current) return;
    const mdCorps = domVersMarkdown(containerRef.current);
    onSynchroniser(mdCorps);
    onSelectionChange?.();
  }, [onSynchroniser, onSelectionChange]);

  /**
   * Recompose une source éditée.
   *
   * Si le texte n'est plus une formule — un délimiteur effacé, tout remplacé
   * par de la prose — il ressort **nu**, jamais supprimé : une frappe ne doit
   * pas faire disparaître ce qui est écrit.
   */
  const refermerSource = useCallback(
    (span: HTMLElement) => {
      const texte = span.textContent ?? "";
      const relue = relireSourceFormule(texte);
      if (!relue) {
        const nu = document.createTextNode(texte);
        span.replaceWith(nu);
        curseurApres(nu);
        return;
      }
      const noeud = remplacerParHtml(span, htmlNoeudFormule(relue.latex, relue.bloc));
      if (noeud) curseurApres(noeud);
    },
    [],
  );

  /** Referme toutes les sources que le curseur a quittées. */
  const refermerSourcesInactives = useCallback(() => {
    const racine = containerRef.current;
    if (!racine) return;
    const ouvertes = racine.querySelectorAll<HTMLElement>(`[${ATTRIBUT_SOURCE}]`);
    if (ouvertes.length === 0) return;
    const ancre = window.getSelection()?.anchorNode ?? null;
    let modifie = false;
    for (const span of ouvertes) {
      if (ancre && span.contains(ancre)) continue;
      refermerSource(span);
      modifie = true;
    }
    if (modifie) handleInput();
  }, [handleInput, refermerSource]);

  /** Rouvre une formule composée en source éditable. */
  const ouvrirFormule = useCallback(
    (noeud: HTMLElement) => {
      const latex = noeud.getAttribute(ATTRIBUT_LATEX) ?? "";
      const source = sourceFormule(latex, noeud.getAttribute(ATTRIBUT_BLOC) === "1");
      const span = remplacerParHtml(noeud, htmlSourceFormule(source));
      if (span) curseurEnFinDe(span);
      handleInput();
    },
    [handleInput],
  );

  /*
   * Le curseur bouge aussi sans clic ni frappe — glisser une sélection,
   * `Ctrl+A`, la molette avec le focus dans un mot. `selectionchange` est le
   * seul événement qui les couvre tous ; il est global, donc filtré sur notre
   * racine.
   */
  useEffect(() => {
    if (lectureSeule) return;
    function surSelection() {
      const racine = containerRef.current;
      const ancre = window.getSelection()?.anchorNode ?? null;
      if (!racine || !ancre || !racine.contains(ancre)) return;
      refermerSourcesInactives();
    }
    document.addEventListener("selectionchange", surSelection);
    return () => document.removeEventListener("selectionchange", surSelection);
  }, [lectureSeule, refermerSourcesInactives]);

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null;

      const formule = target?.closest?.(`[${ATTRIBUT_LATEX}]`) as HTMLElement | null;
      if (formule && !lectureSeule) {
        event.preventDefault();
        ouvrirFormule(formule);
        return;
      }

      onSelectionChange?.();
      const badge = target?.closest?.("[data-wikilien]") as HTMLElement | null;
      if (badge && onOuvrirWikilien) {
        const cible = badge.getAttribute("data-wikilien");
        if (cible) {
          event.preventDefault();
          onOuvrirWikilien(cible);
        }
      }
    },
    [lectureSeule, onOuvrirWikilien, onSelectionChange, ouvrirFormule],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      /* Échap referme la formule en cours plutôt que de laisser l'événement
         fermer le panneau qui héberge l'éditeur. */
      if (event.key === "Escape") {
        const ancre = window.getSelection()?.anchorNode ?? null;
        const ouverte =
          ancre instanceof Node
            ? ((ancre.nodeType === 1 ? (ancre as Element) : ancre.parentElement)?.closest(
                `[${ATTRIBUT_SOURCE}]`,
              ) as HTMLElement | null)
            : null;
        if (ouverte) {
          event.preventDefault();
          event.stopPropagation();
          refermerSource(ouverte);
          handleInput();
          return;
        }
      }
      onRaccourci(event);
    },
    [handleInput, onRaccourci, refermerSource],
  );

  return (
    <div
      ref={setRef}
      contentEditable={!lectureSeule}
      suppressContentEditableWarning
      onInput={handleInput}
      onBlur={() => {
        /* Sortir du champ referme tout : on ne laisse jamais une source
           ouverte dans un document qu'on vient de quitter. */
        const racine = containerRef.current;
        if (racine) {
          for (const span of racine.querySelectorAll<HTMLElement>(`[${ATTRIBUT_SOURCE}]`)) {
            refermerSource(span);
          }
        }
        handleInput();
        onSelectionChange?.();
      }}
      onKeyUp={onSelectionChange}
      onMouseUp={onSelectionChange}
      onClick={handleClick}
      onFocus={onSelectionChange}
      onKeyDown={handleKeyDown}
      className={cx("prose-exo min-h-full w-full px-5 pb-5 pt-7 sm:px-6 sm:pb-6 sm:pt-8 outline-none", !lectureSeule && "cursor-text")}
    />
  );
}
