"use client";

import { useCallback, useEffect, useRef } from "react";
import { cx } from "@/components/ui/primitives";
import { separerFrontMatterEtCorps, markdownVersHtml, domVersMarkdown } from "@/lib/documents/wysiwyg-markdown";

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

/**
 * Éditeur direct ContentEditable synchronisé avec le Markdown.
 *
 * Le DOM n'est réinitialisé que lorsqu'un contenu externe diffère du contenu
 * affiché (annulation, retour de snapshot, rechargement). Quand l'utilisateur
 * tape, le brouillon est mis à jour avec la sérialisation du DOM lui-même —
 * les deux correspondent, on ne réinitialise pas.
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

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      onSelectionChange?.();
      const target = event.target as HTMLElement | null;
      const badge = target?.closest?.("[data-wikilien]") as HTMLElement | null;
      if (badge && onOuvrirWikilien) {
        const cible = badge.getAttribute("data-wikilien");
        if (cible) {
          event.preventDefault();
          onOuvrirWikilien(cible);
        }
      }
    },
    [onSelectionChange, onOuvrirWikilien],
  );

  return (
    <div
      ref={setRef}
      contentEditable={!lectureSeule}
      suppressContentEditableWarning
      onInput={handleInput}
      onBlur={() => {
        handleInput();
        onSelectionChange?.();
      }}
      onKeyUp={onSelectionChange}
      onMouseUp={onSelectionChange}
      onClick={handleClick}
      onFocus={onSelectionChange}
      onKeyDown={onRaccourci}
      className={cx("prose-exo min-h-full w-full px-5 pb-5 pt-7 sm:px-6 sm:pb-6 sm:pt-8 outline-none", !lectureSeule && "cursor-text")}
    />
  );
}