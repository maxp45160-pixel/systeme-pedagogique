"use client";

/**
 * La modale — une seule, pour les sept qui existaient (audit §1.4d).
 *
 * ## Ce qui était dupliqué
 *
 * Sept composants répétaient la même chaîne d'overlay et le même panneau, au
 * caractère près, avec le même caractère de fermeture recopié sept fois. Une
 * seule utilisait un
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
import { cx, Filigrane } from "./primitives";
import { IconeFermer } from "./icones";

import { bloquerDefilement, ciblesTabulation, modaleSuperieure } from "@/lib/ui/modales";

export type LargeurModale = "md" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "6xl";

const LARGEURS: Record<LargeurModale, string> = {
  md: "max-w-md",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
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
  masquee = false,
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
  /**
   * Garder le contenu monté mais invisible.
   *
   * Sert au tiroir du tuteur : fermer la fenêtre pendant que le modèle rédige
   * ne doit ni démonter le chat ni couper le flux SSE. La modale reste rendue,
   * masquée (`display:none`), sans piège de focus ni blocage de défilement ; le
   * contenu poursuit son travail en arrière-plan et se retrouve tel quel à la
   * réouverture.
   */
  masquee?: boolean;
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

  // Une période visible possède son déclencheur, même si le chat reste monté.
  useEffect(() => {
    if (!monte || masquee) return;
    const panneau = panneauRef.current;
    if (!panneau) return;
    const declencheur = document.activeElement as HTMLElement | null;
    const designe = panneau.querySelector<HTMLElement>("[data-focus-initial]");
    (designe ?? ciblesTabulation(panneau)[0] ?? panneau).focus();
    // Un appelant peut désigner un conteneur non focalisable.
    if (!panneau.contains(document.activeElement)) {
      (ciblesTabulation(panneau)[0] ?? panneau).focus();
    }
    return () => {
      requestAnimationFrame(() => {
        const superieure = modaleSuperieure();
        if (declencheur?.isConnected && (!superieure || superieure.contains(declencheur))) {
          declencheur.focus();
        }
      });
    };
  }, [monte, masquee]);

  useEffect(() => {
    if (!monte || masquee) return;
    return bloquerDefilement();
  }, [monte, masquee]);

  const surTouche = useCallback(
    (e: KeyboardEvent) => {
      const panneau = panneauRef.current;
      if (!panneau || e.defaultPrevented || modaleSuperieure() !== panneau) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onFermer();
        return;
      }
      if (e.key !== "Tab") return;

      const cibles = ciblesTabulation(panneau);
      if (cibles.length === 0) {
        e.preventDefault();
        panneau.focus();
        return;
      }

      const premier = cibles[0];
      const dernier = cibles[cibles.length - 1];
      // Une cible statique désignée à l'ouverture n'appartient pas à la boucle.
      if (!cibles.includes(document.activeElement as HTMLElement)) {
        e.preventDefault();
        (e.shiftKey ? dernier : premier).focus();
      } else if (!e.shiftKey && document.activeElement === dernier) {
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
    if (masquee) return;
    document.addEventListener("keydown", surTouche);
    return () => document.removeEventListener("keydown", surTouche);
  }, [surTouche, masquee]);

  if (!monte) return null;

  return createPortal(
    <div
      className={cx(
        "fixed inset-0 z-[var(--superposition-modale)] flex bg-black/40 backdrop-blur-sm",
        position === "laterale"
          ? "justify-end"
          : "items-center justify-center p-4",
      )}
      style={masquee ? { display: "none" } : undefined}
      aria-hidden={masquee || undefined}
      onClick={masquee ? undefined : onFermer}
    >
      <div
        ref={panneauRef}
        role="dialog"
        data-modale-active={!masquee ? "true" : undefined}
        aria-modal="true"
        aria-labelledby={idTitre}
        tabIndex={-1}
        className={cx(
          "relative isolate flex w-full flex-col overflow-hidden border border-bordure",
          "bg-surface text-left text-texte shadow-[var(--ombre-surcouche)]",
          position === "laterale"
            ? "h-full border-y-0 border-r-0"
            : "max-h-[90vh] rounded-xl",
          LARGEURS[largeur],
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/*
         * Le tiroir latéral (le tuteur) porte la feuille en filigrane :
         * un seul geste décoratif, ancré au coin haut-droit de l'en-tête,
         * derrière tout le contenu (`isolate` + `-z-10`).
         */}
        {position === "laterale" && (
          <Filigrane className="bottom-auto -top-10 -right-6 -z-10 size-40" />
        )}
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
            <IconeFermer className="size-4" />
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
