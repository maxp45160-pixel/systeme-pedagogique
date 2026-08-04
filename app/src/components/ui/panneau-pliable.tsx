"use client";

import { useState, type ReactNode } from "react";
import { Carte, cx } from "@/components/ui/primitives";

/**
 * Une carte dont l'en-tête plie et déplie le contenu.
 *
 * Deux règles, et la seconde est celle qui a motivé le composant :
 *
 *  - **le titre seul est le bouton de repli** — les actions du panneau sont des
 *    boutons voisins, jamais imbriqués dans lui : un bouton dans un bouton
 *    n'est pas du HTML valide, et le clic y devient ambigu ;
 *  - **l'en-tête reste lisible déplié** — fond propre et position collante. Un
 *    panneau ouvert de seize lignes perdait le nom du domaine hors de l'écran,
 *    et replier n'aide pas si l'on ne sait plus ce qu'on est en train de lire.
 *
 * L'état d'ouverture est interne et volatile : rien n'est persisté, donc pas de
 * clé de stockage navigateur, donc pas de question de cloisonnement par compte
 * (ADR-029).
 */
export function PanneauPliable({
  titre,
  actions,
  sousEntete,
  ouvertParDefaut = true,
  children,
  pied,
}: {
  /** Contenu cliquable de l'en-tête : nom, étiquettes, compteurs. */
  titre: ReactNode;
  /** Boutons du panneau, rendus à côté du titre et hors du bouton de repli. */
  actions?: ReactNode;
  /** Rendu sous la ligne de titre, dans le bloc collant : description, avertissement. */
  sousEntete?: ReactNode;
  ouvertParDefaut?: boolean;
  children: ReactNode;
  /** Rendu après le contenu, et seulement quand le panneau est ouvert. */
  pied?: ReactNode;
}) {
  const [ouvert, setOuvert] = useState(ouvertParDefaut);

  return (
    <Carte>
      <div className="sticky top-0 z-[1] rounded-t-carte border-b border-bordure bg-surface px-4 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setOuvert((o) => !o)}
            aria-expanded={ouvert}
            className="flex min-w-0 flex-wrap items-center gap-2 text-left"
          >
            <span
              aria-hidden
              className={cx(
                "text-[0.625rem] text-texte-discret transition-transform",
                ouvert ? "rotate-0" : "-rotate-90",
              )}
            >
              ▼
            </span>
            {titre}
          </button>
          {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
        </div>
        {sousEntete}
      </div>

      {ouvert && children}
      {ouvert && pied}
    </Carte>
  );
}
