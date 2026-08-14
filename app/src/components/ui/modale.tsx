"use client";

/**
 * La modale — une seule, pour les sept qui existaient (audit §1.4d).
 *
 * ## Ce qui était dupliqué
 *
 * Sept composants répétaient la même chaîne d'overlay et le même panneau, au
 * caractère près, avec le même ✕ recopié sept fois. Une seule utilisait un
 * portail. Et surtout, **aucune** ne gérait `Échap`, ne piégeait le focus, ni
 * ne le restituait à la fermeture : au clavier, la tabulation sortait derrière
 * l'overlay et l'on se retrouvait à parcourir une page qu'on ne voyait plus.
 *
 * Ce n'est pas une préférence de style. `role="dialog" aria-modal="true"` est
 * une **promesse** faite aux technologies d'assistance : ce qui est derrière
 * n'existe plus. Sept composants la faisaient sans la tenir.
 *
 * ## Ce que la primitive garantit
 *
 * - `Échap` ferme, où que soit le focus.
 * - Le focus entre dans la modale à l'ouverture, y reste en boucle, et revient
 *   à l'élément qui l'avait déclenchée à la fermeture.
 * - Le rendu passe par un **portail** sur `document.body` : sans lui, un parent
 *   avec `transform`, `filter` ou `contain` redéfinit le référentiel de
 *   `position: fixed`, et l'overlay se retrouve cadré dans sa carte.
 * - Le clic sur le fond ferme, le clic dans le panneau non.
 *
 * - Le défilement de l'arrière-plan est bloqué, en compensant la largeur de la
 *   barre de défilement : sans cette compensation la page saute latéralement à
 *   chaque ouverture, un remède plus visible que le mal.
 *
 * ## Trois zones, un seul défilement
 *
 * Le panneau ne défile pas ; son corps, oui. L'en-tête et le pied restent
 * visibles quelle que soit la hauteur du contenu.
 *
 * C'est le défaut qu'on vient de corriger : `overflow-y-auto` était posé sur le
 * panneau entier, si bien que le titre disparaissait vers le haut et que les
 * boutons de validation attendaient tout en bas du défilement. Chaque appelant
 * recopiait alors son propre pied (`border-t border-bordure pt-3` + `flex
 * justify-end gap-2`) — la duplication que la primitive était censée supprimer.
 * D'où la prop `pied` : les actions se déclarent, elles ne se remettent plus en
 * page.
 */

import { useCallback, useEffect, useId, useRef, type ReactNode } from "react";
import { useEstHydrate } from "@/lib/ui/hydratation";
import { createPortal } from "react-dom";
import { cx } from "./primitives";

/** Ce qui peut recevoir le focus au clavier, dans l'ordre du document. */
const FOCUSABLES = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export type LargeurModale = "md" | "xl" | "2xl" | "3xl" | "4xl";

const LARGEURS: Record<LargeurModale, string> = {
  md: "max-w-md",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
};

/**
 * Où le panneau se pose.
 *
 * `laterale` est le tiroir du tuteur : collé au bord droit, pleine hauteur,
 * sans marge. Une variante nommée plutôt qu'un empilement de classes chez
 * l'appelant — sinon la « modale unique » redevient deux coquilles, ce qu'on
 * vient de défaire.
 */
export type PositionModale = "centree" | "laterale";

export function Modale({
  titre,
  sousTitre,
  onFermer,
  largeur = "2xl",
  position = "centree",
  children,
  pied,
  className,
}: {
  /** Sert de titre visible ET de nom accessible — les deux ne peuvent pas diverger. */
  titre: string;
  sousTitre?: ReactNode;
  onFermer: () => void;
  largeur?: LargeurModale;
  position?: PositionModale;
  children: ReactNode;
  /**
   * Barre d'actions, tenue hors du défilement.
   *
   * Les boutons y sont alignés à droite et espacés : l'appelant fournit les
   * boutons, pas leur mise en page.
   */
  pied?: ReactNode;
  className?: string;
}) {
  const panneauRef = useRef<HTMLDivElement>(null);
  const idTitre = useId();

  /*
   * `createPortal` exige `document`, absent au rendu serveur. `useEstHydrate`
   * plutôt qu'un `useState` posé dans un effet : c'est l'utilitaire du dépôt
   * pour exactement ce cas, et il évite la cascade de rendus que
   * `react-hooks/set-state-in-effect` interdit.
   */
  const monte = useEstHydrate();

  /*
   * Restitution du focus.
   *
   * Mémorisé au montage, rendu au démontage. Sans cela, fermer une modale
   * laisse le focus sur `<body>` : la tabulation suivante repart du haut de la
   * page, et l'on a perdu l'endroit où l'on travaillait.
   */
  useEffect(() => {
    const declencheur = document.activeElement as HTMLElement | null;
    return () => declencheur?.focus?.();
  }, []);

  /*
   * Blocage du défilement de fond.
   *
   * La compensation vaut la largeur de la barre de défilement : la masquer sans
   * rendre sa place décale toute la page vers la droite à l'ouverture. Les
   * valeurs d'origine sont relues puis restituées telles quelles, pour qu'une
   * modale ouverte au-dessus d'une autre rende bien `hidden` en se fermant.
   */
  useEffect(() => {
    const compensation = window.innerWidth - document.documentElement.clientWidth;
    const { overflow, paddingRight } = document.body.style;
    document.body.style.overflow = "hidden";
    if (compensation > 0) document.body.style.paddingRight = `${compensation}px`;
    return () => {
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
    };
  }, []);

  // Le focus entre dans la modale — sur le panneau lui-même si rien d'autre
  // n'est focalisable, pour que `Échap` et la tabulation partent d'ici.
  useEffect(() => {
    const panneau = panneauRef.current;
    if (!panneau) return;
    const premier = panneau.querySelector<HTMLElement>(FOCUSABLES);
    (premier ?? panneau).focus();
  }, [monte]);

  const surTouche = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onFermer();
        return;
      }
      if (e.key !== "Tab") return;

      const panneau = panneauRef.current;
      if (!panneau) return;
      const cibles = [...panneau.querySelectorAll<HTMLElement>(FOCUSABLES)].filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (cibles.length === 0) {
        e.preventDefault();
        return;
      }

      const premier = cibles[0];
      const dernier = cibles[cibles.length - 1];
      // La boucle : sortir par le bas revient au début, et inversement.
      if (!e.shiftKey && document.activeElement === dernier) {
        e.preventDefault();
        premier.focus();
      } else if (e.shiftKey && document.activeElement === premier) {
        e.preventDefault();
        dernier.focus();
      }
    },
    [onFermer],
  );

  useEffect(() => {
    document.addEventListener("keydown", surTouche);
    return () => document.removeEventListener("keydown", surTouche);
  }, [surTouche]);

  if (!monte) return null;

  return createPortal(
    <div
      className={cx(
        "fixed inset-0 z-50 flex bg-black/40 backdrop-blur-sm",
        position === "laterale"
          ? "justify-end"
          : "items-center justify-center p-4",
      )}
      onClick={onFermer}
    >
      <div
        ref={panneauRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitre}
        tabIndex={-1}
        className={cx(
          "flex w-full flex-col overflow-hidden border border-bordure",
          "bg-surface text-left text-texte shadow-[var(--ombre-surcouche)]",
          position === "laterale"
            ? "h-full border-y-0 border-r-0"
            : "max-h-[90vh] rounded-xl",
          LARGEURS[largeur],
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-bordure px-5 py-4">
          <div className="min-w-0">
            <h2 id={idTitre} className="font-serif text-base font-medium">
              {titre}
            </h2>
            {sousTitre && <p className="mt-0.5 text-xs text-texte-discret">{sousTitre}</p>}
          </div>
          <button
            type="button"
            onClick={onFermer}
            aria-label="Fermer"
            className="shrink-0 rounded-md px-2 py-1 text-sm text-texte-attenue transition-colors hover:bg-surface-2 hover:text-texte"
          >
            ✕
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-4">{children}</div>

        {pied && (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-bordure px-5 py-3">
            {pied}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
